import conceptsDoc from "../../../quiz-data/concepts.json" with { type: "json" };
import historyDoc from "../../../quiz-data/history.json" with { type: "json" };
import sessionRegistry from "../../../quiz-data/sessions/index.mjs";

// Allowlist, not denylist: a new secret field can never leak by default.
const PUBLIC_FIELDS = ["id", "game", "warmup", "media", "prompt", "choices", "transcript", "task", "prompts"];
const pick = (obj, fields) => Object.fromEntries(fields.filter((f) => f in obj).map((f) => [f, obj[f]]));

export function createContent({ sessions, concepts, history }) {
  const byId = new Map(concepts.concepts.map((c) => [c.id, c]));
  const conceptLabel = (id) => byId.get(id)?.label ?? id;

  return {
    conceptLabel,

    getGame(session) {
      return typeof session === "string" && Object.hasOwn(sessions, session) ? sessions[session] : null;
    },

    publicGame(game, { revealed }) {
      return {
        session: game.session,
        title: game.title,
        questions: game.questions.map((q) =>
          revealed
            ? { ...q, conceptLabel: conceptLabel(q.concept), conceptDefinition: byId.get(q.concept)?.definition ?? "" }
            : pick(q, PUBLIC_FIELDS),
        ),
      };
    },

    compareWithHistory(aggConcepts, session) {
      const past = history.sessions.filter((e) => e.session !== session);
      return Object.fromEntries(
        Object.entries(aggConcepts).map(([id, c]) => {
          const prev = past.findLast((e) => e.concepts?.[id]);
          return [id, { ...c, label: conceptLabel(id), previous: prev ? { session: prev.session, correctRate: prev.concepts[id].correctRate } : null }];
        }),
      );
    },
  };
}

export const content = createContent({ sessions: sessionRegistry, concepts: conceptsDoc, history: historyDoc });
