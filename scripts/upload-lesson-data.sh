#!/usr/bin/env bash
# Uploads the parsed lessons to the R2 bucket behind `/data/*`: index.json, every lesson.json, the
# audio and the pictures. The source PDFs stay local.
#
#   scripts/upload-lesson-data.sh <bucket-name> [data-dir]
#
# The bucket name is printed by `pnpm deploy`; it is `<stack>-<stage>-lessondata` unless you named it.
# Needs `wrangler login` or CLOUDFLARE_API_TOKEN with R2 write access. This changes Cloudflare
# storage, so run it deliberately.
set -euo pipefail

bucket="${1:?usage: upload-lesson-data.sh <bucket-name> [data-dir]}"
root="${2:-packages/irodori/data}"

content_type() {
  case "$1" in
    *.json) echo application/json ;;
    *.mp3) echo audio/mpeg ;;
    *.png) echo image/png ;;
    *) echo application/octet-stream ;;
  esac
}

cd "$root"
find . -type f \( -name '*.json' -o -name '*.mp3' -o -name '*.png' \) | sed 's|^\./||' | sort | while read -r file; do
  pnpm dlx wrangler@latest r2 object put "$bucket/$file" --file "$file" --content-type "$(content_type "$file")" --remote >/dev/null
  echo "uploaded $file"
done
