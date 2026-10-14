// Turns `media.url` into a playable media description. Shared by the validator
// (organisers get a clear error) and the front (rendering). The legacy explicit
// form ({kind, provider, id, src}) is returned unchanged.
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp", "gif", "avif"];
const VIDEO_EXT = ["mp4", "webm", "mov"];
const SOCIAL = ["tiktok.com", "instagram.com", "x.com", "twitter.com", "facebook.com", "fb.watch"];

const hostIs = (host, domain) => host === domain || host.endsWith(`.${domain}`);

export function parseTime(value) {
  if (value === null || value === undefined || value === "") return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!m || !(m[1] || m[2] || m[3])) return undefined;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export function resolveMedia(media) {
  if (!media || typeof media !== "object") return { error: "media manquant" };
  if (media.url === undefined) return media;
  let u;
  try {
    u = new URL(media.url);
  } catch {
    return { error: "media.url invalide" };
  }
  if (u.protocol !== "https:") return { error: "media.url doit être en https" };
  const host = u.hostname.toLowerCase().replace(/^(www|m)\./, "");
  if (SOCIAL.some((d) => hostIs(host, d))) {
    return { error: "réseaux sociaux non pris en charge (TikTok, Instagram, X, Facebook) : utilisez YouTube, Vimeo ou un fichier vidéo" };
  }
  const extra = {};
  if (media.alt !== undefined) extra.alt = media.alt;
  if (media.fallback !== undefined) extra.fallback = media.fallback;
  const times = (fromUrl) => {
    const out = {};
    const start = media.start ?? fromUrl;
    if (start !== undefined) out.start = start;
    if (media.end !== undefined) out.end = media.end;
    return out;
  };

  if (hostIs(host, "youtube.com") || host === "youtu.be") {
    let id;
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else id = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(u.pathname)?.[1];
    if (!id || !/^[A-Za-z0-9_-]{6,20}$/.test(id)) return { error: "identifiant YouTube introuvable dans l'URL" };
    return { kind: "video", provider: "youtube", id, ...times(parseTime(u.searchParams.get("t") ?? u.searchParams.get("start"))), ...extra };
  }
  if (hostIs(host, "vimeo.com")) {
    const id = /\/(\d+)(?:\/|$)/.exec(u.pathname)?.[1];
    if (!id) return { error: "identifiant Vimeo introuvable dans l'URL" };
    return { kind: "video", provider: "vimeo", id, ...times(parseTime(/t=([0-9hms]+)/.exec(u.hash)?.[1])), ...extra };
  }
  const ext = /\.([a-z0-9]+)$/i.exec(u.pathname)?.[1]?.toLowerCase();
  if (IMAGE_EXT.includes(ext)) return { kind: "image", src: u.href, ...extra };
  if (VIDEO_EXT.includes(ext)) return { kind: "video", src: u.href, ...times(undefined), ...extra };
  return { error: "type de média non reconnu : YouTube, Vimeo, image (.jpg, .png, .webp, .gif, .avif) ou vidéo (.mp4, .webm, .mov)" };
}
