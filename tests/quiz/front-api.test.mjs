import { test } from "node:test";
import assert from "node:assert/strict";
import { ANSWER_TIMEOUT_MS, api, ApiError } from "../../quiz/lib/api.js";

// The browser client runs unchanged under Node: only `fetch` is stubbed.
function stubFetch(t, impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  t.after(() => {
    globalThis.fetch = original;
  });
}

test("a hanging answer request times out instead of blocking the send queue", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  stubFetch(
    t,
    (_url, { signal }) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))),
  );
  const pending = api.answer("demo", "p1", "q1", "ai", 1);
  t.mock.timers.tick(ANSWER_TIMEOUT_MS);
  await assert.rejects(pending, (err) => err instanceof ApiError && err.status === 0 && err.code === "timeout");
});

test("a network failure surfaces as ApiError « network »", async (t) => {
  stubFetch(t, async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(api.state("demo"), (err) => err instanceof ApiError && err.status === 0 && err.code === "network");
});

test("HTTP errors keep their status and code", async (t) => {
  stubFetch(t, async () => new Response(JSON.stringify({ error: "not_open" }), { status: 409 }));
  await assert.rejects(api.answer("demo", "p1", "q1", "ai", 1), (err) => err.status === 409 && err.code === "not_open");
});

test("a successful answer resolves with the body", async (t) => {
  stubFetch(t, async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  assert.deepEqual(await api.answer("demo", "p1", "q1", "ai", 1), { ok: true });
});

test("done posts the player id to the done route", async (t) => {
  let seen;
  stubFetch(t, async (url, init) => {
    seen = { url, method: init.method, body: JSON.parse(init.body) };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  assert.deepEqual(await api.done("demo", "p1"), { ok: true });
  assert.deepEqual(seen, { url: "/api/quiz/done?s=demo", method: "POST", body: { pid: "p1" } });
});
