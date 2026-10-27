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

test("publicGame keeps only known media sub-fields before the reveal", () => {
  const media = { kind: "video", provider: "youtube", id: "abc", start: 3, end: 9, alt: "Un chat", fallback: "Texte", source: "Midjourney", credit: "IA" };
  const game = { ...fixtureGame, questions: [{ ...fixtureGame.questions[1], media }] };
  const hidden = content.publicGame(game, { revealed: false }).questions[0].media;
  assert.deepEqual(hidden, { kind: "video", alt: "Un chat", provider: "youtube", id: "abc", start: 3, end: 9, fallback: "Texte" });
  assert.deepEqual(content.publicGame(game, { revealed: true }).questions[0].media, media);
  assert.ok(!("media" in content.publicGame(fixtureGame, { revealed: false }).questions[2]));
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

const PUBLIC_ALLOWLIST = ["id", "game", "warmup", "media", "prompt", "choices", "transcript", "task", "prompts", "question", "timeLimit"];

test("every unrevealed public question only has allowlisted keys", () => {
  const pub = content.publicGame(fixtureGame, { revealed: false });
  for (const q of pub.questions) {
    for (const key of Object.keys(q)) assert.ok(PUBLIC_ALLOWLIST.includes(key), `${q.id} exposes unlisted key ${key}`);
  }
});

test("an unknown extra field on a source question never leaks before reveal", () => {
  const game = structuredClone(fixtureGame);
  game.questions[1].secretNote = "x";
  const local = createContent({ sessions: { test: game }, concepts: fixtureConcepts, history });
  const pub = local.publicGame(game, { revealed: false });
  assert.ok(!("secretNote" in pub.questions[1]));
  for (const key of Object.keys(pub.questions[1])) assert.ok(PUBLIC_ALLOWLIST.includes(key));
  assert.equal(local.publicGame(game, { revealed: true }).questions[1].secretNote, "x");
});

test("question, timeLimit and media.url are public before the reveal", () => {
  const game = structuredClone(fixtureGame);
  game.questions[1].question = "Regardez bien.";
  game.questions[1].timeLimit = 25;
  game.questions[1].media = { url: "https://youtu.be/dQw4w9WgXcQ", source: "Sora" };
  const local = createContent({ sessions: { test: game }, concepts: fixtureConcepts, history });
  const q = local.publicGame(game, { revealed: false }).questions[1];
  assert.equal(q.question, "Regardez bien.");
  assert.equal(q.timeLimit, 25);
  assert.deepEqual(q.media, { url: "https://youtu.be/dQw4w9WgXcQ" });
});

test("publicGame keeps a definition's term and choices, never its answer", () => {
  const q = { id: "d1", game: "definition", term: "LLM", choices: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "b", concept: "tokenization", explanation: "E." };
  const [pub] = content.publicGame({ ...fixtureGame, questions: [q] }, { revealed: false }).questions;
  assert.equal(pub.term, "LLM");
  assert.equal(pub.choices.length, 2);
  for (const field of SECRET) assert.ok(!(field in pub), `expose ${field}`);
});
