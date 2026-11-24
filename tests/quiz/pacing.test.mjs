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
