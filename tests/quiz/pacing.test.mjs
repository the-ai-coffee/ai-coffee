import { mock, test } from "node:test";
import assert from "node:assert/strict";
import { IDLE_LIMIT_MS, nextDelay, pacedLoop } from "../../quiz/lib/pacing.js";

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
