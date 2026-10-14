import { h } from "../dom.js";
import { explanation, okMark, percent, questionHeader, verdict } from "./common.js";

export const CONSIGNE = "Lequel de ces prompts donnera le meilleur résultat ?";
const label = (i) => `Prompt ${String.fromCharCode(65 + i)}`;

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    h("p", { class: "lead" }, `Tâche : ${q.task}`),
    h(
      "div",
      { class: "choices" },
      q.prompts.map((p, i) =>
        h("button", { class: "choice prompt-card", type: "button", onclick: () => onPick(p.id) }, h("span", { class: "kicker" }, label(i)), h("span", { class: "prompt-text" }, p.text)),
      ),
    ),
  );
}

export function renderReveal(q, stats, mine) {
  const total = stats?.answered ?? 0;
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    h("p", { class: "lead" }, `Tâche : ${q.task}`),
    verdict(q, mine),
    h(
      "div",
      { class: "choices" },
      q.prompts.map((p, i) => {
        const pct = percent(stats?.counts?.[p.id] ?? 0, total);
        const correct = p.id === q.answer;
        return h(
          "div",
          { class: `prompt-card${correct ? " is-correct" : ""}` },
          h("span", { class: "kicker" }, okMark(correct), `${label(i)} · ${pct} %${mine?.choice === p.id ? " · toi" : ""}`),
          h("span", { class: "prompt-text" }, p.text),
          h("span", { class: "kicker" }, "Résultat obtenu"),
          h("p", { class: "output" }, q.outputs[p.id]),
        );
      }),
    ),
    explanation(q),
  );
}
