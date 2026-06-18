#!/usr/bin/env bash
# notion-publish.sh — Push local Markdown source to Notion
# Usage: ./notion-publish.sh [file] [page_id]
#
# Defaults:
#   file    = product-presentation.md
#   page_id = 3697e908-6821-81a3-835a-d8b9923b1232  (Présentation Produit — AI Coffee)
#
# Strategy: delete all blocks then re-create from Markdown.
# ntn handles the markdown parsing + block creation in one API call.

set -euo pipefail

FILE="${1:-product-presentation.md}"
PAGE_ID="${2:-3697e908-6821-81a3-835a-d8b9923b1232}"

export NOTION_API_TOKEN="${NOTION_API_TOKEN:-$NOTION_API_KEY}"
export NOTION_KEYRING=0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FULL_PATH="$SCRIPT_DIR/$FILE"

if [[ ! -f "$FULL_PATH" ]]; then
  echo "Error: file not found: $FULL_PATH"
  exit 1
fi

echo "→ Fetching existing blocks for page $PAGE_ID..."
BLOCK_IDS=$(ntn api "v1/blocks/$PAGE_ID/children?page_size=100" | \
  python3 -c "import sys,json; [print(b['id']) for b in json.load(sys.stdin).get('results',[])]")

BLOCK_COUNT=$(echo "$BLOCK_IDS" | grep -c . || true)
echo "→ Deleting $BLOCK_COUNT existing blocks..."
echo "$BLOCK_IDS" | while read -r bid; do
  [[ -z "$bid" ]] && continue
  ntn api "v1/blocks/$bid" -X DELETE > /dev/null
done

echo "→ Publishing $FILE to Notion..."
MD_CONTENT=$(cat "$FULL_PATH")
ntn api v1/pages \
  parent[page_id]="$PAGE_ID" \
  "properties[title][0][text][content]=Présentation Produit — AI Coffee" \
  markdown="$MD_CONTENT" > /dev/null

# Actually we need to create as a new page then delete old, OR use append
# Better: POST new page under same parent, delete old
PARENT_PAGE_ID="3677e9086821808e9e20c59e4174ee88"

# Re-create page under parent with fresh content
RESULT=$(ntn api v1/pages \
  parent[page_id]="$PARENT_PAGE_ID" \
  "properties[title][0][text][content]=Présentation Produit — AI Coffee" \
  markdown="$MD_CONTENT")

NEW_ID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','ERROR'))")
NEW_URL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('url',''))")

if [[ "$NEW_ID" == "ERROR" ]]; then
  echo "Error creating page"
  echo "$RESULT"
  exit 1
fi

# Archive the old page
ntn api "v1/pages/$PAGE_ID" -X PATCH archived:=true > /dev/null

echo "✓ Published successfully"
echo "  New page ID : $NEW_ID"
echo "  URL         : $NEW_URL"

# Update the stored page ID reference
sed -i "s|PAGE_ID=\"[^\"]*\"|PAGE_ID=\"$NEW_ID\"|g" "$0"
echo "  Script updated with new page ID"
