// Fecha de la propuesta. PLACEHOLDER: cámbiala por la fecha real.
const PROPUESTA = new Date("2026-12-31T20:00:00");

const track = document.getElementById("track");
const slides = [...track.children];
const dotsWrap = document.getElementById("dots");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const carousel = document.getElementById("carousel");

const n = slides.length;
const mod = (i) => ((i % n) + n) % n;

// Posición relativa de cada folleto respecto al activo: 0 = al centro,
// 1 = a la derecha, -1 = a la izquierda (circular).
const rel = (i, current) => {
  let d = mod(i - current);
  if (d > n / 2) d -= n;
  return d;
};

let index = 0;
let offsets = slides.map((_, i) => rel(i, 0));

const dots = slides.map((_, i) => {
  const dot = document.createElement("button");
  dot.type = "button";
  dot.setAttribute("aria-label", `Ir al folleto ${i + 1}`);
  dot.addEventListener("click", () => go(i));
  dotsWrap.append(dot);
  return dot;
});

function place(slide, offset, dragPx = 0) {
  slide.style.transform = `translateX(calc(${offset * 100}% + ${dragPx}px))`;
}

function go(target) {
  index = mod(target);
  slides.forEach((slide, k) => {
    const to = rel(k, index);
    // Un folleto que cruza de un lado al otro salta sin animar (ya está fuera de pantalla).
    const jumps = Math.abs(to - offsets[k]) > 1;
    if (jumps) slide.style.transition = "none";
    offsets[k] = to;
    place(slide, to);
    if (jumps) {
      slide.getBoundingClientRect();
      slide.style.transition = "";
    }
    slide.toggleAttribute("inert", to !== 0);
  });
  dots.forEach((d, i) => d.setAttribute("aria-current", String(i === index)));
}

prevBtn.addEventListener("click", () => go(index - 1));
nextBtn.addEventListener("click", () => go(index + 1));

addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") go(index - 1);
  if (e.key === "ArrowRight") go(index + 1);
});

// Arrastrar con el dedo o el mouse: el folleto sigue al puntero.
const DRAG_START = 6;
const DRAG_COMMIT = 50;
let startX = null;
let dragging = false;
let suppressClick = false;

carousel.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  startX = e.clientX;
  dragging = false;
});

addEventListener("pointermove", (e) => {
  if (startX === null) return;
  const dx = e.clientX - startX;
  if (!dragging && Math.abs(dx) > DRAG_START) {
    dragging = true;
    slides.forEach((s) => (s.style.transition = "none"));
  }
  if (dragging) slides.forEach((s, k) => place(s, offsets[k], dx));
});

function endDrag(e) {
  if (startX === null) return;
  const dx = e.clientX - startX;
  const wasDragging = dragging;
  startX = null;
  dragging = false;
  slides.forEach((s) => (s.style.transition = ""));
  if (!wasDragging) return;
  suppressClick = true; // evita que soltar encima de un botón lo active
  setTimeout(() => (suppressClick = false), 0);
  go(Math.abs(dx) > DRAG_COMMIT ? index + (dx < 0 ? 1 : -1) : index);
}
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);
carousel.addEventListener("click", (e) => {
  if (suppressClick) e.preventDefault();
}, true);

// Cuenta regresiva
const els = {
  days: document.getElementById("t-days"),
  hours: document.getElementById("t-hours"),
  mins: document.getElementById("t-mins"),
  secs: document.getElementById("t-secs"),
};
const link = document.getElementById("timer-link");
const pad = (v) => String(v).padStart(2, "0");
let timerId = null;

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
timerId = setInterval(tick, 1000);
go(0);
