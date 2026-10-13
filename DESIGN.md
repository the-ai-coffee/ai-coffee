---
version: alpha
name: AI Coffee
description: >-
  Warm, editorial, restrained visual signature shared by every AI Coffee artifact —
  slide decks, the landing page and standalone HTML tools. Cream paper, warm ink,
  espresso contrast beats and a single rust accent.
colors:
  primary: "{colors.accent}"
  paper: "oklch(0.945 0.018 86)"
  paper-2: "oklch(0.905 0.022 84)"
  paper-3: "oklch(0.975 0.010 88)"
  ink: "oklch(0.255 0.018 60)"
  ink-2: "oklch(0.430 0.022 58)"
  ink-3: "oklch(0.610 0.020 62)"
  rule: "oklch(0.860 0.018 82)"
  rule-2: "oklch(0.780 0.022 78)"
  espresso: "oklch(0.250 0.028 55)"
  accent: "oklch(0.620 0.158 47)"
  accent-soft: "oklch(0.760 0.110 55)"
  paper-on-ink: "oklch(0.930 0.020 88)"
  muted-on-ink: "oklch(0.700 0.020 80)"
typography:
  mega:
    fontFamily: Instrument Serif
    fontSize: 300px
    fontWeight: 400
    lineHeight: 0.84
    letterSpacing: -0.04em
  display:
    fontFamily: Instrument Serif
    fontSize: 224px
    fontWeight: 400
    lineHeight: 0.86
    letterSpacing: -0.045em
  title:
    fontFamily: Instrument Serif
    fontSize: 108px
    fontWeight: 400
    lineHeight: 0.98
    letterSpacing: -0.025em
  h2:
    fontFamily: Instrument Serif
    fontSize: 64px
    fontWeight: 400
    lineHeight: 1
  lead:
    fontFamily: Instrument Serif
    fontSize: 46px
    fontWeight: 400
    lineHeight: 1.26
  body:
    fontFamily: Geist
    fontSize: 30px
    fontWeight: 300
    lineHeight: 1.5
  small:
    fontFamily: Geist
    fontSize: 23px
    fontWeight: 300
    lineHeight: 1.5
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: 0.24em
rounded:
  hairline: 2px
  sm: 8px
  md: 14px
  pill: 999px
spacing:
  page-x: 132px
  page-top: 132px
  page-bottom: 120px
  chrome-inset: 52px
  gap-lg: 96px
  gap-md: 64px
  gap-sm: 32px
components:
  slide:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  slide-ink:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.paper-on-ink}"
  surface-inset:
    backgroundColor: "{colors.paper-2}"
    textColor: "{colors.ink}"
  surface-raised:
    backgroundColor: "{colors.paper-3}"
    textColor: "{colors.ink}"
  divider:
    backgroundColor: "{colors.rule}"
    height: 1px
  divider-strong:
    backgroundColor: "{colors.rule-2}"
    height: 1px
  kicker:
    textColor: "{colors.ink-3}"
    typography: "{typography.label-caps}"
  kicker-on-ink:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.muted-on-ink}"
    typography: "{typography.label-caps}"
  stat-unit-on-ink:
    backgroundColor: "{colors.espresso}"
    textColor: "{colors.accent-soft}"
  kicker-dot:
    backgroundColor: "{colors.accent}"
    size: 8px
  chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    padding: 9px 18px
  chip-lead:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: 9px 18px
  stroke:
    textColor: "{colors.accent}"
    rounded: "{rounded.hairline}"
---

# AI Coffee — Design System

The YAML front matter above is the **source of truth** for the AI Coffee visual signature. It follows the [DESIGN.md format](https://github.com/google-labs-code/design.md) so that both people and coding agents can read it.

- **Runtime mirror**: `design/tokens.css` exposes the colours and font stacks as CSS custom properties (`--paper`, `--accent`, `--serif`…). Every page loads it — never redeclare these tokens in a page.
- **Changing the brand**: update the front matter **and** `design/tokens.css` in the same commit, on a dedicated `feat/` or `design/` branch. Every page follows automatically.
- **Validate**: `pnpm dlx @google/design.md lint DESIGN.md`.

## Overview

AI Coffee is an "anti-conference" about practical AI, held around a cup of coffee. The visual language mirrors that: an **editorial, calm, warm** surface — a cream saucer — with a single drop of **rust crema** as the only colour. Impact comes from very large serif typography and rare dark "espresso" beats, never from decoration.

```
  cream paper  ──────────────  ~95% of the surface: calm, warm, editorial
  warm ink     ──────────────  text, in three strengths (ink / ink-2 / ink-3)
  espresso     ───  1–2 beats  dark contrast surface, used sparingly
  rust accent  ─     a touch   ONE hue, used as punctuation — never decoration
```

The system serves two canvases:

| Canvas | Scale | Where |
|---|---|---|
| Slide deck | Fixed 1920×1080, scaled by `<deck-stage>` | `decks/_template/template.html`, `decks/NN-theme/deck.html` |
| Web page | Responsive, single column below 860px | `index.html`, standalone tools |

## Colors

A **restrained** palette defined in OKLCH: warm neutrals plus exactly one accent.

- **Paper** (`paper`, `paper-2`, `paper-3`): cream canvas, light inset, raised surface.
- **Ink** (`ink`, `ink-2`, `ink-3`): warm near-black for primary text, secondary text, labels and muted metadata.
- **Rules** (`rule`, `rule-2`): hairlines and chip borders.
- **Espresso** (`espresso`): the dark contrast surface. On it, use `paper-on-ink` for text and `muted-on-ink` for labels.
- **Accent** (`accent`, `accent-soft`): the rust crema. `accent-soft` is only for accents on espresso and for gradients.

The accent is **punctuation**: one keyword, one number, one arrow. It goes all-in only on the Impact and Comparison slides. Never encode categories with extra hues — use typography, mono chips or rust markers instead.

The only exception to the single-accent rule is the Buy Me a Coffee QR code (`media/bmc_qr.png`), a functional artifact.

`primary` is an alias of `accent`, declared only so that tools following the DESIGN.md format treat the rust accent as the key colour. It has no CSS counterpart — use `--accent`.

> ⚠️ **Known contrast gap**: paper text on the rust accent (the lead chip) measures **3.28:1**, below WCAG AA for normal text (4.5:1). It is acceptable for short, large labels on a projected slide; never use this pairing for body text or small web UI.

## Typography

Three families, loaded from Google Fonts on every page:

| Role | Family | Weights | Use |
|---|---|---|---|
| Display / titles / leads | Instrument Serif | 400, italic | Everything that should feel editorial; italic + `accent` for emphasis |
| Body | Geist | 300 (default), 400, 500 | Running text |
| Labels | JetBrains Mono | 400, 500 | Kickers, folios, chips, metadata — uppercase, tracked `0.14–0.24em` |

```html
<link rel="stylesheet" href="…/design/tokens.css">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

The type scale in the front matter is the **deck scale** (1920×1080 canvas); decks expose it as `--t-mega` … `--t-micro` in their own `:root`. Web pages keep the same families and hierarchy with a web-sized scale.

## Layout

- **Decks**: authored at 1920×1080 and scaled by `<deck-stage>` — never change the `width`/`height`. Content sits in `.body`, inset `page-top` / `page-x` / `page-bottom`. The chrome (kicker top-left, folio top-right, baseline at the bottom) sits `chrome-inset` from the edges.
- **Grids** are simple and asymmetric (for example `1.4fr 1fr` on the cover, `1fr 1.25fr` on the table of contents), with generous gaps (`gap-sm` → `gap-lg`).
- **Web**: content columns collapse to a single column below 860px; secondary navigation is hidden on small screens.
- Leave empty space rather than filling it — whitespace is part of the calm.

## Elevation & Depth

The system is essentially **flat**: surfaces are separated by hairlines (`rule`, `rule-2`) and by the paper/espresso contrast, not by shadows.

The one exception is the cover's espresso disc: a soft, low, warm drop shadow (`0 36px 90px -34px` in translucent espresso) to make the cup feel physical. Do not add shadows elsewhere.

## Shapes

- **Hairline** (`2px`): the rust underline of the stroke gesture.
- **Small / medium** (`8px`, `14px`): cards and images such as the QR code.
- **Pill** (`999px`): chips and tags.
- **Circles**: the kicker dot, the seal, the espresso disc and its crema — the coffee-cup motif.

## Components

| Component | Markup | Rule |
|---|---|---|
| Slide | `<section>` inside `<deck-stage>` | Paper background, ink text |
| Ink slide | `<section class="ink">` | Espresso background. Reserved for the Impact beat — max 1–2 per deck |
| Kicker | `.chrome .kicker` + `.dot` | Mono uppercase label preceded by an 8px rust dot |
| Stroke | `<span class="stroke">word</span>` | Italic rust keyword with a translucent rust underline — **one per title, max** |
| Emphasis | `<em>` | Serif italic in `accent` |
| Chip | `.chip` / `.chip.lead-chip` | Mono pill with a `rule-2` border; the lead chip is filled rust |
| Espresso disc | `.espresso-disc` + `.crema` | Cover visual: radial espresso gradient with a rust crema |

The nine slide archetypes (cover, table of contents, definition, impact, flow, comparison, demo, glossary, closing) and how to fill them are specified in `decks/_template/TEMPLATE-GUIDE.md`.

## Do's and Don'ts

**Do**

- Load `design/tokens.css` and use `var(--token)` for every colour and font stack.
- Keep exactly one accent hue on a page (QR code excepted).
- Let typography carry the impact: big serif titles, one italic rust keyword.
- Use espresso surfaces as a punctuation beat.
- Encode categories with typography, mono chips or rust markers.

**Don't**

- Redeclare palette or font tokens in a page's `:root`, or hard-code an OKLCH value that exists as a token.
- Introduce a second accent colour, even for "status" or "category" colour coding.
- Put more than one `.stroke` in a title.
- Add drop shadows, gradients or stock illustrations for decoration.
- Change the 1920×1080 slide size.
