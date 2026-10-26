// Small animation helpers shared by the player app and the host screen.
export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// Animates a number from 0 to `target` in `el` (instant when motion is reduced).
export function countUp(el, target, ms = 1200) {
  if (reducedMotion()) {
    el.textContent = String(target);
    return;
  }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = String(Math.round(target * k));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
