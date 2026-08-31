#!/bin/bash

# Ai 翻译插件一键打包脚本

set -e

if ! command -v jq &> /dev/null; then
    echo "错误: 未找到 jq 命令，请先安装 jq (例如: brew install jq)"
    exit 1
fi

if [ ! -f "info.json" ]; then
    echo "错误: info.json 文件不存在，请在插件根目录运行此脚本"
    exit 1
fi

VERSION=$(jq -r '.version' info.json)
IDENTIFIER=$(jq -r '.identifier' info.json)

if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
    echo "错误: 未在 info.json 中找到 version 值"
    exit 1
fi

DEFAULT_ICON=$(jq -r '.icons[] | select(.identifier == "default" and .type == "file") | .filePath' info.json)
if [ -z "$DEFAULT_ICON" ] || [ "$DEFAULT_ICON" = "null" ] || [ ! -f "$DEFAULT_ICON" ]; then
    echo "错误: 默认插件图标文件不存在: $DEFAULT_ICON"
    exit 1
fi

# 防止 Bob 将根目录 icon.png 作为静态插件图标，从而与 key option 动态图标选择冲突。
if [ -f "icon.png" ]; then
    echo "错误: 根目录不应存在 icon.png；请使用 info.json icons 中声明的文件名"
    exit 1
fi

echo "正在打包 $IDENTIFIER 版本: $VERSION..."

if [ -f "index.html" ]; then
    sed -i '' "s/<div class=\"hero-badge\">Bob Plugin v.*<\/div>/<div class=\"hero-badge\">Bob Plugin v$VERSION<\/div>/g" index.html
    echo "index.html 版本号已更新为 v$VERSION"
fi

OUT_DIR="release"
mkdir -p "$OUT_DIR"
PACKAGE_NAME="$OUT_DIR/AiTranslate-v$VERSION.bobplugin"
rm -f "$PACKAGE_NAME"

zip -r "$PACKAGE_NAME" info.json main.js "$DEFAULT_ICON" README.md tools/param-builder.html -x ".*" -x "__MACOSX"

echo "========================================="
echo "✅ 打包成功!"
echo "📦 产物路径: $PACKAGE_NAME"
echo "========================================="

if command -v shasum &> /dev/null; then
    SHA256=$(shasum -a 256 "$PACKAGE_NAME" | awk '{print $1}')
    echo "SHA256: $SHA256"

    TIMESTAMP=$(($(date +%s)*1000))
    MIN_BOB_VERSION=$(jq -r '.minBobVersion // "1.15.3"' info.json)

    if [ -f "appcast.json" ]; then
        echo "正在更新 appcast.json..."
        jq --arg version "$VERSION" --arg sha256 "$SHA256" --arg minBob "$MIN_BOB_VERSION" --argjson timestamp "$TIMESTAMP" '
            if (.versions | map(.version) | index($version)) then
                .versions |= map(if .version == $version then .sha256 = $sha256 | .timestamp = $timestamp | .minBobVersion = $minBob else . end)
            else
                .versions = [{"version": $version, "desc": "AiTranslate \($version) 更新", "sha256": $sha256, "url": "https://github.com/wakewon/AiTranslate/releases/download/v\($version)/AiTranslate-v\($version).bobplugin", "minBobVersion": $minBob, "timestamp": $timestamp}] + .versions
            end
        ' appcast.json > tmp.json && mv tmp.json appcast.json
        echo "appcast.json 更新完成"
    fi
fi
