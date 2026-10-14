#!/usr/bin/env node
// After a session: pull the aggregated results and record them in quiz-data/history.json.
// QUIZ_HOST_KEY=… node scripts/quiz-export.mjs <session> --url https://<site>
import { readFile, writeFile } from "node:fs/promises";
import { upsertHistory } from "../netlify/lib/quiz/history.mjs";

const args = process.argv.slice(2);
const urlAt = args.indexOf("--url");
const base = urlAt >= 0 ? args[urlAt + 1] : process.env.QUIZ_BASE_URL;
const session = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--url");
const key = process.env.QUIZ_HOST_KEY;
if (!session || !base || !key) {
  console.error("Usage : QUIZ_HOST_KEY=… node scripts/quiz-export.mjs <session> --url https://<site>");
  process.exit(1);
}

const res = await fetch(`${base}/api/quiz/export?s=${encodeURIComponent(session)}`, { headers: { authorization: `Bearer ${key}` } });
const entry = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Export impossible : ${res.status} ${entry.error ?? ""} (la partie doit être « terminée »)`);
  process.exit(1);
}

const file = new URL("../quiz-data/history.json", import.meta.url);
const doc = JSON.parse(await readFile(file, "utf8"));
await writeFile(file, `${JSON.stringify(upsertHistory(doc, entry), null, 2)}\n`);
console.log(`✅ history.json mis à jour : session ${session}, ${entry.players} joueurs, niveau ${entry.globalScore}/100`);
