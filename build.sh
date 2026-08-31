#!/bin/bash

# AiTranslate Bob 插件打包脚本。
# 只负责生成可发布的 .bobplugin，不修改源码或 appcast 发布元数据。

set -euo pipefail

if ! command -v jq >/dev/null 2>&1; then
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

if [ -z "$IDENTIFIER" ] || [ "$IDENTIFIER" = "null" ]; then
    echo "错误: 未在 info.json 中找到 identifier 值"
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

if [ ! -f "main.js" ] || [ ! -f "README.md" ] || [ ! -f "tools/param-builder.html" ]; then
    echo "错误: 插件打包所需文件不完整"
    exit 1
fi

echo "正在打包 $IDENTIFIER 版本: $VERSION..."

OUT_DIR="release"
mkdir -p "$OUT_DIR"
PACKAGE_NAME="$OUT_DIR/AiTranslate-v$VERSION.bobplugin"
rm -f "$PACKAGE_NAME"

zip -r "$PACKAGE_NAME" info.json main.js "$DEFAULT_ICON" README.md tools/param-builder.html -x ".*" -x "__MACOSX"

echo "========================================="
echo "✅ 打包成功!"
echo "📦 产物路径: $PACKAGE_NAME"
echo "========================================="

if command -v shasum >/dev/null 2>&1; then
    SHA256=$(shasum -a 256 "$PACKAGE_NAME" | awk '{print $1}')
    echo "SHA256: $SHA256"
fi
