#!/bin/bash
# Update release metadata only after a public plugin asset has been verified.
set -euo pipefail

VERSION="${1:?version}"
PLUGIN_SHA="${2:?plugin sha256}"
TIMESTAMP="${3:?milliseconds timestamp}"
MIN_BOB_VERSION="${4:?minimum Bob version}"
URL="https://github.com/wakewon/AiTranslate/releases/download/v$VERSION/AiTranslate-v$VERSION.bobplugin"

printf '%s' "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'
printf '%s' "$PLUGIN_SHA" | grep -Eq '^[0-9a-f]{64}$'
printf '%s' "$MIN_BOB_VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$'
case "$TIMESTAMP" in
  ''|*[!0-9]*)
    echo "error: invalid timestamp: $TIMESTAMP" >&2
    exit 1
    ;;
esac

jq --arg version "$VERSION" --arg sha256 "$PLUGIN_SHA" \
    --arg url "$URL" --arg minBob "$MIN_BOB_VERSION" --argjson timestamp "$TIMESTAMP" '
      .versions = ([{
        version:$version,
        desc:("AiTranslate " + $version + " 更新"),
        sha256:$sha256,
        url:$url,
        minBobVersion:$minBob,
        timestamp:$timestamp
      }] + [.versions[] | select(.version != $version)])
    ' appcast.json > appcast.json.next
mv appcast.json.next appcast.json
scripts/validate-appcast.sh
