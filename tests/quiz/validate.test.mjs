import { test } from "node:test";
import assert from "node:assert/strict";
import { validateConcepts, validateGame } from "../../netlify/lib/quiz/validate.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";

const clone = () => structuredClone(fixtureGame);
const has = (list, text) => assert.ok(list.some((e) => e.includes(text)), `« ${text} » absent de ${JSON.stringify(list)}`);

test("the fixture game is valid", () => {
  const { errors, warnings } = validateGame(clone(), fixtureConcepts);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
});

test("duplicate question ids are rejected", () => {
  const g = clone();
  g.questions[2].id = "q1";
  has(validateGame(g, fixtureConcepts).errors, "q1: id dupliqué");
});

test("unknown concepts are rejected", () => {
  const g = clone();
  g.questions[1].concept = "nope";
  has(validateGame(g, fixtureConcepts).errors, "q1: concept inconnu « nope »");
});

test("an investigation answer must point to an ai line or be null", () => {
  const g = clone();
  g.questions[3].answer = 0;
  has(validateGame(g, fixtureConcepts).errors, "q3: answer doit désigner une ligne « ai » ou null");
});

test("a prompt duel needs one output per prompt", () => {
  const g = clone();
  delete g.questions[4].outputs.b;
  has(validateGame(g, fixtureConcepts).errors, "q4: outputs manquant pour le prompt « b »");
});

test("a game needs 5 to 8 counted questions", () => {
  const g = clone();
  g.questions = g.questions.slice(0, 5);
  has(validateGame(g, fixtureConcepts).errors, "partie: 5 à 8 questions comptées attendues (4)");
});

test("a game has at most one warmup", () => {
  const g = clone();
  g.questions[1].warmup = true;
  has(validateGame(g, fixtureConcepts).errors, "partie: au plus 1 échauffement (2)");
});

test("a video extract must end after it starts", () => {
  const g = clone();
  g.questions[1].media = { kind: "video", provider: "youtube", id: "x", start: 20, end: 10 };
  has(validateGame(g, fixtureConcepts).errors, "q1: media.end doit être > media.start");
});

test("verify: true warns, and fails in strict mode", () => {
  const g = clone();
  g.questions[2].verify = true;
  const loose = validateGame(g, fixtureConcepts);
  assert.deepEqual(loose.errors, []);
  assert.deepEqual(loose.warnings, ["q2: contenu à vérifier (verify: true)"]);
  has(validateGame(g, fixtureConcepts, { strict: true }).errors, "q2: contenu à vérifier (verify: true)");
});

test("validateConcepts rejects duplicates and unknown families", () => {
  assert.deepEqual(validateConcepts(fixtureConcepts), []);
  const doc = structuredClone(fixtureConcepts);
  doc.concepts.push({ ...doc.concepts[0] });
  doc.concepts[1].family = "magie";
  const errors = validateConcepts(doc);
  has(errors, "hallucination: id dupliqué");
  has(errors, "tokenization: famille inconnue « magie »");
});
