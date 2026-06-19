#!/usr/bin/env bash
# Publish project-vision.md to Notion
set -euo pipefail

SOURCE_FILE="/home/michael/work/ai-coffee/project-vision.md"
OLD_PAGE_ID="3697e908682181a3835ad8b9923b1232"
PARENT_PAGE_ID="3677e9086821808e9e20c59e4174ee88"

# Load env
set -a
source ~/.hermes/.env
set +a
export NOTION_KEYRING=0

echo "→ Unarchiving parent page (Project brief)..."
curl -s -X PATCH "https://api.notion.com/v1/pages/$PARENT_PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"archived": false}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('  archived:', d.get('archived'))"

echo ""
echo "→ Creating new Project Vision page..."
MD_CONTENT=$(cat "$SOURCE_FILE")

# Build JSON payload using Python to avoid shell escaping issues
python3 -c "
import json, sys

payload = {
    'parent': {'page_id': '$PARENT_PAGE_ID'},
    'properties': {
        'title': [{'text': {'content': 'Project Vision'}}]
    },
    'markdown': '''$MD_CONTENT'''
}

with open('/tmp/notion-create.json', 'w') as f:
    json.dump(payload, f, ensure_ascii=False)
print('payload written')
"

RESULT=$(curl -s -X POST "https://api.notion.com/v1/pages" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d @/tmp/notion-create.json)

echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
if d.get('object') == 'page':
    print('  ✓ New page:', d.get('id'))
    print('  URL:', d.get('url'))
    with open('/tmp/new-vision-page-id.txt', 'w') as f:
        f.write(d.get('id',''))
else:
    print('  ✗ Error:', d.get('message', str(d)))
    sys.exit(1)
"

NEW_ID=$(cat /tmp/new-vision-page-id.txt)

echo ""
echo "→ Archiving old page..."
curl -s -X PATCH "https://api.notion.com/v1/pages/$OLD_PAGE_ID" \
  -H "Authorization: Bearer $NOTION_API_KEY" \
  -H "Notion-Version: 2025-09-03" \
  -H "Content-Type: application/json" \
  -d '{"archived": true}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('  archived:', d.get('archived'))"

echo ""
echo "✅ Done! New page ID: $NEW_ID"
