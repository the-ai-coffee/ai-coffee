import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, questionHeader, revealBars, verdict } from "./common.js";

export const CONSIGNE = "Ce contenu a-t-il été créé par un humain ou par une IA ?";
const OPTIONS = [
  { value: "human", label: "🧑 Un humain" },
  { value: "ai", label: "🤖 Une IA" },
];

export function renderQuestion(q, onPick) {
  return h("div", { class: "q" }, questionHeader(CONSIGNE, q), renderMedia(q.media), choiceButtons(OPTIONS, onPick));
}

export function renderReveal(q, stats, mine) {
  return h("div", { class: "q" }, questionHeader(CONSIGNE, q), renderMedia(q.media), verdict(q, mine), revealBars(OPTIONS, q, stats, mine), explanation(q));
}
