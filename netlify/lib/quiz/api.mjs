import { createHash, timingSafeEqual } from "node:crypto";
import { badgesFor, profileFor } from "../../../quiz/lib/profiles.js";
import { cleanPseudo } from "../../../quiz/lib/pseudo.js";
import { aggregate, scorePlayer } from "../../../quiz/lib/scoring.js";

export const MAX_PLAYERS = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// A pid ends up in blob keys: accept UUIDs (and test ids), never "/" or "..".
const PID_RE = /^[A-Za-z0-9-]{1,64}$/;
const REVEALED = new Set(["reveal", "done"]);

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export function isValidChoice(question, choice) {
  switch (question.game) {
    case "human_or_ai":
      return choice === "human" || choice === "ai";
    case "bet_machine":
      return question.choices.some((c) => c.id === choice);
    case "investigation":
      return choice === null || (Number.isInteger(choice) && choice >= 0 && choice < question.transcript.length);
    case "prompt_duel":
      return question.prompts.some((p) => p.id === choice);
    default:
      return false;
  }
}

// Compare digests so the comparison is constant-time whatever the lengths.
function sameSecret(given, expected) {
  const digest = (v) => createHash("sha256").update(String(v)).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

const round = (x, decimals) => (x === null ? null : Math.round(x * 10 ** decimals) / 10 ** decimals);

export function createApi({ store, content, hostKey, maxPlayers = MAX_PLAYERS, now = () => new Date(), newId = () => crypto.randomUUID() }) {
  const keys = {
    state: (s) => `games/${s}/state`,
    game: (s) => `games/${s}/`,
    players: (s) => `games/${s}/players/`,
    player: (s, pid) => `games/${s}/players/${pid}`,
    // One blob per answer, so concurrent answers from one player never overwrite each other.
    answers: (s) => `games/${s}/answers/`,
    playerAnswers: (s, pid) => `games/${s}/answers/${pid}/`,
    answer: (s, pid, qid) => `games/${s}/answers/${pid}/${qid}`,
    member: (uid) => `members/${uid}`,
  };

  async function readState(s) {
    return (await store.get(keys.state(s), { type: "json" })) ?? { status: "closed", revealIndex: 0 };
  }

  // Reads every answer blob under `prefix` and groups them as { pid: { qid: answer } }.
  async function readAnswers(s, prefix) {
    const { blobs } = await store.list({ prefix });
    const values = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    const byPlayer = {};
    blobs.forEach((b, i) => {
      if (!values[i]) return;
      const [pid, qid] = b.key.slice(keys.answers(s).length).split("/");
      (byPlayer[pid] ??= {})[qid] = values[i];
    });
    return byPlayer;
  }

  // Players with their answers merged back in: { pid, pseudo, uid, joinedAt, answers }.
  async function listPlayers(s) {
    const [{ blobs }, answers] = await Promise.all([store.list({ prefix: keys.players(s) }), readAnswers(s, keys.answers(s))]);
    const players = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return players.filter(Boolean).map((p) => ({ ...p, answers: answers[p.pid] ?? {} }));
  }

  async function readBody(req) {
    let body;
    try {
      body = await req.json();
    } catch {
      throw new HttpError(400, "invalid_json");
    }
    if (body === null || typeof body !== "object" || Array.isArray(body)) throw new HttpError(400, "invalid_json");
    return body;
  }

  async function requirePlayer(s, pid) {
    if (typeof pid !== "string" || !PID_RE.test(pid)) throw new HttpError(400, "invalid_player");
    const player = await store.get(keys.player(s, pid), { type: "json" });
    if (!player) throw new HttpError(404, "unknown_player");
    return player;
  }

  function requireHost(req) {
    if (!hostKey) throw new HttpError(503, "host_key_not_configured");
    const header = req.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!given || !sameSecret(given, hostKey)) throw new HttpError(401, "unauthorized");
  }

  // Called on « finish »: one entry per session per anonymous local id, so a
  // returning player can see their own progression next time.
  async function recordMembers(s, game) {
    for (const player of await listPlayers(s)) {
      if (!player.uid) continue;
      const result = scorePlayer(game.questions, player.answers);
      if (result.score === null) continue;
      const entries = ((await store.get(keys.member(player.uid), { type: "json" })) ?? []).filter((e) => e.session !== s);
      entries.push({ session: s, score: result.score, concepts: result.concepts });
      await store.setJSON(keys.member(player.uid), entries);
    }
  }

  const routes = {
    "GET game": async ({ s, game }) => {
      const state = await readState(s);
      const revealed = REVEALED.has(state.status);
      const body = { ...content.publicGame(game, { revealed }), state };
      if (revealed) body.stats = aggregate(game.questions, await listPlayers(s)).perQuestion;
      return body;
    },

    "GET state": async ({ s }) => readState(s),

    "POST join": async ({ s, req }) => {
      const { pseudo, uid } = await readBody(req);
      const clean = cleanPseudo(pseudo);
      if (!clean) throw new HttpError(400, "invalid_pseudo");
      const { blobs } = await store.list({ prefix: keys.players(s) });
      if (blobs.length >= maxPlayers) throw new HttpError(403, "game_full");
      const state = await readState(s);
      const pid = newId();
      await store.setJSON(keys.player(s, pid), {
        pid,
        pseudo: clean,
        uid: typeof uid === "string" && UUID_RE.test(uid) ? uid : null,
        joinedAt: now().toISOString(),
      });
      return { pid, pseudo: clean, status: state.status };
    },

    "POST answer": async ({ s, game, req }) => {
      const { pid, qid, choice, confidence } = await readBody(req);
      const state = await readState(s);
      if (state.status !== "open") throw new HttpError(409, "not_open");
      await requirePlayer(s, pid);
      const question = game.questions.find((q) => q.id === qid);
      if (!question) throw new HttpError(400, "unknown_question");
      if (![1, 2, 3].includes(confidence)) throw new HttpError(400, "invalid_confidence");
      if (!isValidChoice(question, choice)) throw new HttpError(400, "invalid_choice");
      await store.setJSON(keys.answer(s, pid, qid), { choice, confidence });
      return { ok: true };
    },

    "GET me": async ({ s, game, url }) => {
      const state = await readState(s);
      if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
      const player = await requirePlayer(s, url.searchParams.get("pid"));
      player.answers = (await readAnswers(s, keys.playerAnswers(s, player.pid)))[player.pid] ?? {};
      const result = scorePlayer(game.questions, player.answers);
      const previous = player.uid ? ((await store.get(keys.member(player.uid), { type: "json" })) ?? []).filter((e) => e.session !== s) : [];
      const progression = previous.map(({ session, score }) => ({ session, score }));
      if (result.score !== null) progression.push({ session: s, score: result.score });
      return {
        pseudo: player.pseudo,
        answers: player.answers,
        score: result.score,
        correct: result.correct,
        answered: result.answered,
        profile: profileFor(result),
        badges: badgesFor(game.questions, player.answers),
        missedConcepts: Object.entries(result.concepts)
          .filter(([, c]) => c.correct < c.answered)
          .map(([id]) => content.conceptLabel(id)),
        progression,
      };
    },

    "POST host": async ({ s, game, req }) => {
      requireHost(req);
      const { action, index } = await readBody(req);
      const state = await readState(s);
      const last = game.questions.length; // index « last » = the « niveau du jour » screen
      let next;
      switch (action) {
        case "open":
          next = { status: "open", revealIndex: 0 };
          break;
        case "reveal":
          next = { status: "reveal", revealIndex: 0 };
          break;
        case "goto":
          if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
          if (!Number.isInteger(index) || index < 0 || index > last) throw new HttpError(400, "invalid_index");
          next = { ...state, revealIndex: index };
          break;
        case "finish":
          if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
          await recordMembers(s, game);
          next = { status: "done", revealIndex: last };
          break;
        case "reset": {
          const { blobs } = await store.list({ prefix: keys.game(s) });
          await Promise.all(blobs.map((b) => store.delete(b.key)));
          return { status: "closed", revealIndex: 0 };
        }
        default:
          throw new HttpError(400, "invalid_action");
      }
      await store.setJSON(keys.state(s), next);
      return next;
    },

    "GET host-state": async ({ s, game, req }) => {
      requireHost(req);
      const [state, players] = await Promise.all([readState(s), listPlayers(s)]);
      const agg = aggregate(game.questions, players);
      const profiles = {};
      for (const p of players) {
        const profile = profileFor(scorePlayer(game.questions, p.answers));
        if (profile) profiles[profile.id] = (profiles[profile.id] ?? 0) + 1;
      }
      return {
        game: content.publicGame(game, { revealed: true }),
        state,
        players: players
          .sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))
          .map((p) => ({ pseudo: p.pseudo, answered: Object.keys(p.answers).length })),
        stats: agg.perQuestion,
        globalScore: agg.globalScore,
        concepts: content.compareWithHistory(agg.concepts, s),
        profiles,
      };
    },

    "GET export": async ({ s, game, req }) => {
      requireHost(req);
      const state = await readState(s);
      if (state.status !== "done") throw new HttpError(409, "not_done");
      const players = await listPlayers(s);
      const agg = aggregate(game.questions, players);
      const concepts = {};
      for (const [id, c] of Object.entries(agg.concepts)) {
        concepts[id] = { asked: c.asked, correctRate: round(c.correctRate, 2), avgConfidence: round(c.avgConfidence, 1) };
      }
      return { session: s, date: now().toISOString().slice(0, 10), players: players.length, globalScore: agg.globalScore, concepts };
    },
  };

  return async function handle(req) {
    try {
      const url = new URL(req.url);
      const route = url.pathname.replace(/^\/api\/quiz\/?/, "").replace(/\/$/, "");
      const handler = routes[`${req.method} ${route}`];
      if (!handler) {
        const known = Object.keys(routes).some((k) => k.endsWith(` ${route}`));
        throw known ? new HttpError(405, "method_not_allowed") : new HttpError(404, "not_found");
      }
      const s = url.searchParams.get("s") ?? "";
      const game = content.getGame(s);
      if (!game) throw new HttpError(404, "unknown_session");
      return json(await handler({ s, game, req, url }));
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.code }, err.status);
      console.error("[quiz-api]", err);
      return json({ error: "internal" }, 500);
    }
  };
}
