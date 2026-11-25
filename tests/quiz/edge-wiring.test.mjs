import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("../../", import.meta.url);

test("the quiz API is an Edge Function on /api/quiz/*", async () => {
  // Importing is safe in Node: Netlify.env is only read inside the handler.
  const mod = await import("../../netlify/edge-functions/quiz-api.mjs");
  assert.equal(typeof mod.default, "function");
  assert.deepEqual(mod.config, { path: "/api/quiz/*" });
});

test("no Serverless Function is left to count against the 125k quota", () => {
  assert.equal(existsSync(new URL("netlify/functions", root)), false);
  assert.doesNotMatch(readFileSync(new URL("netlify.toml", root), "utf8"), /^\[functions\]/m);
});

test("the edge wiring never reads process.env", () => {
  const src = readFileSync(new URL("netlify/edge-functions/quiz-api.mjs", root), "utf8");
  assert.doesNotMatch(src, /process\.env/);
  assert.match(src, /Netlify\.env\.get\("QUIZ_HOST_KEY"\)/);
});
