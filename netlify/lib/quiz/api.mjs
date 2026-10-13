import { createHash, timingSafeEqual } from "node:crypto";
import { badgesFor, profileFor } from "../../../quiz/lib/profiles.js";
import { cleanPseudo } from "../../../quiz/lib/pseudo.js";
import { aggregate, scorePlayer } from "../../../quiz/lib/scoring.js";

export const MAX_PLAYERS = 40;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

export function createApi({ store, content, hostKey, maxPlayers = MAX_PLAYERS, now = () => new Date(), newId = () => crypto.randomUUID() }) {
  const keys = {
    state: (s) => `games/${s}/state`,
    game: (s) => `games/${s}/`,
    players: (s) => `games/${s}/players/`,
    player: (s, pid) => `games/${s}/players/${pid}`,
    member: (uid) => `members/${uid}`,
  };

  async function readState(s) {
    return (await store.get(keys.state(s), { type: "json" })) ?? { status: "closed", revealIndex: 0 };
  }

  async function listPlayers(s) {
    const { blobs } = await store.list({ prefix: keys.players(s) });
    const players = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    return players.filter(Boolean);
  }

  async function readBody(req) {
    try {
      return await req.json();
    } catch {
      throw new HttpError(400, "invalid_json");
    }
  }

  async function requirePlayer(s, pid) {
    if (typeof pid !== "string" || !pid) throw new HttpError(400, "invalid_player");
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
        answers: {},
      });
      return { pid, pseudo: clean, status: state.status };
    },

    "POST answer": async ({ s, game, req }) => {
      const { pid, qid, choice, confidence } = await readBody(req);
      const state = await readState(s);
      if (state.status !== "open") throw new HttpError(409, "not_open");
      const player = await requirePlayer(s, pid);
      const question = game.questions.find((q) => q.id === qid);
      if (!question) throw new HttpError(400, "unknown_question");
      if (![1, 2, 3].includes(confidence)) throw new HttpError(400, "invalid_confidence");
      if (!isValidChoice(question, choice)) throw new HttpError(400, "invalid_choice");
      player.answers[qid] = { choice, confidence };
      await store.setJSON(keys.player(s, pid), player);
      return { ok: true };
    },

    "GET me": async ({ s, game, url }) => {
      const state = await readState(s);
      if (!REVEALED.has(state.status)) throw new HttpError(409, "not_revealed");
      const player = await requirePlayer(s, url.searchParams.get("pid"));
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
      const { action } = await readBody(req);
      let next;
      switch (action) {
        case "open":
          next = { status: "open", revealIndex: 0 };
          break;
        case "reveal":
          next = { status: "reveal", revealIndex: 0 };
          break;
        default:
          throw new HttpError(400, "invalid_action");
      }
      await store.setJSON(keys.state(s), next);
      return next;
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
