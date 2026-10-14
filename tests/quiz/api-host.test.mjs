import { test } from "node:test";
import assert from "node:assert/strict";
import { A, B, setup, UID } from "../helpers/quiz-api.mjs";

test("host routes require a configured, matching key", async () => {
  const { call } = setup();
  assert.deepEqual(await call("POST", "host?s=test", { action: "open" }), { status: 401, body: { error: "unauthorized" } });
  assert.deepEqual(await call("POST", "host?s=test", { action: "open" }, "wrong"), { status: 401, body: { error: "unauthorized" } });
  assert.equal((await call("GET", "host-state?s=test", undefined, "wrong")).status, 401);
  const unconfigured = setup({ hostKey: "" }); // an empty env var counts as unset
  assert.deepEqual(await unconfigured.call("POST", "host?s=test", { action: "open" }, "x"), { status: 503, body: { error: "host_key_not_configured" } });
});

test("host-state reports players, aggregates, history comparison and profiles", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Alice", UID, A);
  await play("Bob", undefined, B);
  await host("reveal");
  const { status, body } = await call("GET", "host-state?s=test", undefined, "secret");
  assert.equal(status, 200);
  assert.deepEqual(body.players, [
    { id: "p1", pseudo: "Alice", avatar: "🦊", answered: 4, profile: "oracle" },
    { id: "p2", pseudo: "Bob", avatar: "🦊", answered: 3, profile: "temeraire" },
  ]);
  assert.equal(body.globalScore, 58);
  assert.equal(body.state.status, "reveal");
  assert.equal(body.game.questions[3].answer, 2);
  assert.equal(body.concepts.hallucination.correctRate, 1);
  assert.deepEqual(body.concepts.hallucination.previous, { session: "03", correctRate: 0.45 });
  assert.deepEqual(body.profiles, { oracle: 1, temeraire: 1 });
  assert.deepEqual(body.stats.q0.counts, { human: 1, ai: 1 });
});

test("goto is bounded and only works once revealed", async () => {
  const { host } = setup();
  await host("open");
  assert.deepEqual(await host("goto", { index: 1 }), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  assert.deepEqual(await host("goto", { index: 99 }), { status: 400, body: { error: "invalid_index" } });
  assert.deepEqual(await host("goto", { index: -1 }), { status: 400, body: { error: "invalid_index" } });
  assert.deepEqual(await host("goto", { index: 7 }), { status: 200, body: { status: "reveal", revealIndex: 7 } });
  assert.deepEqual(await host("dance"), { status: 400, body: { error: "invalid_action" } });
});

test("finish records member progression for players with a local id", async () => {
  const { call, host, play, store } = setup();
  await store.setJSON(`members/${UID}`, [{ session: "04", score: 40, concepts: {} }]);
  await host("open");
  const pid = await play("Alice", UID, A);
  await play("Bob", undefined, B);
  assert.deepEqual(await host("finish"), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  assert.deepEqual(await host("finish"), { status: 200, body: { status: "done", revealIndex: 7 } });
  const member = await store.get(`members/${UID}`, { type: "json" });
  assert.deepEqual(member.map((e) => [e.session, e.score]), [["04", 40], ["test", 57]]);
  const me = await call("GET", `me?s=test&pid=${pid}`);
  assert.deepEqual(me.body.progression, [{ session: "04", score: 40 }, { session: "test", score: 57 }]);
  await host("finish"); // idempotent: no duplicate entry
  assert.equal((await store.get(`members/${UID}`, { type: "json" })).length, 2);
});

test("export returns the aggregated history entry once the game is done", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Alice", UID, A);
  await play("Bob", undefined, B);
  await host("reveal");
  assert.deepEqual(await call("GET", "export?s=test", undefined, "secret"), { status: 409, body: { error: "not_done" } });
  await host("finish");
  const { status, body } = await call("GET", "export?s=test", undefined, "secret");
  assert.equal(status, 200);
  assert.equal(body.session, "test");
  assert.equal(body.date, "2026-10-20");
  assert.equal(body.players, 2);
  assert.equal(body.globalScore, 58);
  assert.deepEqual(body.concepts.tokenization, { asked: 2, correctRate: 0, avgConfidence: 3 });
  assert.deepEqual(body.concepts.hallucination, { asked: 2, correctRate: 1, avgConfidence: 2 });
  assert.deepEqual(body.concepts["ai-detection"], { asked: 1, correctRate: 0.5, avgConfidence: 2.5 });
  assert.deepEqual(body.concepts["prompt-context"], { asked: 1, correctRate: null, avgConfidence: null });
});

test("reset clears players and state", async () => {
  const { call, host, play, store } = setup();
  await host("open");
  await play("Alice", UID, A);
  assert.deepEqual(await host("reset"), { status: 200, body: { status: "closed", revealIndex: 0 } });
  assert.deepEqual((await call("GET", "state?s=test")).body, { status: "closed", revealIndex: 0 });
  assert.deepEqual([...store.data.keys()].filter((k) => k.startsWith("games/test/")), []);
});

test("open starts the countdown and extend adjusts it", async () => {
  const { host } = setup();
  assert.deepEqual(await host("extend", { deltaSec: 60 }), { status: 409, body: { error: "not_open" } });
  const opened = await host("open");
  assert.deepEqual(opened.body, { status: "open", revealIndex: 0, openedAt: "2026-10-20T19:00:00.000Z", durationSec: 240 });
  assert.equal((await host("extend", { deltaSec: 60 })).body.durationSec, 300);
  assert.deepEqual(await host("extend", { deltaSec: 30 }), { status: 400, body: { error: "invalid_delta" } });
  for (let i = 0; i < 6; i++) await host("extend", { deltaSec: -60 });
  assert.equal((await host("extend", { deltaSec: -60 })).body.durationSec, 60);
});
