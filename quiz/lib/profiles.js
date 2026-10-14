// Default « profil IA » values. Tweak the copy freely; keep the ids stable
// (the host screen counts players per profile id).
export const THRESHOLDS = { correctRate: 0.6, avgConfidence: 2 };

export const PROFILES = {
  oracle: { id: "oracle", emoji: "🎯", title: "Oracle calibré", tagline: "Tu sais, et tu sais que tu sais." },
  sceptique: { id: "sceptique", emoji: "🧐", title: "Sceptique éclairé", tagline: "Tu doutes, mais tu vises juste." },
  temeraire: { id: "temeraire", emoji: "🚀", title: "Optimiste téméraire", tagline: "La machine t'a eu en beauté." },
  explorateur: { id: "explorateur", emoji: "🔭", title: "Explorateur prudent", tagline: "Tu avances à tâtons, et c'est sain." },
};

export function profileFor({ correctRate, avgConfidence }) {
  if (correctRate === null || correctRate === undefined) return null;
  const accurate = correctRate >= THRESHOLDS.correctRate;
  const confident = avgConfidence >= THRESHOLDS.avgConfidence;
  if (accurate) return confident ? PROFILES.oracle : PROFILES.sceptique;
  return confident ? PROFILES.temeraire : PROFILES.explorateur;
}

export const BADGES = {
  detector: { id: "detector", emoji: "🕵️", title: "Détecteur de machines" },
};

export function badgesFor(questions, answers = {}) {
  const humanOrAi = questions.filter((q) => q.game === "human_or_ai" && !q.warmup);
  if (!humanOrAi.length) return [];
  return humanOrAi.every((q) => answers[q.id]?.choice === q.answer) ? [BADGES.detector] : [];
}
