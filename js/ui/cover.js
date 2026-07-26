// Splash/cover screen shown on first load — purely a visual overlay, the
// app underneath is already initialised so dismissing it needs no tab-
// lifecycle wiring.

const MATH_SYMBOLS = ["+", "−", "×", "÷", "="];

// A handful of oversized, near-invisible symbols drifting slowly behind the
// cover text — purely decorative, generated once so the randomised
// position/size/timing never needs hand-authored markup.
function createMathBackground(cover) {
  const bg = document.createElement("div");
  bg.className = "cover-math-bg";

  const COUNT = 16;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement("span");
    el.className = "cover-math-symbol";
    el.textContent =
      MATH_SYMBOLS[Math.floor(Math.random() * MATH_SYMBOLS.length)];
    el.style.left = `${Math.random() * 100}%`;
    el.style.top = `${Math.random() * 100}%`;
    el.style.fontSize = `${28 + Math.random() * 46}px`;
    el.style.animationDuration = `${14 + Math.random() * 12}s`;
    el.style.animationDelay = `-${Math.random() * 16}s`; // stagger phases so they don't all drift in sync
    el.style.setProperty("--dx", `${(Math.random() - 0.5) * 180}px`);
    el.style.setProperty("--dy", `${(Math.random() - 0.5) * 180}px`);
    el.style.setProperty("--rot", `${(Math.random() - 0.5) * 40}deg`);
    bg.appendChild(el);
  }

  cover.insertBefore(bg, cover.firstChild);
}

export function initCover() {
  const cover = document.getElementById("cover-screen");
  const btn = document.getElementById("cover-start-btn");
  if (!cover || !btn) return;

  createMathBackground(cover);

  btn.addEventListener("click", () => {
    cover.classList.add("hidden");
    // Matches --duration-slow in css/styles.css — the fade/scale/blur exit
    // must finish before the node is removed.
    setTimeout(() => cover.remove(), 400);
  });
}
