import { h } from "./dom.js";
import { isHttpsUrl, resolveMedia } from "./media-url.js";

export function renderMedia(media) {
  if (!media) return null;
  const m = resolveMedia(media);
  if (m.error) return h("p", { class: "error" }, `Média indisponible : ${m.error}`);
  switch (m.kind) {
    case "text":
      return h("blockquote", { class: "media media-text" }, m.text);
    case "code":
      return h("pre", { class: "media media-code" }, h("code", {}, m.text));
    case "image":
      return h("img", { class: "media media-image", src: m.src, alt: m.alt ?? "" });
    case "video":
      return renderVideo(m);
    default:
      return h("p", { class: "error" }, "Média non pris en charge.");
  }
}

function renderVideo(m) {
  if (m.src) {
    // a media fragment makes the browser start (and pause) at the extract's bounds
    const range = m.start !== undefined || m.end !== undefined ? `#t=${m.start ?? 0}${m.end !== undefined ? `,${m.end}` : ""}` : "";
    return h("video", { class: "media media-video", src: m.src.split("#")[0] + range, controls: true, playsinline: true, preload: "metadata" });
  }
  const start = m.start ?? 0;
  const src =
    m.provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.id)}?start=${start}${m.end ? `&end=${m.end}` : ""}&rel=0&playsinline=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(m.id)}#t=${start}s`;
  return h(
    "div",
    { class: "media-video-wrap" },
    h("iframe", { class: "media media-video", src, title: "Vidéo", loading: "lazy", allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true }),
    isHttpsUrl(m.fallback) ? h("a", { class: "media-fallback", href: m.fallback, target: "_blank", rel: "noopener" }, "La vidéo ne se charge pas ? Voir l'image") : null,
  );
}

// Resolves when a question's timer may start: once a video extract has had time to play.
// Embeds: wait (end − start) seconds when known. Video files: wait for the end of the video
// (or of the extract when `end` is given), capped by its length; if its metadata never
// arrives within 3 s, don't hold the timer.
export function waitForMedia(media, container) {
  const m = media ? resolveMedia(media) : null;
  if (!m || m.error || m.kind !== "video") return Promise.resolve();
  if (m.provider) {
    const sec = m.end !== undefined ? m.end - (m.start ?? 0) : 0;
    return new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(sec, 0), 120) * 1000));
  }
  const video = container.querySelector("video");
  if (!video) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve();
      }
    };
    video.addEventListener("ended", finish, { once: true });
    // with an end bound the browser pauses at the fragment's end instead of firing « ended »
    if (m.end !== undefined) video.addEventListener("timeupdate", () => video.currentTime >= m.end - 0.3 && finish());
    const capByDuration = () => setTimeout(finish, Math.min((m.end ?? video.duration ?? 0) - (m.start ?? 0) || 0, 120) * 1000 + 500);
    if (video.readyState >= 1) capByDuration();
    else video.addEventListener("loadedmetadata", capByDuration, { once: true });
    setTimeout(() => {
      if (video.readyState < 1) finish();
    }, 3000);
  });
}
