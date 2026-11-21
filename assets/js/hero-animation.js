/* Pasko ng Angkan 2026 v2.8 — scoped decorative Christmas banner effects. */
(() => {
  "use strict";
  const hero = document.querySelector(".hero-animated");
  const snow = document.getElementById("heroSnow");
  if (!hero || !snow) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  // Fixed seed: consistent snowfall layout without external images, libraries or data calls.
  const seeded = (n) => {
    const value = Math.sin(n * 73.873 + 10.37) * 43758.5453123;
    return value - Math.floor(value);
  };
  const makeSnow = () => {
    snow.replaceChildren();
    if (reduceMotion.matches) return;
    const count = window.innerWidth <= 700 ? 19 : 31;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const dot = document.createElement("i");
      dot.className = "hero-flake";
      dot.setAttribute("aria-hidden", "true");
      const size = 1.5 + seeded(i + 91) * 3;
      dot.style.setProperty("--flake-left", `${(seeded(i + 3) * 100).toFixed(2)}%`);
      dot.style.setProperty("--flake-size", `${size.toFixed(1)}px`);
      dot.style.setProperty("--flake-opacity", (0.35 + seeded(i + 40) * 0.53).toFixed(2));
      dot.style.setProperty("--flake-duration", `${(7 + seeded(i + 65) * 8).toFixed(2)}s`);
      dot.style.setProperty("--flake-delay", `${(-15 * seeded(i + 110)).toFixed(2)}s`);
      dot.style.setProperty("--flake-drift", `${(-17 + seeded(i + 130) * 34).toFixed(1)}px`);
      fragment.appendChild(dot);
    }
    snow.appendChild(fragment);
  };
  makeSnow();
  // Pause artwork when offscreen or the tab is hidden, conserving battery.
  let inView = true;
  const applyPause = () => hero.classList.toggle("hero-motion-paused", document.hidden || !inView);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? true;
      applyPause();
    }, {threshold:0.02});
    observer.observe(hero);
  }
  document.addEventListener("visibilitychange", applyPause);
  reduceMotion.addEventListener?.("change", makeSnow);
})();
