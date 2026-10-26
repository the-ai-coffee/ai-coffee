import { h } from "../dom.js";
import { explanation, okMark, questionHeader, verdict } from "./common.js";

export const CONSIGNE = "Quelle réponse de l'IA pose problème ?";

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    h("p", { class: "lead" }, "Touche la bulle de l'IA qui cloche."),
    h(
      "ol",
      { class: "transcript" },
      q.transcript.map((line, i) =>
        h(
          "li",
          { class: "bubble-row" },
          line.role === "ai"
            ? h("button", { class: "bubble ai", type: "button", onclick: () => onPick(i) }, line.text)
            : h("div", { class: "bubble user" }, line.text),
        ),
      ),
    ),
    h("button", { class: "choice", type: "button", onclick: () => onPick(null) }, "🤷 Tout est correct"),
  );
}

export function renderReveal(q, stats, mine) {
  const count = (key) => stats?.counts?.[key] ?? 0;
  return h(
    "div",
    { class: "q" },
    questionHeader(CONSIGNE, q),
    verdict(q, mine),
    h(
      "ol",
      { class: "transcript" },
      q.transcript.map((line, i) =>
        h(
          "li",
          { class: "bubble-row" },
          h(
            "div",
            { class: `bubble ${line.role}${i === q.answer ? " is-faulty" : ""}${mine?.choice === i ? " is-mine" : ""}` },
            okMark(i === q.answer),
            line.text,
            mine?.choice === i ? " · toi" : null,
            line.role === "ai" ? h("span", { class: "bubble-count" }, `${count(String(i))} 👆`) : null,
          ),
        ),
      ),
    ),
    h("p", { class: q.answer === null ? "none-line is-correct" : "none-line" }, okMark(q.answer === null), `Tout est correct : ${count("none")} 👆`),
    explanation(q),
  );
}
