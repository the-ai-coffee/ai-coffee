import { test } from "node:test";
import assert from "node:assert/strict";
import { badgesFor, profileFor } from "../../quiz/lib/profiles.js";
import { cleanPseudo, MAX_PSEUDO_LENGTH, randomPseudo } from "../../quiz/lib/pseudo.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

test("profileFor ranks players by their share of right answers", () => {
  assert.equal(profileFor({ correctRate: 1 }).id, "oracle");
  assert.equal(profileFor({ correctRate: 0.8 }).id, "oracle"); // thresholds are inclusive
  assert.equal(profileFor({ correctRate: 0.79 }).id, "sceptique");
  assert.equal(profileFor({ correctRate: 0.5 }).id, "sceptique");
  assert.equal(profileFor({ correctRate: 0.49 }).id, "explorateur");
  assert.equal(profileFor({ correctRate: 0 }).id, "explorateur");
  assert.equal(profileFor({ correctRate: null }), null);
});

test("badgesFor awards the machine detector when every counted human_or_ai is right", () => {
  const Q = fixtureGame.questions;
  assert.deepEqual(badgesFor(Q, { q1: { choice: "human" } }).map((b) => b.id), ["detector"]);
  assert.deepEqual(badgesFor(Q, { q1: { choice: "ai" } }), []);
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
