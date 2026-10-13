// Fecha de la propuesta. PLACEHOLDER: cámbiala por la fecha real.
const PROPUESTA = new Date("2026-12-31T20:00:00");

const track = document.getElementById("track");
const slides = [...track.children];
const dotsWrap = document.getElementById("dots");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const carousel = document.getElementById("carousel");

let index = 0;

const dots = slides.map((_, i) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("aria-label", `Ir al folleto ${i + 1}`);
  dot.addEventListener("click", () => go(i));
  dotsWrap.append(dot);
  return dot;
});

function go(i) {
  // Da la vuelta: después del último vuelve al primero, y viceversa.
  index = (i + slides.length) % slides.length;
  track.style.transform = `translateX(${-index * 100}%)`;
  dots.forEach((d, n) => d.setAttribute("aria-current", String(n === index)));
  slides.forEach((s, n) => s.toggleAttribute("inert", n !== index));
}

prevBtn.addEventListener("click", () => go(index - 1));
nextBtn.addEventListener("click", () => go(index + 1));

// Flechas del teclado
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") go(index - 1);
  if (e.key === "ArrowRight") go(index + 1);
});

// Deslizar con el dedo o el mouse
let startX = null;
carousel.addEventListener("pointerdown", (e) => {
  startX = e.clientX;
});
carousel.addEventListener("pointerup", (e) => {
  if (startX === null) return;
  const dx = e.clientX - startX;
  startX = null;
  if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
});
carousel.addEventListener("pointercancel", () => { startX = null; });

// Cuenta regresiva
const els = {
  days: document.getElementById("t-days"),
  hours: document.getElementById("t-hours"),
  mins: document.getElementById("t-mins"),
  secs: document.getElementById("t-secs"),
};
const link = document.getElementById("timer-link");
const pad = (n) => String(n).padStart(2, "0");

function tick() {
  const ms = PROPUESTA - Date.now();
  if (ms <= 0) {
    els.days.textContent = els.hours.textContent = els.mins.textContent = els.secs.textContent = "00";
    link.hidden = false;
    clearInterval(timerId);
    return;
  }
  const total = Math.floor(ms / 1000);
  els.days.textContent = Math.floor(total / 86400);
  els.hours.textContent = pad(Math.floor((total % 86400) / 3600));
  els.mins.textContent = pad(Math.floor((total % 3600) / 60));
  els.secs.textContent = pad(total % 60);
}

tick();
const timerId = setInterval(tick, 1000);
go(0);
