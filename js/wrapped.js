// "Tu año en Ari": un Wrapped en formato historias, con premios de broma, hecho con sus estadísticas (usuarios/{uid}).
// Se abre en año nuevo (fecha editable en el modo edición del carrusel > Ajustes); el admin puede verlo siempre
// y ver el de cualquier cuenta con ?uid=…

import { ACTION_NAMES, awards, derived, entries, fmtDate, fmtDuration, hourLabel, sectionName } from "./stats-lib.js";
import { getContent, loadContent, markRendered } from "./content.js";

const DEFAULTS = {
  outro: "Gracias por pasar tiempo aquí. Todo esto lo hice pensando en ti, y ver que lo disfrutas es mi premio favorito.",
  firma: "— Iván",
};
const CONTENT = await loadContent(DEFAULTS, "wrapped");

const app = document.getElementById("app");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SLIDE_MS = 7000;

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const append = (parent, ...kids) => (parent.append(...kids.flat().filter(Boolean)), parent);

/* ---------- Diapositivas ---------- */

// Cada una devuelve { hue, build() }: el color de fondo y el contenido.
function buildSlides(d, ctx) {
  const x = derived(d);
  const name = (d.nombre || "").split(" ")[0] || "tú";
  const slides = [];
  const slide = (hue, build) => slides.push({ hue, build });
  const num = (value, format = (n) => String(Math.round(n))) => {
    const el = h("strong", "wrp__big", format(0));
    el.dataset.to = value;
    el._format = format;
    return el;
  };

  slide(300, () => [
    h("p", "wrp__kicker", `Ari Wrapped ${ctx.year}`),
    h("h1", "wrp__title", `${name}, este fue tu año aquí`),
    h("p", "wrp__text", "Toca para ver cómo te fue. Spoiler: te fue increíble."),
  ]);

  slide(335, () => [
    h("p", "wrp__kicker", "Tiempo total"),
    h("p", "wrp__text", "En esta página pasaste"),
    num(x.total / 60, (n) => (n >= 120 ? `${Math.round(n / 60 * 10) / 10} h` : `${Math.round(n)} min`)),
    h("p", "wrp__text", x.total >= 180 ? `Eso son como ${Math.max(1, Math.round(x.total / 180))} canciones de 3 minutos. Y no te las sabes todas, ¿o sí?` : "Poquito, pero cada minuto contó."),
  ]);

  slide(270, () => [
    h("p", "wrp__kicker", "Visitas"),
    h("p", "wrp__text", "Entraste"),
    num(x.aperturas),
    h("p", "wrp__text", x.aperturas > 6 ? "veces. Dicen que quien vuelve tanto es porque algo le gusta." : x.aperturas > 1 ? "veces. Cada una cuenta." : "vez. Pero fue una muy buena."),
  ]);

  const fav = x.topApartados[0];
  if (fav) {
    slide(40, () => [
      h("p", "wrp__kicker", "Tu rincón favorito"),
      h("h2", "wrp__title", sectionName(fav[0])),
      h("p", "wrp__text", `Te quedaste ${fmtDuration(fav[1])} ahí.`),
      x.topApartados.length > 1
        ? append(
            h("ol", "wrp__rank"),
            x.topApartados.slice(0, 4).map(([k, v], i) => append(h("li"), h("span", null, `${i + 1}. ${sectionName(k)}`), h("b", null, fmtDuration(v))))
          )
        : null,
    ]);
  }

  if (x.horaFavorita != null) {
    const hr = x.horaFavorita;
    const when = hr >= 22 || hr < 5 ? ["🌙", "Eres de las que vienen de noche."] : hr < 12 ? ["☀️", "Eres de las que vienen con el café."] : hr < 19 ? ["🌤️", "Eres de las que vienen en la tarde."] : ["🌆", "Eres de las que vienen al atardecer."];
    slide(225, () => [
      h("p", "wrp__kicker", "Tu hora favorita"),
      h("div", "wrp__emoji", when[0]),
      h("h2", "wrp__title", hourLabel(hr)),
      h("p", "wrp__text", when[1]),
      x.mejorDia ? h("p", "wrp__text wrp__small", `Tu día récord fue el ${fmtDate(x.mejorDia.dia + "T12:00:00", { day: "numeric", month: "long" })}: ${fmtDuration(x.mejorDia.seg)}.`) : null,
    ]);
  }

  const a = x.acciones;
  const facts = [
    ["🎧", a.song_opened, "discos sacados"],
    ["🗝️", a.open_when, "tarjetas “abre cuando”"],
    ["📸", a.memory_viewed, "recuerdos en grande"],
    ["💌", a.letter_opened, "cartas abiertas"],
  ].filter(([, n]) => n);
  if (facts.length || a.final_surprise || a.secret_found) {
    slide(150, () => [
      h("p", "wrp__kicker", "Lo que tocaste"),
      facts.length ? append(h("ul", "wrp__facts"), facts.map(([e, n, t]) => append(h("li"), h("span", null, e), h("strong", null, String(n)), h("small", null, t)))) : null,
      a.final_surprise ? h("p", "wrp__text", `Y sí: presionaste el botón que decía “NO PRESIONES” (${a.final_surprise} ${a.final_surprise === 1 ? "vez" : "veces"}). Chismosa. 🕵️`) : null,
      a.secret_found ? h("p", "wrp__text", "Además encontraste el secreto escondido. ✦") : null,
    ]);
  }

  slide(45, () => [h("p", "wrp__kicker", "Y ahora…"), h("h2", "wrp__title", "Los premios"), h("div", "wrp__emoji", "🏆"), h("p", "wrp__text", "Todos son totalmente oficiales y no apelables.")]);
  awards(d).forEach((aw, i) =>
    slide((45 + i * 37) % 360, () => [
      h("p", "wrp__kicker", `Premio ${i + 1}`),
      h("div", "wrp__emoji wrp__emoji--trophy", aw.emoji),
      h("h2", "wrp__title", aw.title),
      h("p", "wrp__text", aw.sub),
      h("p", "wrp__chip", aw.detail),
    ])
  );

  slide(320, () => [
    h("p", "wrp__kicker", "Para cerrar"),
    h("h2", "wrp__title", `Gracias por estar, ${name}`),
    h("p", "wrp__text", CONTENT.outro),
    h("p", "wrp__sign", CONTENT.firma),
    Object.assign(h("a", "wrp__btn", "Volver al inicio"), { href: "index.html" }),
  ]);
  return slides;
}

/* ---------- Reproductor de historias ---------- */

function play(slides) {
  const story = h("div", "story");
  const bars = h("div", "story__bars");
  const fills = slides.map(() => {
    const f = h("i");
    bars.append(append(h("span"), f));
    return f;
  });
  const stage = h("div", "story__stage");
  const close = Object.assign(h("a", "story__close", "✕"), { href: "index.html", "aria-label": "Cerrar" });
  const hint = h("p", "story__hint", "Toca los lados para avanzar · mantén para pausar");
  append(story, bars, close, stage, hint);
  app.replaceChildren(story);

  let i = -1;
  let t0 = 0;
  let elapsed = 0;
  let paused = false;
  let raf = 0;

  function countUp(root) {
    root.querySelectorAll("[data-to]").forEach((el) => {
      const to = Number(el.dataset.to);
      if (reduceMotion) return (el.textContent = el._format(to));
      const start = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - start) / 1400);
        el.textContent = el._format(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function go(n) {
    if (n < 0) n = 0;
    if (n >= slides.length) return;
    i = n;
    elapsed = 0;
    t0 = performance.now();
    story.style.setProperty("--hue", slides[i].hue);
    const view = h("section", "slide");
    append(view, slides[i].build());
    stage.replaceChildren(view);
    countUp(view);
    fills.forEach((f, k) => (f.style.transform = `scaleX(${k < i ? 1 : 0})`));
    hint.hidden = i > 0;
  }

  function frame(now) {
    if (!paused && i < slides.length - 1) {
      elapsed += now - t0;
      fills[i].style.transform = `scaleX(${Math.min(1, elapsed / SLIDE_MS)})`;
      if (elapsed >= SLIDE_MS) go(i + 1);
    } else if (i === slides.length - 1) fills[i].style.transform = "scaleX(1)";
    t0 = now;
    raf = requestAnimationFrame(frame);
  }

  // Tocar a la izquierda: atrás; a la derecha: adelante; mantener: pausa.
  let holdTimer = 0;
  let held = false;
  stage.addEventListener("pointerdown", () => {
    held = false;
    holdTimer = setTimeout(() => ((held = true), (paused = true), story.classList.add("is-paused")), 220);
  });
  const release = (e) => {
    clearTimeout(holdTimer);
    if (!story.classList.contains("is-paused") && !held && e.type === "pointerup" && !e.target.closest("a")) {
      const r = stage.getBoundingClientRect();
      go(i + (e.clientX - r.left < r.width * 0.35 ? -1 : 1));
    }
    paused = false;
    story.classList.remove("is-paused");
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("contextmenu", (e) => e.preventDefault());
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " ") go(i + 1);
    if (e.key === "ArrowLeft") go(i - 1);
  });

  go(0);
  raf = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(raf);
}

/* ---------- Pantallas especiales ---------- */

function screen(kicker, title, text, extra) {
  const box = h("section", "wrp__screen");
  append(box, h("p", "wrp__kicker", kicker), h("h1", "wrp__title", title), h("p", "wrp__text", text), extra, Object.assign(h("a", "wrp__btn", "Volver"), { href: "index.html" }));
  app.replaceChildren(box);
  document.body.style.setProperty("--hue", 300);
}

export function renderWrapped(data, ctx) {
  play(buildSlides(data, ctx));
  document.body.classList.add("is-story");
}

/* ---------- Arranque ---------- */

const whenRole = () =>
  window.ARI?.rol ? Promise.resolve(window.ARI) : new Promise((resolve) => document.addEventListener("ari:role", (e) => resolve(e.detail), { once: true }));

async function boot() {
  const ari = await whenRole();
  const isAdmin = ari.rol === "admin";

  const index = await getContent("index");
  const opens = new Date(index.wrapped || "2027-01-01T00:00:00");
  const year = opens.getMonth() === 0 && opens.getDate() <= 7 ? opens.getFullYear() - 1 : opens.getFullYear();

  if (Date.now() < opens && !isAdmin) {
    const days = Math.ceil((opens - Date.now()) / 86400000);
    return screen("Tu año en Ari", "Todavía no…", `Se abre el ${fmtDate(opens, { day: "numeric", month: "long", year: "numeric" })} (faltan ${days} ${days === 1 ? "día" : "días"}). Mientras tanto, sigue visitando la página: cada minuto cuenta para los premios.`);
  }

  const { db, doc, getDoc } = ari.fb;
  const uid = (isAdmin && new URLSearchParams(location.search).get("uid")) || ari.user.uid;
  let data = {};
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    data = snap.exists() ? snap.data() : {};
  } catch {
    return screen("Tu año en Ari", "No se pudo cargar", "Revisa tu conexión e intenta de nuevo.");
  }
  if (!data.segundos && !data.aperturas) return screen("Tu año en Ari", "Aún no hay nada que mostrar", "Todavía no hay estadísticas de esta cuenta.");
  renderWrapped(data, { year, isAdmin });
  markRendered("wrapped");
}

boot();
