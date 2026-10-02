// Trivia de un solo intento que hay que pasar para ver la página.
// Estado en localStorage: jugando (se retoma al recargar), fallado (espera 24 h) o pasado.

import { QUESTIONS, ROUNDS, SETTINGS } from "./trivia-questions.js";

const KEY = "ari-trivia";
const HOUR = 3_600_000;
const TOTAL = QUESTIONS.length;
const PER = SETTINGS.perRound;

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null;
  } catch {
    return null;
  }
};
const write = (state) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
};

const norm = (s) =>
  String(s)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function isRight(q, v) {
  if (q.type === "text") return q.answer.some((a) => norm(a) === norm(v));
  if (q.type === "slider") return Math.abs(Number(v) - q.correct) <= (q.tolerance ?? 0);
  return v === q.correct;
}

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => String(n).padStart(2, "0");

function remaining(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const hh = Math.floor(m / 60);
  return hh ? `${hh} h ${m % 60} min` : `${m} min`;
}

// Imagen real o caja de placeholder si todavía no hay archivo.
function media(src, label, className) {
  if (src) {
    const img = h("img", className);
    img.src = src;
    img.alt = label || "";
    img.decoding = "async";
    return img;
  }
  const ph = h("div", `${className} is-placeholder`);
  ph.append(h("span", null, label || "IMAGEN"));
  return ph;
}

// Resuelve cuando ella pasa la trivia (o enseguida si ya la había pasado).
export async function runTrivia({ track = () => {} } = {}) {
  let state = read();
  if (state?.status === "passed") return;
  if (state?.status === "failed" && Date.now() >= state.until) state = null;

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
  document.addEventListener("keydown", (e) => onKey?.(e));
  const buzz = (ms = 10) => navigator.vibrate?.(ms);

  const swap = async () => {
    card.classList.add("is-out");
    await wait(260);
    card.replaceChildren();
    onKey = null;
    card.classList.remove("is-out", "is-locked");
  };

  /* ---------- Progreso ---------- */

  function renderTop(i) {
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
      h("span", "trivia__round", `Ronda ${r + 1} · ${ROUNDS[r]?.name ?? ""}`),
      h("span", "trivia__num", `${pad(Math.min(i + 1, TOTAL))}/${TOTAL}`),
      quit
    );
    top.replaceChildren(segs, meta);
  }

  /* ---------- Pantallas de resultado ---------- */

  const showFailed = () => {
    top.replaceChildren();
    const t = h("p", "trivia__count");
    const tick = () => (t.textContent = `Podrás intentarlo de nuevo en ${remaining(state.until - Date.now())}.`);
    tick();
    setInterval(tick, 30000);
    card.replaceChildren(
      h("p", "trivia__kicker", "Intento terminado"),
      h("h2", "trivia__title", SETTINGS.failTitle),
      h("p", "trivia__text", SETTINGS.failText),
      t
    );
  };

  const showPassed = (score) =>
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
        h("p", "trivia__kicker", `${score} de ${TOTAL}`),
        h("h2", "trivia__title", SETTINGS.passTitle),
        h("p", "trivia__text", SETTINGS.passText),
        btn
      );
      btn.focus();
    });

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
    return new Promise(() => {});
  }

  const conclude = async (score) => {
    const ok = (score / TOTAL) * 100 >= SETTINGS.passPercent;
    await swap();
    if (ok) {
      state = { status: "passed", score };
      write(state);
      track("trivia_passed", { score, total: TOTAL });
      return showPassed(score);
    }
    state = { status: "failed", until: Date.now() + SETTINGS.cooldownHours * HOUR, score };
    write(state);
    track("trivia_failed", { score, total: TOTAL });
    showFailed();
    return new Promise(() => {});
  };

  /* ---------- Una pregunta ---------- */

  const ask = (i, score) =>
    new Promise((resolve) => {
      const q = QUESTIONS[i];
      renderTop(i);
      card.append(h("p", "trivia__count", pad(i + 1)), h("h2", "trivia__question", q.q));
      if (q.image && q.type === "choice") card.append(media(q.image, "IMAGEN", "trivia__img"));

      let answered = false;
      // Se guarda el avance antes de seguir: recargar no permite volver a contestar.
      const answer = (value, picked) => {
        if (answered || over) return;
        answered = true;
        buzz();
        const next = score + (isRight(q, value) ? 1 : 0);
        write({ status: "playing", i: i + 1, score: next });
        card.classList.add("is-locked");
        picked?.classList.add("is-picked");
        card.querySelectorAll("button, input").forEach((n) => (n.disabled = true));
        resolve(next);
      };

      if (q.type === "choice") {
        const list = h("div", "trivia__options");
        q.options.forEach((label, idx) => {
          const b = h("button", "trivia__option");
          b.type = "button";
          b.append(h("kbd", null, String(idx + 1)), h("span", null, label));
          b.addEventListener("click", () => answer(idx, b));
          list.append(b);
        });
        card.append(list);
        onKey = (e) => {
          const b = list.children[Number(e.key) - 1];
          if (b) b.click();
        };
      } else if (q.type === "grid") {
        const list = h("div", "trivia__grid");
        q.images.forEach((im, idx) => {
          const b = h("button", "trivia__tile");
          b.type = "button";
          b.append(media(im.src, im.label, "trivia__tile-img"), h("kbd", null, String(idx + 1)));
          b.addEventListener("click", () => answer(idx, b));
          list.append(b);
        });
        card.append(list);
        onKey = (e) => {
          const b = list.children[Number(e.key) - 1];
          if (b) b.click();
        };
      } else if (q.type === "tf") {
        const list = h("div", "trivia__tf");
        [
          ["Verdad", true, "V"],
          ["Mentira", false, "M"],
        ].forEach(([label, val, key]) => {
          const b = h("button", "trivia__option trivia__option--tf");
          b.type = "button";
          b.append(h("kbd", null, key), h("span", null, label));
          b.addEventListener("click", () => answer(val, b));
          list.append(b);
        });
        card.append(list);
        onKey = (e) => {
          const k = e.key.toLowerCase();
          if (k === "v") list.children[0].click();
          if (k === "m" || k === "f") list.children[1].click();
        };
      } else if (q.type === "slider") {
        const mid = Math.round((q.min + q.max) / 2 / q.step) * q.step;
        const out = h("div", "trivia__big");
        const val = h("span", null, String(mid));
        out.append(val, h("small", null, q.unit));
        const range = h("input", "trivia__range");
        range.type = "range";
        range.min = q.min;
        range.max = q.max;
        range.step = q.step;
        range.value = mid;
        const paint = () => {
          val.textContent = Number(range.value).toLocaleString("es");
          range.style.setProperty("--p", `${((range.value - q.min) / (q.max - q.min)) * 100}%`);
        };
        range.addEventListener("input", paint);
        paint();
        const go = h("button", "trivia__btn", "Fijar respuesta");
        go.type = "button";
        go.addEventListener("click", () => answer(Number(range.value), go));
        card.append(out, range, go);
        onKey = (e) => e.key === "Enter" && go.click();
      } else {
        const input = h("input", "trivia__input");
        input.type = "text";
        input.autocomplete = "off";
        input.placeholder = "Escribe tu respuesta";
        const go = h("button", "trivia__btn", "Responder");
        go.type = "button";
        const submit = () => input.value.trim() && answer(input.value, go);
        go.addEventListener("click", submit);
        input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
        card.append(input, go);
        input.focus({ preventScroll: true });
      }
    });

  /* ---------- Cartel de ronda ---------- */

  async function roundCard(r) {
    await swap();
    top.replaceChildren();
    card.append(
      h("p", "trivia__count", `Ronda ${r + 1} de ${Math.ceil(TOTAL / PER)}`),
      h("h2", "trivia__title", ROUNDS[r]?.name ?? ""),
      h("p", "trivia__text", ROUNDS[r]?.blurb ?? "")
    );
    await wait(2200);
  }

  /* ---------- Inicio / reanudar ---------- */

  let i = 0;
  let score = 0;
  if (state?.status === "playing") ({ i, score } = state);

  if (i === 0) {
    await new Promise((resolve) => {
      const start = h("button", "trivia__btn", "Empezar");
      start.type = "button";
      start.addEventListener("click", () => {
        write({ status: "playing", i: 0, score: 0 });
        track("trivia_started");
        resolve();
      });
      card.append(
        h("p", "trivia__kicker", SETTINGS.kicker),
        h("h2", "trivia__title", SETTINGS.title),
        h("p", "trivia__text", SETTINGS.intro),
        h("p", "trivia__count", `${TOTAL} preguntas · un solo intento`),
        start
      );
      start.focus();
    });
  }

  for (; i < TOTAL; i++) {
    if (i % PER === 0) await roundCard(i / PER);
    if (over) return new Promise(() => {});
    await swap();
    if (over) return new Promise(() => {});
    score = await ask(i, score);
    await wait(420);
    if (over) return new Promise(() => {});
  }
  return conclude(score);
}
