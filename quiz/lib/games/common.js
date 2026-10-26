import { h } from "../dom.js";
import { choiceKey } from "../scoring.js";

export const CONFIDENCE = [
  { value: 1, label: "Je pense" },
  { value: 2, label: "Je suis sûr" },
  { value: 3, label: "Certain" },
];

const percent = (n, total) => (total ? Math.round((n * 100) / total) : 0);

// Fixed, explicit instruction for each game, plus the optional per-question precision.
export function questionHeader(consigne, q) {
  return [
    h("p", { class: "consigne" }, q.warmup ? `Échauffement · ${consigne}` : consigne),
    q.question ? h("p", { class: "q-extra" }, q.question) : null,
  ];
}

// The ✅ marker is a separate span so the host screen can hide it until its reveal.
export const okMark = (show) => (show ? h("span", { class: "ok-mark" }, "✅ ") : null);

export function choiceButtons(options, onPick) {
  return h(
    "div",
    { class: "choices" },
    options.map((o) => h("button", { class: "choice", type: "button", onclick: () => onPick(o.value) }, o.label)),
  );
}

export function confidencePicker(onPick) {
  return h(
    "div",
    { class: "confidence" },
    h("p", { class: "kicker" }, "Ton niveau de confiance ?"),
    h("div", { class: "choices choices-row" }, CONFIDENCE.map((c) => h("button", { class: "choice", type: "button", onclick: () => onPick(c.value) }, c.label))),
  );
}

export function revealBars(options, q, stats, mine) {
  const total = stats?.answered ?? 0;
  return h(
    "ul",
    { class: "bars" },
    options.map((o) => {
      const pct = percent(stats?.counts?.[choiceKey(o.value)] ?? 0, total);
      const correct = o.value === q.answer;
      const isMine = mine?.choice === o.value;
      return h(
        "li",
        { class: `bar${correct ? " is-correct" : ""}${isMine ? " is-mine" : ""}` },
        h("span", { class: "bar-label" }, okMark(correct), `${o.label}${isMine ? " · toi" : ""}`),
        h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${pct}%` })),
        h("span", { class: "bar-pct" }, `${pct} %`),
      );
    }),
  );
}

export function verdict(q, mine) {
  if (!mine) return null;
  const ok = mine.choice === q.answer;
  return h("p", { class: `verdict ${ok ? "ok" : "ko"}` }, ok ? "✅ Bien vu !" : "❌ Raté !");
}

export function explanation(q) {
  return h("div", { class: "explain" }, h("p", { class: "kicker" }, q.conceptLabel ?? q.concept), h("p", {}, q.explanation));
}

export { percent };
