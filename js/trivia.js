// Trivia de un solo intento que hay que pasar para ver la página.
// Cada intento mezcla las preguntas (la final siempre va al último).
// Estado en localStorage: jugando (se retoma al recargar con el mismo orden), fallado (espera 24 h) o pasado.

import { QUESTIONS, ROUNDS, SETTINGS } from "./trivia-questions.js";

const KEY = "ari-trivia-v3";
const IMG_KEY = "ari-trivia-img";
const HOUR = 3_600_000;
const TOTAL = QUESTIONS.length;
const PER = SETTINGS.perRound;
const REGULAR = QUESTIONS.filter((q) => !q.final).length;
const BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));
const FINAL = QUESTIONS.find((q) => q.final);
const STRIKES = SETTINGS.strikes;
const GAP = 8; // separación entre filas al ordenar (igual que en el CSS)

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
};

// Subir el número de la clave reinicia el progreso de todos; las claves anteriores se limpian.
try {
  ["ari-trivia", "ari-trivia-v2"].forEach((k) => localStorage.removeItem(k));
} catch {}

const read = () => store.get(KEY);
const write = (state) => store.set(KEY, state);

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");
const hang = () => new Promise(() => {});

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const initials = (label = "") =>
  label
    .split(/\s+/)
    .filter((w) => /[a-z0-9]/i.test(w[0] || ""))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

/* ---------- Imágenes (Wikipedia y URLs directas) ---------- */

const WIKI = "https://en.wikipedia.org/api/rest_v1/page/summary/";
const imgCache = store.get(IMG_KEY) || {};
const lookups = new Map();

function wikiImage(title) {
  if (title in imgCache) return Promise.resolve(imgCache[title]);
  if (!lookups.has(title)) {
    lookups.set(
      title,
      fetch(WIKI + encodeURIComponent(title.replace(/ /g, "_")))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const url = d?.thumbnail?.source || d?.originalimage?.source || "";
          imgCache[title] = url;
          store.set(IMG_KEY, imgCache);
          return url;
        })
        .catch(() => "")
    );
  }
  return lookups.get(title);
}

const srcOf = (o) => (o.img ? Promise.resolve(o.img) : o.wiki ? wikiImage(o.wiki) : Promise.resolve(""));

function warm(url) {
  if (!url) return;
  const im = new Image();
  im.referrerPolicy = "no-referrer";
  im.src = url;
}

function prefetch(q) {
  if (!q) return;
  for (const o of [...(q.options || []), ...(q.items || [])]) {
    srcOf(o).then(warm);
    o.imgs?.forEach(warm);
  }
  q.preload?.forEach(warm);
}

// Caja de imagen: muestra iniciales mientras carga (o si la imagen no existe) y aparece con un fundido.
function media(o, aspect = "square") {
  const box = h("span", `t-media is-${aspect}`);
  if (o.svg) {
    box.classList.add("is-svg");
    box.innerHTML = o.svg;
    return box;
  }
  if (o.icon) {
    box.classList.add("is-icon");
    if (o.bg) box.style.background = o.bg;
    box.append(h("span", "t-media__icon", o.icon));
    return box;
  }
  if (o.contain) box.classList.add("is-contain");
  box.append(h("span", "t-media__fallback", initials(o.label)));
  srcOf(o).then((src) => {
    if (!src) return;
    const img = new Image();
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.onload = () => box.classList.add("is-loaded");
    img.src = src;
    box.append(img);
  });
  return box;
}

function logo(url, label) {
  const img = h("img", "t-logo");
  img.alt = "";
  img.referrerPolicy = "no-referrer";
  img.onerror = () => img.replaceWith(h("span", "t-logo is-empty", initials(label)));
  img.src = url;
  return img;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const POSITIONS = [
  { id: "S", name: "Profundo", x: 50, y: 10, def: true },
  { id: "CB", name: "Esquinero", x: 12, y: 24, def: true },
  { id: "LB", name: "Apoyador", x: 50, y: 24, def: true },
  { id: "DL", name: "Línea defensiva", x: 50, y: 37, def: true, wide: true },
  { id: "WR", name: "Receptor abierto", x: 12, y: 55 },
  { id: "OL", name: "Línea ofensiva", x: 50, y: 55, wide: true },
  { id: "TE", name: "Ala cerrada", x: 86, y: 55 },
  { id: "QB", name: "Mariscal de campo", x: 50, y: 71 },
  { id: "RB", name: "Corredor", x: 50, y: 87 },
];

// Resuelve cuando ella pasa la trivia (o enseguida si ya la había pasado).
export async function runTrivia({ track = () => {} } = {}) {
  let state = read();
  if (state?.status === "passed") return;
  if (state?.status === "failed" && Date.now() >= state.until) state = null;
  if (state?.status === "playing" && !validOrder(state.order)) state = null;

  const root = h("div", "trivia");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", SETTINGS.title);
  const top = h("div", "trivia__top");
  const card = h("div", "trivia__card");
  root.append(top, card);
  document.body.append(root);
  document.body.classList.add("is-locked");
  const intro = document.getElementById("intro");
  if (intro) intro.inert = true;

  let onKey = null;
  document.addEventListener("keydown", (e) => {
    if (e.target.matches?.('input[type="text"]') || root.querySelector(".trivia__modal")) return;
    onKey?.(e);
  });
  const buzz = (ms = 10) => navigator.vibrate?.(ms);

  const swap = async () => {
    card.classList.add("is-out");
    await wait(260);
    card.replaceChildren();
    onKey = null;
    card.classList.remove("is-out", "is-locked", "is-final");
  };

  /* ---------- Progreso ---------- */

  function renderTop(i, q) {
    const rounds = Math.ceil(TOTAL / PER);
    const segs = h("div", "trivia__segs");
    for (let r = 0; r < rounds; r++) {
      const seg = h("span", "trivia__seg");
      const fill = h("i");
      fill.style.width = `${Math.min(1, Math.max(0, (i - r * PER) / PER)) * 100}%`;
      seg.append(fill);
      segs.append(seg);
    }
    const r = Math.min(rounds - 1, Math.floor(i / PER));
    const meta = h("div", "trivia__meta");
    const quit = h("button", "trivia__quit", "Abandonar");
    quit.type = "button";
    quit.addEventListener("click", confirmQuit);
    meta.append(
      h("span", "trivia__round", q.final ? "Final" : `Ronda ${r + 1} · ${ROUNDS[r]?.name ?? ""}`),
      h("span", "trivia__num", `${pad(i + 1)}/${TOTAL}`),
      quit
    );
    top.replaceChildren(segs, meta);
  }

  /* ---------- Pantallas de resultado ---------- */

  // Cuenta atrás en vivo hasta que se cumplan las 24 h; al llegar a cero se puede reintentar.
  const showFailed = () => {
    top.replaceChildren();
    const unit = (label) => {
      const num = h("span", "trivia__cd-num", "00");
      const box = h("div", "trivia__cd-unit");
      box.append(num, h("span", "trivia__cd-label", label));
      return [box, num];
    };
    const [hBox, hNum] = unit("horas");
    const [mBox, mNum] = unit("min");
    const [sBox, sNum] = unit("seg");
    const clock = h("div", "trivia__cd");
    clock.setAttribute("role", "timer");
    clock.append(hBox, h("span", "trivia__cd-sep", ":"), mBox, h("span", "trivia__cd-sep", ":"), sBox);
    const note = h("p", "trivia__count", "Para volver a intentarlo");
    const again = h("button", "trivia__btn", "Intentar de nuevo");
    again.type = "button";
    again.hidden = true;
    again.addEventListener("click", () => location.reload());

    const timer = setInterval(tick, 1000);
    function tick() {
      const left = Math.max(0, state.until - Date.now());
      const sec = Math.ceil(left / 1000);
      hNum.textContent = pad(Math.floor(sec / 3600));
      mNum.textContent = pad(Math.floor((sec % 3600) / 60));
      sNum.textContent = pad(sec % 60);
      if (!left) {
        clearInterval(timer);
        note.textContent = "Ya puedes intentarlo de nuevo";
        again.hidden = false;
        again.focus();
      }
    }
    tick();

    card.replaceChildren(
      h("p", "trivia__kicker", state.quit ? "Abandonaste" : state.strikes >= STRIKES ? `${STRIKES} strikes` : "Intento terminado"),
      h("h2", "trivia__title", SETTINGS.failTitle),
      h("p", "trivia__text", SETTINGS.failText),
      note,
      clock,
      again
    );
  };

  const showPassed = (score, strikes) =>
    new Promise((resolve) => {
      top.replaceChildren();
      const btn = h("button", "trivia__btn", "Abrir mi página");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        root.classList.add("is-leaving");
        await wait(600);
        root.remove();
        if (intro) intro.inert = false;
        resolve();
      });
      card.replaceChildren(
        h("p", "trivia__kicker", `${score} de ${REGULAR} · ${strikes} ${strikes === 1 ? "strike" : "strikes"}`),
        h("h2", "trivia__title", SETTINGS.trapTitle),
        h("p", "trivia__text", SETTINGS.trapText),
        btn
      );
      btn.focus();
    });

  function burst() {
    const layer = h("div", "t-burst");
    const colors = ["#e38ca5", "#f6f1f3", "#cf6a8a", "#f2b3c4", "#ffc20e"];
    for (let k = 0; k < 48; k++) {
      const s = h("span");
      const a = Math.random() * Math.PI * 2;
      const d = 120 + Math.random() * 240;
      s.style.setProperty("--x", `${Math.cos(a) * d}px`);
      s.style.setProperty("--y", `${Math.sin(a) * d - 80}px`);
      s.style.setProperty("--r", `${(Math.random() - 0.5) * 900}deg`);
      s.style.background = colors[k % colors.length];
      s.style.animationDelay = `${Math.random() * 120}ms`;
      layer.append(s);
    }
    root.append(layer);
    setTimeout(() => layer.remove(), 2000);
  }

  // Abandonar cuenta como intento: corre las 24 h igual que si hubiera fallado.
  let over = false;

  async function quit() {
    if (over) return;
    over = true;
    onKey = null;
    root.querySelector(".trivia__modal")?.remove();
    state = { status: "failed", until: Date.now() + SETTINGS.cooldownHours * HOUR, score: 0, quit: true };
    write(state);
    track("trivia_abandoned");
    await swap();
    showFailed();
  }

  function confirmQuit() {
    if (over || root.querySelector(".trivia__modal")) return;
    const modal = h("div", "trivia__modal");
    const box = h("div", "trivia__modal-box");
    const cancel = h("button", "trivia__btn trivia__btn--ghost", "Seguir jugando");
    const ok = h("button", "trivia__btn", "Abandonar");
    cancel.type = ok.type = "button";
    cancel.addEventListener("click", () => modal.remove());
    ok.addEventListener("click", quit);
    box.append(
      h("h3", "trivia__modal-title", "¿Seguro que abandonas?"),
      h("p", "trivia__text", `Cuenta como intento y no podrás volver a intentarlo en ${SETTINGS.cooldownHours} horas.`),
      ok,
      cancel
    );
    modal.append(box);
    root.append(modal);
    cancel.focus();
  }

  // Ya falló y todavía no pasan las 24 h: se queda aquí.
  if (state?.status === "failed") {
    showFailed();
    return hang();
  }

  async function conclude() {
    const { score, finalOk } = state;
    const strikes = state.strikes || 0;
    const ok = finalOk && strikes < STRIKES;
    await swap();
    if (ok) {
      state = { status: "passed", score, strikes, finalOk: true };
      write(state);
      track("trivia_passed", { score, total: REGULAR, strikes });
      burst();
      return showPassed(score, strikes);
    }
    state = { status: "failed", until: Date.now() + SETTINGS.cooldownHours * HOUR, score, strikes };
    write(state);
    track("trivia_failed", { score, total: REGULAR, strikes });
    showFailed();
    return hang();
  }

  /* ---------- Tipos de pregunta ---------- */

  function fill(b, o, layout, q, k) {
    const text = () => {
      const t = h("span", "t-opt__text");
      t.append(h("span", "t-opt__label", o.label));
      if (o.sub) t.append(h("span", "t-opt__sub", o.sub));
      return t;
    };
    switch (layout) {
      case "grid":
        b.append(media(o, q.aspect || "square"), text());
        break;
      case "vinyl": {
        const stage = h("span", "t-vinyl__stage");
        stage.append(h("span", "t-vinyl__disc"), media(o, "square"));
        b.append(stage, text());
        break;
      }
      case "duo":
        b.append(media(o, q.aspect || "portrait"), h("span", "t-duo__label", o.label));
        break;
      case "signs":
        b.append(h("span", "t-sign", o.icon), h("span", "t-opt__label", o.label));
        return;
      case "swatch": {
        const dot = h("span", "t-dot");
        dot.style.background = o.swatch;
        b.append(dot, h("span", "t-opt__label", o.label));
        return;
      }
      case "chips":
        b.append(h("span", "t-opt__label", o.label));
        return;
      case "matchup": {
        const vs = h("span", "t-vs");
        const [a, z] = o.label.split(" vs ");
        vs.append(logo(o.imgs[0], a), h("span", "t-vs__x", "vs"), logo(o.imgs[1], z));
        b.append(vs, text());
        break;
      }
      case "playlist":
        b.append(media(o, "square"), text());
        break;
      default:
        b.append(text());
    }
    if (k < 9) b.append(h("kbd", null, String(k + 1)));
  }

  function buildPick(q, answer) {
    const multi = q.type === "multi";
    const opts = q.shuffle === false ? q.options : shuffle(q.options);
    const layout = q.layout || "list";
    const wrap = h("div", `t-opts t-${layout}${q.compact ? " is-compact" : ""}`);
    const chosen = new Set();
    const go = multi ? h("button", "trivia__btn", "Elige al menos una") : null;
    const buttons = opts.map((o, k) => {
      const b = h("button", `t-opt t-opt--${layout}`);
      b.type = "button";
      b.style.setProperty("--k", k);
      fill(b, o, layout, q, k);
      if (multi) {
        b.setAttribute("aria-pressed", "false");
        if (layout !== "chips") b.append(h("span", "t-check"));
      }
      b.addEventListener("click", () => {
        if (!multi) return answer(!!o.correct, b, reveal());
        buzz(6);
        if (chosen.has(o)) chosen.delete(o);
        else chosen.add(o);
        b.classList.toggle("is-on", chosen.has(o));
        b.setAttribute("aria-pressed", String(chosen.has(o)));
        go.disabled = !chosen.size;
        go.textContent = chosen.size ? `Listo (${chosen.size})` : "Elige al menos una";
      });
      wrap.append(b);
      return b;
    });
    card.append(wrap);
    const reveal = () => ({
      text: opts.filter((o) => o.correct).map((o) => o.label).join(" y "),
      els: buttons.filter((_, k) => opts[k].correct),
    });
    if (multi) {
      go.type = "button";
      go.disabled = true;
      go.addEventListener("click", () => {
        const ok = opts.every((o) => chosen.has(o) === !!o.correct);
        answer(ok, buttons.filter((_, k) => chosen.has(opts[k])), reveal());
      });
      card.append(go);
    }
    onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= Math.min(9, buttons.length)) buttons[n - 1].click();
      if (multi && e.key === "Enter" && !go.disabled) go.click();
    };
  }

  function buildOrder(q, answer) {
    let items = shuffle(q.items);
    while (items.every((it, k) => it === q.items[k])) items = shuffle(q.items);
    const list = h("ol", "t-order");
    const itemOf = new WeakMap();

    // Anima las filas que cambian de lugar desde donde estaban.
    const flip = (nodes, mutate) => {
      const before = new Map(nodes.map((n) => [n, n.getBoundingClientRect().top]));
      mutate();
      for (const n of nodes) {
        const dy = before.get(n) - n.getBoundingClientRect().top;
        if (!dy || n.classList.contains("is-drag")) continue;
        n.style.transition = "none";
        n.style.transform = `translateY(${dy}px)`;
        void n.offsetWidth;
        n.style.transition = "";
        n.style.transform = "";
      }
    };

    const renumber = () => {
      [...list.children].forEach((row, k, all) => {
        row.querySelector(".t-row__pos").textContent = k + 1;
        row.querySelector(".is-up").disabled = k === 0;
        row.querySelector(".is-down").disabled = k === all.length - 1;
      });
    };

    const move = (row, dir) => {
      const sib = dir < 0 ? row.previousElementSibling : row.nextElementSibling;
      if (!sib) return;
      flip([...list.children], () => (dir < 0 ? list.insertBefore(row, sib) : list.insertBefore(sib, row)));
      renumber();
      buzz(6);
    };

    items.forEach((it, k) => {
      const row = h("li", "t-row");
      row.style.setProperty("--k", k);
      const up = h("button", "t-row__btn is-up", "↑");
      const down = h("button", "t-row__btn is-down", "↓");
      up.type = down.type = "button";
      up.setAttribute("aria-label", `Subir ${it.label}`);
      down.setAttribute("aria-label", `Bajar ${it.label}`);
      up.addEventListener("click", () => move(row, -1));
      down.addEventListener("click", () => move(row, 1));
      row.append(h("span", "t-row__grip", "⠿"), h("span", "t-row__pos"), logo(it.img, it.label), h("span", "t-row__label", it.label), up, down);
      itemOf.set(row, it);
      list.append(row);
    });
    renumber();

    let drag = null;
    list.addEventListener("pointerdown", (e) => {
      const row = e.target.closest(".t-row");
      if (!row || e.target.closest("button") || card.classList.contains("is-locked")) return;
      e.preventDefault();
      row.setPointerCapture(e.pointerId);
      drag = { row, y: e.clientY, id: e.pointerId };
      row.classList.add("is-drag");
      buzz(6);
    });
    list.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { row } = drag;
      let dy = e.clientY - drag.y;
      const prev = row.previousElementSibling;
      const next = row.nextElementSibling;
      if (next && dy > (next.offsetHeight + GAP) / 2) {
        flip([next], () => list.insertBefore(next, row));
        drag.y += next.offsetHeight + GAP;
        renumber();
        buzz(4);
      } else if (prev && dy < -(prev.offsetHeight + GAP) / 2) {
        flip([prev], () => list.insertBefore(row, prev));
        drag.y -= prev.offsetHeight + GAP;
        renumber();
        buzz(4);
      }
      dy = e.clientY - drag.y;
      row.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      const { row } = drag;
      drag = null;
      row.classList.remove("is-drag");
      row.style.transform = "";
    };
    list.addEventListener("pointerup", end);
    list.addEventListener("pointercancel", end);

    const go = h("button", "trivia__btn", "Fijar orden");
    go.type = "button";
    go.addEventListener("click", () => {
      const now = [...list.children].map((row) => itemOf.get(row));
      answer(now.every((it, k) => it === q.items[k]), go, { text: q.items.map((it) => it.label).join(" › ") });
    });
    card.append(h("p", "t-order__end", `↑ ${q.top}`), list, h("p", "t-order__end", `↓ ${q.bottom}`), go);
    onKey = (e) => e.key === "Enter" && go.click();
  }

  function buildDate(q, answer) {
    let month = -1;
    let day = 0;
    const months = h("div", "t-months");
    const monthBtns = MONTHS.map((m, k) => {
      const b = h("button", "t-month", m.slice(0, 3));
      b.type = "button";
      b.addEventListener("click", () => pickMonth(k));
      months.append(b);
      return b;
    });
    const title = h("p", "t-cal__title");
    const grid = h("div", "t-cal__grid");
    const cal = h("div", "t-cal");
    cal.append(title, grid);
    const out = h("p", "t-cal__out");
    const go = h("button", "trivia__btn", "Fijar fecha");
    go.type = "button";
    go.disabled = true;
    const [cm, cd] = q.correct.split("-").map(Number);
    go.addEventListener("click", () =>
      answer(`${pad(month + 1)}-${pad(day)}` === q.correct, go, { text: `${cd} de ${MONTHS[cm - 1]}` })
    );

    const update = () => {
      out.textContent = day ? `${day} de ${MONTHS[month]}` : "Ahora elige el día";
      go.disabled = !day;
    };

    function pickMonth(k, silent) {
      if (k === month) return;
      month = k;
      day = 0;
      if (!silent) buzz(6);
      monthBtns.forEach((b, j) => b.classList.toggle("is-on", j === k));
      const b = monthBtns[k];
      months.scrollTo({ left: b.offsetLeft - months.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
      title.textContent = MONTHS[k];
      const cells = ["L", "M", "M", "J", "V", "S", "D"].map((d) => h("span", "t-cal__dow", d));
      const lead = (new Date(q.year, k, 1).getDay() + 6) % 7;
      for (let j = 0; j < lead; j++) cells.push(h("span"));
      const days = new Date(q.year, k + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const cell = h("button", "t-cal__day", String(d));
        cell.type = "button";
        cell.style.setProperty("--k", d);
        cell.addEventListener("click", () => {
          day = d;
          buzz(6);
          grid.querySelectorAll(".t-cal__day").forEach((x) => x.classList.toggle("is-on", x === cell));
          update();
        });
        cells.push(cell);
      }
      grid.replaceChildren(...cells);
      grid.classList.remove("is-anim");
      void grid.offsetWidth;
      grid.classList.add("is-anim");
      update();
    }

    card.append(months, cal, out, go);
    // Empieza en un mes al azar que no sea el correcto.
    const right = Number(q.correct.slice(0, 2)) - 1;
    let start;
    do start = (Math.random() * 12) | 0;
    while (start === right);
    requestAnimationFrame(() => pickMonth(start, true));
    onKey = (e) => e.key === "Enter" && !go.disabled && go.click();
  }

  function buildSlider(q, answer) {
    const steps = Math.round((q.max - q.min) / q.step);
    let start;
    do start = q.min + Math.round(Math.random() * steps) * q.step;
    while (Math.abs(start - q.correct) <= q.tolerance && steps > 3);

    const art = h("div", "t-art");
    const big = h("div", "trivia__big");
    const val = h("span");
    const sub = h("small");
    big.append(val, sub);
    const range = h("input", "trivia__range");
    range.type = "range";
    range.min = q.min;
    range.max = q.max;
    range.step = q.step;
    range.value = start;

    let imgs = null;
    let last = null;
    const paint = () => {
      const v = Number(range.value);
      val.textContent = q.label ? q.label(v) : String(v);
      sub.textContent = q.sub ? q.sub(v) : "";
      range.style.setProperty("--p", `${((v - q.min) / (q.max - q.min)) * 100}%`);
      if (v === last) return;
      if (q.art) {
        const a = q.art(v);
        if (a.svg) art.innerHTML = a.svg;
        if (a.imgs) {
          imgs ??= a.imgs.map(() => {
            const im = h("img", "t-art__img");
            im.alt = "";
            im.referrerPolicy = "no-referrer";
            im.onload = () => im.classList.add("is-ok");
            im.onerror = () => im.classList.remove("is-ok");
            art.append(im);
            return im;
          });
          a.imgs.forEach((src, k) => (imgs[k].src = src));
        }
      }
      if (last !== null) {
        buzz(4);
        big.classList.remove("is-bump");
        void big.offsetWidth;
        big.classList.add("is-bump");
      }
      last = v;
    };
    range.addEventListener("input", paint);
    paint();
    q.preload?.forEach(warm);

    const go = h("button", "trivia__btn", "Fijar respuesta");
    go.type = "button";
    const right = [q.label ? q.label(q.correct) : String(q.correct), q.sub?.(q.correct)].filter(Boolean).join(" ");
    go.addEventListener("click", () => answer(Math.abs(Number(range.value) - q.correct) <= q.tolerance, go, { text: right }));
    if (q.art) card.append(art);
    card.append(big, range, go);
    onKey = (e) => e.key === "Enter" && go.click();
  }

  function buildField(q, answer) {
    const field = h("div", "t-field");
    field.append(h("span", "t-field__los"));
    const out = h("p", "t-field__out", "Toca una posición");
    const go = h("button", "trivia__btn", "Fijar posición");
    go.type = "button";
    go.disabled = true;
    let sel = null;
    POSITIONS.forEach((p, k) => {
      const b = h("button", `t-pos${p.def ? " is-def" : ""}${p.wide ? " is-wide" : ""}`, p.id);
      b.type = "button";
      b.style.left = `${p.x}%`;
      b.style.top = `${p.y}%`;
      b.style.setProperty("--k", k);
      b.setAttribute("aria-label", `${p.name} (${p.id})`);
      b.addEventListener("click", () => {
        sel = { p, b };
        buzz(6);
        field.querySelectorAll(".t-pos").forEach((x) => x.classList.toggle("is-on", x === b));
        out.textContent = `${p.name} (${p.id})`;
        go.disabled = false;
      });
      field.append(b);
    });
    go.addEventListener("click", () => {
      const p = POSITIONS.find((x) => x.id === q.correct);
      const el = [...field.querySelectorAll(".t-pos")].find((x) => x.textContent === q.correct);
      answer(sel.p.id === q.correct, [go, sel.b], { text: `${p.name} (${p.id})`, els: [el] });
    });
    card.append(field, out, go);
    onKey = (e) => e.key === "Enter" && !go.disabled && go.click();
  }

  function buildText(q, answer) {
    const input = h("input", "trivia__input");
    input.type = "text";
    input.autocomplete = "off";
    input.setAttribute("autocapitalize", "words");
    input.placeholder = q.placeholder || "Escribe tu respuesta";
    const go = h("button", "trivia__btn", "Responder");
    go.type = "button";
    const submit = () => {
      const v = input.value.trim();
      if (v) answer(q.accept(norm(v)), go, { text: q.reveal });
    };
    go.addEventListener("click", submit);
    input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
    card.append(input, go);
    setTimeout(() => input.focus({ preventScroll: true }), 350);
  }

  const BUILD = {
    pick: buildPick,
    multi: buildPick,
    order: buildOrder,
    date: buildDate,
    slider: buildSlider,
    field: buildField,
    text: buildText,
  };

  /* ---------- Una pregunta ---------- */

  function strikesEl(n) {
    const box = h("span", "t-strikes");
    box.setAttribute("aria-label", `${n} de ${STRIKES} strikes`);
    for (let k = 0; k < STRIKES; k++) box.append(h("i", k < n ? "is-on" : null, "✕"));
    return box;
  }

  // Después de contestar se revela la respuesta correcta y se espera a "Siguiente".
  const ask = (q, i, commit) =>
    new Promise((resolve) => {
      renderTop(i, q);
      if (q.final) card.classList.add("is-final");
      const head = h("div", "t-qhead");
      const strikes = strikesEl(state.strikes || 0);
      head.append(h("p", "trivia__count", q.final ? SETTINGS.finalKicker : pad(i + 1)), strikes);
      card.append(head, h("h2", "trivia__question", q.q));
      if (q.hint) card.append(h("p", "t-hint", q.hint));

      let answered = false;
      // Se guarda el avance antes de mostrar nada: recargar no permite volver a contestar.
      const answer = (correct, picked, reveal = {}) => {
        if (answered || over) return;
        answered = true;
        const { strikes: used } = commit(correct);
        const out = !correct && (used >= STRIKES || q.final);
        card.classList.add("is-locked");
        [].concat(picked).forEach((n) => n?.classList.add("is-picked", correct || reveal.els?.includes(n) ? "is-right" : "is-wrong"));
        if (!correct) reveal.els?.forEach((n) => n?.classList.add("is-correct"));
        card.querySelectorAll("button, input").forEach((n) => (n.disabled = true));
        strikes.replaceWith(strikesEl(used));
        buzz(correct ? 14 : [30, 60, 30]);

        if (correct && q.final) return resolve();

        const fb = h("div", `t-feedback ${correct ? "is-right" : "is-wrong"}`);
        fb.append(
          h("span", "t-feedback__icon", correct ? "✓" : "✕"),
          h("p", "t-feedback__title", correct ? "Correcto" : out ? (q.final ? "Fallaste la final" : `Strike ${used}. Estás fuera.`) : `Strike ${used} de ${STRIKES}`)
        );
        if (!correct && reveal.text) {
          const ans = h("p", "t-feedback__answer", "La respuesta era: ");
          ans.append(h("strong", null, reveal.text));
          fb.append(ans);
        }
        const next = h("button", "trivia__btn", out ? "Ver resultado" : "Siguiente");
        next.type = "button";
        next.addEventListener("click", () => resolve(), { once: true });
        fb.append(next);
        card.append(fb);
        requestAnimationFrame(() => fb.scrollIntoView({ block: "nearest", behavior: "smooth" }));
        onKey = (e) => e.key === "Enter" && next.click();
        next.focus({ preventScroll: true });
      };
      BUILD[q.type](q, answer);
    });

  /* ---------- Carteles ---------- */

  async function stage(kicker, title, text, ms) {
    await swap();
    top.replaceChildren();
    card.append(h("p", "trivia__count", kicker), h("h2", "trivia__title", title), h("p", "trivia__text", text));
    await wait(ms);
  }

  /* ---------- Inicio / reanudar ---------- */

  if (state?.status !== "playing") {
    await new Promise((resolve) => {
      const start = h("button", "trivia__btn", "Empezar");
      start.type = "button";
      start.addEventListener("click", resolve, { once: true });
      card.append(
        h("p", "trivia__kicker", SETTINGS.kicker),
        h("h2", "trivia__title", SETTINGS.title),
        h("p", "trivia__text", SETTINGS.intro),
        h("p", "trivia__count", `${TOTAL} preguntas · ${STRIKES} strikes · un solo intento`),
        start
      );
      start.focus();
    });
    const regular = QUESTIONS.filter((q) => !q.final).map((q) => q.id);
    state = { status: "playing", order: [...shuffle(regular), FINAL.id], i: 0, score: 0, strikes: 0 };
    write(state);
    track("trivia_started");
  }

  // Si recargó justo después de su quinto strike (o de fallar la final), va directo al resultado.
  if ((state.strikes || 0) >= STRIKES || state.finalOk === false) return conclude();

  for (let i = state.i; i < TOTAL; i++) {
    const q = BY_ID.get(state.order[i]);
    prefetch(q);
    prefetch(BY_ID.get(state.order[i + 1]));
    if (q.final) {
      await stage(SETTINGS.finalKicker, SETTINGS.finalTitle, SETTINGS.finalText, 2800);
    } else if (i % PER === 0) {
      const r = i / PER;
      await stage(`Ronda ${r + 1} de ${ROUNDS.length}`, ROUNDS[r]?.name ?? "", ROUNDS[r]?.blurb ?? "", 2200);
    }
    if (over) return hang();
    await swap();
    if (over) return hang();
    prefetch(BY_ID.get(state.order[i + 2]));
    await ask(q, i, (ok) => {
      state = {
        ...state,
        i: i + 1,
        score: state.score + (ok && !q.final ? 1 : 0),
        strikes: (state.strikes || 0) + (ok ? 0 : 1),
        finalOk: q.final ? ok : state.finalOk,
      };
      write(state);
      return state;
    });
    if (over) return hang();
    if (state.strikes >= STRIKES || (q.final && !state.finalOk)) break;
  }
  return conclude();
}

function validOrder(order) {
  return (
    Array.isArray(order) &&
    order.length === TOTAL &&
    new Set(order).size === TOTAL &&
    order.every((id) => BY_ID.has(id)) &&
    order[TOTAL - 1] === FINAL.id
  );
}
