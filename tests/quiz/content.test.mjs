import { test } from "node:test";
import assert from "node:assert/strict";
import { createContent } from "../../netlify/lib/quiz/content.mjs";
import { upsertHistory } from "../../netlify/lib/quiz/history.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";

const history = {
  sessions: [
    { session: "03", date: "2026-07-01", concepts: { hallucination: { asked: 1, correctRate: 0.45, avgConfidence: 2 } } },
    { session: "04", date: "2026-09-22", concepts: { hallucination: { asked: 1, correctRate: 0.6, avgConfidence: 2 } } },
    { session: "test", date: "2026-10-20", concepts: { hallucination: { asked: 1, correctRate: 0.9, avgConfidence: 2 } } },
  ],
};
const content = createContent({ sessions: { test: fixtureGame }, concepts: fixtureConcepts, history });
const SECRET = ["answer", "explanation", "outputs", "concept", "revisits", "verify"];

test("getGame only resolves registered sessions", () => {
  assert.equal(content.getGame("test"), fixtureGame);
  for (const s of ["nope", "__proto__", "constructor", undefined, null]) assert.equal(content.getGame(s), null);
});

test("publicGame hides answers, explanations, outputs and concepts before the reveal", () => {
  const pub = content.publicGame(fixtureGame, { revealed: false });
  assert.equal(pub.title, "Partie de test");
  for (const q of pub.questions) for (const field of SECRET) assert.ok(!(field in q), `${q.id} expose ${field}`);
  assert.equal(pub.questions[3].transcript.length, 3);
  assert.equal(pub.questions[4].prompts.length, 2);
});

test("publicGame reveals everything plus concept labels afterwards, without mutating the source", () => {
  const q3 = content.publicGame(fixtureGame, { revealed: true }).questions[3];
  assert.equal(q3.answer, 2);
  assert.equal(q3.conceptLabel, "Hallucination");
  assert.equal(q3.conceptDefinition, "Le modèle produit une information fausse avec assurance.");
  assert.ok(!("conceptLabel" in fixtureGame.questions[3]));
});

test("compareWithHistory finds the latest previous session for each concept", () => {
  const cmp = content.compareWithHistory(
    { hallucination: { asked: 2, answers: 2, correctRate: 1, avgConfidence: 2 }, tokenization: { asked: 2, answers: 1, correctRate: 0, avgConfidence: 3 } },
    "test",
  );
  assert.deepEqual(cmp.hallucination.previous, { session: "04", correctRate: 0.6 });
  assert.equal(cmp.hallucination.label, "Hallucination");
  assert.equal(cmp.hallucination.correctRate, 1);
  assert.equal(cmp.tokenization.previous, null);
});

test("upsertHistory appends, replaces the same session and sorts by date", () => {
  let doc = { sessions: [] };
  doc = upsertHistory(doc, { session: "05", date: "2026-10-20", players: 9 });
  doc = upsertHistory(doc, { session: "04", date: "2026-09-22", players: 7 });
  doc = upsertHistory(doc, { session: "05", date: "2026-10-20", players: 10 });
  assert.deepEqual(doc.sessions.map((e) => [e.session, e.players]), [["04", 7], ["05", 10]]);
});
