import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal DOM stand-in, enough for the h() builder and a click.
class Node {}
class El extends Node {
  constructor(tag) {
    super();
    this.tagName = tag.toUpperCase();
    this.attrs = {};
    this.children = [];
    this.listeners = {};
    this.parent = null;
  }
  set className(v) {
    this.attrs.class = v;
  }
  setAttribute(k, v) {
    this.attrs[k] = v;
  }
  getAttribute(k) {
    return this.attrs[k] ?? null;
  }
  addEventListener(type, fn) {
    this.listeners[type] = fn;
  }
  append(child) {
    if (child instanceof El) child.parent = this;
    this.children.push(child);
  }
  replaceWith(other) {
    const i = this.parent.children.indexOf(this);
    other.parent = this.parent;
    this.parent.children[i] = other;
  }
  get text() {
    return this.children.map((c) => (c instanceof El ? c.text : c)).join("");
  }
}
globalThis.Node = Node;
globalThis.document = { createElement: (tag) => new El(tag) };

const { renderMedia } = await import("../../quiz/lib/media.js");

test("a YouTube video starts behind a neutral cover, so its title cannot give the answer away", () => {
  const wrap = renderMedia({ url: "https://www.youtube.com/shorts/AAco7ZuBksk", start: 0, end: 20 });
  const [cover] = wrap.children;
  assert.equal(cover.tagName, "BUTTON");
  assert.match(cover.text, /Lancer la vidéo/);
  assert.ok(!wrap.children.some((c) => c.tagName === "IFRAME"), "no player, hence no title, before the tap");
  cover.listeners.click();
  const [frame] = wrap.children;
  assert.equal(frame.tagName, "IFRAME");
  assert.match(frame.getAttribute("src"), /youtube-nocookie\.com\/embed\/AAco7ZuBksk\?start=0&end=20/);
  assert.match(frame.getAttribute("src"), /autoplay=1/);
});

test("a Vimeo video asks the player to hide its title, author and avatar", () => {
  const wrap = renderMedia({ url: "https://vimeo.com/123456789" });
  const [frame] = wrap.children;
  assert.equal(frame.tagName, "IFRAME");
  assert.match(frame.getAttribute("src"), /title=0&byline=0&portrait=0/);
});
