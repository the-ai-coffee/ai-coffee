// Question timers and the host's countdown. The timer never changes the score.
export const DEFAULT_TIME_LIMITS = { human_or_ai: 15, bet_machine: 20, investigation: 30, prompt_duel: 30, definition: 20 };
export const MIN_TIME_LIMIT = 5;
export const MAX_TIME_LIMIT = 120;

export const timeLimitFor = (q) => (Number.isInteger(q.timeLimit) ? q.timeLimit : (DEFAULT_TIME_LIMITS[q.game] ?? 20));

// The host's countdown starts at 10 minutes; ±1 min buttons adjust it.
export const DEFAULT_GAME_SEC = 600;
export const gameDurationSec = () => DEFAULT_GAME_SEC;

export function remainingSec(state, nowMs = Date.now()) {
  if (!state?.openedAt || !state?.durationSec) return null;
  const elapsed = (nowMs - Date.parse(state.openedAt)) / 1000;
  return Math.max(0, Math.round(state.durationSec - elapsed));
}

export const formatClock = (sec) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
