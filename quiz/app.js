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
// crypto.randomUUID is only available in secure contexts (not plain http on a LAN IP).
function uuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const x = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
function uid() {
  let id = read(UID_KEY, null);
  if (!id) {
    id = uuid();
    write(UID_KEY, id);
  }
  return id;
}

const blank = () => ({ pid: null, pseudo: null, answers: {} });
const stored = read(STORE_KEY, null);
let me = stored && typeof stored === "object" && stored.answers && typeof stored.answers === "object" ? stored : blank();
let game = null;
let state = null;
let results = null;
const UNAVAILABLE = Symbol("results-unavailable");
const save = () => write(STORE_KEY, me);
const allAnswered = () => game.questions.every((q) => me.answers[q.id]);

// Answers are sent one at a time through a single chain; `inFlight` holds the
// qids queued or being sent, so a poll never sends the same answer twice.
let sendQueue = Promise.resolve();
const inFlight = new Set();
let unsentNote = null; // the « non envoyée » span of the current question screen
const unsentCount = () => Object.entries(me.answers).filter(([qid, a]) => !a.sent && !a.late && !inFlight.has(qid)).length;
const unsentLabel = (n) => (n === 0 ? "" : n === 1 ? " · 1 réponse non envoyée" : ` · ${n} réponses non envoyées`);
const LATE = "Trop tard : la révélation avait commencé.";
const lateNote = (late) => (late ? h("p", { class: "error" }, LATE) : null);

function message(title, text, extra = null) {
  mount(root, h("section", { class: "screen center" }, h("h1", {}, title), text ? h("p", { class: "lead" }, text) : null, extra));
}

async function main() {
  if (!session) return message("Lien incomplet", "Scanne le QR code affiché par l'animateur.");
  try {
    game = await api.game(session);
  } catch (err) {
    return message(err.status === 404 ? "Partie introuvable" : "Connexion impossible", "Vérifie le lien puis recharge la page.");
  }
  state = game.state;
  if (state.status === "closed" && Object.keys(me.answers).length) {
    me = blank(); // answers only exist after an open game: the host reset while we were away
    save();
  }
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
  // While open, unsent answers are retried; once revealed, one last try gets
  // the 409 « not_open » that marks them as too late.
  if (state.status !== "closed") flushUnsent();
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
  unsentNote = h("span", {}, unsentLabel(unsentCount()));
  mount(root, h("section", { class: "screen" }, h("p", { class: "kicker" }, `Question ${index + 1} / ${game.questions.length}`, unsentNote), stage));
}

function record(qid, choice, confidence) {
  me.answers[qid] = { choice, confidence, sent: false };
  save();
  send(qid); // queued first, so the next screen does not flag it as unsent
  renderPlay();
}

function send(qid) {
  if (inFlight.has(qid)) return;
  inFlight.add(qid);
  sendQueue = sendQueue.then(async () => {
    try {
      await deliver(qid);
    } finally {
      inFlight.delete(qid);
    }
    showUnsent();
  });
}

async function deliver(qid) {
  const pid = me.pid;
  const answer = me.answers[qid];
  if (!pid || !answer || answer.sent || answer.late) return; // reset meanwhile, or nothing left to send
  try {
    await api.answer(session, pid, qid, answer.choice, answer.confidence);
    answer.sent = true;
    save();
  } catch (err) {
    if (err.code === "unknown_player") {
      if (me.pid !== pid) return; // an earlier send already showed the join screen
      me = blank(); // game was reset while we were away
      save();
      return renderJoin();
    }
    if (err.code === "not_open") {
      answer.late = true; // the reveal has started: never resent
      save();
      if (REVEALED.has(state.status)) render();
      return;
    }
    console.warn("[quiz] réponse non envoyée, nouvel essai au prochain cycle", err);
  }
}

// Refreshes the « non envoyée » indicator without redrawing the question being answered.
function showUnsent() {
  if (!me.pid || state.status !== "open") return;
  if (allAnswered()) return renderWaiting();
  if (unsentNote?.isConnected) unsentNote.textContent = unsentLabel(unsentCount());
}

function flushUnsent() {
  for (const [qid, answer] of Object.entries(me.answers)) if (!answer.sent && !answer.late) send(qid);
}

function renderWaiting() {
  const unsent = unsentCount();
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
  if (results === UNAVAILABLE) return null;
  if (!results) {
    try {
      results = await api.me(session, me.pid);
    } catch (err) {
      if (err.code === "unknown_player") {
        me = blank(); // game was reset while we were away: carry on as a spectator
        save();
        results = UNAVAILABLE;
        return null;
      }
      console.warn("[quiz] résultats indisponibles", err);
    }
  }
  return results;
}

async function renderReveal() {
  const r = await loadResults();
  if (!REVEALED.has(state.status)) return; // a reset/reopen happened meanwhile
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
      lateNote(me.answers[q.id]?.late),
    ),
  );
}

function renderProfile(r) {
  const late = lateNote(Object.values(me.answers).some((a) => a.late));
  if (!r || r.score === null) return message("Merci d'avoir suivi !", "Pas de réponse comptée cette fois. À la prochaine session !", late);
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
      late,
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
