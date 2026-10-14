import { test } from "node:test";
import assert from "node:assert/strict";
import { AVATARS, isAvatar, nextAvatar, randomAvatar } from "../../quiz/lib/avatars.js";
import { parseTime, resolveMedia } from "../../quiz/lib/media-url.js";
import { formatClock, gameDurationSec, remainingSec, timeLimitFor } from "../../quiz/lib/timing.js";
import { fixtureGame } from "../fixtures/quiz.mjs";

test("avatars come from a closed list", () => {
  assert.equal(AVATARS.length, 16);
  assert.equal(isAvatar("🦊"), true);
  assert.equal(isAvatar("<b>"), false);
  assert.equal(randomAvatar(() => 0), "🦊");
  assert.equal(randomAvatar(() => 0.999), "👾");
  assert.equal(nextAvatar("👾"), "🦊");
  assert.equal(nextAvatar("inconnu"), "🦊");
});

test("timeLimitFor uses per-game defaults unless the question overrides it", () => {
  assert.equal(timeLimitFor({ game: "human_or_ai" }), 15);
  assert.equal(timeLimitFor({ game: "bet_machine" }), 20);
  assert.equal(timeLimitFor({ game: "investigation" }), 30);
  assert.equal(timeLimitFor({ game: "prompt_duel" }), 30);
  assert.equal(timeLimitFor({ game: "human_or_ai", timeLimit: 45 }), 45);
});

test("gameDurationSec defaults to 10 minutes whatever the questions", () => {
  assert.equal(gameDurationSec(fixtureGame.questions), 600);
});

test("remainingSec counts down from openedAt and stops at 0", () => {
  const state = { openedAt: "2026-10-20T19:00:00.000Z", durationSec: 240 };
  assert.equal(remainingSec(state, Date.parse("2026-10-20T19:01:30Z")), 150);
  assert.equal(remainingSec(state, Date.parse("2026-10-20T19:10:00Z")), 0);
  assert.equal(remainingSec({ status: "closed" }), null);
  assert.equal(formatClock(222), "03:42");
  assert.equal(formatClock(0), "00:00");
});

test("parseTime reads seconds and 1h2m3s forms", () => {
  assert.equal(parseTime("42"), 42);
  assert.equal(parseTime("1m30s"), 90);
  assert.equal(parseTime("1h0m5s"), 3605);
  assert.equal(parseTime(null), undefined);
  assert.equal(parseTime("abc"), undefined);
});

test("resolveMedia understands YouTube links", () => {
  assert.deepEqual(resolveMedia({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42" }), { kind: "video", provider: "youtube", id: "dQw4w9WgXcQ", start: 42 });
  assert.deepEqual(resolveMedia({ url: "https://youtu.be/dQw4w9WgXcQ?t=1m30s" }), { kind: "video", provider: "youtube", id: "dQw4w9WgXcQ", start: 90 });
  assert.deepEqual(resolveMedia({ url: "https://m.youtube.com/shorts/abcDEF12345" }), { kind: "video", provider: "youtube", id: "abcDEF12345" });
  assert.deepEqual(resolveMedia({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42", start: 5, end: 20 }), { kind: "video", provider: "youtube", id: "dQw4w9WgXcQ", start: 5, end: 20 });
});

test("resolveMedia understands Vimeo, images and video files", () => {
  assert.deepEqual(resolveMedia({ url: "https://vimeo.com/123456789#t=10s" }), { kind: "video", provider: "vimeo", id: "123456789", start: 10 });
  assert.deepEqual(resolveMedia({ url: "https://ex.com/a/photo.JPG?x=1", alt: "Un chat" }), { kind: "image", src: "https://ex.com/a/photo.JPG?x=1", alt: "Un chat" });
  assert.deepEqual(resolveMedia({ url: "https://cdn.ex.com/clip.mp4", fallback: "https://ex.com/f.png" }), { kind: "video", src: "https://cdn.ex.com/clip.mp4", fallback: "https://ex.com/f.png" });
});

test("resolveMedia refuses what it cannot play", () => {
  assert.match(resolveMedia({ url: "http://ex.com/a.png" }).error, /https/);
  assert.match(resolveMedia({ url: "https://www.tiktok.com/@a/video/1" }).error, /réseaux sociaux/);
  assert.match(resolveMedia({ url: "https://ex.com/page" }).error, /non reconnu/);
  assert.match(resolveMedia({ url: "pas une url" }).error, /invalide/);
  assert.match(resolveMedia({ url: "https://www.youtube.com/watch" }).error, /YouTube/);
});

test("resolveMedia returns the legacy explicit form unchanged", () => {
  const legacy = { kind: "text", text: "Bip." };
  assert.equal(resolveMedia(legacy), legacy);
});
