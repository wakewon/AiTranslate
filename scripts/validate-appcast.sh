#!/bin/bash
# Validate tracked appcast structure without requiring every historical asset to stay online.
set -euo pipefail

jq -e '
  .identifier == "com.github.wakewon.ai.translate" and
  (.versions | type == "array") and
  ([.versions[].version] | length == (unique | length)) and
  ([.versions[] |
    (.version | test("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$")) and
    (.url == ("https://github.com/wakewon/AiTranslate/releases/download/v" + .version + "/AiTranslate-v" + .version + ".bobplugin")) and
    (.sha256 | test("^[0-9a-f]{64}$")) and
    (.minBobVersion | test("^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$")) and
    (.timestamp | type == "number") and
    (.timestamp > 0)
  ] | all)
' appcast.json >/dev/null

python3 - <<'PY'
import json
from pathlib import Path

payload = json.loads(Path("appcast.json").read_text())
versions = payload["versions"]
parsed = [tuple(map(int, item["version"].split("."))) for item in versions]
if parsed != sorted(parsed, reverse=True):
    raise SystemExit("error: appcast versions are not newest-first")
print("appcast schema passed")
PY
