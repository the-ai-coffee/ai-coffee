import { h } from "./dom.js";

export function renderMedia(media) {
  if (!media) return null;
  switch (media.kind) {
    case "text":
      return h("blockquote", { class: "media media-text" }, media.text);
    case "code":
      return h("pre", { class: "media media-code" }, h("code", {}, media.text));
    case "image":
      return h("img", { class: "media media-image", src: media.src, alt: media.alt ?? "" });
    case "video":
      return renderVideo(media);
    default:
      return h("p", { class: "error" }, "Média non pris en charge.");
  }
}

function renderVideo(media) {
  if (media.src) {
    return h("video", { class: "media media-video", src: media.src, controls: true, playsinline: true, preload: "metadata" });
  }
  const start = media.start ?? 0;
  const src =
    media.provider === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.id)}?start=${start}${media.end ? `&end=${media.end}` : ""}&rel=0&playsinline=1`
      : `https://player.vimeo.com/video/${encodeURIComponent(media.id)}#t=${start}s`;
  return h(
    "div",
    { class: "media-video-wrap" },
    h("iframe", { class: "media media-video", src, title: "Vidéo", loading: "lazy", allow: "autoplay; encrypted-media; picture-in-picture", allowfullscreen: true }),
    media.fallback ? h("a", { class: "media-fallback", href: media.fallback, target: "_blank", rel: "noopener" }, "La vidéo ne se charge pas ? Voir l'image") : null,
  );
}
