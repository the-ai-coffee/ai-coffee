import { getStore } from "@netlify/blobs";
import { createApi } from "../lib/quiz/api.mjs";
import { content } from "../lib/quiz/content.mjs";

// Thin Netlify wiring: everything testable lives in netlify/lib/quiz/.
export default async (req) => {
  const api = createApi({
    store: getStore({ name: "quiz", consistency: "strong" }),
    content,
    hostKey: process.env.QUIZ_HOST_KEY?.trim(),
  });
  return api(req);
};

export const config = { path: "/api/quiz/*" };
