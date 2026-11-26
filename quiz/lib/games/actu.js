import { h } from "../dom.js";
import { choiceButtons, explanation, questionHeader, revealBars, verdict } from "./common.js";

// « Actu IA » : one short, sourced news fact and 2–3 short answers (often Vrai / Faux).
// Kept deliberately light to read: the evening audience is tired.
export const CONSIGNE = "Actu IA : à ton avis ?";
const options = (q) => q.choices.map((c) => ({ value: c.id, label: c.text }));
const fact = (q) => h("p", { class: "term" }, q.fact);

export function renderQuestion(q, onPick) {
  return h("div", { class: "q" }, questionHeader(CONSIGNE, q), fact(q), choiceButtons(options(q), onPick));
}

export function renderReveal(q, stats, mine) {
  return h("div", { class: "q" }, questionHeader(CONSIGNE, q), fact(q), verdict(q, mine), revealBars(options(q), q, stats, mine), explanation(q));
}
