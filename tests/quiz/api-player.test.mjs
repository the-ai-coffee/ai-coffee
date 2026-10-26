import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidChoice } from "../../netlify/lib/quiz/api.mjs";
import { AVATARS } from "../../quiz/lib/avatars.js";
import { fixtureGame } from "../fixtures/quiz.mjs";
import { A, setup, UID } from "../helpers/quiz-api.mjs";

test("unknown session, unknown route and wrong method", async () => {
  const { call } = setup();
  assert.deepEqual(await call("GET", "game?s=nope"), { status: 404, body: { error: "unknown_session" } });
  assert.equal((await call("GET", "nope?s=test")).status, 404);
  assert.deepEqual(await call("GET", "join?s=test"), { status: 405, body: { error: "method_not_allowed" } });
});

test("state defaults to closed", async () => {
  const { call } = setup();
  assert.deepEqual((await call("GET", "state?s=test")).body, { status: "closed", revealIndex: 0 });
});

test("join validates the pseudo and returns a pid", async () => {
  const { call } = setup();
  assert.deepEqual(await call("POST", "join?s=test", { pseudo: "   " }), { status: 400, body: { error: "invalid_pseudo" } });
  const r = await call("POST", "join?s=test", { pseudo: "Token  Têtu", uid: UID, avatar: "🐙" });
  assert.deepEqual(r, { status: 200, body: { pid: "p1", pseudo: "Token Têtu", avatar: "🐙", status: "closed" } });
});

test("malformed or non-object JSON bodies are refused with invalid_json", async () => {
  const { api, call } = setup();
  const raw = (path, body) =>
    api(new Request(`http://localhost/api/quiz/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body }));
  const r = await raw("join?s=test", "{oops");
  assert.deepEqual({ status: r.status, body: await r.json() }, { status: 400, body: { error: "invalid_json" } });
  for (const bad of [null, [], "x", 42]) {
    assert.deepEqual(await call("POST", "join?s=test", bad), { status: 400, body: { error: "invalid_json" } });
    assert.deepEqual(await call("POST", "answer?s=test", bad), { status: 400, body: { error: "invalid_json" } });
  }
});

test("join refuses players beyond maxPlayers", async () => {
  const { call } = setup({ maxPlayers: 1 });
  assert.equal((await call("POST", "join?s=test", { pseudo: "Un" })).status, 200);
  assert.deepEqual(await call("POST", "join?s=test", { pseudo: "Deux" }), { status: 403, body: { error: "game_full" } });
});

test("answers are refused until the game is open", async () => {
  const { call } = setup();
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  const r = await call("POST", "answer?s=test", { pid: body.pid, qid: "q1", choice: "ai", confidence: 1 });
  assert.deepEqual(r, { status: 409, body: { error: "not_open" } });
});

test("answer validation", async () => {
  const { call, host } = setup();
  await host("open");
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  const answer = (patch) => call("POST", "answer?s=test", { pid: body.pid, qid: "q2", choice: "a", confidence: 2, ...patch });
  assert.deepEqual(await answer({ choice: "z" }), { status: 400, body: { error: "invalid_choice" } });
  assert.deepEqual(await answer({ confidence: 4 }), { status: 400, body: { error: "invalid_confidence" } });
  assert.deepEqual(await answer({ confidence: "2" }), { status: 400, body: { error: "invalid_confidence" } });
  assert.deepEqual(await answer({ qid: "qx" }), { status: 400, body: { error: "unknown_question" } });
  assert.deepEqual(await answer({ pid: "ghost" }), { status: 404, body: { error: "unknown_player" } });
  assert.deepEqual(await answer({}), { status: 200, body: { ok: true } });
  assert.deepEqual(await answer({ qid: "q5", choice: null }), { status: 200, body: { ok: true } });
});

test("game hides answers while open and reveals them with stats afterwards", async () => {
  const { call, host, play } = setup();
  await host("open");
  await play("Un", undefined, { q3: [2, 1] });
  const open = (await call("GET", "game?s=test")).body;
  assert.equal(open.state.status, "open");
  assert.ok(!("answer" in open.questions[3]) && !("explanation" in open.questions[3]));
  assert.ok(!("outputs" in open.questions[4]) && !("concept" in open.questions[4]));
  assert.ok(!("stats" in open));
  await host("reveal");
  const revealed = (await call("GET", "game?s=test")).body;
  assert.equal(revealed.questions[3].answer, 2);
  assert.equal(revealed.questions[3].conceptLabel, "Hallucination");
  assert.deepEqual(revealed.stats.q3, { counts: { 2: 1 }, answered: 1, correctRate: 1 });
});

test("answers are locked after the reveal", async () => {
  const { call, host } = setup();
  await host("open");
  const { body } = await call("POST", "join?s=test", { pseudo: "Un" });
  await host("reveal");
  const r = await call("POST", "answer?s=test", { pid: body.pid, qid: "q1", choice: "ai", confidence: 1 });
  assert.deepEqual(r, { status: 409, body: { error: "not_open" } });
});

test("me returns score, profile, badges and missed concepts after the reveal", async () => {
  const { call, host, play } = setup();
  await host("open");
  const pid = await play("Alice", UID, A);
  assert.deepEqual(await call("GET", `me?s=test&pid=${pid}`), { status: 409, body: { error: "not_revealed" } });
  await host("reveal");
  const { status, body } = await call("GET", `me?s=test&pid=${pid}`);
  assert.equal(status, 200);
  assert.equal(body.pseudo, "Alice");
  assert.equal(body.score, 57);
  assert.equal(body.correct, 2);
  assert.equal(body.answered, 3);
  assert.equal(body.profile.id, "oracle");
  assert.deepEqual(body.badges.map((b) => b.id), ["detector"]);
  assert.deepEqual(body.missedConcepts, ["Tokenisation"]);
  assert.deepEqual(body.progression, [{ session: "test", score: 57 }]);
  assert.deepEqual(body.answers.q3, { choice: 2, confidence: 1 });
  assert.equal((await call("GET", "me?s=test&pid=ghost")).status, 404);
});

test("isValidChoice per game", () => {
  const [q0, , q2, q3, q4] = fixtureGame.questions;
  assert.equal(isValidChoice(q0, "human"), true);
  assert.equal(isValidChoice(q0, "robot"), false);
  assert.equal(isValidChoice(q2, "b"), true);
  assert.equal(isValidChoice(q3, null), true);
  assert.equal(isValidChoice(q3, 2), true);
  assert.equal(isValidChoice(q3, 3), false);
  assert.equal(isValidChoice(q3, "2"), false);
  assert.equal(isValidChoice(q4, "a"), true);
  assert.equal(isValidChoice({ game: "nope" }, "a"), false);
});

test("concurrent answers from one player are all kept", async () => {
  const { call, host } = setup();
  await host("open");
  const { body } = await call("POST", "join?s=test", { pseudo: "Rapide" });
  const answers = { q0: ["ai", 1], q1: ["human", 2], q2: ["b", 3], q3: [2, 1], q4: ["b", 2] };
  const results = await Promise.all(
    Object.entries(answers).map(([qid, [choice, confidence]]) => call("POST", "answer?s=test", { pid: body.pid, qid, choice, confidence })),
  );
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200]);
  const hostState = await call("GET", "host-state?s=test", undefined, "secret");
  assert.deepEqual(hostState.body.players.map(({ pseudo, answered }) => ({ pseudo, answered })), [{ pseudo: "Rapide", answered: 5 }]);
  await host("reveal");
  const me = await call("GET", `me?s=test&pid=${body.pid}`);
  assert.deepEqual(Object.keys(me.body.answers).sort(), ["q0", "q1", "q2", "q3", "q4"]);
  assert.deepEqual(me.body.answers.q2, { choice: "b", confidence: 3 });
});

test("a pid that is not a safe key is refused with invalid_player", async () => {
  const { call, host } = setup();
  await host("open");
  await call("POST", "join?s=test", { pseudo: "Un" });
  for (const pid of ["p1/../p2", "../state", "a".repeat(65)]) {
    assert.deepEqual(await call("POST", "answer?s=test", { pid, qid: "q1", choice: "ai", confidence: 1 }), {
      status: 400,
      body: { error: "invalid_player" },
    });
  }
  await host("reveal");
  assert.deepEqual(await call("GET", "me?s=test&pid=p1%2Fx"), { status: 400, body: { error: "invalid_player" } });
});

test("join replaces an unknown avatar with one from the list", async () => {
  const { call } = setup();
  const { body } = await call("POST", "join?s=test", { pseudo: "Un", avatar: "<img>" });
  assert.ok(AVATARS.includes(body.avatar));
});

test("me returns the player's avatar", async () => {
  const { call, host, play } = setup();
  await host("open");
  const pid = await play("Alice", UID, A);
  await host("reveal");
  assert.equal((await call("GET", `me?s=test&pid=${pid}`)).body.avatar, "🦊");
});
