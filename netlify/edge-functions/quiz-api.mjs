import { getStore } from "@netlify/blobs";
import { createApi } from "../lib/quiz/api.mjs";
import { content } from "../lib/quiz/content.mjs";

// Thin Netlify wiring: everything testable lives in netlify/lib/quiz/.
// Edge, not serverless: on the legacy Free plan Edge Functions have their own
// 1M/month quota vs 125k for Serverless Functions.
// See docs/superpowers/specs/2026-11-24-quiz-quota-design.md.
export default async (req) => {
  const api = createApi({
    store: getStore({ name: "quiz", consistency: "strong" }),
    content,
    hostKey: Netlify.env.get("QUIZ_HOST_KEY")?.trim(),
  });
  return api(req);
};

export const config = { path: "/api/quiz/*" };
