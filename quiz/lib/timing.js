// Question timers and the host's countdown. The timer never changes the score.
export const DEFAULT_TIME_LIMITS = { human_or_ai: 15, bet_machine: 20, investigation: 30, prompt_duel: 30 };
export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 120;

export const timeLimitFor = (q) => (Number.isInteger(q.timeLimit) ? q.timeLimit : (DEFAULT_TIME_LIMITS[q.game] ?? 20));

// Every question's timer plus a 60 s margin, rounded up to the minute.
export function gameDurationSec(questions) {
  const total = questions.reduce((sum, q) => sum + timeLimitFor(q), 0) + 60;
  return Math.ceil(total / 60) * 60;
}

export function remainingSec(state, nowMs = Date.now()) {
  if (!state?.openedAt || !state?.durationSec) return null;
  const elapsed = (nowMs - Date.parse(state.openedAt)) / 1000;
  return Math.max(0, Math.round(state.durationSec - elapsed));
}

export const formatClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
