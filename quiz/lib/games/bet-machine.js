import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, questionHeader, revealBars, verdict } from "./common.js";

export const CONSIGNE = "On a posé cette question à une IA. Que va-t-elle répondre ?";
const options = (q) => q.choices.map((c) => ({ value: c.id, label: c.text }));

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    h("blockquote", { class: "media media-text" }, q.prompt),
    renderMedia(q.media),
    choiceButtons(options(q), onPick),
  );
}

export function renderReveal(q, stats, mine) {
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    h("blockquote", { class: "media media-text" }, q.prompt),
    renderMedia(q.media),
    verdict(q, mine),
    revealBars(options(q), q, stats, mine),
    explanation(q),
  );
}
