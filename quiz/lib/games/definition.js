import { h } from "../dom.js";
import { choiceButtons, explanation, questionHeader, revealBars, verdict } from "./common.js";

export const CONSIGNE = "Que veut dire ce terme ?";
const options = (q) => q.choices.map((c) => ({ value: c.id, label: c.text }));
const term = (q) => h("p", { class: "term" }, q.term);

export function renderQuestion(q, onPick) {
  return h("div", { class: "q" }, questionHeader(CONSIGNE, q), term(q), choiceButtons(options(q), onPick));
}

export function renderReveal(q, stats, mine) {
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    term(q),
    verdict(q, mine),
    revealBars(options(q), q, stats, mine),
    explanation(q),
  );
}
