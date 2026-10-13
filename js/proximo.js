import C from "./proximo-contenido.js";
import { createMusic } from "./proximo-musica.js";

const $ = (sel, root = document) => root.querySelector(sel);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const intro = $("#intro");
const garden = $("#garden");
const hold = $("#hold");
const holdProgress = $("#hold-progress");
const hint = $("#hint");
const enterBtn = $("#enter");
const page = $("#page");
const music = createMusic($("#music"));

const HOLD_MS = 1300; // cuánto hay que mantener presionado para que florezca
const DECAY_MS = 700; // qué tan rápido se encoge si sueltas antes
const RING = 2 * Math.PI * 36; // circunferencia del anillo del botón
const TOTAL = C.flores.length;

// ---------- Vibración ----------
// Solo funciona en celulares Android (Chrome/Firefox). iPhone/Safari no tiene esta función: ahí no pasa nada.
const canBuzz = "vibrate" in navigator;
const buzz = (pattern) => {
  if (canBuzz) navigator.vibrate(pattern);
};
// Pulsos suaves y seguidos mientras mantienes presionado (el mismo tiempo que tarda en florecer).
const growBuzz = () => {
  const pattern = [];
  for (let t = 0; t < HOLD_MS; t += 120) pattern.push(14, 106);
  buzz(pattern);
};

// ---------- Contenido (todo viene de proximo-contenido.js) ----------
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const photo = (src, alt = "") => {
  if (src) {
    const img = el("img");
    img.src = src;
    img.alt = alt;
    img.loading = "lazy";
    return img;
  }
  const ph = el("div", "ph");
  ph.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l1.5-2h7L17 8h3v11H4z" /><circle cx="12" cy="13.5" r="3.2" /></svg><span>Tu foto aquí</span>';
  return ph;
};

$("#intro-line").textContent = C.frase;
$("#hero-name").textContent = C.nombre;
$("#hero-sub").textContent = "Cinco flores, cinco razones y una pregunta.";
$("#nos-title").textContent = C.nosotros.titulo;
$("#nos-text").textContent = C.nosotros.texto;
$("#pro-title").textContent = C.promesas.titulo;
$("#pro-text").textContent = C.promesas.texto;
$("#ask-kicker").textContent = C.pregunta.kicker;
$("#ask-question").textContent = C.pregunta.texto;
$("#end-title").textContent = `${C.ramo.titulo}, ${C.nombre}`;
$("#end-text").textContent = C.ramo.texto;

C.nosotros.fotos.forEach((f, i) => {
  const frame = el("figure", "frame reveal");
  frame.append(photo(f.src, f.pie), el("figcaption", "frame__cap", f.pie));
  frame.style.setProperty("--d", `${(i % 2) * 90}ms`);
  $("#frames").append(frame);
});

C.promesas.lista.forEach((p, i) => {
  const li = el("li", "promise reveal");
  li.append(el("span", "promise__num", String(i + 1).padStart(2, "0")), el("h3", "promise__title", p.titulo), el("p", "promise__text", p.texto));
  $("#promises").append(li);
});

// ---------- El ramo ----------
const BASE = [150, 262];
const HEADS = [[42, 80], [96, 46], [150, 32], [204, 46], [258, 80]];
const ORDER = [2, 1, 3, 0, 4]; // florecen desde el centro hacia afuera

const petals = Array.from({ length: 10 }, (_, k) =>
  `<ellipse cx="0" cy="-15" rx="6.5" ry="14" fill="url(#petal)" transform="rotate(${k * 36})"/>`).join("");

garden.innerHTML = `
<svg viewBox="0 0 300 280" role="img" aria-hidden="true">
  <defs>
    <radialGradient id="petal" cx="50%" cy="30%" r="80%"><stop offset="0" stop-color="#FFE48A"/><stop offset="1" stop-color="#F2B705"/></radialGradient>
    <radialGradient id="core" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#C98A1B"/><stop offset="1" stop-color="#7A4A0C"/></radialGradient>
  </defs>
  ${HEADS.map(([x, y], i) => {
    const cx = (BASE[0] + x) / 2 + (x < BASE[0] ? -10 : x > BASE[0] ? 10 : 0);
    const cy = (BASE[1] + y) / 2 + 12;
    return `<g class="flower" data-i="${i}">
      <path class="stem" pathLength="1" d="M${BASE[0]} ${BASE[1]} Q${cx} ${cy} ${x} ${y}"/>
      <circle class="glint" cx="${x}" cy="${y}" r="2.8"/>
      <g class="head"><g class="head-in"><g class="petals">${petals}</g><circle r="8" fill="url(#core)"/></g></g>
    </g>`;
  }).join("")}
  <g class="ribbon">
    <path d="M150 252 C140 238 126 245 133 254 C139 261 148 256 150 252 Z"/>
    <path d="M150 252 C160 238 174 245 167 254 C161 261 152 256 150 252 Z"/>
    <path d="M149 254 L141 274 L148 268 L150 276 Z"/>
    <path d="M151 254 L159 274 L152 268 L150 276 Z"/>
    <circle cx="150" cy="252" r="3.8"/>
  </g>
</svg>`;

const flowers = [...garden.querySelectorAll(".flower")].map((node, i) => ({
  node,
  head: node.querySelector(".head"),
  stem: node.querySelector(".stem"),
  x: HEADS[i][0],
  y: HEADS[i][1],
}));

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function paintFlower(f, p) {
  f.stem.style.strokeDashoffset = String(1 - Math.min(1, p * 1.15));
  const s = p <= 0.001 ? 0 : easeOutBack(p);
  f.head.style.transform = `translate(${f.x}px, ${f.y}px) scale(${s})`;
  f.node.classList.toggle("is-started", p > 0.001);
  holdProgress.style.strokeDashoffset = String(RING * (1 - p));
}

flowers.forEach((f) => paintFlower(f, 0));
holdProgress.style.strokeDasharray = String(RING);
holdProgress.style.strokeDashoffset = String(RING);

const markNext = () => {
  flowers.forEach((f, i) => f.node.classList.toggle("is-next", current < TOTAL && i === ORDER[current]));
};

// ---------- Motivos ----------
const reason = $("#reason");
const introLine = $("#intro-line");

function showReason(n) {
  const r = C.flores[n];
  $("#reason-photo").replaceChildren(photo(r.foto, r.titulo));
  $("#reason-num").textContent = `${n + 1} de ${TOTAL}`;
  $("#reason-title").textContent = r.titulo;
  $("#reason-text").textContent = r.texto;
  reason.classList.remove("is-in");
  void reason.offsetWidth; // reinicia la animación
  reason.classList.add("is-in");
}

// ---------- Mantener presionado ----------
let current = 0; // cuántas flores han florecido
let holding = false;
let needRelease = false; // tras florecer hay que soltar antes de empezar otra
let finished = false;
let p = 0;
let last = 0;
let raf = 0;
let started = false;

function frame(now) {
  const dt = Math.min(now - last, 50);
  last = now;
  if (holding) p = Math.min(1, p + dt / HOLD_MS);
  else p = Math.max(0, p - dt / DECAY_MS);

  const f = flowers[ORDER[current]];
  if (f) paintFlower(f, p);
  intro.classList.toggle("is-holding", holding && p > 0);

  if (p >= 1 && holding) return bloom();
  if (p <= 0 && !holding) {
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(frame);
}

function startHold() {
  if (finished || needRelease || holding) return;
  holding = true;
  music.start();
  music.growStart(HOLD_MS);
  growBuzz();
  if (!started) {
    started = true;
    introLine.classList.remove("is-in");
  }
  reason.classList.remove("is-in");
  kick();
}

function endHold() {
  needRelease = false;
  if (!holding) return;
  holding = false;
  music.growStop();
  buzz(0); // cancela los pulsos si se suelta antes de tiempo
  kick();
}

function bloom() {
  const f = flowers[ORDER[current]];
  holding = false;
  music.growStop();
  music.bloom(current);
  buzz([40, 70, 40]);
  needRelease = true;
  raf = 0;
  p = 0;
  f.node.classList.add("is-bloomed");
  f.node.classList.remove("is-next");
  burst(f);
  showReason(current);
  current++;
  hint.textContent = current < TOTAL ? `Una flor más · ${current} de ${TOTAL}` : "";
  intro.classList.remove("is-holding");
  holdProgress.style.strokeDashoffset = String(RING);
  markNext();
  if (current >= TOTAL) finale();
}

function burst(f) {
  const box = garden.getBoundingClientRect();
  const svg = garden.querySelector("svg").getBoundingClientRect();
  const x = svg.left - box.left + (f.x / 300) * svg.width;
  const y = svg.top - box.top + (f.y / 280) * svg.height;
  for (let i = 0; i < 14; i++) {
    const s = el("span", "spark");
    const a = (Math.PI * 2 * i) / 14;
    const d = 34 + Math.random() * 28;
    s.style.left = `${x}px`;
    s.style.top = `${y}px`;
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
    s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    garden.append(s);
    s.addEventListener("animationend", () => s.remove());
    if (reduceMotion) s.remove();
  }
}

function finale() {
  finished = true;
  music.finale();
  buzz([80, 120, 80, 120, 80, 120, 300]);
  garden.classList.add("is-complete");
  setTimeout(() => {
    reason.classList.remove("is-in");
    intro.classList.add("is-finale");
    hold.hidden = true;
    hint.hidden = true;
    enterBtn.hidden = false;
    enterBtn.focus({ preventScroll: true });
  }, reduceMotion ? 300 : 3200);
}

hold.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "mouse" && e.button !== 0) return;
  startHold();
});
["pointerup", "pointercancel", "pointerleave"].forEach((ev) => hold.addEventListener(ev, endHold));
addEventListener("pointerup", endHold);
hold.addEventListener("contextmenu", (e) => e.preventDefault());
hold.addEventListener("keydown", (e) => {
  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
    e.preventDefault();
    startHold();
  }
});
hold.addEventListener("keyup", (e) => {
  if (e.key === " " || e.key === "Enter") endHold();
});

markNext();

// ---------- Entrar al contenido ----------
enterBtn.addEventListener("click", () => {
  music.start();
  intro.classList.add("is-out");
  page.inert = false;
  document.body.classList.remove("is-locked");
  scrollTo(0, 0);
  setTimeout(() => (intro.hidden = true), reduceMotion ? 0 : 1300);
  observe();
});

// Aparecer al hacer scroll
function observe() {
  const items = [...document.querySelectorAll(".reveal")];
  if (!("IntersectionObserver" in window) || reduceMotion) {
    items.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.18 },
  );
  items.forEach((n) => io.observe(n));
}

// ---------- La pregunta ----------
const yesBtn = $("#yes");
const noBtn = $("#no");
let noClicks = 0;

noBtn.addEventListener("click", () => {
  const texts = C.pregunta.noTextos;
  noClicks = Math.min(noClicks + 1, texts.length - 1);
  noBtn.textContent = texts[noClicks];
  yesBtn.style.transform = `scale(${1 + noClicks * 0.12})`; // el Sí crece con cada "No"
});

yesBtn.addEventListener("click", () => {
  $("#ask-kicker").hidden = true;
  $("#ask-question").hidden = true;
  $("#choices").hidden = true;
  $("#answer-big").textContent = C.respuesta.grande;
  $("#answer-text").textContent = C.respuesta.texto;
  $("#answer-extra").textContent = C.respuesta.extra;
  $("#sign").textContent = C.firma;
  $("#answer").hidden = false;
  $("#answer").scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  celebrate();
});

function celebrate() {
  if (reduceMotion) return;
  const symbols = ["🌼", "🌻", "❤️", "✨", "🌼"];
  for (let i = 0; i < 32; i++) {
    const h = el("span", "heart", symbols[i % symbols.length]);
    h.style.left = `${Math.random() * 100}vw`;
    h.style.animationDelay = `${Math.random() * 1.8}s`;
    h.style.fontSize = `${18 + Math.random() * 16}px`;
    document.body.append(h);
    h.addEventListener("animationend", () => h.remove());
  }
}
