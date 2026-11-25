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

// Drives one polling loop with nextDelay(). Dependencies are injected so
// node:test can run it without a browser.
export function pacedLoop({
  role,
  tick,
  status,
  signature,
  onPause = () => {},
  onResume = () => {},
  immediate = true,
  doc = globalThis.document,
  now = Date.now,
  timers = globalThis,
}) {
  let timer = null;
  let running = false;
  let paused = false; // stopped by the idle cutoff, waiting for an interaction
  let stopped = false;
  let lastSig = signature();
  let lastChange = now();

  const clear = () => {
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
  };

  const schedule = () => {
    clear();
    if (stopped) return;
    const s = status();
    if (nextDelay({ role, status: s }) === null) return; // finished: nothing left to follow
    if (doc.hidden) return; // resumes on visibilitychange
    const delay = nextDelay({ role, status: s, idleMs: now() - lastChange });
    if (delay !== null) timer = timers.setTimeout(run, delay);
    else if (!paused) {
      paused = true;
      onPause();
    }
  };

  const run = async () => {
    if (running || stopped) return;
    running = true;
    try {
      await tick();
      const sig = signature();
      if (sig !== lastSig) {
        lastSig = sig;
        lastChange = now();
      }
    } catch (err) {
      console.warn("[quiz] poll", err);
    } finally {
      running = false;
    }
    try {
      schedule();
    } catch (err) {
      // status() threw: keep the loop alive at the lobby cadence
      console.warn("[quiz] poll", err);
      const delay = nextDelay({ role, status: undefined });
      if (!stopped && !doc.hidden) timer = timers.setTimeout(run, delay);
    }
  };

  const wake = () => {
    if (stopped) return;
    lastChange = now();
    if (paused) {
      paused = false;
      onResume();
    }
    clear();
    run();
  };

  const touch = () => {
    if (paused) wake();
    else lastChange = now();
  };

  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) wake();
  });
  doc.addEventListener("pointerdown", touch);
  doc.addEventListener("keydown", touch);

  if (immediate) run();
  else schedule();

  return {
    wake,
    stop() {
      stopped = true;
      clear();
    },
  };
}
