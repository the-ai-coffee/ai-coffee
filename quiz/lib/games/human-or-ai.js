import { h } from "../dom.js";
import { renderMedia } from "../media.js";
import { choiceButtons, explanation, revealBars, verdict } from "./common.js";

const OPTIONS = [
  { value: "human", label: "🧑 Humain" },
  { value: "ai", label: "🤖 IA" },
];
const title = (q) => (q.warmup ? "Échauffement : humain ou IA ?" : "Humain ou IA ?");

export function renderQuestion(q, onPick) {
  return h("div", { class: "q" }, h("p", { class: "q-title" }, title(q)), renderMedia(q.media), choiceButtons(OPTIONS, onPick));
}

export function renderReveal(q, stats, mine) {
  return h("div", { class: "q" }, h("p", { class: "q-title" }, title(q)), renderMedia(q.media), verdict(q, mine), revealBars(OPTIONS, q, stats, mine), explanation(q));
}
