import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, choiceKey, isCorrect, scoreAnswer, scorePlayer } from "../../quiz/lib/scoring.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

const Q = fixtureGame.questions;
const byId = (id) => Q.find((q) => q.id === id);
// A: warmup ignored; q1 ✅, q2 ❌, q3 ✅ → 2/3 → 67
const A = { q0: { choice: "human" }, q1: { choice: "human" }, q2: { choice: "b" }, q3: { choice: 2 } };
// B: q1 ❌, q3 ✅ → 50
const B = { q0: { choice: "ai" }, q1: { choice: "ai" }, q3: { choice: 2 } };

test("scoreAnswer gives 100 for a right answer and 0 for a wrong one", () => {
  assert.equal(scoreAnswer(true), 100);
  assert.equal(scoreAnswer(false), 0);
});

test("isCorrect and choiceKey handle the « rien ne cloche » null choice", () => {
  assert.equal(isCorrect(byId("q5"), null), true);
  assert.equal(isCorrect(byId("q3"), null), false);
  assert.equal(isCorrect(byId("q3"), 2), true);
  assert.equal(choiceKey(null), "none");
  assert.equal(choiceKey(2), "2");
  assert.equal(choiceKey("ai"), "ai");
});

test("scorePlayer ignores the warmup and averages answered questions", () => {
  const r = scorePlayer(Q, A);
  assert.equal(r.score, 67);
  assert.equal(r.answered, 3);
  assert.equal(r.correct, 2);
  assert.ok(Math.abs(r.correctRate - 2 / 3) < 1e-9);
  assert.deepEqual(r.concepts, {
    "ai-detection": { answered: 1, correct: 1 },
    tokenization: { answered: 1, correct: 0 },
    hallucination: { answered: 1, correct: 1 },
  });
});

test("scorePlayer returns null scores when nothing counted was answered", () => {
  for (const answers of [{}, { q0: { choice: "ai" } }]) {
    const r = scorePlayer(Q, answers);
    assert.equal(r.score, null);
    assert.equal(r.correctRate, null);
  }
});

test("aggregate builds per-question and per-concept stats", () => {
  const agg = aggregate(Q, [{ answers: A }, { answers: B }]);
  assert.equal(agg.players, 2);
  assert.equal(agg.globalScore, 59);
  assert.deepEqual(agg.perQuestion.q0, { counts: { human: 1, ai: 1 }, answered: 2, correctRate: 0.5 });
  assert.deepEqual(agg.perQuestion.q3, { counts: { 2: 2 }, answered: 2, correctRate: 1 });
  assert.deepEqual(agg.perQuestion.q4, { counts: {}, answered: 0, correctRate: null });
  assert.deepEqual(agg.concepts.hallucination, { asked: 2, answers: 2, correctRate: 1 });
  assert.deepEqual(agg.concepts.tokenization, { asked: 2, answers: 1, correctRate: 0 });
  assert.deepEqual(agg.concepts["ai-detection"], { asked: 1, answers: 2, correctRate: 0.5 });
  assert.deepEqual(agg.concepts["prompt-context"], { asked: 1, answers: 0, correctRate: null });
});

test("aggregate of an empty room", () => {
  const agg = aggregate(Q, []);
  assert.equal(agg.players, 0);
  assert.equal(agg.globalScore, null);
});
