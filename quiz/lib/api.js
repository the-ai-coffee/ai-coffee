const BASE = "/api/quiz";

export class ApiError extends Error {
  constructor(status, code) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

// Answers go through a one-at-a-time queue: a request hanging on flaky Wi-Fi
// must give up quickly so the answers behind it are not held until the reveal.
export const ANSWER_TIMEOUT_MS = 8000;

// Every failure is an ApiError: HTTP errors keep their status, while network
// failures and timeouts get status 0 and the code "network" or "timeout".
async function request(path, { method = "GET", body, key, timeout } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers.authorization = `Bearer ${key}`;
  const controller = timeout ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    let res;
    try {
      res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller?.signal });
    } catch {
      throw new ApiError(0, controller?.signal.aborted ? "timeout" : "network");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error ?? "network");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

const qs = (s, extra = "") => `?s=${encodeURIComponent(s)}${extra}`;

export const api = {
  game: (s) => request(`/game${qs(s)}`),
  state: (s) => request(`/state${qs(s)}`),
  join: (s, pseudo, uid) => request(`/join${qs(s)}`, { method: "POST", body: { pseudo, uid } }),
  answer: (s, pid, qid, choice, confidence) =>
    request(`/answer${qs(s)}`, { method: "POST", body: { pid, qid, choice, confidence }, timeout: ANSWER_TIMEOUT_MS }),
  me: (s, pid) => request(`/me${qs(s, `&pid=${encodeURIComponent(pid)}`)}`),
  hostState: (s, key) => request(`/host-state${qs(s)}`, { key }),
  host: (s, key, action, extra = {}) => request(`/host${qs(s)}`, { method: "POST", key, body: { action, ...extra } }),
};

// Calls fn every `ms` milliseconds, never overlapping; errors are logged and retried.
export function poll(fn, ms) {
  let stopped = false;
  let timer;
  const tick = async () => {
    if (stopped) return;
    try {
      await fn();
    } catch (err) {
      console.warn("[quiz] poll", err);
    }
    if (!stopped) timer = setTimeout(tick, ms);
  };
  tick();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
