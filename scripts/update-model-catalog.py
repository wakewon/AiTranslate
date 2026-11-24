#!/usr/bin/env python3
"""Refresh public model metadata. Use --check for offline validation."""
import argparse
import json
import os
import re
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timezone
from pathlib import Path
from urllib import request
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = ROOT / "data/model-catalog.json"
MODEL_ID = re.compile(r"~?[a-zA-Z0-9][a-zA-Z0-9_:.~/+-]{0,159}")
PARAMETER = re.compile(r"[a-z][a-z0-9_]{0,90}")
MAX_BYTES = 20 * 1024 * 1024


def fetch(url):
    req = request.Request(url, headers={"User-Agent": "AiTranslate-model-catalog/1"})
    for attempt in range(3):
        try:
            with request.urlopen(req, timeout=25) as response:
                data = response.read(MAX_BYTES + 1)
            if len(data) > MAX_BYTES:
                raise ValueError("response exceeded size limit")
            return data.decode("utf-8")
        except (OSError, URLError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def model(model_id, context, output, parameters=()):
    return {"id": model_id, "contextLength": context, "maxOutputTokens": output,
            "parameters": sorted(set(parameters))}


def openrouter(url):
    page = json.loads(fetch(url))
    if page.get("links", {}).get("next") or page.get("total_count", len(page["data"])) != len(page["data"]):
        raise ValueError("incomplete OpenRouter catalog (check pagination)")
    for item in page["data"]:
        modalities = item["architecture"]
        if ("text" in modalities["input_modalities"] and "text" in modalities["output_modalities"]
                and "/api/v1/chat/completions" in item["endpoints"]):
            yield model(item["id"], item["context_length"], item["top_provider"]["max_completion_tokens"],
                        item["supported_parameters"])


def bilibili(url):
    # This endpoint also lists dubbing and speech models. Only publish the translation family.
    for item in json.loads(fetch(url))["data"]:
        if (item["type"] == "chat" and item["id"].startswith("Index-Translate-")
                and "text" in item["input_modalities"] and "text" in item["output_modalities"]):
            yield model(item["id"], item.get("context_length"), item.get("max_output_tokens"))


def aihubmix(url):
    page = json.loads(fetch(url))
    if page["success"] is not True:
        raise ValueError("AIHubMix did not return a successful catalog")
    for item in page["data"]:
        if (item["retire_stage"] == "active" and "chat_completions" in item["endpoints"].split(",")
                and "text" in (item["input_modalities"] or "").split(",")
                and "text" in (item["output_modalities"] or "").split(",")):
            yield model(item["model_id"], item["context_length"] or None, item["max_output"] or None)


def cells(line):
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def token_limit(value):
    match = re.fullmatch(r"(?:MAXIMUM:\s*)?([0-9]+)([KM]?)\s*(?:tokens)?", value)
    if not match:
        raise ValueError(f"unrecognized token limit: {value!r}")
    number, suffix = match.groups()
    return int(number) * {"": 1, "K": 1000, "M": 1000000}[suffix]


def anthropic(url):
    # Use the first feature comparison table, not the separate pricing table.
    table = {}
    for line in fetch(url).splitlines():
        if line.startswith("|"):
            label, *values = cells(line)
            label = re.sub(r"^\[([^\]]+)\]\([^)]+\)$", r"\1", label)
            if label in {"Claude API ID", "Context window", "Max output"}:
                table[label] = values
        if len(table) == 3:
            break
    for name, context, output in zip(table["Claude API ID"], table["Context window"], table["Max output"], strict=True):
        yield model(name.strip("`"), token_limit(context), token_limit(output))


def deepseek(url):
    table = {}
    for line in fetch(url).splitlines():
        if line.startswith("|"):
            label, *values = cells(line)
            if label in {"MODEL", "CONTEXT LENGTH", "MAX OUTPUT"}:
                # Markdown repeats labels from the source table's merged cells.
                table[label] = [value for value in values if value != label]
    for name, context, output in zip(table["MODEL"], table["CONTEXT LENGTH"], table["MAX OUTPUT"], strict=True):
        yield model(re.sub(r"\(\d+\)$", "", name), token_limit(context), token_limit(output))


def openai(url):
    # Read featured models only. Each model page explicitly lists modalities and endpoints.
    match = re.search(r"^## Featured models\s*\n(.*?)(?=^## |\Z)", fetch(url), re.M | re.S)
    if not match:
        raise ValueError("featured models section missing")
    paths = re.findall(r"\]\((/api/docs/models/[a-zA-Z0-9.-]+\.md)\)", match[1])
    for path in dict.fromkeys(paths):
        page = fetch("https://developers.openai.com" + path)
        if "| Chat Completions | `v1/chat/completions` | Supported |" not in page:
            continue
        if not all(re.search(rf"^- {mode} modalities: [^\n]*\btext\b", page, re.M) for mode in ("Input", "Output")):
            continue
        name = re.search(r"^Model ID: `([^`]+)`$", page, re.M)
        context = re.search(r"^- ([\d,]+) context window$", page, re.M)
        output = re.search(r"^- ([\d,]+) max output tokens$", page, re.M)
        if not all((name, context, output)):
            raise ValueError(f"model details missing on {path}")
        yield model(name[1], int(context[1].replace(",", "")), int(output[1].replace(",", "")))


def groq(url):
    # Production text models only. Preview, speech, and task-specific models have separate lifecycles.
    section = re.search(r"^## \[Production Models\][^\n]*\n(.+?)(?=^## |\Z)", fetch(url), re.M | re.S)
    if not section:
        raise ValueError("Groq production model table missing")
    rows = [cells(line) for line in section[1].splitlines() if line.startswith("|")]
    header = rows[0]
    context_col = header.index("CONTEXT WINDOW (TOKENS)")
    output_col = header.index("MAX COMPLETION TOKENS")
    for row in rows[2:]:
        match = re.search(r"\]\(/docs/model/([a-zA-Z0-9./_-]+)\)", row[0])
        if not match:
            raise ValueError("Groq model ID missing")
        name = match[1]
        detail = fetch(f"https://console.groq.com/docs/model/{name}.md")
        if not re.search(r"^INPUT\s+[^\n]*\bText\b", detail, re.M) or not re.search(r"^OUTPUT\s+Text\s*$", detail, re.M):
            continue
        if "chat.completions.create(" not in detail or re.search(r"whisper|safeguard|prompt-guard", name):
            continue
        yield model(name, token_limit(row[context_col].replace(",", "")), token_limit(row[output_col].replace(",", "")))


def gemini(url):
    # Intersect the generateContent thinking table with models still listed by AI Studio.
    # Restrict to general-purpose families: the table also contains image and robotics models.
    listing = fetch("https://aistudio.google.com/docs/models.md")
    active_tables = re.findall(r"^## All Gemini [^\n]+ models\b[^\n]*\n(.*?)(?=^## |\Z)", listing, re.M | re.S)
    listed = set(re.findall(r"/docs/models/(gemini-[a-z0-9.-]+)", "\n".join(active_tables)))
    guide = fetch(url)
    table = re.search(r"\{% table %\}\s*\* Model\s*\* Default thinking\s*\* Levels supported\s*(.*?)\{% /table %\}", guide, re.S)
    if not listed or not table:
        raise ValueError("Gemini model index or thinking levels table missing")
    family = re.compile(r"gemini-[0-9.]+-(?:carbon|neon|argon|hydrogen|pro|flash(?:-lite)?)(?:-preview(?:-[0-9-]+)?)?")
    for row in table[1].split("---"):
        if not row.strip():
            continue
        fields = [line.strip()[2:] for line in row.splitlines() if line.strip().startswith("* ")]
        if len(fields) != 3:
            raise ValueError("unrecognized Gemini thinking table row")
        name, _, values = fields
        if name not in listed or not family.fullmatch(name):
            continue
        page = fetch(f"https://aistudio.google.com/docs/models/{name}.md")
        if not re.search(r"\*\*Outputs?\*\* Text\s*\n", page):
            raise ValueError(f"Gemini text output missing on {name}")
        # Older cards publish a separate input limit; that is not a unified context limit.
        context = re.search(r"\*\*Context window \(unified input and output token limit\)\*\* ([\d,]+)", page)
        output = re.search(r"\*\*(?:Output token limit|Max output)\*\* ([\d,]+)", page)
        if not output:
            raise ValueError(f"Gemini output limit missing on {name}")
        item = model(name, int(context[1].replace(",", "")) if context else None, int(output[1].replace(",", "")))
        item["thinkingLevels"] = [level.strip() for level in values.split(",")]
        yield item


# Only these reviewed, public origins are requested. No account keys or inference requests.
SOURCES = {
    "gemini": ("https://aistudio.google.com/docs/thinking.md?generate-content=true", gemini),
    "groq": ("https://console.groq.com/docs/models.md", groq),
    "openai": ("https://developers.openai.com/api/docs/models.md", openai),
    "anthropic": ("https://platform.claude.com/docs/en/models/overview.md", anthropic),
    "deepseek": ("https://api-docs.deepseek.com/quick_start/pricing.md", deepseek),
    "openrouter": ("https://openrouter.ai/api/v1/models", openrouter),
    "aihubmix": ("https://api.aihubmix.com/api/v1/models", aihubmix),
    "bilibili": ("https://index-translate.bilibili.com/v1/models", bilibili),
}


def validate_models(models):
    if not isinstance(models, list) or not models:
        raise ValueError("empty model catalog")
    ids = set()
    for entry in models:
        name = entry["id"]
        if not MODEL_ID.fullmatch(name) or name in ids:
            raise ValueError(f"invalid or duplicate model ID: {name!r}")
        ids.add(name)
        for key in ("contextLength", "maxOutputTokens"):
            value = entry[key]
            if value is not None and (type(value) is not int or not 0 < value < 2 ** 53):
                raise ValueError(f"invalid {key} for {name}")
        if "thinkingLevels" in entry:
            levels = entry["thinkingLevels"]
            if not isinstance(levels, list) or not levels or not all(re.fullmatch("[a-z][a-z0-9_]{0,24}", level) for level in levels):
                raise ValueError(f"invalid thinking levels for {name}")
        params = entry["parameters"]
        if not isinstance(params, list) or not all(PARAMETER.fullmatch(param) for param in params):
            raise ValueError(f"invalid parameter names for {name}")


def check_providers():
    providers = json.loads((ROOT / "data/providers.json").read_text())["providers"]
    info = json.loads((ROOT / "info.json").read_text())
    menus = {opt["identifier"]: {item["value"] for item in opt["menuValues"]}
             for opt in info["options"] if "menuValues" in opt}
    ids = set()
    for p in providers:
        name = p["id"]
        if name in ids or not re.fullmatch("[a-z0-9-]+", name):
            raise ValueError(f"invalid or duplicate provider ID: {name}")
        ids.add(name)
        if (not p["docs"].startswith("https://") or (p["bob"] and not p["bob"].startswith("https://bobtranslate.com/"))
                or p["group"] not in ("cloud", "gateway", "local", "other")
                or not all(p[key] for key in ("name", "note", "modelHint"))):
            raise ValueError(f"invalid provider metadata: {name}")
        if p["status"] == "unavailable":
            continue
        if (p["status"] != "supported" or p["format"] not in menus["format"]
                or p["authMode"] not in menus["authMode"]
                or not p["baseURL"].startswith(("https://", "http://localhost:"))
                or (p["endpointOverride"] and not p["endpointOverride"].startswith("/"))
                or not isinstance(p["models"], list)
                or not all(MODEL_ID.fullmatch(m) for m in p["models"])):
            raise ValueError(f"invalid Bob configuration: {name}")
    if SOURCES.keys() - ids:
        raise ValueError("snapshot source without a matching provider")


def check_snapshot(sources):
    if sources.keys() != SOURCES.keys():
        raise ValueError("snapshot sources do not match configured sources")
    for key, source in sources.items():
        if source["url"] != SOURCES[key][0]:
            raise ValueError(f"unexpected source URL for {key}")
        date.fromisoformat(source["updatedAt"])
        validate_models(source["models"])


def refresh_source(key):
    url, reader = SOURCES[key]
    models = sorted(reader(url), key=lambda row: row["id"])
    validate_models(models)
    return models


def save_snapshot(sources):
    # One model per line keeps the file readable and the weekly PR diff small.
    rows = []
    for key in sorted(sources):
        source = sources[key]
        lines = [f'    {json.dumps(key)}: {{', f'      "url": {json.dumps(source["url"])},',
                 f'      "updatedAt": {json.dumps(source["updatedAt"])},', '      "models": [']
        lines.append(",\n".join("        " + json.dumps(item, ensure_ascii=False) for item in source["models"]))
        lines.extend(["      ]", "    }"])
        rows.append("\n".join(lines))
    content = '{\n  "sources": {\n' + ",\n".join(rows) + '\n  }\n}\n'
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=SNAPSHOT.parent, delete=False) as f:
        f.write(content)
    os.replace(f.name, SNAPSHOT)
    SNAPSHOT.chmod(0o644)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="validate committed metadata offline")
    args = parser.parse_args()
    check_providers()
    sources = json.loads(SNAPSHOT.read_text())["sources"] if SNAPSHOT.exists() else {}
    if args.check:
        check_snapshot(sources)
        print(f"Validated provider presets and {len(sources)} model catalogs.")
        return 0

    failed = []
    with ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        futures = {pool.submit(refresh_source, key): key for key in SOURCES}
        for future in as_completed(futures):
            key = futures[future]
            try:
                models = future.result()
            except Exception as exc:
                print(f"{key}: {exc}; keeping previous snapshot", file=sys.stderr)
                failed.append(key)
                continue
            previous = sources.get(key, {})
            if models != previous.get("models") or previous.get("url") != SOURCES[key][0]:
                sources[key] = {"url": SOURCES[key][0], "updatedAt": datetime.now(timezone.utc).date().isoformat(),
                                "models": models}
            print(f"{key}: {len(models)} chat models")

    check_snapshot(sources)
    save_snapshot(sources)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
