import { api, poll } from "./lib/api.js";
import { h, mount } from "./lib/dom.js";
import { confidencePicker } from "./lib/games/common.js";
import { GAMES } from "./lib/games/index.js";
import { MAX_PSEUDO_LENGTH, randomPseudo } from "./lib/pseudo.js";

const root = document.getElementById("app");
const session = new URLSearchParams(location.search).get("s");
const STORE_KEY = `aic-quiz-${session}`;
const UID_KEY = "aic-quiz-uid";
const REVEALED = new Set(["reveal", "done"]);

// localStorage can throw (private mode, blocked storage): the game must still work.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* state stays in memory for this tab */
  }
}
function uid() {
  let id = read(UID_KEY, null);
  if (!id) {
    id = crypto.randomUUID();
    write(UID_KEY, id);
  }
  return id;
}

const blank = () => ({ pid: null, pseudo: null, answers: {} });
let me = read(STORE_KEY, blank());
let game = null;
let state = null;
let results = null;
const save = () => write(STORE_KEY, me);
const allAnswered = () => game.questions.every((q) => me.answers[q.id]);

function message(title, text) {
  mount(root, h("section", { class: "screen center" }, h("h1", {}, title), text ? h("p", { class: "lead" }, text) : null));
}

async function main() {
  if (!session) return message("Lien incomplet", "Scanne le QR code affiché par l'animateur.");
  try {
    game = await api.game(session);
  } catch (err) {
    return message(err.status === 404 ? "Partie introuvable" : "Connexion impossible", "Vérifie le lien puis recharge la page.");
  }
  state = game.state;
  if (!me.pid && !REVEALED.has(state.status)) renderJoin();
  else render();
  poll(refresh, 3000);
}

async function refresh() {
  const next = await api.state(session);
  const previous = state;
  const statusChanged = next.status !== previous.status;
  if (statusChanged) {
    game = await api.game(session); // answers and stats arrive with the reveal
    results = null;
    if (next.status === "closed") {
      me = blank(); // the host reset the game
      save();
    }
  }
  state = next;
  if (state.status === "open") flushUnsent();
  if (!statusChanged && next.revealIndex === previous.revealIndex) return;
  if (!me.pid && !REVEALED.has(state.status)) {
    // back from a reveal, or the host reset the game: show the join screen again;
    // otherwise keep it as is (and what the player is typing)
    if (REVEALED.has(previous.status) || next.status === "closed") renderJoin();
    return;
  }
  render();
}

function render() {
  if (state.status === "closed") return message("La partie va commencer…", `Tu joues en tant que ${me.pseudo}. Garde cette page ouverte.`);
  if (state.status === "open") return renderPlay();
  return renderReveal();
}

function renderJoin() {
  const input = h("input", { class: "input", value: randomPseudo(), maxlength: MAX_PSEUDO_LENGTH, autocomplete: "off" });
  const error = h("p", { class: "error", role: "alert" });
  const go = h("button", { class: "cta", type: "button" }, "Jouer");
  go.addEventListener("click", async () => {
    go.disabled = true;
    error.textContent = "";
    try {
      const res = await api.join(session, input.value, uid());
      me = { pid: res.pid, pseudo: res.pseudo, answers: {} };
      save();
      render();
    } catch (err) {
      error.textContent =
        err.code === "game_full" ? "La partie est complète." : err.code === "invalid_pseudo" ? "Choisis un pseudo." : "Connexion impossible, réessaie.";
      go.disabled = false;
    }
  });
  mount(
    root,
    h(
      "section",
      { class: "screen" },
      h("p", { class: "kicker" }, "AI Coffee · Brise-glace"),
      h("h1", {}, game.title),
      h("label", { class: "field" }, "Ton pseudo", input),
      h("button", { class: "link", type: "button", onclick: () => (input.value = randomPseudo()) }, "🎲 Un autre pseudo"),
      go,
      error,
    ),
  );
}

function renderPlay() {
  const next = game.questions.find((q) => !me.answers[q.id]);
  if (!next) return renderWaiting();
  const index = game.questions.indexOf(next);
  const stage = h("div", { class: "stage" });
  stage.append(
    GAMES[next.game].renderQuestion(next, (choice) => {
      mount(
        stage,
        h(
          "div",
          { class: "screen" },
          h("p", { class: "lead" }, "Réponse choisie."),
          confidencePicker((confidence) => record(next.id, choice, confidence)),
          h("button", { class: "link", type: "button", onclick: renderPlay }, "↩ Changer de réponse"),
        ),
      );
    }),
  );
  mount(root, h("section", { class: "screen" }, h("p", { class: "kicker" }, `Question ${index + 1} / ${game.questions.length}`), stage));
}

function record(qid, choice, confidence) {
  me.answers[qid] = { choice, confidence, sent: false };
  save();
  renderPlay();
  send(qid);
}

async function send(qid) {
  const answer = me.answers[qid];
  try {
    await api.answer(session, me.pid, qid, answer.choice, answer.confidence);
    answer.sent = true;
    save();
  } catch (err) {
    if (err.code === "unknown_player") {
      me = blank(); // game was reset while we were away
      save();
      return renderJoin();
    }
    if (err.code !== "not_open") console.warn("[quiz] réponse non envoyée, nouvel essai au prochain cycle", err);
  }
  if (state.status === "open" && allAnswered()) renderWaiting();
}

function flushUnsent() {
  for (const [qid, answer] of Object.entries(me.answers)) if (!answer.sent) send(qid);
}

function renderWaiting() {
  const unsent = Object.values(me.answers).filter((a) => !a.sent).length;
  mount(
    root,
    h(
      "section",
      { class: "screen center" },
      h("h1", {}, "C'est dans la boîte ☕"),
      h("p", { class: "lead" }, "En attente de la révélation…"),
      unsent ? h("p", { class: "error" }, `${unsent} réponse(s) pas encore envoyée(s), nouvel essai automatique.`) : null,
    ),
  );
}

async function loadResults() {
  if (!me.pid) return null;
  if (!results) {
    try {
      results = await api.me(session, me.pid);
    } catch (err) {
      console.warn("[quiz] résultats indisponibles", err);
    }
  }
  return results;
}

async function renderReveal() {
  const r = await loadResults();
  const i = state.revealIndex;
  if (i >= game.questions.length) return renderProfile(r);
  const q = game.questions[i];
  mount(
    root,
    h(
      "section",
      { class: "screen" },
      h("p", { class: "kicker" }, `Révélation · ${i + 1} / ${game.questions.length}`),
      GAMES[q.game].renderReveal(q, game.stats?.[q.id], r?.answers?.[q.id]),
    ),
  );
}

function renderProfile(r) {
  if (!r || r.score === null) return message("Merci d'avoir suivi !", "Pas de réponse comptée cette fois. À la prochaine session !");
  const p = r.profile;
  mount(
    root,
    h(
      "section",
      { class: "screen center" },
      h("p", { class: "kicker" }, r.pseudo),
      h("p", { class: "profile-emoji" }, p.emoji),
      h("h1", {}, p.title),
      h("p", { class: "lead" }, p.tagline),
      h("p", { class: "score" }, h("strong", {}, String(r.score)), " / 100"),
      h("p", {}, `${r.correct} bonne(s) réponse(s) sur ${r.answered}`),
      r.badges.length ? h("p", { class: "badges" }, r.badges.map((b) => `${b.emoji} ${b.title}`).join(" · ")) : null,
      r.missedConcepts.length ? h("p", { class: "revise" }, `À revoir : ${r.missedConcepts.join(", ")}`) : null,
      r.progression.length > 1
        ? h(
            "div",
            { class: "progression" },
            h("p", { class: "kicker" }, "Ta progression"),
            h("ul", {}, r.progression.map((x) => h("li", {}, `Session ${x.session} : ${x.score}/100`))),
          )
        : null,
    ),
  );
}

main();
