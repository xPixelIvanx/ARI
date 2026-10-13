// Fecha de la propuesta: viernes 23 de octubre de 2026, 3:00 pm (hora local del dispositivo).
const PROPUESTA = new Date("2026-10-23T15:00:00");

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = document.getElementById("scene");
const ring = document.getElementById("ring");

// ---------- Anillo: los folletos + sus clones ----------
const originals = [...ring.children];
const CARDS = originals.length; // folletos reales
const COPIES = 2; // 3 reales + 3 clones = 6 posiciones en el círculo

for (let c = 1; c < COPIES; c++) {
  originals.forEach((orig) => {
    const clone = orig.cloneNode(true);
    clone.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id")); // sin ids repetidos
    ring.append(clone);
  });
}

const slots = [...ring.children];
const N = slots.length;
const STEP = 360 / N; // grados entre folletos
const mod = (i, m = N) => ((i % m) + m) % m;

slots.forEach((slot, i) => slot.setAttribute("aria-label", `${(i % CARDS) + 1} de ${CARDS}`));

// ---------- Geometría ----------
let radius = 0;

function measure() {
  const w = ring.offsetWidth; // ancho de layout (no lo afecta la perspectiva)
  // Radio para que N tarjetas de ancho w formen un polígono, con un pequeño espacio.
  radius = (w / 2 / Math.tan(Math.PI / N)) * 1.12;
  slots.forEach((slot, i) => {
    slot.style.transform = `rotateY(${i * STEP}deg) translateZ(${radius}px)`;
  });
  render();
}

// ---------- Estado y animación ----------
let pos = 0; // posición actual (en folletos, continua)
let target = 0; // hacia dónde gira
let active = -1;
let raf = 0;
let last = 0;

function render() {
  ring.style.transform = `translateZ(${-radius}px) rotateY(${-pos * STEP}deg)`;
  slots.forEach((slot, i) => {
    // Distancia (en folletos) al que está al frente: los de los lados se oscurecen.
    const d = Math.abs(mod(i - pos + N / 2, N) - N / 2);
    const k = Math.min(d, 1);
    slot.style.opacity = String(1 - 0.2 * k);
    slot.style.filter = k > 0.001 ? `brightness(${1 - 0.55 * k})` : "";
  });
}

function updateActive() {
  const front = mod(Math.round(target));
  if (front === active) return;
  active = front;
  slots.forEach((slot, i) => slot.toggleAttribute("inert", i !== front));
}

function frame(now) {
  const dt = Math.min(now - last, 50);
  last = now;
  const k = reduceMotion ? 1 : 1 - Math.exp(-dt / 95); // suavizado independiente de los fps
  pos += (target - pos) * k;
  if (Math.abs(target - pos) < 0.0005) {
    pos = target;
    raf = 0;
    render();
    return;
  }
  render();
  raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function go(delta) {
  target = Math.round(target) + delta;
  updateActive();
  kick();
}

addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") go(-1);
  if (e.key === "ArrowRight") go(1);
});

// ---------- Girar arrastrando (con inercia) ----------
const DRAG_START = 6;
const RAD = 180 / Math.PI;
let drag = null;
let suppressClick = false;

scene.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  drag = { x: e.clientX, startPos: pos, moved: false, samples: [{ t: performance.now(), x: e.clientX }] };
});

addEventListener("pointermove", (e) => {
  if (!drag) return;
  const dx = e.clientX - drag.x;
  if (!drag.moved && Math.abs(dx) > DRAG_START) drag.moved = true;
  if (!drag.moved) return;

  // En un cilindro, un desplazamiento dx equivale a dx / radio radianes.
  pos = target = drag.startPos - (dx / radius) * RAD / STEP;
  const now = performance.now();
  drag.samples.push({ t: now, x: e.clientX });
  while (drag.samples.length > 2 && now - drag.samples[0].t > 100) drag.samples.shift();
  render();
  updateActive();
});

function endDrag() {
  if (!drag) return;
  const { moved, samples } = drag;
  drag = null;
  if (!moved) return;

  suppressClick = true; // evita que soltar encima de un botón lo active
  setTimeout(() => (suppressClick = false), 0);

  // Inercia: se proyecta la velocidad del dedo y se acomoda al folleto más cercano.
  const a = samples[0];
  const b = samples[samples.length - 1];
  const stopped = performance.now() - b.t > 80; // si el dedo se detuvo antes de soltar, no hay empuje
  const v = !stopped && b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/ms
  const throwSlots = Math.max(-1.2, Math.min(1.2, -((v * 180) / radius) * RAD / STEP));
  target = Math.round(pos + throwSlots);
  updateActive();
  kick();
}
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", endDrag);
scene.addEventListener("click", (e) => {
  if (suppressClick) e.preventDefault();
}, true);

// ---------- Cuenta regresiva (en todas las copias) ----------
const pad = (v) => String(v).padStart(2, "0");
const setAll = (key, text) =>
  document.querySelectorAll(`[data-t="${key}"]`).forEach((el) => (el.textContent = text));
let timerId = null;

function tick() {
  const ms = PROPUESTA - Date.now();
  if (ms <= 0) {
    ["days", "hours", "mins", "secs"].forEach((k) => setAll(k, "00"));
    document.querySelectorAll('[data-t="link"]').forEach((el) => (el.hidden = false));
    clearInterval(timerId);
    return;
  }
  const total = Math.floor(ms / 1000);
  setAll("days", Math.floor(total / 86400));
  setAll("hours", pad(Math.floor((total % 86400) / 3600)));
  setAll("mins", pad(Math.floor((total % 3600) / 60)));
  setAll("secs", pad(total % 60));
}

tick();
timerId = setInterval(tick, 1000);

addEventListener("resize", measure);
document.fonts?.ready.then(measure);
measure();
updateActive();
