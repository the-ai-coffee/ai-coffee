# Quiz Quota: Edge Function + Paced Polling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the Quiz Espresso out of the Netlify Serverless Functions quota (125k calls a month) by serving `/api/quiz/*` from an Edge Function (1M a month), and by cutting polling to what each game status needs.

**Architecture:**
- **Backend:** the thin Netlify wrapper moves from `netlify/functions/` to `netlify/edge-functions/`. The route stays `/api/quiz/*`. The tested logic in `netlify/lib/quiz/` doesn't change.
- **Polling:** a new pure module `quiz/lib/pacing.js` holds the cadence table (`nextDelay`) and a loop driver with injected dependencies (`pacedLoop`). The phone app and the host screen both use it, replacing their own `setTimeout` loops.

**Tech Stack:** vanilla ES modules (no build step), Netlify Edge Functions (Deno) + `@netlify/blobs`, `node:test` (`pnpm test`), Node ≥ 22.12, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-24-quiz-quota-design.md`

## Global Constraints

- Branch: `fix/quiz-quota-edge`. Don't commit to `main`.
- Route stays exactly `/api/quiz/*`, so `quiz/lib/api.js` (`BASE = "/api/quiz"`) doesn't change.
- `netlify/lib/quiz/*` must not change (both runtimes share it).
- Edge env access: `Netlify.env.get("QUIZ_HOST_KEY")`. Never `process.env` in the edge file.
- Polling table (ms; `null` = no further poll):

  | status | player | host |
  |---|---|---|
  | `closed` | 3000 | 5000 |
  | `open` | 3000 | 2000 |
  | `reveal` | 1500 | 1500 |
  | `done` | `null` | 5000 |

  Hidden tab → `null`. `idleMs >= IDLE_LIMIT_MS` (15 × 60 × 1000) → `null`.
- The idle pause banner is neutral (`role="status"`, never `role="alert"`). Text:
  - phone: `Pause — touchez pour reprendre`
  - host: `Pause — cliquez pour reprendre`
- User-facing copy is in French. Code, comments and commit messages are in English.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Keep `pnpm test` green after every task.

## File Map

| File | Change | Responsibility |
|---|---|---|
| `netlify/edge-functions/quiz-api.mjs` | Create | Edge wiring: Blobs store + content + host key → `createApi` |
| `netlify/functions/quiz-api.mjs` | Delete | Old serverless wiring |
| `netlify.toml` | Modify | Drop the `[functions]` block |
| `tests/quiz/edge-wiring.test.mjs` | Create | Guard: edge route exists, serverless function gone |
| `quiz/lib/pacing.js` | Create | `IDLE_LIMIT_MS`, `nextDelay()`, `pacedLoop()` |
| `tests/quiz/pacing.test.mjs` | Create | Cadence table + loop driver behaviour |
| `quiz/app.js` | Modify | Phone loop → `pacedLoop` + pause banner |
| `quiz/host/host.js` | Modify | Host loop → `pacedLoop` + pause banner |
| `quiz/quiz.css` | Modify | `.paused` banner style (loaded by both pages) |
| `docs/quiz.md`, `docs/development.md`, `CLAUDE.md` | Modify | Edge Function, quotas, troubleshooting |

---

### Task 1: Serve the API from an Edge Function

**Files:**
- Create: `netlify/edge-functions/quiz-api.mjs`
- Delete: `netlify/functions/quiz-api.mjs`
- Modify: `netlify.toml` (remove the `[functions]` block)
- Modify: `CLAUDE.md`, `docs/development.md`
- Test: `tests/quiz/edge-wiring.test.mjs`

**Interfaces:**
- Consumes: `createApi({ store, content, hostKey })` from `netlify/lib/quiz/api.mjs`; `content` from `netlify/lib/quiz/content.mjs`; `getStore` from `@netlify/blobs`.
- Produces: `export default async (req) => Response` and `export const config = { path: "/api/quiz/*" }`.

- [ ] **Step 1: Write the failing test**

Create `tests/quiz/edge-wiring.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);

test("the quiz API is an Edge Function on /api/quiz/*", async () => {
  // Importing is safe in Node: Netlify.env is only read inside the handler.
  const mod = await import("../../netlify/edge-functions/quiz-api.mjs");
  assert.equal(typeof mod.default, "function");
  assert.deepEqual(mod.config, { path: "/api/quiz/*" });
});

test("no Serverless Function is left to count against the 125k quota", () => {
  assert.equal(existsSync(new URL("netlify/functions", root)), false);
  assert.doesNotMatch(readFileSync(new URL("netlify.toml", root), "utf8"), /^\[functions\]/m);
});

test("the edge wiring never reads process.env", () => {
  const src = readFileSync(new URL("netlify/edge-functions/quiz-api.mjs", root), "utf8");
  assert.doesNotMatch(src, /process\.env/);
  assert.match(src, /Netlify\.env\.get\("QUIZ_HOST_KEY"\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quiz/edge-wiring.test.mjs`
Expected: FAIL. `ERR_MODULE_NOT_FOUND` for `netlify/edge-functions/quiz-api.mjs`, and `netlify/functions` still exists.

- [ ] **Step 3: Create the edge function**

Create `netlify/edge-functions/quiz-api.mjs`:

```js
import { getStore } from "@netlify/blobs";
import { createApi } from "../lib/quiz/api.mjs";
import { content } from "../lib/quiz/content.mjs";

// Thin Netlify wiring: everything testable lives in netlify/lib/quiz/.
// Edge, not serverless: on the legacy Free plan Edge Functions have their own
// 1M/month quota vs 125k for Serverless Functions.
// See docs/superpowers/specs/2026-11-24-quiz-quota-design.md.
export default async (req) => {
  const api = createApi({
    store: getStore({ name: "quiz", consistency: "strong" }),
    content,
    hostKey: Netlify.env.get("QUIZ_HOST_KEY")?.trim(),
  });
  return api(req);
};

export const config = { path: "/api/quiz/*" };
```

- [ ] **Step 4: Remove the serverless function and its config**

```bash
git rm netlify/functions/quiz-api.mjs
```

In `netlify.toml`, delete these lines (and the blank line after them):

```toml
[functions]
  directory = "netlify/functions"
  node_bundler = "esbuild"
```

Keep the `/netlify/*` → 404 redirect: edge functions are served from their route, never from the folder.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: all PASS, including the 3 new edge-wiring tests.

- [ ] **Step 6: Update the docs that name the old function**

In `CLAUDE.md`:
- Line 7: change `one Netlify Function + Netlify Blobs` to `one Netlify Edge Function + Netlify Blobs`.
- Line 25: change `` `functions/quiz-api.mjs` (the `/api/quiz/*` function) `` to `` `edge-functions/quiz-api.mjs` (the `/api/quiz/*` Edge Function — edge, not serverless, for the larger free quota) ``.
- Line 26: change `bundled into the function at build time` to `bundled into the Edge Function at build time`.

In `docs/development.md` line 32: change `serveur local avec Netlify Functions et Blobs` to `serveur local avec la Netlify Edge Function et Blobs`.

- [ ] **Step 7: Smoke-test locally**

```bash
printf 'QUIZ_HOST_KEY=dev-key\n' > .env   # if not already there; gitignored
pnpm dev                                  # netlify dev; first run downloads Deno for edge functions
```

In a second terminal:

```bash
QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo
```

Expected: the simulation completes with no HTTP errors. The `netlify dev` log shows requests handled by the `quiz-api` edge function.

- [ ] **Step 8: Commit**

```bash
git add netlify/edge-functions/quiz-api.mjs netlify.toml tests/quiz/edge-wiring.test.mjs CLAUDE.md docs/development.md
git commit -m "Serve the quiz API from a Netlify Edge Function

The serverless function hit the legacy 125k/month Functions quota.
Edge Functions have a separate 1M/month quota; the route and the
tested API logic are unchanged.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Consistency spike on a deploy preview (blocking gate)

Checks the spec's one open risk: `consistency: "strong"` Blobs inside an Edge Function. **No later task is deployed until this passes**, but Tasks 3–6 can be written in parallel.

**Files:** none are changed if the check passes. If it fails, modify `netlify/edge-functions/quiz-api.mjs` (Step 4).

**Interfaces:**
- Consumes: the Task 1 edge function, deployed.
- Produces: a pass/fail verdict recorded in the PR description.

- [ ] **Step 1: Check the env var scope**

Netlify UI → *the-ai-coffee* → *Site configuration* → *Environment variables* → `QUIZ_HOST_KEY` must include the **Functions** scope, and apply to *Deploy Previews*. If it doesn't, fix it before deploying. Edge Functions can't see variables without that scope.

- [ ] **Step 2: Push and open the PR to get a deploy preview**

```bash
git push -u origin fix/quiz-quota-edge
gh pr list --head fix/quiz-quota-edge   # reuse if one exists
gh pr create --base main --title "Quiz: move the API to an Edge Function and pace polling" --body "Fixes the Netlify « exceeded the Functions limit » block. Spec: docs/superpowers/specs/2026-11-24-quiz-quota-design.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Wait for the Netlify deploy-preview check. Its URL looks like `https://deploy-preview-<N>--the-ai-coffee.netlify.app`.

- [ ] **Step 3: Run the read-after-write probe**

```bash
PREVIEW=https://deploy-preview-<N>--the-ai-coffee.netlify.app QUIZ_HOST_KEY=<the real key> node --input-type=module <<'EOF'
const base = `${process.env.PREVIEW}/api/quiz`;
const auth = { authorization: `Bearer ${process.env.QUIZ_HOST_KEY}` };
const call = async (method, path, body, headers = {}) => {
  const res = await fetch(`${base}/${path}?s=demo`, { method, headers: { ...headers, ...(body ? { "content-type": "application/json" } : {}) }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};
let misses = 0;
for (let i = 0; i < 10; i++) {
  await call("POST", "host", { action: "reset" }, auth);
  await call("POST", "host", { action: "open" }, auth);
  const join = await call("POST", "join", { pseudo: `Probe${i}` });
  if (join.status !== 200) throw new Error(`join failed: ${JSON.stringify(join)}`);
  const hs = await call("GET", "host-state", undefined, auth);
  const seen = hs.body.players?.some((p) => p.id === join.body.pid);
  if (!seen) misses++;
  console.log(i, seen ? "seen" : "MISSED", hs.body.state?.status);
}
await call("POST", "host", { action: "reset" }, auth);
console.log(misses === 0 ? "PASS: strong consistency holds at the edge" : `FAIL: ${misses}/10 reads missed the write`);
EOF
```

Expected: `PASS`, with every row showing `seen open`. This only touches the `demo` session, never a real one.

- [ ] **Step 4: Only if Step 3 prints FAIL, fall back to eventual consistency**

In `netlify/edge-functions/quiz-api.mjs`, change the store line to:

```js
    // Strong consistency is not honoured at the edge (spike, 2026-11-24): eventual is
    // acceptable because only the host writes the game state and each phone writes
    // only its own player key; the host counter may lag a few seconds.
    store: getStore({ name: "quiz", consistency: "eventual" }),
```

Run `pnpm test` (expected: PASS), then commit (`git commit -am "Use eventual Blobs consistency at the edge" ...` with the co-author trailer), push, and re-run Step 3. Expected: misses are allowed now, but `join` must keep returning 200. Run `QUIZ_HOST_KEY=<key> pnpm quiz:simulate demo --url $PREVIEW`; it must complete with no errors.

- [ ] **Step 5: Record the verdict**

Add one line to the PR description: `Edge Blobs consistency spike: PASS (strong)` or `FAIL → eventual`.

---

### Task 3: `nextDelay` — the polling cadence table

**Files:**
- Create: `quiz/lib/pacing.js`
- Test: `tests/quiz/pacing.test.mjs`

**Interfaces:**
- Produces:
  - `export const IDLE_LIMIT_MS = 900000`
  - `export function nextDelay({ role, status, hidden = false, idleMs = 0 }): number | null`
  - `role` is `"player" | "host"`. Throws `Error("unknown role: …")` for anything else.
  - An unknown `status` falls back to that role's `closed` delay.

- [ ] **Step 1: Write the failing tests**

Create `tests/quiz/pacing.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { IDLE_LIMIT_MS, nextDelay } from "../../quiz/lib/pacing.js";

test("idle limit is 15 minutes", () => {
  assert.equal(IDLE_LIMIT_MS, 15 * 60 * 1000);
});

test("player cadence follows the status and stops once done", () => {
  assert.equal(nextDelay({ role: "player", status: "closed" }), 3000);
  assert.equal(nextDelay({ role: "player", status: "open" }), 3000);
  assert.equal(nextDelay({ role: "player", status: "reveal" }), 1500);
  assert.equal(nextDelay({ role: "player", status: "done" }), null);
});

test("host cadence follows the status and keeps a slow poll when done", () => {
  assert.equal(nextDelay({ role: "host", status: "closed" }), 5000);
  assert.equal(nextDelay({ role: "host", status: "open" }), 2000);
  assert.equal(nextDelay({ role: "host", status: "reveal" }), 1500);
  assert.equal(nextDelay({ role: "host", status: "done" }), 5000);
});

test("a hidden tab never polls, whatever the status", () => {
  for (const role of ["player", "host"]) {
    for (const status of ["closed", "open", "reveal", "done"]) {
      assert.equal(nextDelay({ role, status, hidden: true }), null, `${role}/${status}`);
    }
  }
});

test("the idle cutoff pauses at the limit, not just below it", () => {
  assert.equal(nextDelay({ role: "host", status: "open", idleMs: IDLE_LIMIT_MS - 1 }), 2000);
  assert.equal(nextDelay({ role: "host", status: "open", idleMs: IDLE_LIMIT_MS }), null);
  assert.equal(nextDelay({ role: "player", status: "reveal", idleMs: IDLE_LIMIT_MS + 1 }), null);
});

test("an unknown status falls back to the lobby cadence; an unknown role throws", () => {
  assert.equal(nextDelay({ role: "player", status: undefined }), 3000);
  assert.equal(nextDelay({ role: "host", status: "weird" }), 5000);
  assert.throws(() => nextDelay({ role: "viewer", status: "open" }), /unknown role: viewer/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quiz/pacing.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `quiz/lib/pacing.js`.

- [ ] **Step 3: Write the implementation**

Create `quiz/lib/pacing.js`:

```js
// Polling cadence for the quiz. Every poll is a billed Netlify call, so each
// loop polls only as fast as its game status needs, never from a hidden tab,
// and pauses after a long stretch without any change.

export const IDLE_LIMIT_MS = 15 * 60 * 1000;

// ms before the next poll; null = nothing left to follow.
const DELAYS = {
  player: { closed: 3000, open: 3000, reveal: 1500, done: null },
  host: { closed: 5000, open: 2000, reveal: 1500, done: 5000 },
};

export function nextDelay({ role, status, hidden = false, idleMs = 0 }) {
  const table = DELAYS[role];
  if (!table) throw new Error(`unknown role: ${role}`);
  if (hidden || idleMs >= IDLE_LIMIT_MS) return null;
  return Object.hasOwn(table, status) ? table[status] : table.closed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/quiz/pacing.test.mjs`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add quiz/lib/pacing.js tests/quiz/pacing.test.mjs
git commit -m "Add the quiz polling cadence table

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `pacedLoop` — the shared loop driver

**Files:**
- Modify: `quiz/lib/pacing.js` (append)
- Test: `tests/quiz/pacing.test.mjs` (append)

**Interfaces:**
- Consumes: `nextDelay`, `IDLE_LIMIT_MS` (Task 3).
- Produces:
  ```js
  export function pacedLoop({
    role,            // "player" | "host"
    tick,            // async () => void; one refresh. Throwing is logged, then retried at the next delay
    status,          // () => string | undefined; current game status, read after each tick
    signature,       // () => string; changes whenever something worth watching changed (resets the idle clock)
    onPause = () => {},   // idle cutoff reached: show the pause banner
    onResume = () => {},  // resumed after an idle pause: hide the banner
    immediate = true,     // false: wait one delay before the first tick
    doc = globalThis.document, // EventTarget with a boolean `hidden`
    now = Date.now,
    timers = globalThis,       // { setTimeout, clearTimeout }
  }): { wake(): void, stop(): void }
  ```
- Behaviour:
  - Ticks never overlap. Exactly one timer is armed at a time.
  - After each tick, the loop compares `signature()` with the previous value. A change resets the idle clock.
  - It then schedules the next tick:
    - Stop for good, with no banner, if `nextDelay({role, status})` is `null` even when visible and not idle (player at `done`).
    - Stop without a banner if `doc.hidden`.
    - Stop and call `onPause()` once if the idle cutoff is reached.
    - Otherwise arm `setTimeout(run, delay)`.
  - `visibilitychange` to visible calls `wake()`.
  - `pointerdown` or `keydown` calls `wake()` when paused, and otherwise just resets the idle clock.
  - `wake()` resets the idle clock, calls `onResume()` if paused, clears the timer and ticks now.
  - `stop()` clears the timer for good.

- [ ] **Step 1: Write the failing tests**

Append to `tests/quiz/pacing.test.mjs`. First extend the import line at the top of the file to:

```js
import { IDLE_LIMIT_MS, nextDelay, pacedLoop } from "../../quiz/lib/pacing.js";
```

and add `import { mock } from "node:test";` below the existing `node:test` import. Then append:

```js
// ---------- pacedLoop ----------

const flush = () => new Promise((resolve) => setImmediate(resolve)); // let the async tick settle

function harness({ role = "player", status = "open", immediate = true, failFirst = false } = {}) {
  const doc = new EventTarget();
  doc.hidden = false;
  let t = 0;
  let nextId = 1;
  const armed = new Map(); // id → { fn, ms }
  const timers = {
    setTimeout: (fn, ms) => (armed.set(nextId, { fn, ms }), nextId++),
    clearTimeout: (id) => armed.delete(id),
  };
  const h = {
    doc,
    status,
    sig: "a",
    ticks: 0,
    pauses: 0,
    resumes: 0,
    advance: (ms) => (t += ms),
    pending: () => [...armed.values()].map((x) => x.ms),
    fire: async () => {
      const [[id, { fn }]] = armed;
      armed.delete(id);
      fn();
      await flush();
    },
  };
  h.loop = pacedLoop({
    role,
    immediate,
    doc,
    timers,
    now: () => t,
    status: () => h.status,
    signature: () => h.sig,
    tick: async () => {
      h.ticks++;
      if (failFirst && h.ticks === 1) throw new Error("network down");
    },
    onPause: () => h.pauses++,
    onResume: () => h.resumes++,
  });
  return h;
}

test("pacedLoop ticks at the status delay and stops for good once the player is done", async () => {
  const h = harness();
  await flush();
  assert.equal(h.ticks, 1);
  assert.deepEqual(h.pending(), [3000]);
  h.status = "reveal";
  await h.fire();
  assert.deepEqual(h.pending(), [1500]);
  h.status = "done";
  await h.fire();
  assert.equal(h.ticks, 3);
  assert.deepEqual(h.pending(), []);
  assert.equal(h.pauses, 0, "finishing is not an idle pause");
});

test("pacedLoop with immediate: false waits one delay before the first tick", async () => {
  const h = harness({ immediate: false });
  await flush();
  assert.equal(h.ticks, 0);
  assert.deepEqual(h.pending(), [3000]);
});

test("pacedLoop goes quiet in a hidden tab and refreshes at once when it is visible again", async () => {
  const h = harness();
  await flush();
  h.doc.hidden = true;
  await h.fire(); // the timer armed before hiding still fires once
  assert.equal(h.ticks, 2);
  assert.deepEqual(h.pending(), []);
  assert.equal(h.pauses, 0, "a hidden tab shows no banner");
  h.doc.hidden = false;
  h.doc.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(h.ticks, 3);
  assert.deepEqual(h.pending(), [3000]);
});

test("pacedLoop pauses after 15 minutes without change and resumes on interaction", async () => {
  const h = harness({ role: "host", status: "closed" });
  await flush();
  h.advance(IDLE_LIMIT_MS);
  await h.fire();
  assert.deepEqual(h.pending(), []);
  assert.equal(h.pauses, 1);
  h.doc.dispatchEvent(new Event("pointerdown"));
  await flush();
  assert.equal(h.resumes, 1);
  assert.equal(h.ticks, 3);
  assert.deepEqual(h.pending(), [5000]);
});

test("pacedLoop keeps polling while the signature keeps changing", async () => {
  const h = harness({ role: "host", status: "open" });
  await flush();
  for (let i = 0; i < 4; i++) {
    h.advance(IDLE_LIMIT_MS / 2);
    h.sig = `s${i}`;
    await h.fire();
  }
  assert.deepEqual(h.pending(), [2000]);
  assert.equal(h.pauses, 0);
});

test("pacedLoop: an interaction while running only resets the idle clock", async () => {
  const h = harness({ role: "host", status: "open" });
  await flush();
  h.advance(IDLE_LIMIT_MS - 1000);
  h.doc.dispatchEvent(new Event("keydown"));
  await flush();
  assert.equal(h.ticks, 1, "no extra request on every key press");
  h.advance(2000);
  await h.fire();
  assert.deepEqual(h.pending(), [2000], "the key press kept the loop alive");
});

test("pacedLoop logs a failing tick and retries at the next delay", async () => {
  const warn = mock.method(console, "warn", () => {});
  try {
    const h = harness({ failFirst: true });
    await flush();
    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(h.pending(), [3000]);
    await h.fire();
    assert.equal(h.ticks, 2);
  } finally {
    warn.mock.restore();
  }
});

test("pacedLoop.stop() clears the timer for good", async () => {
  const h = harness();
  await flush();
  h.loop.stop();
  assert.deepEqual(h.pending(), []);
  h.doc.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(h.ticks, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quiz/pacing.test.mjs`
Expected: the 6 `nextDelay` tests PASS. The `pacedLoop` tests FAIL with `SyntaxError: The requested module ... does not provide an export named 'pacedLoop'`, which fails the whole file. That's fine.

- [ ] **Step 3: Write the implementation**

Append to `quiz/lib/pacing.js`:

```js
// Drives one polling loop with nextDelay(). Dependencies are injected so
// node:test can run it without a browser.
export function pacedLoop({
  role,
  tick,
  status,
  signature,
  onPause = () => {},
  onResume = () => {},
  immediate = true,
  doc = globalThis.document,
  now = Date.now,
  timers = globalThis,
}) {
  let timer = null;
  let running = false;
  let paused = false; // stopped by the idle cutoff, waiting for an interaction
  let stopped = false;
  let lastSig = signature();
  let lastChange = now();

  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clear();
    if (stopped) return;
    const s = status();
    if (nextDelay({ role, status: s }) === null) return; // finished: nothing left to follow
    if (doc.hidden) return; // resumes on visibilitychange
    const delay = nextDelay({ role, status: s, idleMs: now() - lastChange });
    if (delay !== null) timer = timers.setTimeout(run, delay);
    else if (!paused) {
      paused = true;
      onPause();
    }
  };

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await tick();
    } catch (err) {
      console.warn("[quiz] poll", err);
    }
    running = false;
    const sig = signature();
    if (sig !== lastSig) {
      lastSig = sig;
      lastChange = now();
    }
    schedule();
  };

  const wake = () => {
    if (stopped) return;
    lastChange = now();
    if (paused) {
      paused = false;
      onResume();
    }
    clear();
    run();
  };

  const touch = () => {
    if (paused) wake();
    else lastChange = now();
  };

  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) wake();
  });
  doc.addEventListener("pointerdown", touch);
  doc.addEventListener("keydown", touch);

  if (immediate) run();
  else schedule();

  return {
    wake,
    stop() {
      stopped = true;
      clear();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/quiz/pacing.test.mjs`
Expected: 14 tests PASS.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add quiz/lib/pacing.js tests/quiz/pacing.test.mjs
git commit -m "Add pacedLoop: status-aware polling that sleeps when hidden or idle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Wire the phone app and add the pause banner

**Files:**
- Modify: `quiz/app.js`: imports (top), `main()` (around lines 117–132), delete the old `loop()` (around lines 134–142)
- Modify: `quiz/quiz.css` (append the `.paused` rule)

**Interfaces:**
- Consumes: `pacedLoop` (Task 4); the existing `refresh()`, `state`, `h()` in `quiz/app.js`.
- Produces: the `.paused` CSS class, reused by Task 6.

- [ ] **Step 1: Add the banner style**

Append to `quiz/quiz.css`:

```css
/* Idle polling pause (quiz/lib/pacing.js): neutral, not an error. */
.paused { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 20; margin: 0; padding: 10px 18px; border-radius: 999px; background: var(--ink); color: var(--paper); font-family: var(--mono); font-size: 13px; letter-spacing: 0.04em; white-space: nowrap; box-shadow: 0 4px 16px rgb(0 0 0 / 0.15); }
.paused[hidden] { display: none; }
```

- [ ] **Step 2: Import `pacedLoop` in `quiz/app.js`**

Add after the `import { MAX_PSEUDO_LENGTH, randomPseudo } from "./lib/pseudo.js";` line:

```js
import { pacedLoop } from "./lib/pacing.js";
```

- [ ] **Step 3: Replace the phone loop**

In `main()`, replace the last line `  setTimeout(loop, 3000);` with:

```js
  // main() just fetched the game: wait one delay before the first poll.
  pacedLoop({
    role: "player",
    tick: refresh,
    status: () => state?.status,
    signature: () => (state ? `${state.status}:${state.revealIndex}:${state.durationSec ?? ""}` : ""),
    onPause: () => (pauseBanner.hidden = false),
    onResume: () => (pauseBanner.hidden = true),
    immediate: false,
  });
```

Delete this whole block, which is directly below `main()`:

```js
// Faster polling during the reveal so phones follow the shared screen.
async function loop() {
  try {
    await refresh();
  } catch (err) {
    console.warn("[quiz] poll", err);
  }
  setTimeout(loop, REVEALED.has(state?.status) ? 1500 : 3000);
}
```

Just above `async function main() {`, add:

```js
// Shown when polling pauses after a long idle stretch (quiz/lib/pacing.js).
const pauseBanner = h("p", { class: "paused", role: "status", hidden: true }, "Pause — touchez pour reprendre");
document.body.append(pauseBanner);
```

`REVEALED` is still used elsewhere in `app.js`, so keep it.

- [ ] **Step 4: Check that nothing else references the old loop**

Run: `grep -n "loop" quiz/app.js`
Expected: only the `pacedLoop` import and the call.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: all PASS. `tests/quiz/front-api.test.mjs` covers `quiz/lib/api.js`, which is unchanged.

- [ ] **Step 6: Manual check in the browser**

With `pnpm dev` running, open `http://localhost:8888/quiz/?s=demo` and DevTools → Network, filtered on `api/quiz`.
1. Lobby: one `/state` call every ~3 s.
2. Switch to another tab for 20 s, then come back: no calls while hidden, one immediately on return.
3. Run `QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo` to the end. Once the status is `done`, the calls stop.
4. Idle cutoff, using a temporary hack you **must not commit**:
   - Edit `IDLE_LIMIT_MS` to `10 * 1000` and reload.
   - After ~10 s the banner « Pause — touchez pour reprendre » appears and the calls stop.
   - Tap the page: the banner hides and a call fires.
   - Then revert with `git checkout quiz/lib/pacing.js`.

- [ ] **Step 7: Commit**

```bash
git add quiz/app.js quiz/quiz.css
git commit -m "Phone app: paced polling, stop at done, pause when hidden or idle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the host screen

**Files:**
- Modify: `quiz/host/host.js`: imports (top), delete `loop()` (around lines 158–165), replace the last line `else loop();` (around line 362)

**Interfaces:**
- Consumes: `pacedLoop` (Task 4); the `.paused` class (Task 5); the existing `refresh()`, `data`, `h()` in `host.js`.
- Produces: nothing new.

- [ ] **Step 1: Import `pacedLoop`**

Add after `import { formatClock, gameDurationSec, remainingSec } from "../lib/timing.js";`:

```js
import { pacedLoop } from "../lib/pacing.js";
```

- [ ] **Step 2: Delete the old loop**

Remove this block from the `// ---------- polling ----------` section (keep `refresh()`):

```js
async function loop() {
  try {
    await refresh();
  } catch (err) {
    console.warn("[quiz] poll", err);
  }
  setTimeout(loop, 1000);
}
```

- [ ] **Step 3: Start the paced loop**

Replace the final line `else loop();` with:

```js
else {
  // Shown when polling pauses after a long idle stretch (quiz/lib/pacing.js).
  const pauseBanner = h("p", { class: "paused", role: "status", hidden: true }, "Pause — cliquez pour reprendre");
  document.body.append(pauseBanner);
  pacedLoop({
    role: "host",
    tick: () => refresh(),
    status: () => data?.state.status,
    // New players and new answers count as activity, not just status changes.
    signature: () => (data ? JSON.stringify([data.state, data.players.map((p) => p.answered)]) : ""),
    onPause: () => (pauseBanner.hidden = false),
    onResume: () => (pauseBanner.hidden = true),
  });
}
```

Notes for the implementer:
- `tick: () => refresh()` and not `tick: refresh`. Otherwise `refresh(fromAction)` could receive an argument.
- Host actions already call `refresh(true)` themselves, and they always come from a click or key press, which resets the idle clock through the `pointerdown`/`keydown` listeners. No extra wiring is needed.
- `data.players` is the array returned by `GET host-state` (see `tests/quiz/api-host.test.mjs`).

- [ ] **Step 4: Check that nothing else references the old loop**

Run: `grep -n "loop" quiz/host/host.js`
Expected: only the `pacedLoop` import and the call.

- [ ] **Step 5: Run the tests**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 6: Manual check in the browser**

With `pnpm dev` running, open `http://localhost:8888/quiz/host/?s=demo#key=dev-key` and DevTools → Network, filtered on `host-state`.
1. Lobby (`closed`): a call every ~5 s.
2. Press Space to open the game: every ~2 s. Run `QUIZ_HOST_KEY=dev-key pnpm quiz:simulate demo`: the reveal runs at ~1.5 s and `done` at ~5 s.
3. Hidden tab: no calls; one immediately on return.
4. Arrow keys and Space still navigate and reveal straight away, as before.
5. Idle cutoff: same temporary `IDLE_LIMIT_MS = 10 * 1000` hack as Task 5. The banner « Pause — cliquez pour reprendre » appears; a click resumes. Then run `git checkout quiz/lib/pacing.js`.

- [ ] **Step 7: Commit**

```bash
git add quiz/host/host.js
git commit -m "Host screen: paced polling instead of a 1 s loop forever

A forgotten host tab cost 86,400 calls a day; it now polls at 1.5–5 s
by status, never when hidden, and pauses after 15 idle minutes.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Organiser docs, preview verification, PR

**Files:**
- Modify: `docs/quiz.md` (section `## 🔐 Configuration`, line 18; section `## 🛟 Dépannage` table; new paragraph in `## 🎬 Le jour J`)

**Interfaces:**
- Consumes: everything above, deployed on the PR's preview.
- Produces: the PR, ready for review.

- [ ] **Step 1: Update `docs/quiz.md`**

In `## 🔐 Configuration`, step 2 (line 18), after `scope *Functions*.`, add: ` Ce scope couvre aussi l'Edge Function qui sert l'API du quiz.`

At the end of `## 🎬 Le jour J`, add:

```markdown
> 💡 **Quota Netlify** : l'API du quiz tourne en *Edge Function* (offre gratuite : 1 M d'appels par mois). Les téléphones et l'écran animateur interrogent l'API seulement quand c'est utile : rien quand l'onglet est masqué, plus rien côté joueurs une fois la partie terminée, et une pause automatique après 15 min sans changement (« Pause — touchez pour reprendre »). Fermez quand même l'écran animateur après la session.
```

In the `## 🛟 Dépannage` table, add these two rows at the end:

```markdown
| Bandeau « Pause — touchez/cliquez pour reprendre » | 15 min sans aucun changement : les appels sont suspendus pour économiser le quota | Toucher ou cliquer la page : la partie reprend aussitôt |
| Netlify : « exceeded the Functions limit » ou erreurs 5xx sur `/api/quiz/*` | Quota mensuel Netlify épuisé (*Team → Usage*) | Attendre la remise à zéro mensuelle ou passer à une offre payante ; option long terme : spec `docs/superpowers/specs/2026-11-24-quiz-quota-design.md`, section Cloudflare |
```

- [ ] **Step 2: Run tests and validation**

Run: `pnpm test && pnpm quiz:validate`
Expected: all PASS, no validation errors.

- [ ] **Step 3: Commit and push**

```bash
git add docs/quiz.md
git commit -m "Docs: quiz runs on an Edge Function; quota and pause troubleshooting

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

- [ ] **Step 4: End-to-end check on the deploy preview**

Once the preview of the latest commit is ready:

```bash
QUIZ_HOST_KEY=<the real key> pnpm quiz:simulate demo --url https://deploy-preview-<N>--the-ai-coffee.netlify.app
```

Expected: completes with no errors. Then open the preview's `/quiz/?s=demo` and `/quiz/host/?s=demo#key=<key>`, and repeat the hidden-tab check from Tasks 5 and 6 in the Network panel.

- [ ] **Step 5: Confirm no serverless invocations**

Netlify UI → *the-ai-coffee* → *Logs & metrics* → *Functions*: this deploy lists no functions. *Edge Functions*: `quiz-api` is listed and shows invocations from the simulation.

- [ ] **Step 6: Finalise the PR description**

```bash
gh pr edit --body "$(cat <<'EOF'
Fixes the Netlify « This team has exceeded the Functions limit » block.

- `/api/quiz/*` now runs as an **Edge Function** (legacy Free plan: 1M/month, separate from the 125k Serverless quota). Same route, same tested logic.
- **Paced polling** (`quiz/lib/pacing.js`): status-aware delays, no polling from hidden tabs, phones stop at `done`, 15-min idle pause with a resume banner. The host screen no longer polls every second forever.
- Edge Blobs consistency spike: <PASS (strong) | FAIL → eventual>
- Future option (Cloudflare Durable Objects + WebSockets) documented in the spec.

Spec: docs/superpowers/specs/2026-11-24-quiz-quota-design.md
Plan: docs/superpowers/plans/2026-11-24-quiz-quota-edge.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Replace `<PASS (strong) | FAIL → eventual>` with the Task 2 verdict. Report the PR URL.
