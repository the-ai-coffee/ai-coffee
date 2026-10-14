import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, choiceKey, isCorrect, scoreAnswer, scorePlayer } from "../../quiz/lib/scoring.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

const Q = fixtureGame.questions;
const byId = (id) => Q.find((q) => q.id === id);
// A: warmup ignored; q1 ✅ certain (100), q2 ❌ certain (0), q3 ✅ « je pense » (70) → 57
const A = { q0: { choice: "human", confidence: 3 }, q1: { choice: "human", confidence: 3 }, q2: { choice: "b", confidence: 3 }, q3: { choice: 2, confidence: 1 } };
// B: q1 ❌ « sûr » (15), q3 ✅ certain (100) → 57.5 → 58
const B = { q0: { choice: "ai", confidence: 1 }, q1: { choice: "ai", confidence: 2 }, q3: { choice: 2, confidence: 3 } };

test("scoreAnswer applies the confidence table", () => {
  assert.equal(scoreAnswer(true, 1), 70);
  assert.equal(scoreAnswer(false, 1), 30);
  assert.equal(scoreAnswer(true, 2), 85);
  assert.equal(scoreAnswer(false, 2), 15);
  assert.equal(scoreAnswer(true, 3), 100);
  assert.equal(scoreAnswer(false, 3), 0);
  assert.throws(() => scoreAnswer(true, 4), RangeError);
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
  assert.equal(r.score, 57);
  assert.equal(r.answered, 3);
  assert.equal(r.correct, 2);
  assert.ok(Math.abs(r.correctRate - 2 / 3) < 1e-9);
  assert.ok(Math.abs(r.avgConfidence - 7 / 3) < 1e-9);
  assert.deepEqual(r.concepts, {
    "ai-detection": { answered: 1, correct: 1 },
    tokenization: { answered: 1, correct: 0 },
    hallucination: { answered: 1, correct: 1 },
  });
});

test("scorePlayer returns null scores when nothing counted was answered", () => {
  for (const answers of [{}, { q0: { choice: "ai", confidence: 3 } }]) {
    const r = scorePlayer(Q, answers);
    assert.equal(r.score, null);
    assert.equal(r.correctRate, null);
    assert.equal(r.avgConfidence, null);
  }
});

test("aggregate builds per-question and per-concept stats", () => {
  const agg = aggregate(Q, [{ answers: A }, { answers: B }]);
  assert.equal(agg.players, 2);
  assert.equal(agg.globalScore, 58);
  assert.deepEqual(agg.perQuestion.q0, { counts: { human: 1, ai: 1 }, answered: 2, correctRate: 0.5 });
  assert.deepEqual(agg.perQuestion.q3, { counts: { 2: 2 }, answered: 2, correctRate: 1 });
  assert.deepEqual(agg.perQuestion.q4, { counts: {}, answered: 0, correctRate: null });
  assert.deepEqual(agg.concepts.hallucination, { asked: 2, answers: 2, correctRate: 1, avgConfidence: 2 });
  assert.deepEqual(agg.concepts.tokenization, { asked: 2, answers: 1, correctRate: 0, avgConfidence: 3 });
  assert.deepEqual(agg.concepts["ai-detection"], { asked: 1, answers: 2, correctRate: 0.5, avgConfidence: 2.5 });
  assert.deepEqual(agg.concepts["prompt-context"], { asked: 1, answers: 0, correctRate: null, avgConfidence: null });
});

test("aggregate of an empty room", () => {
  const agg = aggregate(Q, []);
  assert.equal(agg.players, 0);
  assert.equal(agg.globalScore, null);
});
