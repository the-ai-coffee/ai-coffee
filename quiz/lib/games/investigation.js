import { h } from "../dom.js";
import { explanation, verdict } from "./common.js";

export function renderQuestion(q, onPick) {
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "L'Enquête : trouve ce qui cloche"),
    h("p", { class: "lead" }, "Touche la réponse de l'IA qui pose problème."),
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
    h("button", { class: "choice", type: "button", onclick: () => onPick(null) }, "🤷 Rien ne cloche"),
  );
}

export function renderReveal(q, stats, mine) {
  const count = (key) => stats?.counts?.[key] ?? 0;
  return h(
    "div",
    { class: "q" },
    h("p", { class: "q-title" }, "L'Enquête"),
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
            line.text,
            line.role === "ai" ? h("span", { class: "bubble-count" }, `${count(String(i))} 👆`) : null,
          ),
        ),
      ),
    ),
    h("p", { class: q.answer === null ? "none-line is-correct" : "none-line" }, `${q.answer === null ? "✅ " : ""}Rien ne cloche : ${count("none")} 👆`),
    explanation(q),
  );
}
