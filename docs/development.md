# 🛠️ Development

> **Prerequisites**: `python3` (local HTTP server), `make`, `pre-commit`. Optional: `ntn` CLI for Notion publishing.

------

## 🚀 Serve the decks locally

```bash
# List episodes, then serve the repo root and open a deck (default: latest)
make list
make slides DECK=04-branche-design PORT=8000

# Expose on the LAN (e.g. to present from another machine)
python3 -m http.server 8000 --bind 0.0.0.0
```

> ⚠️ **Warning**: opening a deck as `file://` breaks the `deck-stage.js` import — always go through HTTP.

------

## 🎬 Create a new episode deck

1. Write `sessions/NN.md` (see `sessions/02.md` for the expected structure).
2. Generate `decks/NN-theme/deck.html` from `decks/_template/template.html` following `decks/_template/TEMPLATE-GUIDE.md` (or use the `deck` Claude skill).
3. Add a link to the new deck in `index.html`.

------

## ☕ Quiz brise-glace

Préparer, animer et exporter le quiz d'ouverture : voir [`quiz.md`](quiz.md). Tests : `pnpm test` ; serveur local avec Netlify Functions et Blobs : `pnpm dev`.

------

## 🔐 Secrets

Copy `.env.example` to `.env` (gitignored) and fill `NOTION_API_KEY`, or export it from your shell before running `scripts/*.sh`.

------

## 🎨 Design tokens

Colours and fonts live in `DESIGN.md` (front matter) and `design/tokens.css`. Change both in the same commit, then validate:

```bash
pnpm dlx @google/design.md lint DESIGN.md
```

------

## ✅ Quality checks

```bash
pre-commit install          # once per clone
pre-commit run --all-files  # whitespace, YAML/JSON, shellcheck, shfmt, private keys
```

------

## 🔀 Conventions

- Branches: GitHub Flow (`{type}/{kebab-description}` + PR to `main`)
- Commits: Conventional Commits, in English
