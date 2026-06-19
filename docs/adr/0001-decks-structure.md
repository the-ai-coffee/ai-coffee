# 1. `decks/` structure: shared system plus one folder per episode

- **Status**: Accepted
- **Date**: 2026-06-19
- **Deciders**: Xavier Gueret

------

## Context

Every slide deck in this repo is a self-contained HTML file built on the shared
`<deck-stage>` web component (`deck-stage.js`). Until now all deck-related files
lived in a single folder named `ai coffee (Template)/`. As soon as the repo held
two episodes plus a reusable template, that folder became a problem:

- **Misleading name.** The folder was called `(Template)` but actually held the
  shared component, the real template, the generation guide, *and* the finished
  episode decks. The name described one of its contents, not its purpose.
- **System and outputs mixed.** The stable, shared pieces (`deck-stage.js`, the
  template, `TEMPLATE-GUIDE.md`) sat in the same flat list as per-episode,
  throwaway-prone artifacts (multiple deck versions, screenshots, a PDF export).
- **Did not scale.** With four files per episode (current deck plus older
  versions plus a standalone export) plus screenshots and a PDF, the folder would
  become a flat dump of ~25+ files by episode 06, with no boundary between
  episodes.
- **Hostile path.** Spaces and parentheses in the folder name made it awkward in
  the shell, in URLs, and in git.

The decks are intended to be **generated**, one per session, from
`TEMPLATE-GUIDE.md`. A directory layout that makes "generate a session" mean
"create one clean, self-contained folder" was therefore worth designing
deliberately.

## Decision

Replace `ai coffee (Template)/` with a `decks/` directory organized as
**shared system plus one folder per episode**:

```
decks/
├── deck-stage.js              # shared component (the only real code)
├── _template/                 # the generation system, stable across episodes
│   ├── template.html
│   └── TEMPLATE-GUIDE.md
├── 01-agentic-ai/             # one folder per episode: NN-theme/
│   ├── deck.html              # the current deck
│   ├── archive/               # superseded versions
│   │   ├── v1.html
│   │   ├── v2.html
│   │   └── standalone.html
│   ├── export.pdf
│   └── screenshots/
└── 02-hermes-ai/
    └── deck.html
```

Rules that follow from this layout:

- `deck-stage.js` stays a **single shared file** at the `decks/` root. Decks
  reference it relatively: `../deck-stage.js` from an episode `deck.html` or the
  template, and `../../deck-stage.js` from an `archive/` file. It is never copied
  per episode.
- `_template/` is underscore-prefixed so it sorts first and reads as "not an
  episode." It holds the only files a generator reads, never edits.
- Each episode is `NN-theme/`: `deck.html` is the live deck; older versions go to
  `archive/`; `export.pdf` and `screenshots/` are per-episode build artifacts.
- **Generating a session = creating one `decks/NN-theme/` folder** by copying
  `_template/template.html` to `deck.html`.
- The move was performed with `git mv` so history is preserved (git records
  renames, not delete-plus-add).

The content source (`sessions/NN.md`) **stays in `sessions/`**, separate from the
rendered decks (see Alternatives).

## Alternatives considered

- **Keep the flat folder, just rename it.** Cheaper, but solves only the hostile
  name. The system/outputs mix and the scaling problem remain. Rejected.
- **Co-locate the content source per episode** (`decks/NN-theme/content.md`
  instead of `sessions/NN.md`). Puts everything for an episode in one place, but
  breaks the existing content/render separation documented in `CLAUDE.md` and
  scatters the single source of truth across many folders. Rejected: the content
  in `sessions/` is authored and consumed independently of the deck, and keeping
  it in one place is more valuable than physical co-location.
- **One folder per episode but no shared `_template/`** (template duplicated or
  left at root). Rejected: the template and guide are the stable "system" and
  belong together, isolated from episode outputs.

## Consequences

**Positive**

- "Generate a session" maps to a single, self-contained folder. The convention is
  now obvious and reproducible.
- The shared system (`deck-stage.js`, `_template/`) is isolated and stable;
  improving the component benefits every episode at once.
- The repo scales cleanly: each new episode adds exactly one `NN-theme/` folder.
- History preserved via `git mv`; the folder name is now shell- and URL-friendly.

**Negative / trade-offs**

- `deck-stage.js` is now referenced by **depth-dependent relative paths**
  (`../` for decks and the template, `../../` from `archive/`). A deck placed at
  the wrong depth, or moved without fixing the `<script src>`, will fail to load
  the component. The generation procedure in `TEMPLATE-GUIDE.md` calls this out.
- Content and its deck live in two trees (`sessions/NN.md` and
  `decks/NN-theme/`), so the link between them is convention, not co-location.
- `CLAUDE.md` and `TEMPLATE-GUIDE.md` had to be updated to describe the new
  layout; any future tool or script that hard-codes the old folder name must be
  updated too.

------

> **Supersedes**: none.
> **Related**: `CLAUDE.md` (Layout section), `decks/_template/TEMPLATE-GUIDE.md`
> (generation contract).
