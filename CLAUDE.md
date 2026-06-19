# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Content and slide-deck source for **AI Coffee**, a monthly French-language meetup/anti-conference about practical AI. There is no build system, package manager, or test suite — this is a documentation/presentation repo, not an application.

## Layout

- `README.md` — one-paragraph pitch for the event, in French.
- `project-vision.md` — the living product vision/strategy doc (problem, format, growth model, signature offerings, metrics, roadmap, risks). Plain Markdown. This is the source of truth for what the project actually is and where it's headed — check it before assuming a session format or business model detail from an older artifact (e.g. a deck) is still current.
- `CONTEXT.md` — glossary of project-specific terms (e.g. `Session`, `Cohort cap`, `Prompt Bar`, `Use Case Catalog`) maintained alongside `project-vision.md`. Defines what each term means and which competing terms to avoid. Consult it before using ambiguous terminology, and keep it in sync when a term's meaning changes.
- `product-presentation.md` — long-form product presentation, published to Notion (see below).
- `sessions/NN.md` — content source per episode (summary + per-talk notes), used to generate that episode's slide deck. Written in finished, narrative form as soon as content is planned — which may be *before* the session actually happens, so past tense doesn't imply the session occurred. `02.md` shows the expected structure (Summary, then a `### N. Talk title` section per presentation with a blockquote tagline and bolded sub-sections).
- `decks/` — all slide decks, organized as **shared system + one folder per episode**:
  - `decks/deck-stage.js` — the `<deck-stage>` custom element used by every deck in this repo. It is the one piece of real code here; treat it as a shared library, not per-deck boilerplate. Decks reference it relatively (`../deck-stage.js`, or `../../deck-stage.js` from an `archive/`).
  - `decks/_template/` — the generation system, stable across episodes: `template.html` (the light template, 9 archetypes) and `TEMPLATE-GUIDE.md` (the deterministic `sessions/NN.md` → deck contract). Underscore-prefixed so it sorts first and reads as "not an episode."
  - `decks/NN-theme/` — one folder per episode (e.g. `01-agentic-ai/`, `02-hermes-ai/`). Contains `deck.html` (the current deck), optionally `archive/` (older versions like `v1.html`, `v2.html`, `standalone.html`), `export.pdf`, and `screenshots/`. Generating a session means creating one such folder by copying `_template/template.html`.
- `media/` — logo/cover images used in presentations (shared across episodes).
- `notion-publish.sh` — publishes a Markdown file to Notion.

## `deck-stage.js` — the slide deck component

Each deck HTML file declares slides as plain `<section>` children of a single `<deck-stage>` element and loads `deck-stage.js`, which upgrades it into a shadow-DOM custom element handling navigation, scaling, printing, and an editable thumbnail rail. Key things to know before editing a deck or the component:

- **Slides stay in the DOM.** Non-active slides are hidden via `visibility`/`opacity`, never removed/unmounted — so embedded videos, iframes, and component state persist across navigation.
- **Design-size canvas.** Slides are authored at a fixed size (`width`/`height` attrs, default 1920×1080) and scaled to fit the viewport via CSS `transform: scale()`. The `noscale` attribute (used by the PPTX exporter) renders at 1:1 authored size instead.
- **Printing → PDF.** `@media print` re-lays slides into normal document flow at one page per slide; `_syncPrintPageRule()` injects the matching `@page` size into `<head>` (a no-op inside shadow DOM otherwise). Browser's Print → Save as PDF then "just works."
- **Thumbnail rail.** A left-hand column of lazily-materialized slide clones; supports drag-to-reorder, skip, and delete via a right-click context menu. Mutations dispatch a `deckchange` CustomEvent; navigation dispatches `slidechange`. The rail is suppressed in presenting mode, the host's Preview mode, `noscale`, or via the `no-rail` attribute.
- **Host integration via `postMessage`.** The component listens for messages like `__omelette_presenting`, `__omelette_preview_mode`, `__deck_rail_visible`, and `__omelette_rail_enabled` from a parent window (an external editor/presenter app), and broadcasts `slideIndexChanged` back out. Slide content can listen for the in-page `slidechange` CustomEvent instead of postMessage.
- **Per-deck "Tweaks" panel.** Some decks (e.g. `decks/01-agentic-ai/deck.html`) embed their own small live-tweak panel (cover variation, background palette) that posts `__edit_mode_*` messages to the parent and re-applies via `data-cover`/`data-bg` attributes on `<html>`. This is deck-specific script in the HTML file, separate from `deck-stage.js`.
- Author CSS for slides is snapshotted and rewritten (`:root` → `:host`, `html` → `:host(...)`) so it also applies inside each thumbnail's nested shadow root — keep this in mind if a deck's stylesheet relies on document-level selectors not covered by that rewrite.

When generating a new episode deck, start from `decks/_template/template.html` and follow `decks/_template/TEMPLATE-GUIDE.md`. When editing an existing deck's `deck-stage.js` integration, prefer copying patterns from a current `deck.html` rather than from an `archive/standalone.html`, which is a flattened/simplified snapshot.

## Publishing to Notion

`./notion-publish.sh [file] [page_id]` pushes a local Markdown file to a Notion page using the `ntn` CLI (requires `NOTION_API_TOKEN`/`NOTION_API_KEY` in the environment). Defaults to publishing `product-presentation.md`. The script's actual strategy is: create a brand-new page under the parent page from the Markdown, archive the old page, then rewrite its own `PAGE_ID` default in-place via `sed` — so re-running it after a successful publish targets the newly created page automatically.
