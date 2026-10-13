import { test } from "node:test";
import assert from "node:assert/strict";
import { badgesFor, profileFor } from "../../quiz/lib/profiles.js";
import { cleanPseudo, MAX_PSEUDO_LENGTH, randomPseudo } from "../../quiz/lib/pseudo.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

test("profileFor crosses accuracy and confidence", () => {
  assert.equal(profileFor({ correctRate: 0.8, avgConfidence: 2.5 }).id, "oracle");
  assert.equal(profileFor({ correctRate: 0.8, avgConfidence: 1.5 }).id, "sceptique");
  assert.equal(profileFor({ correctRate: 0.4, avgConfidence: 2.5 }).id, "temeraire");
  assert.equal(profileFor({ correctRate: 0.4, avgConfidence: 1 }).id, "explorateur");
  assert.equal(profileFor({ correctRate: 0.6, avgConfidence: 2 }).id, "oracle"); // thresholds are inclusive
  assert.equal(profileFor({ correctRate: null, avgConfidence: null }), null);
});

test("badgesFor awards the machine detector when every counted human_or_ai is right", () => {
  const Q = fixtureGame.questions;
  assert.deepEqual(badgesFor(Q, { q1: { choice: "human", confidence: 1 } }).map((b) => b.id), ["detector"]);
  assert.deepEqual(badgesFor(Q, { q1: { choice: "ai", confidence: 1 } }), []);
  assert.deepEqual(badgesFor(Q, {}), []);
});

test("randomPseudo combines a noun and an adjective", () => {
  assert.equal(randomPseudo(() => 0), "Transformer Tranquille");
  assert.equal(randomPseudo(() => 0.999), "Vecteur Zen");
});

test("cleanPseudo trims, collapses spaces and caps the length", () => {
  assert.equal(cleanPseudo("  Token   Têtu "), "Token Têtu");
  assert.equal(cleanPseudo("x".repeat(40)).length, MAX_PSEUDO_LENGTH);
  assert.equal(cleanPseudo("   "), null);
  assert.equal(cleanPseudo(42), null);
});
