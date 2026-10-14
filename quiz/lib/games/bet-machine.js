import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, revealBars, verdict } from "./common.js";

const options = (q) => q.choices.map((c) => ({ value: c.id, label: c.text }));

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Pariez sur la machine"),
    h("p", { class: "lead" }, q.prompt),
    renderMedia(q.media),
    h("p", {}, "Que va faire le modèle ?"),
    choiceButtons(options(q), onPick),
  );
}

export function renderReveal(q, stats, mine) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "Pariez sur la machine"),
    h("p", { class: "lead" }, q.prompt),
    verdict(q, mine),
    revealBars(options(q), q, stats, mine),
    explanation(q),
  );
}
