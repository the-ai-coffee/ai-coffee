const BASE = "/api/quiz";

export class ApiError extends Error {
  constructor(status, code) {
    super(`${status} ${code}`);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, key } = {}) {
  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (key) headers.authorization = `Bearer ${key}`;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? "network");
  return data;
}

const qs = (s, extra = "") => `?s=${encodeURIComponent(s)}${extra}`;

export const api = {
  game: (s) => request(`/game${qs(s)}`),
  state: (s) => request(`/state${qs(s)}`),
  join: (s, pseudo, uid) => request(`/join${qs(s)}`, { method: "POST", body: { pseudo, uid } }),
  answer: (s, pid, qid, choice, confidence) => request(`/answer${qs(s)}`, { method: "POST", body: { pid, qid, choice, confidence } }),
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
