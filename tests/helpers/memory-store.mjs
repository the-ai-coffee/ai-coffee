// In-memory stand-in for a Netlify Blobs store (only the calls the quiz API uses).
export function memoryStore() {
  const data = new Map();
  return {
    data,
    async get(key, { type } = {}) {
      if (!data.has(key)) return null;
      const raw = data.get(key);
      return type === "json" ? JSON.parse(raw) : raw;
    },
    async setJSON(key, value) {
      data.set(key, JSON.stringify(value));
    },
    async delete(key) {
      data.delete(key);
    },
    async list({ prefix = "" } = {}) {
      return { blobs: [...data.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key, etag: "mem" })) };
    },
  };
}
