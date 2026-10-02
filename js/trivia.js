// Trivia de un solo intento que hay que pasar para ver la página.
// Estado en localStorage: jugando (se retoma al recargar), fallado (espera 24 h) o pasado.

import { QUESTIONS, SETTINGS } from "./trivia-questions.js";

const KEY = "ari-trivia";
const HOUR = 3_600_000;

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

const isRight = (q, value) =>
  q.options ? value === q.correct : q.answer.some((a) => norm(a) === norm(value));

function h(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function remaining(ms) {
  const m = Math.max(1, Math.ceil(ms / 60000));
  const hh = Math.floor(m / 60);
  return hh ? `${hh} h ${m % 60} min` : `${m} min`;
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
  const card = h("div", "trivia__card");
  root.append(card);
  document.body.append(root);
  document.body.classList.add("is-locked");
  const intro = document.getElementById("intro");
  if (intro) intro.inert = true;

  const finish = async () => {
    root.classList.add("is-leaving");
    await wait(600);
    root.remove();
    if (intro) intro.inert = false;
  };

  const swap = async (build) => {
    card.classList.add("is-out");
    await wait(280);
    card.replaceChildren();
    build();
    card.classList.remove("is-out");
  };

  const showFailed = () => {
    const t = h("p", "trivia__count");
    const tick = () => (t.textContent = `Podrás intentarlo de nuevo en ${remaining(state.until - Date.now())}.`);
    tick();
    setInterval(tick, 30000);
    card.replaceChildren(h("p", "trivia__kicker", "Intento terminado"), h("h2", "trivia__title", SETTINGS.failTitle), h("p", "trivia__text", SETTINGS.failText), t);
  };

  const showPassed = (score) =>
    new Promise((resolve) => {
      const btn = h("button", "trivia__btn", "Abrir mi regalo");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        await finish();
        resolve();
      });
      card.replaceChildren(
        h("p", "trivia__kicker", `${score} de ${QUESTIONS.length}`),
        h("h2", "trivia__title", SETTINGS.passTitle),
        h("p", "trivia__text", SETTINGS.passText),
        btn
      );
      btn.focus();
    });

  // Ya falló y todavía no pasan las 24 h: se queda aquí para siempre.
  if (state?.status === "failed") {
    showFailed();
    return new Promise(() => {});
  }

  const conclude = async (score) => {
    const percent = (score / QUESTIONS.length) * 100;
    if (percent >= SETTINGS.passPercent) {
      state = { status: "passed", score };
      write(state);
      track("trivia_passed", { score, total: QUESTIONS.length });
      await swap(() => {});
      return showPassed(score);
    }
    state = { status: "failed", until: Date.now() + SETTINGS.cooldownHours * HOUR, score };
    write(state);
    track("trivia_failed", { score, total: QUESTIONS.length });
    await swap(() => {});
    showFailed();
    return new Promise(() => {});
  };

  const ask = (i, score) =>
    new Promise((resolve) => {
      const q = QUESTIONS[i];
      const bar = h("div", "trivia__bar");
      const fill = h("span");
      fill.style.width = `${(i / QUESTIONS.length) * 100}%`;
      bar.append(fill);
      card.append(
        bar,
        h("p", "trivia__count", `Pregunta ${i + 1} de ${QUESTIONS.length}`),
        h("h2", "trivia__question", q.q)
      );

      let answered = false;
      // Se guarda el avance antes de seguir: recargar no permite volver a contestar.
      const answer = (value) => {
        if (answered) return;
        answered = true;
        const next = score + (isRight(q, value) ? 1 : 0);
        write({ status: "playing", i: i + 1, score: next });
        card.querySelectorAll("button, input").forEach((n) => (n.disabled = true));
        resolve(next);
      };

      if (q.options) {
        const list = h("div", "trivia__options");
        q.options.forEach((text, idx) => {
          const b = h("button", "trivia__option", text);
          b.type = "button";
          b.addEventListener("click", () => {
            b.classList.add("is-picked");
            answer(idx);
          });
          list.append(b);
        });
        card.append(list);
      } else {
        const input = h("input", "trivia__input");
        input.type = "text";
        input.autocomplete = "off";
        input.placeholder = "Escribe tu respuesta";
        const go = h("button", "trivia__btn", "Responder");
        go.type = "button";
        const submit = () => input.value.trim() && answer(input.value);
        go.addEventListener("click", submit);
        input.addEventListener("keydown", (e) => e.key === "Enter" && submit());
        card.append(input, go);
        input.focus({ preventScroll: true });
      }
    });

  // Pantalla de inicio (o reanudar si recargó a la mitad).
  let i = 0;
  let score = 0;
  if (state?.status === "playing") ({ i, score } = state);

  await new Promise((resolve) => {
    if (i > 0) return resolve();
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
      h("p", "trivia__count", `${QUESTIONS.length} preguntas · un solo intento`),
      start
    );
    start.focus();
  });

  for (; i < QUESTIONS.length; i++) {
    await swap(() => {});
    score = await ask(i, score);
    await wait(350);
  }
  return conclude(score);
}
