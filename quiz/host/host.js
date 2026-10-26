import { api } from "../lib/api.js";
import { h, mount } from "../lib/dom.js";
import { GAMES } from "../lib/games/index.js";
import { countUp, reducedMotion } from "../lib/motion.js";
import { PROFILES } from "../lib/profiles.js";
import { formatClock, gameDurationSec, remainingSec } from "../lib/timing.js";

const session = new URLSearchParams(location.search).get("s");
const KEY_STORAGE = "aic-quiz-hostkey";
const STATUS_LABEL = { closed: "fermée", open: "en cours", reveal: "révélation", done: "terminée" };
const REVEALED = new Set(["reveal", "done"]);
const els = { head: document.getElementById("head"), main: document.getElementById("main"), side: document.getElementById("side") };
const pct = (x) => Math.round((x ?? 0) * 100);

// The key arrives once in the URL fragment (never sent to servers or logs),
// is remembered in this browser, and removed from the address bar.
function readHostKey() {
  const match = location.hash.match(/(?:^#|&)key=([^&]+)/);
  if (match) {
    let key = match[1];
    try {
      key = decodeURIComponent(key);
    } catch {
      /* keep the raw value */
    }
    try {
      localStorage.setItem(KEY_STORAGE, key);
    } catch {
      /* not remembered: the fragment must be passed again next time */
    }
    history.replaceState(null, "", location.pathname + location.search);
    return key.trim();
  }
  try {
    return localStorage.getItem(KEY_STORAGE)?.trim() || null;
  } catch {
    return null;
  }
}
const key = readHostKey();

let data = null; // last host-state from the server
let view = null; // optimistic { status, revealIndex, … } shown while an action is pending
let busy = false; // one action at a time
let refreshSeq = 0; // a response older than the latest request must not overwrite newer state
let headKey = null; // controls are rebuilt only when status/index change
let mainKey = null; // the main panel too (keeps videos playing, animations running)
let clockEl = null;
let revealBtn = null;
let playStats = null;
let pendingGoto = null; // latest navigation target requested while an action was in flight
let mainStats = null; // stats snapshot of the question shown in the main panel
const cur = () => view ?? data.state;

function showError(text) {
  headKey = mainKey = null;
  mount(els.main, h("section", { class: "screen" }, h("h1", {}, "Écran animateur"), h("p", { class: "error" }, text)));
}

// A failed action shows a banner in the head (kept across head rebuilds),
// hidden after 5 s or by the next successful action.
const errorBanner = h("p", { class: "error host-error", role: "alert", hidden: true });
let errorTimer = null;
function actionError(text) {
  errorBanner.textContent = text;
  errorBanner.hidden = false;
  clearTimeout(errorTimer);
  errorTimer = setTimeout(hideActionError, 5000);
}
function hideActionError() {
  clearTimeout(errorTimer);
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

// ---------- actions (optimistic) ----------
async function act(name, extra, optimistic) {
  if (busy || !data) return;
  busy = true;
  if (optimistic) {
    view = optimistic;
    renderAll();
  }
  try {
    await api.host(session, key, name, extra);
    hideActionError();
    await refresh(true);
  } catch (err) {
    actionError(`Action impossible : ${err.code ?? err.message}`);
  } finally {
    busy = false;
    const target = pendingGoto;
    pendingGoto = null;
    if (target !== null && REVEALED.has(data.state.status) && target !== data.state.revealIndex) {
      // fast navigation made while busy: send only the latest target, keeping the optimistic view
      act("goto", { index: target }, { ...data.state, revealIndex: target });
    } else {
      view = null;
      renderAll(); // server truth: confirms the optimistic view, or rolls it back
    }
  }
}
const openGame = () => act("open", {}, { status: "open", revealIndex: 0 });
const reveal = () => act("reveal", {}, { status: "reveal", revealIndex: 0 });
const finish = () => act("finish", {}, { status: "done", revealIndex: data.game.questions.length });
const extend = (deltaSec) => act("extend", { deltaSec }, null);
const reset = () => confirm("Effacer toutes les réponses de cette partie ?") && act("reset", {}, { status: "closed", revealIndex: 0 });
function go(delta) {
  const s = cur();
  if (!REVEALED.has(s.status)) return;
  const index = Math.min(data.game.questions.length, Math.max(0, s.revealIndex + delta));
  if (index === s.revealIndex) return;
  if (busy) {
    pendingGoto = index;
    view = { ...s, revealIndex: index };
    renderAll();
  } else act("goto", { index }, { ...s, revealIndex: index });
}

document.addEventListener("keydown", (e) => {
  if (e.repeat) return; // a held Space must not reveal, then skip question 1
  if (!data || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.("input, textarea, select")) return;
  const s = cur();
  if (e.key === "ArrowRight") go(1);
  else if (e.key === "ArrowLeft") go(-1);
  else if (e.key === " ") s.status === "open" ? reveal() : go(1);
  else if (e.key === "f" || e.key === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  else return;
  e.preventDefault();
});

// ---------- polling ----------
async function refresh(fromAction = false) {
  const seq = ++refreshSeq;
  if (!key) return showError(`Clé animateur manquante : ouvrez /quiz/host/?s=${session}#key=<QUIZ_HOST_KEY>`);
  let next;
  try {
    next = await api.hostState(session, key);
  } catch (err) {
    if (seq !== refreshSeq) return;
    if (err.status === 401) {
      try {
        localStorage.removeItem(KEY_STORAGE); // a wrong remembered key must not stick
      } catch {
        /* ignore */
      }
      return showError(`Clé animateur invalide. Rouvrez /quiz/host/?s=${session}#key=<QUIZ_HOST_KEY> avec la clé exacte.`);
    }
    if (err.status === 503) return showError("QUIZ_HOST_KEY n'est pas configurée sur Netlify.");
    if (err.status === 404) return showError(`Partie « ${session} » introuvable.`);
    throw err; // network: the loop logs and retries
  }
  if ((!fromAction && seq !== refreshSeq) || (busy && !fromAction)) return; // stale poll, or an action owns the screen
  data = next;
  if (!busy) renderAll();
}

async function loop() {
  try {
    await refresh();
  } catch (err) {
    console.warn("[quiz] poll", err);
  }
  setTimeout(loop, 1000);
}

// ---------- rendering ----------
function renderAll() {
  if (!data) return;
  const s = cur();
  const k = `${s.status}:${s.revealIndex}`;
  if (k !== headKey) {
    headKey = k;
    renderHead(s);
  }
  renderSide();
  if (k !== mainKey) {
    mainKey = k;
    renderMain(s);
  } else {
    updatePlayStats();
    const q = REVEALED.has(s.status) && data.game.questions[s.revealIndex];
    if (q && JSON.stringify(data.stats[q.id]) !== mainStats) renderMain(s, true); // stats arrived after an optimistic reveal
  }
}

function renderHead(s) {
  const n = data.game.questions.length;
  const i = s.revealIndex;
  const btn = (label, onclick, cls = "", title = "") => h("button", { class: `btn ${cls}`, type: "button", onclick: onclick && ((e) => (e.currentTarget.blur(), onclick(e))), title }, label);
  revealBtn = null;
  let controls;
  if (s.status === "closed") controls = [btn("Ouvrir la partie", openGame, "primary")];
  else if (s.status === "open") {
    revealBtn = btn("Révéler", reveal, "primary", "Espace");
    controls = [btn("−1 min", () => extend(-60)), btn("+1 min", () => extend(60)), revealBtn];
  } else {
    controls = [
      btn("◀", () => go(-1), "", "←"),
      btn(i >= n ? "Niveau du jour" : `${i + 1} / ${n}`, null, "ghost"),
      btn("▶", () => go(1), "", "→ ou Espace"),
      s.status === "reveal" ? btn("Terminer", finish, "primary") : null,
    ];
  }
  mount(
    els.head,
    h("div", {}, h("p", { class: "kicker" }, `AI Coffee · Espresso · ${STATUS_LABEL[s.status]}`), h("h1", {}, data.game.title)),
    h("div", { class: "controls" }, controls, btn("Réinitialiser", reset, "danger"), h("span", { class: "keys" }, "← → Espace · F plein écran")),
    errorBanner,
  );
}

// Players column, updated in place (no flicker): one row per player id.
const rows = new Map();
let sideHeader = null;
let sideList = null;
function renderSide() {
  if (!sideList?.isConnected) {
    rows.clear();
    sideHeader = h("p", { class: "kicker" });
    sideList = h("ul", { class: "players" });
    mount(els.side, sideHeader, sideList);
  }
  const total = data.game.questions.length;
  const finished = data.players.filter((p) => p.finished).length;
  sideHeader.textContent = `${data.players.length} connecté(s) · ${finished} ont fini`;
  const seen = new Set();
  for (const p of data.players) {
    seen.add(p.id);
    let row = rows.get(p.id);
    if (!row) {
      const count = h("span", { class: "player-count" });
      const fill = h("span", { class: "bar-fill" });
      const li = h("li", { class: "player is-new" }, h("span", { class: "player-avatar" }, p.avatar ?? "🙂"), h("span", { class: "player-name" }, p.pseudo), count, h("span", { class: "bar-track" }, fill));
      row = { li, count, fill };
      rows.set(p.id, row);
      sideList.append(li);
    }
    const done = p.finished;
    row.count.textContent = done ? "✓" : `${p.answered}/${total}`;
    row.fill.style.width = `${Math.round((p.answered * 100) / total)}%`;
    row.li.classList.toggle("is-done", done);
  }
  for (const [id, row] of rows) {
    if (!seen.has(id)) {
      row.li.remove();
      rows.delete(id);
    }
  }
}

function renderMain(s, keepRevealed = false) {
  clockEl = playStats = null;
  mainStats = null;
  const { game } = data;
  if (s.status === "closed" || s.status === "open") return mount(els.main, renderPlayPanel(s.status));
  if (s.revealIndex >= game.questions.length) return mount(els.main, renderSummary());
  const q = game.questions[s.revealIndex];
  const stats = data.stats[q.id];
  mainStats = JSON.stringify(stats);
  const wasRevealed = keepRevealed && els.main.firstElementChild?.classList.contains("revealed");
  const panel = h(
    "section",
    { class: "host-reveal" },
    GAMES[q.game].renderReveal(q, stats, undefined),
    h("p", { class: "found" }, stats?.answered ? `${pct(stats.correctRate)} % ont trouvé` : "Personne n'a répondu"),
  );
  mount(els.main, panel);
  if (wasRevealed) panel.classList.add("revealed");
  else setTimeout(() => panel.classList.add("revealed"), reducedMotion() ? 0 : 1000); // ~1 s of suspense
}

function renderPlayPanel(status) {
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
  clockEl = h("p", { class: "clock" }, status === "open" ? "--:--" : formatClock(gameDurationSec(data.game.questions)));
  playStats = h("p", { class: "kicker play-stats" });
  updatePlayStats();
  return h(
    "section",
    { class: "qr" },
    code,
    h(
      "div",
      { class: "screen" },
      h("p", { class: "kicker" }, status === "closed" ? "Partie fermée : ouvrez-la pour commencer" : "Scannez pour jouer"),
      h("p", { class: "qr-url" }, url.replace(/^https?:\/\//, "")),
      h("p", { class: "kicker" }, status === "open" ? "Temps restant" : "Durée prévue"),
      clockEl,
      playStats,
    ),
  );
}

function updatePlayStats() {
  if (!playStats?.isConnected) return;
  const total = data.game.questions.length;
  const players = data.players;
  const finished = players.filter((p) => p.finished).length;
  const answers = players.reduce((sum, p) => sum + p.answered, 0);
  const rate = players.length ? Math.round((answers * 100) / (players.length * total)) : 0;
  playStats.textContent = `${players.length} connecté(s) · ${finished} ont fini · ${rate} % des réponses`;
}

// The countdown ticks on its own, between polls.
setInterval(() => {
  if (!data || !clockEl?.isConnected || cur().status !== "open") return;
  const left = remainingSec(cur());
  if (left === null) return;
  clockEl.textContent = formatClock(left);
  clockEl.classList.toggle("is-over", left === 0);
  revealBtn?.classList.toggle("is-pulsing", left === 0);
}, 250);

function renderSummary() {
  const { globalScore, concepts, players } = data;
  const rows = Object.values(concepts).sort((a, b) => (a.correctRate ?? 1) - (b.correctRate ?? 1));
  const rate = (x) => (x === null ? "—" : `${pct(x)} %`);
  const score = h("p", { class: "summary-score" }, globalScore === null ? "—" : "0");
  const panel = h(
    "section",
    { class: "screen host-summary" },
    h("p", { class: "kicker" }, "Niveau du jour"),
    score,
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
    h(
      "ul",
      { class: "profiles" },
      Object.values(PROFILES).map((p) => {
        const faces = players.filter((x) => x.profile === p.id).map((x) => x.avatar ?? "🙂").join(" ");
        return h("li", {}, h("strong", {}, `${p.emoji} ${p.title}`), h("span", { class: "profile-faces" }, faces || "—"));
      }),
    ),
  );
  if (globalScore !== null) countUp(score, globalScore);
  setTimeout(() => panel.classList.add("revealed"), 50); // bars grow from 0
  return panel;
}

if (!session) showError("Ajoutez ?s=<session> à l'URL.");
else loop();
