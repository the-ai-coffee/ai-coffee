# Quiz Espresso: getting out of the Netlify Functions quota

**Date:** 2026-11-24
**Status:** Approved (option A); option C recorded as a future optimisation
**Branch:** `fix/quiz-quota-edge`

## Problem

Netlify blocked the site with: *"This team has exceeded the Functions limit for the-ai-coffee."*

- The team (`mikamboo`, created 2018) is on the **legacy Free/Starter plan**: **125k Serverless Function invocations per site per month**, and **1M Edge Function invocations per month** as a separate quota ([Netlify legacy pricing plans](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-legacy-plans/legacy-pricing-plans/)).
- The site has only one function, `netlify/functions/quiz-api.mjs`. The limit is about **how many calls** it gets, not how many functions there are.
- **Root cause: polling that never stops.**
  - The host screen calls `GET /api/quiz/host-state` **every 1 s**, in every status, as long as the tab is open (`quiz/host/host.js`, `loop()`). One forgotten tab costs **86,400 calls a day**, so the month's quota is gone in about 1.5 days.
  - Phones call `/state` every 3 s (every 1.5 s during the reveal), forever: after `done`, and with the tab in the background too (`quiz/app.js`, `loop()`).
  - No loop listens to `visibilitychange`.
- A real 30-player game costs about 20k calls. Normal use fits within the quota; the forgotten tabs are what use it up.

## Options considered

| | Option | Verdict |
|---|---|---|
| **A** | Stay on Netlify; move the API to an **Edge Function** (1M/month quota) and **calm the polling down** | **Chosen**: small change, unblocks right away, about 8× the headroom |
| B | Move to Vercel Hobby (1M invocations/month) + Upstash Redis for state | Rejected: Hobby **forbids commercial use**, and the paid offers in `project-vision.md` make that a grey zone at best. It also adds a storage migration, and polling still drives both quotas |
| C | Cloudflare Workers + one **Durable Object per game**, **WebSockets** (push) | Best target; too big for now. **Future optimisation**, see the last section |

## Design (option A)

### 1. The backend becomes an Edge Function

- **New:** `netlify/edge-functions/quiz-api.mjs`. A thin wrapper, like today's: it builds `createApi({ store, content, hostKey })` and returns `api(req)`.
  - `export const config = { path: "/api/quiz/*" }`: **same route**, so the client doesn't change.
  - `hostKey: Netlify.env.get("QUIZ_HOST_KEY")?.trim()`. `process.env` doesn't exist on edge. The variable must have the **Functions** scope; check it in the Netlify UI.
  - `store: getStore({ name: "quiz", consistency: "strong" })`, imported from `@netlify/blobs`. Netlify resolves npm packages for edge functions.
- **Removed:** `netlify/functions/quiz-api.mjs` and the `[functions]` block in `netlify.toml`, so nothing counts against the 125k quota any more.
- **Unchanged:** `netlify/lib/quiz/*` and `quiz/lib/*`. Deno supports `node:crypto` (`createHash`, `timingSafeEqual`) and JSON imports with `with { type: "json" }`, so the `node:test` tests keep covering all the logic.
- **Redirects:** the `/netlify/*` → 404 rule stays. Edge functions are served from their route, not from the folder.
- **Edge limits:** 50 ms of CPU per request (I/O excluded), 20 MB bundle. `/host-state` reads one blob per player (about 30 reads), which is I/O and so not counted. `quiz-data/` weighs 40 KB.

**Risk to clear first (spike):** `consistency: "strong"` on Blobs **inside an Edge Function**. We check it on a deploy preview: a player joins, and an immediate `/host-state` call must see that player.
- If it fails: fall back to eventual consistency.
- That's acceptable because the game state is written by one actor only (the host), and each phone writes only its own `player` key.
- The worst case is a lag of a few seconds on the host screen's counter.

### 2. Polling that depends on the status

New pure module, `quiz/lib/pacing.js`, shared by the host and the phones:

```js
// Returns the delay before the next poll in ms, or null to stop.
export function nextDelay({ role, status, hidden, idleMs }) // role: "host" | "player"
export const IDLE_LIMIT_MS = 15 * 60 * 1000;
```

| Situation | Player | Host |
|---|---|---|
| `hidden` tab | `null` (paused) | `null` (paused) |
| `idleMs >= IDLE_LIMIT_MS` (state unchanged) | `null` (paused) | `null` (paused) |
| `closed` (lobby) | 3000 | 5000 |
| `open` | 3000 | 2000 |
| `reveal` | 1500 | 1500 |
| `done` | `null` (stop) | 5000 |

How it behaves in the loops (`quiz/app.js`, `quiz/host/host.js`):
- After each poll, the loop asks `nextDelay(...)` for the next delay. On `null`, it schedules nothing.
- `idleMs` = the time since the **last state change**. The comparison uses `status`, `revealIndex`, and on the host side the player count and number of answers.
- **Resuming:**
  - `visibilitychange` → `visible` triggers one immediate refresh, then the loop starts again.
  - When the idle cutoff paused the loop, a « Pause — touchez pour reprendre » banner appears. Any `pointerdown` or `keydown` resets `idleMs` and restarts the loop.
  - A host action (open, reveal, next…) always resets `idleMs`.
- The loop can't be armed twice: one `timer` per loop, and `clearTimeout` before rescheduling.
- A phone at `done` still shows its final screen. No more calls are needed: the reveal is finished.

**Estimate:** a 30-player game drops from about 20k to about 12k calls, and forgotten tabs cost 0. With 1M edge calls a month, that's about 80 games a month.

### 3. Error handling

- Network errors: same as today. The loop logs and retries at the next delay.
- If the Edge Function is down (an outage, or the edge quota is used up), the client keeps its current error messages.
- The idle pause isn't an error: a neutral banner, no `role="alert"`.

### 4. Tests

- `tests/quiz/pacing.test.mjs`, written first (TDD): one case per row of the table, plus `hidden` taking priority over every status, plus idle exactly at the limit (pauses) and just below it (doesn't pause).
- Existing tests: `pnpm test` stays green.
- Manual check on the deploy preview: the consistency spike, then `pnpm quiz:simulate` against the preview URL, then a hidden tab showing no requests in the Network panel.

### 5. Documentation

- `docs/quiz.md`: the backend is an Edge Function; the quotas; « fermez l'écran animateur après la partie » (polling stops on its own after 15 min anyway); the `QUIZ_HOST_KEY` scope.
- `CLAUDE.md` and `docs/architecture.md`: "one Netlify Function" becomes "one Netlify Edge Function".

### Out of scope

- Caching `/state` at the CDN. It's personalised by session and changes often; not worth it at this volume.
- Leaving Netlify.

## Future optimisation: Cloudflare Durable Objects + WebSockets (option C)

**When to do it:** edge usage goes above about 50% of the monthly quota; or we want instant reveals on the phones; or cohorts grow (for example, more than 100 players per game); or Netlify migrates the team to the credit-based plan.

### Architecture

```
phone / host ──WebSocket──► Worker (routing /api/quiz/:session/ws)
                                  │ idFromName(session)
                                  ▼
                         Durable Object "QuizGame" (1 per game)
                         - SQLite storage: state, players, answers
                         - WebSocket Hibernation API
                         - broadcast on each change
```

- **One Durable Object per game** (`idFromName(session)`). It holds the state, is the single writer (no more consistency questions), and broadcasts each change to every connected socket.
- **Push instead of poll:**
  - The client opens a WebSocket at startup and receives a `state` message on every change: `open`, `reveal`, `next`, a player joining, an answer.
  - The host receives the counters live.
  - Answers can go through the socket or stay as `POST` requests.
- **Hibernation API** (`ctx.acceptWebSocket`): no duration cost while nobody is talking. The DO wakes up for a message and goes back to sleep.
- **Fallback:** if the WebSocket breaks, the client reconnects with backoff. While it's down, it polls the `GET` routes slowly, through the same `pacing.js`.

### Reuse

- `createApi` already takes an injected `store` with a small interface (`get`, `setJSON`, `list`, `delete`). Write a `DurableObjectStore` adapter over `ctx.storage` (KV or SQLite) and the game logic doesn't move.
- `content.mjs` (JSON bundled at build time) works the same with Wrangler (esbuild).
- The `pacing.js` from this design becomes the fallback strategy.

### Hosting

- Either the whole site on **Workers Static Assets** (static requests are free and unmetered), or just the API on Cloudflare (`api.<domain>` with CORS) while the site stays on Netlify. Preference: the whole site, to avoid CORS and having two platforms.
- Secret: `QUIZ_HOST_KEY` through `wrangler secret put`.

### Quotas (Cloudflare Free plan, checked on 2026-11-24)

- Workers: **100,000 requests a day**, reset daily, 10 ms of CPU per invocation ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)).
- Durable Objects (SQLite backend available on Free): **100,000 requests a day**, covering HTTP, RPC, incoming WebSocket messages and alarms ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Incoming WebSocket messages are billed at 20:1. Outgoing messages (the broadcast) aren't billed as requests.
- A 30-player game is about 30 connections plus a few hundred answers, **≈ 500 billed requests**, against about 12k calls with A.

### Migration path

1. Write a `DurableObjectStore` adapter and test it in `node:test` with a `ctx.storage` fake.
2. Create a `QuizGame` DO that exposes the current HTTP routes, so the existing clients work unchanged.
3. Add the WebSocket route and a `subscribe(session, onState)` on the client side, with polling fallback.
4. Move the site (or only the API) to Cloudflare; update DNS.
5. Remove the Netlify Edge Function.

### Risks

- 10 ms of CPU per invocation on the Workers Free plan: `/host-state` (aggregating scores) has to fit. Measure it.
- WebSockets on venue Wi-Fi: proxies can cut them, so the polling fallback is required.
- A second platform to run if the site stays on Netlify.
