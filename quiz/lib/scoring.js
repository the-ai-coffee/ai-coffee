// Scoring rewards being right AND being calibrated: a confident mistake costs more
// than a hesitant one. Pure functions, shared by the browser and the Netlify function.
export const CONFIDENCE_POINTS = { 1: [70, 30], 2: [85, 15], 3: [100, 0] };

export function scoreAnswer(correct, confidence) {
  const points = CONFIDENCE_POINTS[confidence];
  if (!points) throw new RangeError(`confidence must be 1, 2 or 3 (got ${confidence})`);
  return correct ? points[0] : points[1];
}

export const isCorrect = (question, choice) => choice === question.answer;

// Answers are counted per choice; « rien ne cloche » (null) needs a string key.
export const choiceKey = (choice) => (choice === null ? "none" : String(choice));

const ratio = (part, whole) => (whole ? part / whole : null);

export function scorePlayer(questions, answers = {}) {
  let points = 0;
  let answered = 0;
  let correct = 0;
  let confidence = 0;
  const concepts = {};
  for (const q of questions) {
    if (q.warmup) continue;
    const a = answers[q.id];
    if (!a) continue;
    const ok = isCorrect(q, a.choice);
    points += scoreAnswer(ok, a.confidence);
    answered++;
    confidence += a.confidence;
    if (ok) correct++;
    const c = (concepts[q.concept] ??= { answered: 0, correct: 0 });
    c.answered++;
    if (ok) c.correct++;
  }
  return {
    score: answered ? Math.round(points / answered) : null,
    answered,
    correct,
    correctRate: ratio(correct, answered),
    avgConfidence: ratio(confidence, answered),
    concepts,
  };
}

export function aggregate(questions, players) {
  const perQuestion = Object.fromEntries(questions.map((q) => [q.id, { counts: {}, answered: 0, correct: 0 }]));
  const concepts = {};
  for (const q of questions) {
    if (!q.warmup) (concepts[q.concept] ??= { asked: 0, answers: 0, correct: 0, confidence: 0 }).asked++;
  }

  const scores = [];
  for (const player of players) {
    const answers = player.answers ?? {};
    const { score } = scorePlayer(questions, answers);
    if (score !== null) scores.push(score);
    for (const q of questions) {
      const a = answers[q.id];
      if (!a) continue;
      const ok = isCorrect(q, a.choice);
      const pq = perQuestion[q.id];
      const key = choiceKey(a.choice);
      pq.counts[key] = (pq.counts[key] ?? 0) + 1;
      pq.answered++;
      if (ok) pq.correct++;
      if (q.warmup) continue;
      const c = concepts[q.concept];
      c.answers++;
      c.confidence += a.confidence;
      if (ok) c.correct++;
    }
  }

  return {
    players: players.length,
    globalScore: scores.length ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length) : null,
    perQuestion: Object.fromEntries(
      Object.entries(perQuestion).map(([id, pq]) => [id, { counts: pq.counts, answered: pq.answered, correctRate: ratio(pq.correct, pq.answered) }]),
    ),
    concepts: Object.fromEntries(
      Object.entries(concepts).map(([id, c]) => [
        id,
        { asked: c.asked, answers: c.answers, correctRate: ratio(c.correct, c.answers), avgConfidence: ratio(c.confidence, c.answers) },
      ]),
    ),
  };
}
