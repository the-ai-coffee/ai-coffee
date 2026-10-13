import { api, poll } from "../lib/api.js";
import { h, mount } from "../lib/dom.js";
import { GAMES } from "../lib/games/index.js";
import { PROFILES } from "../lib/profiles.js";

const session = new URLSearchParams(location.search).get("s");
const KEY_STORAGE = "aic-quiz-hostkey";
const STATUS_LABEL = { closed: "fermée", open: "en cours", reveal: "révélation", done: "terminée" };
const els = { head: document.getElementById("head"), main: document.getElementById("main"), side: document.getElementById("side") };
const pct = (x) => Math.round((x ?? 0) * 100);

// The key arrives once in the URL fragment (never sent to servers or logs),
// is remembered in this browser, and removed from the address bar.
function readHostKey() {
  const match = location.hash.match(/key=([^&]+)/);
  if (match) {
    const key = decodeURIComponent(match[1]);
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* not remembered: the fragment must be passed again next time */
    }
    history.replaceState(null, "", location.pathname + location.search);
    return key;
  }
  try {
    return localStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}
const key = readHostKey();
let mainKey = null; // re-render the main panel only when status/index change (keeps videos playing)

function showError(text) {
  mainKey = null;
  mount(els.main, h("section", { class: "screen" }, h("h1", {}, "Écran animateur"), h("p", { class: "error" }, text)));
}

let busy = false; // ignore control clicks while an action (POST + refresh) is pending
async function action(name, extra) {
  if (busy) return;
  busy = true;
  try {
    await api.host(session, key, name, extra);
    await refresh();
  } catch (err) {
    alert(`Action impossible : ${err.code ?? err.message}`);
  } finally {
    busy = false;
  }
}

let refreshSeq = 0; // a response older than the latest request must not overwrite newer state
async function refresh() {
  const seq = ++refreshSeq;
  if (!key) return showError(`Clé animateur manquante : ouvrez /quiz/host/?s=${session}#key=<QUIZ_HOST_KEY>`);
  let data;
  try {
    data = await api.hostState(session, key);
    if (seq !== refreshSeq) return;
  } catch (err) {
    if (seq !== refreshSeq) return;
    if (err.status === 401) return showError("Clé animateur invalide.");
    if (err.status === 503) return showError("QUIZ_HOST_KEY n'est pas configurée sur Netlify.");
    if (err.status === 404) return showError(`Partie « ${session} » introuvable.`);
    throw err; // network: poll() logs and retries
  }
  renderHead(data);
  renderSide(data);
  const next = `${data.state.status}:${data.state.revealIndex}`;
  if (next !== mainKey) {
    mainKey = next;
    renderMain(data);
  }
}

function renderHead({ game, state }) {
  const n = game.questions.length;
  const i = state.revealIndex;
  const btn = (label, onclick, cls = "") => h("button", { class: `btn ${cls}`, type: "button", onclick }, label);
  const prev = () => action("goto", { index: Math.max(0, i - 1) });
  const next = () => action("goto", { index: Math.min(n, i + 1) });
  const controls = {
    closed: [btn("Ouvrir la partie", () => action("open"), "primary")],
    open: [btn("Révéler", () => action("reveal"), "primary")],
    reveal: [btn("◀", prev), btn(i >= n ? "Niveau du jour" : `${i + 1} / ${n}`, null, "ghost"), btn("▶", next), btn("Terminer", () => action("finish"), "primary")],
    done: [btn("◀", prev), btn(i >= n ? "Niveau du jour" : `${i + 1} / ${n}`, null, "ghost"), btn("▶", next)],
  }[state.status];
  const reset = btn("Réinitialiser", () => confirm("Effacer toutes les réponses de cette partie ?") && action("reset"), "danger");
  mount(
    els.head,
    h("div", {}, h("p", { class: "kicker" }, `AI Coffee · Brise-glace · ${STATUS_LABEL[state.status]}`), h("h1", {}, game.title)),
    h("div", { class: "controls" }, controls, reset),
  );
}

function renderSide({ players, game }) {
  const total = game.questions.length;
  const finished = players.filter((p) => p.answered >= total).length;
  mount(
    els.side,
    h("p", { class: "kicker" }, `${players.length} connecté(s) · ${finished} terminé(s)`),
    h(
      "ul",
      { class: "players" },
      players.map((p) =>
        h(
          "li",
          { class: "player" },
          h("span", {}, p.pseudo),
          h("span", { class: "bar-pct" }, `${p.answered}/${total}`),
          h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${Math.round((p.answered * 100) / total)}%` })),
        ),
      ),
    ),
  );
}

function renderMain(data) {
  const { state, game } = data;
  if (state.status === "closed" || state.status === "open") return mount(els.main, renderJoinPanel(state.status));
  if (state.revealIndex >= game.questions.length) return mount(els.main, renderSummary(data));
  const q = game.questions[state.revealIndex];
  mount(els.main, GAMES[q.game].renderReveal(q, data.stats[q.id], undefined));
}

function renderJoinPanel(status) {
  const url = `${location.origin}/quiz/?s=${encodeURIComponent(session)}`;
  const code = h("div", { class: "qr-code", role: "img", "aria-label": `QR code vers ${url}` });
  if (typeof qrcode === "function") {
    const qr = qrcode(0, "M");
    qr.addData(url);
    qr.make();
    code.innerHTML = qr.createSvgTag(8, 2); // markup generated by the library from our own URL
  } else {
    code.textContent = "QR indisponible : utilisez le lien.";
  }
  return h(
    "section",
    { class: "qr" },
    code,
    h(
      "div",
      { class: "screen" },
      h("p", { class: "kicker" }, status === "closed" ? "Partie fermée : ouvrez-la pour commencer" : "Scannez pour jouer"),
      h("p", { class: "qr-url" }, url.replace(/^https?:\/\//, "")),
    ),
  );
}

function renderSummary({ globalScore, concepts, profiles }) {
  const rows = Object.values(concepts).sort((a, b) => (a.correctRate ?? 1) - (b.correctRate ?? 1));
  const rate = (x) => (x === null ? "—" : `${pct(x)} %`);
  return h(
    "section",
    { class: "screen" },
    h("p", { class: "kicker" }, "Niveau du jour"),
    h("p", { class: "summary-score" }, globalScore === null ? "—" : String(globalScore)),
    h(
      "ul",
      { class: "concepts" },
      rows.map((c) =>
        h(
          "li",
          { class: "bar" },
          h("span", { class: "bar-label" }, c.label),
          h("span", { class: "bar-track" }, h("span", { class: "bar-fill", style: `width:${pct(c.correctRate)}%` })),
          h("span", { class: "bar-pct" }, rate(c.correctRate)),
          c.previous ? h("span", { class: "concept-prev" }, `Session ${c.previous.session} : ${rate(c.previous.correctRate)} → aujourd'hui : ${rate(c.correctRate)}`) : null,
        ),
      ),
    ),
    h("ul", { class: "profiles" }, Object.values(PROFILES).map((p) => h("li", {}, `${p.emoji} ${p.title} · ${profiles[p.id] ?? 0}`))),
  );
}

if (!session) showError("Ajoutez ?s=<session> à l'URL.");
else poll(refresh, 2000);
