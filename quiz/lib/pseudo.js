// Default pseudo = an AI noun + an adjective, so joining takes a single tap.
// All nouns are masculine so the adjectives always agree.
const NOUNS = ["Transformer", "Token", "Agent", "Prompt", "Neurone", "Embedding", "Modèle", "Copilote", "Chatbot", "Vecteur"];
const ADJECTIVES = ["Tranquille", "Têtu", "Distrait", "Curieux", "Calibré", "Pressé", "Malicieux", "Rêveur", "Bavard", "Zen"];

export const MAX_PSEUDO_LENGTH = 24;

export function randomPseudo(rand = Math.random) {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  return `${pick(NOUNS)} ${pick(ADJECTIVES)}`;
}

export function cleanPseudo(input) {
  if (typeof input !== "string") return null;
  const pseudo = input.replace(/\s+/g, " ").trim().slice(0, MAX_PSEUDO_LENGTH);
  return pseudo || null;
}
