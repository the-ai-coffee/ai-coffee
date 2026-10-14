import assert from "node:assert/strict";
import { createApi } from "../../netlify/lib/quiz/api.mjs";
import { createContent } from "../../netlify/lib/quiz/content.mjs";
import { fixtureConcepts, fixtureGame } from "../fixtures/quiz.mjs";
import { memoryStore } from "./memory-store.mjs";

export const UID = "11111111-2222-4333-8444-555555555555";
export const A = { q0: ["human", 3], q1: ["human", 3], q2: ["b", 3], q3: [2, 1] };
export const B = { q0: ["ai", 1], q1: ["ai", 2], q3: [2, 3] };

export function setup({ hostKey = "secret", maxPlayers } = {}) {
  const store = memoryStore();
  const content = createContent({
    sessions: { test: fixtureGame },
    concepts: fixtureConcepts,
    history: { sessions: [{ session: "03", date: "2026-07-01", concepts: { hallucination: { asked: 1, correctRate: 0.45, avgConfidence: 2 } } }] },
  });
  let n = 0;
  const api = createApi({ store, content, hostKey, maxPlayers, now: () => new Date("2026-10-20T19:00:00Z"), newId: () => `p${++n}` });
  const call = async (method, path, body, key) => {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (key) headers.authorization = `Bearer ${key}`;
    const res = await api(
      new Request(`http://localhost/api/quiz/${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }),
    );
    return { status: res.status, body: await res.json() };
  };
  const host = (action, extra = {}) => call("POST", "host?s=test", { action, ...extra }, "secret");
  const play = async (pseudo, uid, answers) => {
    const { body } = await call("POST", "join?s=test", { pseudo, uid });
    for (const [qid, [choice, confidence]] of Object.entries(answers)) {
      const r = await call("POST", "answer?s=test", { pid: body.pid, qid, choice, confidence });
      assert.equal(r.status, 200, JSON.stringify(r.body));
    }
    return body.pid;
  };
  return { store, api, call, host, play };
}
