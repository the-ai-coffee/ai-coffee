// Validates the quiz content contract (quiz-data/). Shared by scripts/quiz-validate.mjs
// and the tests. Messages are French: they are read by the organisers.
import { isHttpsUrl, resolveMedia } from "../../../quiz/lib/media-url.js";
import { MAX_TIME_LIMIT, MIN_TIME_LIMIT } from "../../../quiz/lib/timing.js";
export const GAMES = ["human_or_ai", "bet_machine", "investigation", "prompt_duel", "definition"];
export const FAMILIES = ["fondamentaux", "limites", "prompting", "usages"];
export const SESSION_RE = /^[a-z0-9-]{1,20}$/;
const MEDIA_KINDS = ["text", "image", "code", "video"];

const isText = (v) => typeof v === "string" && v.trim().length > 0;
const uniqueItems = (items) =>
  Array.isArray(items) &&
  items.every((x) => isText(x?.id) && isText(x?.text)) &&
  new Set(items.map((x) => x.id)).size === items.length;

export function validateConcepts(doc) {
  if (!Array.isArray(doc?.concepts)) return ["concepts: tableau « concepts » manquant"];
  const errors = [];
  const seen = new Set();
  for (const c of doc.concepts) {
    const id = c?.id ?? "?";
    if (!/^[a-z0-9-]+$/.test(c?.id ?? "")) errors.push(`${id}: id invalide`);
    if (seen.has(id)) errors.push(`${id}: id dupliqué`);
    seen.add(id);
    if (!isText(c?.label)) errors.push(`${id}: label manquant`);
    if (!FAMILIES.includes(c?.family)) errors.push(`${id}: famille inconnue « ${c?.family} »`);
    if (!isText(c?.definition)) errors.push(`${id}: definition manquante`);
  }
  return errors;
}

function validateTimes(id, media, errors) {
  if (media.start !== undefined && !(Number.isInteger(media.start) && media.start >= 0)) errors.push(`${id}: media.start invalide`);
  const start = media.start ?? (media.url !== undefined ? resolveMedia(media).start : undefined) ?? 0;
  if (media.end !== undefined && !(Number.isInteger(media.end) && media.end > start)) errors.push(`${id}: media.end doit être > media.start`);
}

function validateMedia(id, media, errors) {
  if (!media || typeof media !== "object") return errors.push(`${id}: media manquant`);
  if (media.url !== undefined) {
    const resolved = resolveMedia(media);
    if (resolved.error) errors.push(`${id}: ${resolved.error}`);
    else if (resolved.kind === "image" && !isText(media.alt)) errors.push(`${id}: media.alt requis pour une image`);
    validateTimes(id, media, errors);
  } else {
    if (!MEDIA_KINDS.includes(media.kind)) return errors.push(`${id}: media.kind inconnu « ${media.kind} »`);
    if ((media.kind === "text" || media.kind === "code") && !isText(media.text)) errors.push(`${id}: media.text manquant`);
    if (media.kind === "image" && (!isText(media.src) || !isText(media.alt))) errors.push(`${id}: media.src et media.alt requis`);
    if (media.kind === "video") {
      if (media.src === undefined) {
        if (!["youtube", "vimeo"].includes(media.provider) || !isText(media.id)) {
          errors.push(`${id}: vidéo : provider (youtube|vimeo) + id, ou src, requis`);
        }
        validateTimes(id, media, errors);
      } else if (!isText(media.src)) {
        errors.push(`${id}: media.src invalide`);
      }
    }
  }
  if (media.fallback !== undefined && !isHttpsUrl(media.fallback)) errors.push(`${id}: media.fallback doit être une URL https`);
}

function validateQuestion(q, conceptIds, errors) {
  const id = isText(q?.id) ? q.id : "?";
  if (!GAMES.includes(q?.game)) return errors.push(`${id}: jeu inconnu « ${q?.game} »`);
  if (!conceptIds.has(q.concept)) errors.push(`${id}: concept inconnu « ${q.concept} »`);
  if (!isText(q.explanation)) errors.push(`${id}: explanation manquante`);
  if (q.warmup !== undefined && typeof q.warmup !== "boolean") errors.push(`${id}: warmup doit être un booléen`);
  if (q.revisits !== undefined && !SESSION_RE.test(q.revisits)) errors.push(`${id}: revisits invalide`);
  if (q.timeLimit !== undefined && !(Number.isInteger(q.timeLimit) && q.timeLimit >= MIN_TIME_LIMIT && q.timeLimit <= MAX_TIME_LIMIT)) {
    errors.push(`${id}: timeLimit doit être un entier entre ${MIN_TIME_LIMIT} et ${MAX_TIME_LIMIT}`);
  }
  if (q.question !== undefined && !(isText(q.question) && q.question.length <= 300)) {
    errors.push(`${id}: question doit être un texte de 300 caractères maximum`);
  }
  if (q.media !== undefined || q.game === "human_or_ai") validateMedia(id, q.media, errors);

  switch (q.game) {
    case "human_or_ai":
      if (!["human", "ai"].includes(q.answer)) errors.push(`${id}: answer doit valoir "human" ou "ai"`);
      break;
    case "bet_machine":
      if (!isText(q.prompt)) errors.push(`${id}: prompt manquant`);
      if (!uniqueItems(q.choices) || q.choices.length < 2) errors.push(`${id}: au moins 2 choices {id, text} aux id uniques`);
      else if (!q.choices.some((c) => c.id === q.answer)) errors.push(`${id}: answer ne correspond à aucun choix`);
      break;
    case "investigation": {
      const lines = q.transcript;
      const wellFormed =
        Array.isArray(lines) && lines.length >= 2 && lines.every((l) => ["user", "ai"].includes(l?.role) && isText(l?.text));
      if (!wellFormed) errors.push(`${id}: transcript d'au moins 2 lignes {role: user|ai, text} requis`);
      else if (!(q.answer === null || (Number.isInteger(q.answer) && lines[q.answer]?.role === "ai"))) {
        errors.push(`${id}: answer doit désigner une ligne « ai » ou null`);
      }
      break;
    }
    case "definition":
      if (!isText(q.term)) errors.push(`${id}: term manquant`);
      if (!uniqueItems(q.choices) || q.choices.length < 2) errors.push(`${id}: au moins 2 choices {id, text} aux id uniques`);
      else if (!q.choices.some((c) => c.id === q.answer)) errors.push(`${id}: answer ne correspond à aucun choix`);
      break;
    case "prompt_duel":
      if (!isText(q.task)) errors.push(`${id}: task manquante`);
      if (!uniqueItems(q.prompts) || q.prompts.length < 2) {
        errors.push(`${id}: au moins 2 prompts {id, text} aux id uniques`);
      } else {
        for (const p of q.prompts) if (!isText(q.outputs?.[p.id])) errors.push(`${id}: outputs manquant pour le prompt « ${p.id} »`);
        if (!q.prompts.some((p) => p.id === q.answer)) errors.push(`${id}: answer ne correspond à aucun prompt`);
      }
      break;
  }
}

export function validateGame(game, conceptsDoc, { strict = false } = {}) {
  const errors = [];
  const warnings = [];
  const conceptIds = new Set((conceptsDoc?.concepts ?? []).map((c) => c.id));

  if (!SESSION_RE.test(game?.session ?? "")) errors.push(`partie: session invalide « ${game?.session} »`);
  if (!isText(game?.title)) errors.push("partie: title manquant");
  if (!Array.isArray(game?.questions)) return { errors: [...errors, "partie: questions manquantes"], warnings };

  const seen = new Set();
  for (const q of game.questions) {
    const id = isText(q?.id) ? q.id : "?";
    if (seen.has(id)) errors.push(`${id}: id dupliqué`);
    seen.add(id);
    validateQuestion(q, conceptIds, errors);
    if (q?.verify === true) (strict ? errors : warnings).push(`${id}: contenu à vérifier (verify: true)`);
  }

  const warmups = game.questions.filter((q) => q?.warmup === true).length;
  const counted = game.questions.length - warmups;
  if (warmups > 1) errors.push(`partie: au plus 1 échauffement (${warmups})`);
  if (counted < 5 || counted > 8) errors.push(`partie: 5 à 8 questions comptées attendues (${counted})`);
  return { errors, warnings };
}
