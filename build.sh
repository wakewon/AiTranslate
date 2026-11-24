#!/bin/bash

# AiTranslate 插件一键打包脚本
set -euo pipefail

# 检查依赖
if ! command -v jq &> /dev/null; then
    echo "错误: 未找到 jq 命令，请先安装 jq (例如: brew install jq)"
    exit 1
fi

# 检查 info.json 是否存在
if [ ! -f "info.json" ]; then
    echo "错误: info.json 文件不存在，请在插件根目录运行此脚本"
    exit 1
fi

# 提取版本号和标识符
VERSION=$(jq -r '.version' info.json)
IDENTIFIER=$(jq -r '.identifier' info.json)

if [ -z "$VERSION" ] || [ "$VERSION" == "null" ]; then
    echo "错误: 未在 info.json 中找到 version 值"
    exit 1
fi

echo "正在打包 $IDENTIFIER 版本: $VERSION..."

# 先在临时目录准备插件和随包文档。离线页面使用随包的目录快照。
OUT_DIR="release"
mkdir -p "$OUT_DIR"
PACKAGE_NAME="$OUT_DIR/AiTranslate-v$VERSION.bobplugin"
STAGING=$(mktemp -d)
trap 'rm -rf "$STAGING"' EXIT
mkdir "$STAGING/plugin"
cp -R info.json main.js icon.png favicon.ico README.md index.html docs tools assets "$STAGING/plugin/"

python3 - "$STAGING/plugin" <<'PYTHON'
import json
import sys
from pathlib import Path

target = Path(sys.argv[1])
catalog = {
    "providers": json.loads(Path("data/providers.json").read_text()),
    "modelCatalog": json.loads(Path("data/model-catalog.json").read_text()),
}
(target / "assets" / "offline-data.js").write_text(
    "window.AiTranslateData=" + json.dumps(catalog, ensure_ascii=True, separators=(",", ":")) + ";\n"
)
for page, prefix in [("index.html", ""), ("tools/param-builder.html", "../")]:
    path = target / page
    html = path.read_text()
    marker = "<!-- offline-data -->"
    if html.count(marker) != 1:
        raise SystemExit(f"缺少离线数据入口: {page}")
    path.write_text(html.replace(marker, f'<script src="{prefix}assets/offline-data.js"></script>'))
PYTHON

(cd "$STAGING/plugin" && zip -qr "$STAGING/package.zip" . -x '*/.*' '.*' '__MACOSX/*')
mv "$STAGING/package.zip" "$PACKAGE_NAME"

echo "安装包已生成: $PACKAGE_NAME"
# 计算并输出 SHA256，更新 appcast.json
if command -v shasum &> /dev/null; then
    SHA256=$(shasum -a 256 "$PACKAGE_NAME" | awk '{print $1}')
    echo "SHA256: $SHA256"

    # 生成时间戳
    TIMESTAMP=$(($(date +%s)*1000))

    # 获取最新的 minBobVersion，如果 info.json 没写，默认 1.8.0
    MIN_BOB_VERSION=$(jq -r '.minBobVersion // "1.8.0"' info.json)

    if [ -f "appcast.json" ]; then
        echo "正在更新 appcast.json..."
        jq --arg version "$VERSION" --arg sha256 "$SHA256" --arg minBob "$MIN_BOB_VERSION" --argjson timestamp $TIMESTAMP '
            if (.versions | map(.version) | index($version)) then
                .versions |= map(if .version == $version then .sha256 = $sha256 | .timestamp = $timestamp | .minBobVersion = $minBob else . end)
            else
                .versions = [{"version": $version, "desc": "AiTranslate \($version) 更新", "sha256": $sha256, "url": "https://github.com/wakewon/AiTranslate/releases/download/v\($version)/AiTranslate-v\($version).bobplugin", "minBobVersion": $minBob, "timestamp": $timestamp}] + .versions
            end
        ' appcast.json > tmp.json && mv tmp.json appcast.json
        echo "appcast.json 更新完成"
    else
        echo "appcast.json 不存在，跳过更新。"
    fi
fi
