import { test } from "node:test";
import assert from "node:assert/strict";
import conceptsDoc from "../../quiz-data/concepts.json" with { type: "json" };
import registry from "../../quiz-data/sessions/index.mjs";
import { validateConcepts, validateGame } from "../../netlify/lib/quiz/validate.mjs";
import { content } from "../../netlify/lib/quiz/content.mjs";

test("shipped concepts.json is valid", () => {
  assert.deepEqual(validateConcepts(conceptsDoc), []);
});

for (const [key, game] of Object.entries(registry)) {
  test(`shipped session « ${key} » is valid and registered under its own id`, () => {
    assert.equal(game.session, key);
    const { errors } = validateGame(game, conceptsDoc);
    assert.deepEqual(errors, []);
  });
}

test("the real content singleton resolves the demo game", () => {
  assert.equal(content.getGame("demo"), registry.demo);
});
