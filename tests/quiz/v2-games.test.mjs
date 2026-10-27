import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal DOM: enough for h() to build trees we can read back as text.
class Node {}
class El extends Node {
  constructor(tag) { super(); this.tag = tag; this.attrs = {}; this.children = []; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  append(...c) { this.children.push(...c); }
  set className(v) { this.attrs.class = v; }
  get text() { return this.children.map((c) => (typeof c === "string" ? c : c.text)).join(""); }
}
globalThis.Node = Node;
globalThis.document = { createElement: (t) => new El(t) };
const { GAMES } = await import("../../quiz/lib/games/index.js");
const { fixtureGame } = await import("../fixtures/quiz.mjs");

const CONSIGNES = {
  human_or_ai: "Ce contenu a-t-il été créé par un humain ou par une IA ?",
  bet_machine: "On a posé cette question à une IA. Que va-t-elle répondre ?",
  investigation: "Quelle réponse de l'IA pose problème ?",
  prompt_duel: "Lequel de ces prompts donnera le meilleur résultat ?",
  definition: "Que veut dire ce terme ?",
};
const definitionQ = { id: "d1", game: "definition", term: "LLM", choices: [{ id: "a", text: "Un moteur de recherche" }, { id: "b", text: "Un modèle qui prédit le texte suivant" }], answer: "b", concept: "tokenization", explanation: "Large Language Model." };

test("every game shows its explicit instruction and the optional question", () => {
  for (const q of [...fixtureGame.questions, definitionQ]) {
    const mod = GAMES[q.game];
    assert.equal(mod.CONSIGNE, CONSIGNES[q.game]);
    const text = mod.renderQuestion({ ...q, question: "Indice : regardez bien." }, () => {}).text;
    assert.ok(text.includes(CONSIGNES[q.game]), `${q.id}: consigne absente`);
    assert.ok(text.includes("Indice : regardez bien."), `${q.id}: question absente`);
    assert.ok(mod.renderReveal({ ...q, conceptLabel: "X" }, { counts: {}, answered: 0 }, undefined).text.includes(CONSIGNES[q.game]));
  }
});

test("answers are full sentences", () => {
  const hoa = GAMES.human_or_ai.renderQuestion(fixtureGame.questions[1], () => {}).text;
  assert.ok(hoa.includes("Un humain") && hoa.includes("Une IA"));
  assert.ok(GAMES.investigation.renderQuestion(fixtureGame.questions[3], () => {}).text.includes("Tout est correct"));
});

test("media given by URL is rendered", () => {
  const q = { ...fixtureGame.questions[1], media: { url: "https://ex.com/a.png", alt: "Un chat" } };
  const tree = GAMES.human_or_ai.renderQuestion(q, () => {});
  const find = (n) => (n.tag === "img" ? n : n.children?.map((c) => (typeof c === "string" ? null : find(c))).find(Boolean));
  assert.equal(find(tree).attrs.src, "https://ex.com/a.png");
});

const findAll = (n, pred, out = []) => {
  if (typeof n === "string" || !n) return out;
  if (pred(n)) out.push(n);
  for (const c of n.children ?? []) findAll(c, pred, out);
  return out;
};

test("a video file honours start and end through a media fragment", () => {
  const q = { ...fixtureGame.questions[1], media: { url: "https://ex.com/clip.mp4", start: 3, end: 9 } };
  const [video] = findAll(GAMES.human_or_ai.renderQuestion(q, () => {}), (n) => n.tag === "video");
  assert.equal(video.attrs.src, "https://ex.com/clip.mp4#t=3,9");
  const plain = { ...q, media: { url: "https://ex.com/clip.mp4" } };
  assert.equal(findAll(GAMES.human_or_ai.renderQuestion(plain, () => {}), (n) => n.tag === "video")[0].attrs.src, "https://ex.com/clip.mp4");
});

test("a fallback link is only rendered for an https URL", () => {
  const link = (fallback) => {
    const q = { ...fixtureGame.questions[1], media: { kind: "video", provider: "youtube", id: "dQw4w9WgXcQ", fallback } };
    return findAll(GAMES.human_or_ai.renderQuestion(q, () => {}), (n) => n.tag === "a")[0];
  };
  assert.equal(link("https://ex.com/a.png").attrs.href, "https://ex.com/a.png");
  assert.equal(link("javascript:alert(1)"), undefined);
});

test("the investigation reveal marks the faulty bubble and the player's own one in text", () => {
  const q = fixtureGame.questions[3]; // answer: 2
  const tree = GAMES.investigation.renderReveal({ ...q, conceptLabel: "X" }, { counts: {}, answered: 0 }, { choice: 1, confidence: 2 });
  const bubbles = findAll(tree, (n) => (n.attrs?.class ?? "").split(" ").includes("bubble"));
  assert.ok(bubbles[2].text.startsWith("✅ "), bubbles[2].text);
  assert.ok(findAll(bubbles[2], (n) => n.attrs?.class === "ok-mark").length === 1);
  assert.ok(bubbles[1].text.includes("· toi"), bubbles[1].text);
  assert.ok(!bubbles[2].text.includes("· toi"));
});

test("the bet machine reveal shows the question's media", () => {
  const q = { ...fixtureGame.questions[2], media: { url: "https://ex.com/a.png", alt: "Capture" }, conceptLabel: "X" };
  const imgs = findAll(GAMES.bet_machine.renderReveal(q, { counts: {}, answered: 0 }, undefined), (n) => n.tag === "img");
  assert.equal(imgs[0]?.attrs.src, "https://ex.com/a.png");
});

test("a definition shows the term and its choices, then the term again at the reveal", () => {
  const text = GAMES.definition.renderQuestion(definitionQ, () => {}).text;
  assert.ok(text.includes("LLM") && text.includes("Un modèle qui prédit le texte suivant"), text);
  const reveal = GAMES.definition.renderReveal({ ...definitionQ, conceptLabel: "X" }, { counts: { b: 1 }, answered: 1 }, { choice: "b", confidence: 1 }).text;
  assert.ok(reveal.includes("LLM") && reveal.includes("Large Language Model."), reveal);
});
