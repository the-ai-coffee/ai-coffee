#!/usr/bin/env node
// Plays a full game against a running site with 3 fake players.
// QUIZ_HOST_KEY=… node scripts/quiz-simulate.mjs [session] [--url http://localhost:8888]
// ⚠️ Starts with a « reset »: never run it against a real session in progress.
const args = process.argv.slice(2);
const urlAt = args.indexOf("--url");
const base = (urlAt >= 0 ? args[urlAt + 1] : process.env.QUIZ_BASE_URL) ?? "http://localhost:8888";
const session = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--url") ?? "demo";
const key = process.env.QUIZ_HOST_KEY;
if (!key) {
  console.error("QUIZ_HOST_KEY manquante");
  process.exit(1);
}

async function call(method, path, body, auth = false) {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}/api/quiz/${path}${sep}s=${encodeURIComponent(session)}`, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(auth ? { authorization: `Bearer ${key}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${data.error}`);
  return data;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
function randomChoice(q) {
  switch (q.game) {
    case "human_or_ai":
      return pick(["human", "ai"]);
    case "bet_machine":
      return pick(q.choices).id;
    case "investigation":
      return pick([null, ...q.transcript.flatMap((line, i) => (line.role === "ai" ? [i] : []))]);
    case "prompt_duel":
      return pick(q.prompts).id;
  }
}

await call("POST", "host", { action: "reset" }, true);
await call("POST", "host", { action: "open" }, true);
const game = await call("GET", "game");
if (game.questions.some((q) => "answer" in q)) throw new Error("Fuite : réponses visibles avant la révélation");

const pids = [];
for (const pseudo of ["Sim Alpha", "Sim Bêta", "Sim Gamma"]) {
  const { pid } = await call("POST", "join", { pseudo, uid: crypto.randomUUID() });
  for (const q of game.questions) {
    await call("POST", "answer", { pid, qid: q.id, choice: randomChoice(q), confidence: 1 + Math.floor(Math.random() * 3) });
  }
  pids.push(pid);
}

await call("POST", "host", { action: "reveal" }, true);
for (const pid of pids) {
  const me = await call("GET", `me?pid=${encodeURIComponent(pid)}`);
  console.log(`${me.pseudo} : ${me.score}/100 — ${me.profile?.emoji} ${me.profile?.title}`);
}
const dashboard = await call("GET", "host-state", undefined, true);
console.log(`Niveau du jour : ${dashboard.globalScore}/100 (${dashboard.players.length} joueurs)`);
await call("POST", "host", { action: "finish" }, true);
console.log(JSON.stringify(await call("GET", "export", undefined, true), null, 2));
console.log("✅ Simulation terminée");
