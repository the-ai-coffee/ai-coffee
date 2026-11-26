// Default « profil IA » values. Tweak the copy freely; keep the ids stable
// (the host screen counts players per profile id).
// The profile depends only on the share of right answers.
export const THRESHOLDS = { oracle: 0.8, sceptique: 0.5 };

export const PROFILES = {
  oracle: { id: "oracle", emoji: "🎯", title: "Œil de lynx", tagline: "La machine ne t'a presque jamais eu.", range: "80 % de bonnes réponses ou plus" },
  sceptique: { id: "sceptique", emoji: "🧐", title: "Bon flair", tagline: "Tu vises juste, plus souvent qu'à ton tour.", range: "De 50 à 79 % de bonnes réponses" },
  explorateur: { id: "explorateur", emoji: "🔭", title: "Explorateur", tagline: "La machine t'a eu, et c'est comme ça qu'on apprend.", range: "Moins de 50 % de bonnes réponses" },
};

export function profileFor({ correctRate }) {
  if (correctRate === null || correctRate === undefined) return null;
  if (correctRate >= THRESHOLDS.oracle) return PROFILES.oracle;
  if (correctRate >= THRESHOLDS.sceptique) return PROFILES.sceptique;
  return PROFILES.explorateur;
}

export const BADGES = {
  detector: { id: "detector", emoji: "🕵️", title: "Détecteur de machines" },
};

export function badgesFor(questions, answers = {}) {
  const humanOrAi = questions.filter((q) => q.game === "human_or_ai" && !q.warmup);
  if (!humanOrAi.length) return [];
  return humanOrAi.every((q) => answers[q.id]?.choice === q.answer) ? [BADGES.detector] : [];
}
