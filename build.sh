#!/bin/bash

# Ai 翻译插件一键打包脚本

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

# 自动更新 index.html 中的版本号显示
if [ -f "index.html" ]; then
    sed -i '' "s/<div class=\"hero-badge\">Bob Plugin v.*<\/div>/<div class=\"hero-badge\">Bob Plugin v$VERSION<\/div>/g" index.html
    echo "index.html 版本号已更新为 v$VERSION"
fi

# 创建输出目录
OUT_DIR="release"
mkdir -p "$OUT_DIR"

# 定义包名
PACKAGE_NAME="$OUT_DIR/AiTranslate-v$VERSION.bobplugin"

# 清理可能存在的旧包
rm -f "$PACKAGE_NAME"

# 打包文件 (包含核心文件、README 和工具页面)
zip -r "$PACKAGE_NAME" info.json main.js icon.png README.md tools/param-builder.html -x ".*" -x "__MACOSX"

if [ $? -eq 0 ]; then
    echo "========================================="
    echo "✅ 打包成功!"
    echo "📦 产物路径: $PACKAGE_NAME"
    echo "========================================="
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
else
    echo "❌ 打包失败"
    exit 1
fi
