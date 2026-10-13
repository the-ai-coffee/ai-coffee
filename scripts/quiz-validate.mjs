#!/usr/bin/env node
// Validates quiz-data/: node scripts/quiz-validate.mjs [--strict] [session…]
// --strict turns « verify: true » warnings into errors (use it before a real session).
import { readdir, readFile } from "node:fs/promises";
import { basename } from "node:path";
import { validateConcepts, validateGame } from "../netlify/lib/quiz/validate.mjs";
import registry from "../quiz-data/sessions/index.mjs";

const ROOT = new URL("../quiz-data/", import.meta.url);
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const only = args.filter((a) => !a.startsWith("--"));
const readJson = async (rel) => JSON.parse(await readFile(new URL(rel, ROOT), "utf8"));

let failed = false;
function report(label, errors, warnings = []) {
  for (const w of warnings) console.warn(`⚠️  ${label} — ${w}`);
  for (const e of errors) console.error(`❌ ${label} — ${e}`);
  if (errors.length) failed = true;
  else console.log(`✅ ${label}`);
}

const concepts = await readJson("concepts.json");
report("concepts.json", validateConcepts(concepts));

const files = (await readdir(new URL("sessions/", ROOT))).filter((f) => f.endsWith(".json")).map((f) => basename(f, ".json"));
for (const s of only.length ? only : files) {
  const label = `sessions/${s}.json`;
  if (!files.includes(s)) {
    report(label, ["fichier introuvable"]);
    continue;
  }
  const game = await readJson(`sessions/${s}.json`);
  const { errors, warnings } = validateGame(game, concepts, { strict });
  if (game.session !== s) errors.push(`le champ session doit valoir « ${s} »`);
  if (!Object.hasOwn(registry, s)) errors.push("absent de quiz-data/sessions/index.mjs");
  report(label, errors, warnings);
}

const history = await readJson("history.json");
report("history.json", Array.isArray(history.sessions) ? [] : ["tableau « sessions » manquant"]);
process.exit(failed ? 1 : 0);
