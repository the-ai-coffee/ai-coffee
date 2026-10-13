# 🏗️ Architecture

> How the AI Coffee repo turns session content into slide decks and a static site.

------

## 🧠 Mental Model

```
sessions/NN.md ──(deck skill + TEMPLATE-GUIDE.md)──► decks/NN-theme/deck.html
                                                          │
decks/_template/template.html ──copied as starting point──┤
decks/deck-stage.js ──────────loaded by every deck────────┤
design/tokens.css ────────────shared palette + fonts──────┤
media/ ───────────────────────shared images───────────────┘
                                                          │
index.html (landing, links to decks) ─────────────────────┴──► Netlify (publish = ".")
```

No build step: every file is served as-is. Decks must be served over HTTP from the repo root so that relative paths (`../deck-stage.js`, `../../media/...`) resolve.

------

## 📝 Building blocks

| Piece | Role |
|---|---|
| `sessions/NN.md` | Source of truth for an episode's content |
| `decks/_template/` | Light template (9 archetypes) + deterministic generation contract |
| `DESIGN.md` + `design/tokens.css` | Visual signature: tokens + rationale, and their CSS mirror loaded by every page |
| `decks/deck-stage.js` | Shared `<deck-stage>` web component: navigation, scaling, print-to-PDF, thumbnail rail |
| `decks/NN-theme/` | One folder per episode: `deck.html`, optional `archive/`, `export.pdf`, `screenshots/` |
| `index.html` + `netlify.toml` | Public landing page and hosting config (security headers, long-lived media cache) |
| `scripts/` | Notion publishing helpers (need `NOTION_API_KEY`) |
| `project-vision.md`, `CONTEXT.md` | Product vision and glossary |

------

## 📚 Decisions

- [ADR 0001 — `decks/` structure](adr/0001-decks-structure.md)
