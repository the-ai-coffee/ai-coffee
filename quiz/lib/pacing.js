// Polling cadence for the quiz. Every poll is a billed Netlify call, so each
// loop polls only as fast as its game status needs, never from a hidden tab,
// and pauses after a long stretch without any change.

export const IDLE_LIMIT_MS = 15 * 60 * 1000;

// ms before the next poll; null = nothing left to follow.
const DELAYS = {
  player: { closed: 3000, open: 3000, reveal: 1500, done: null },
  host: { closed: 5000, open: 2000, reveal: 1500, done: 5000 },
};

export function nextDelay({ role, status, hidden = false, idleMs = 0 }) {
  const table = DELAYS[role];
  if (!table) throw new Error(`unknown role: ${role}`);
  if (hidden || idleMs >= IDLE_LIMIT_MS) return null;
  return Object.hasOwn(table, status) ? table[status] : table.closed;
}
