---
name: deck
description: Use when the user wants to generate or update an AI Coffee slide deck for a session. Turns a sessions/NN.md content file into decks/NN-theme/deck.html built on the light template, following the deterministic TEMPLATE-GUIDE.md contract. Covers both creating a new episode deck from scratch and refreshing an existing deck after its sessions/NN.md content changed.
user-invocable: true
argument-hint: "<NN> [theme-slug] [--new|--update]"
---

# deck — generate or update an episode deck

Produce or refresh `decks/NN-theme/deck.html` from `sessions/NN.md`, reusing the
archetypes in `decks/_template/template.html`. This skill is the **procedure
wrapper**; the substantive rules (archetype mapping, fill instructions,
invariants, checklist) live in `decks/_template/TEMPLATE-GUIDE.md` and are the
single source of truth. Read that guide and follow it. Do not duplicate or
re-derive its rules here.

## Mental model

```
sessions/NN.md ──► blocks ──► archetypes ──► fill template classes ──► decks/NN-theme/deck.html
                                  ▲
                  rules: decks/_template/TEMPLATE-GUIDE.md (source of truth)
                  engine: decks/deck-stage.js (shared, never edited)
```

## Inputs

Argument is `<NN> [theme-slug] [--new|--update]`:

- `NN` (required): zero-padded episode number, e.g. `03`, `02`.
- `theme-slug` (optional): kebab-case theme for the folder name, e.g.
  `agentic-ai`. If omitted, derive it from the session title in `sessions/NN.md`.
- `--new` / `--update` (optional): force the mode. If omitted, auto-detect:
  an existing `decks/NN-*/deck.html` means **update**, otherwise **generate**.

If invoked with no argument, ask which episode (and list the `sessions/*.md`
files and existing `decks/NN-*` folders to help the user choose).

## Procedure

1. **Load the contract.** Read `decks/_template/TEMPLATE-GUIDE.md` in full, then
   `sessions/NN.md`. If `sessions/NN.md` is missing, stop and tell the user.
2. **Resolve the episode folder.** Glob `decks/NN-*`.
   - None found → **generate** mode. Folder is `decks/NN-<theme-slug>/`.
   - One found → **update** mode (unless `--new`). Reuse that folder. If the
     session theme changed enough that the existing slug is now wrong, propose a
     `git mv` rename to the user before proceeding; do not rename silently.
3. **Map content to archetypes.** List the blocks of `sessions/NN.md` in order
   and map each to an archetype using the guide's mapping table. An episode does
   not need all nine archetypes and may repeat one (e.g. two demos). Keep the
   narrative order of the session.
4. **Build the deck.**
   - **Generate**: copy `decks/_template/template.html` to
     `decks/NN-theme/deck.html`. The `<script src="../deck-stage.js">` path is
     already correct at this depth. Keep the `<section>` for each chosen
     archetype, fill its content classes, drop unused archetype sections,
     duplicate repeated ones.
   - **Update**: edit the existing `decks/NN-theme/deck.html` in place. Rewrite
     only the `<section>` contents to match the new `sessions/NN.md`. **Do not**
     touch the `<style>` block, the palette/type tokens, or the
     `<script src>` line. Add or remove sections to match the new block list.
5. **Per slide**, set `data-label`, the `.folio` (`NN / total`), and the
   `.baseline`, exactly as the guide specifies. Update the `<title>` to
   `IA Coffee · Épisode NN — <Theme>`.
   - On the **closing** slide (`.close`), always keep the `.support` block with
     the Buy Me a Coffee QR (`../../media/bmc_qr.png` from `decks/NN-theme/`) and
     its caption. This is where it has the most value (attendees scan to support
     as the session wraps). In **update** mode, if the existing deck predates the
     QR, add the `.support` block to the close slide.
6. **Verify in the browser** (see protocol below) before claiming done.
7. **Report**: list the slide-by-slide archetype mapping, flag any content gaps
   (empty sections in `sessions/NN.md`, missing metric), and state what you
   verified. Do not commit unless the user asks (project commit policy).

## Invariants (enforced; full list in TEMPLATE-GUIDE.md)

- One rust accent only. No other color introduced. Sole exception: the Buy Me a
  Coffee QR on the closing slide (a functional artifact, not decoration).
- Exactly one dark `class="ink"` slide, reserved for the Impact beat, carrying a
  single number. If the session has no honest hard metric, use a real defensible
  attribute instead of fabricating one (e.g. "100% on-prem"). Never invent data.
- One `.stroke` per title, max.
- Folios coherent (`NN / total`); `.baseline` current on every slide.
- Authored canvas stays 1920×1080. Never edit `decks/deck-stage.js`. Never alter
  the template's CSS.
- Copy uses no em dashes (`—`) and no `--`; use commas, colons, periods, parens.
- Content language matches the session (French for AI Coffee decks).

## Verification protocol

`file://` is blocked in the Playwright MCP, so serve over HTTP:

1. `python3 -m http.server` from the repo root (run in background).
2. Navigate to `http://localhost:8000/decks/NN-theme/deck.html`.
3. Step through with the ArrowRight key (hash navigation on an already-loaded
   deck does not advance slides) and screenshot the risk-prone slides:
   the Impact `.stat` slide and any slide with a long title, checking nothing is
   clipped at the bottom. A console "error" for a missing `favicon.ico` is
   harmless.
4. Confirm: the folio count is right, exactly one `.ink` slide, no overflow.
5. Stop the server when done.

## Guardrails

- `decks/_template/` and `decks/deck-stage.js` are read-only inputs. The skill
  writes only inside `decks/NN-theme/`.
- Generate, don't decorate: visual impact comes from the template's system
  (typography, the single dark contrast slide, the rust accent), not from
  per-slide additions.
- If `sessions/NN.md` has empty or placeholder sections, fill what you can from
  the summary and clearly flag the gaps in the report rather than inventing
  content.
