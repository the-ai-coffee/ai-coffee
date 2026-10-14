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
};

test("every game shows its explicit instruction and the optional question", () => {
  for (const q of fixtureGame.questions) {
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
