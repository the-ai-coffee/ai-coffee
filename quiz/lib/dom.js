// Tiny DOM builder. Children are appended as text nodes, never parsed as HTML,
// so content from quiz files or pseudos cannot inject markup.
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (name.startsWith("on") && typeof value === "function") el.addEventListener(name.slice(2).toLowerCase(), value);
    else if (name === "class") el.className = value;
    else el.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

export function mount(root, ...nodes) {
  root.replaceChildren(...nodes.flat().filter(Boolean));
}
