// Secciones de la propuesta entre el inicio y la pregunta: línea de tiempo, entonces/hoy, lo que me enseñaste,
// planes y la carta al futuro (las promesas las pinta proximo.js).
// Todo el texto viene de proximo-contenido.js. En modo edición todo se ve quieto y abierto para poder editarlo.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function setupSections({ C, EDITING, reduceMotion, el, photo }) {
  const still = EDITING || reduceMotion; // sin animaciones largas: todo aparece completo
  const starters = []; // lo que arranca al entrar a la página (después del ramo)
  const scrollFns = [];

  const ed = (node, path) => {
    node.dataset.ed = path;
    return node;
  };

  // Cuando algo entra a la pantalla (una sola vez)
  const onView = (node, fn, threshold = 0.35) => {
    if (!("IntersectionObserver" in window)) return fn();
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          fn();
        }
      },
      { threshold },
    );
    io.observe(node);
  };

  // Chispas doradas en un punto de la pantalla
  const burst = (x, y, n = 14, spread = 56) => {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const s = el("span", "burst");
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const d = spread * (0.55 + Math.random() * 0.6);
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty("--dx", `${Math.cos(a) * d}px`);
      s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
      if (i % 3 === 0) s.classList.add("burst--rose");
      document.body.append(s);
      s.addEventListener("animationend", () => s.remove());
    }
  };
  const burstAt = (node, n, spread) => {
    const r = node.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, n, spread);
  };

  /* ---------- Línea de tiempo ---------- */
  const tl = $("#tl");
  const tlFill = el("span", "tl__fill");
  tlFill.setAttribute("aria-hidden", "true");
  tl.append(tlFill);
  C.historia.momentos.forEach((m, i) => {
    const base = `historia.momentos.${i}`;
    const li = el("li", "tl__item");
    li.dataset.edItem = "";
    li.style.setProperty("--i", i);
    const card = el("div", "tl__card glow-card");
    const pic = el("div", "tl__photo");
    pic.append(photo(m.foto, m.titulo, `${base}.foto`));
    // La foto viene borrosa; "Descubrir" la abre completa en grande (en modo edición se ve normal para poder cambiarla)
    if (m.foto && !EDITING) {
      pic.classList.add("is-veiled");
      const btn = el("button", "tl__reveal");
      btn.type = "button";
      btn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg><span>Descubrir</span>';
      btn.setAttribute("aria-label", `Ver la foto: ${m.titulo}`);
      btn.addEventListener("click", () => {
        const img = pic.querySelector("img");
        if (!img?.src) return;
        openPhoto(img, m, () => {
          pic.classList.replace("is-veiled", "is-open");
          btn.querySelector("span").textContent = "Ver";
        });
      });
      pic.append(btn);
    }
    card.append(
      pic,
      ed(el("p", "tl__date", m.fecha), `${base}.fecha`),
      ed(el("h3", "tl__title", m.titulo), `${base}.titulo`),
      ed(el("p", "tl__text", m.texto), `${base}.texto`),
    );
    li.append(el("span", "tl__dot"), card);
    tl.append(li);
  });
  const tlItems = $$(".tl__item", tl);
  // "Hasta ahora…": la línea sigue punteada hacia lo que falta
  const tlEnd = $("#tl-end");
  if (still) {
    tl.style.setProperty("--p", 1);
    tlItems.forEach((li) => li.classList.add("is-seen", "is-lit"));
    tlEnd.classList.add("is-lit");
  } else {
    scrollFns.push(() => {
      const r = tl.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) return;
      const mark = innerHeight * 0.62;
      tl.style.setProperty("--p", clamp((mark - r.top) / r.height).toFixed(4));
      tlItems.forEach((li) => {
        const lit = li.getBoundingClientRect().top + 18 < mark;
        if (lit && !li.classList.contains("is-seen")) li.classList.add("is-seen");
        li.classList.toggle("is-lit", lit);
      });
      tlEnd.classList.toggle("is-lit", tlEnd.getBoundingClientRect().top + 40 < mark);
    });
  }

  /* ---------- Antes y ahora ---------- */
  const then = $("#then");
  C.antes.pares.forEach((p, i) => {
    const base = `antes.pares.${i}`;
    const li = el("li", "then__item glow-card");
    li.dataset.edItem = "";
    li.style.setProperty("--i", i);
    li.append(
      ed(el("p", "then__a", p.entonces), `${base}.entonces`),
      ed(el("p", "then__b", p.hoy), `${base}.hoy`),
    );
    $("#then-list").append(li);
  });
  $("#then-a").textContent = C.antes.entonces;
  $("#then-b").textContent = C.antes.hoy;
  let thenTouched = false;
  const setThen = (state) => {
    if (then.dataset.state === state) return;
    then.dataset.state = state;
    $$(".then__opt", then).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.state === state)));
    then.classList.remove("is-swapping");
    void then.offsetWidth;
    then.classList.add("is-swapping");
  };
  then.dataset.state = "entonces";
  if (EDITING) then.classList.add("is-static");
  else {
    $$(".then__opt", then).forEach((b) =>
      b.addEventListener("click", () => {
        thenTouched = true;
        setThen(b.dataset.state);
      }),
    );
    // Si ella no lo toca, cambia sola a "Hoy" después de un momento
    starters.push(() => onView(then, () => setTimeout(() => !thenTouched && setThen("hoy"), 3800), 0.6));
  }

  /* ---------- Cosas que me enseñaste ---------- */
  C.ensenaste.lista.forEach((t, i) => {
    const li = el("li", "lesson");
    li.dataset.edItem = "";
    li.append(el("span", "lesson__n", String(i + 1).padStart(2, "0")), ed(el("p", "lesson__text", t), `ensenaste.lista.${i}`));
    $("#lessons").append(li);
  });
  const lessons = [...$$(".lesson"), $("#lessons-end")];
  if (still) lessons.forEach((l) => l.classList.add("is-lit"));
  else
    scrollFns.push(() => {
      const mark = innerHeight * 0.64;
      lessons.forEach((l) => {
        const r = l.getBoundingClientRect();
        l.classList.toggle("is-lit", r.top + r.height / 2 < mark);
      });
    });

  /* ---------- Planes contigo ---------- */
  const PLAN_KEY = "ari-planes";
  let donePlans = [];
  try {
    donePlans = JSON.parse(localStorage.getItem(PLAN_KEY)) || [];
  } catch {}
  const plansFill = $("#plans-fill");
  const plansCount = $("#plans-count");
  const planItems = [];
  const updatePlans = (celebrate) => {
    const done = planItems.filter((p) => p.classList.contains("is-done")).length;
    const total = planItems.length;
    plansFill.style.transform = `scaleX(${total ? done / total : 0})`;
    plansCount.textContent = done === total && total ? "Todos apartados. Ahora a cumplirlos ✨" : `${done} de ${total} apartados`;
    $("#plans-meter").classList.toggle("is-full", done === total && total > 0);
    if (celebrate && done === total) burstAt($("#plans-meter"), 26, 120);
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(planItems.filter((p) => p.classList.contains("is-done")).map((p) => p.dataset.key)));
    } catch {}
  };
  C.planes.lista.forEach((p, i) => {
    const base = `planes.lista.${i}`;
    const li = el("li", "plan glow-card reveal");
    li.dataset.edItem = "";
    li.dataset.key = p.titulo;
    li.style.setProperty("--d", `${(i % 2) * 90}ms`);
    const check = el("button", "plan__check");
    check.type = "button";
    check.setAttribute("aria-label", `Apartar: ${p.titulo}`);
    check.innerHTML =
      '<svg viewBox="0 0 32 32" aria-hidden="true"><circle class="plan__ring" cx="16" cy="16" r="13"/><path class="plan__tick" pathLength="1" d="M10 16.5l4.2 4.2L22.5 12"/></svg>';
    const body = el("div", "plan__body");
    body.append(ed(el("h3", "plan__title", p.titulo), `${base}.titulo`));
    if (p.texto) body.append(ed(el("p", "plan__text", p.texto), `${base}.texto`));
    li.append(check, body);
    if (donePlans.includes(p.titulo)) li.classList.add("is-done");
    check.setAttribute("aria-pressed", String(li.classList.contains("is-done")));
    const toggle = () => {
      const on = li.classList.toggle("is-done");
      check.setAttribute("aria-pressed", String(on));
      if (on) burstAt(check, 12, 44);
      updatePlans(on);
    };
    check.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });
    if (!EDITING) li.addEventListener("click", toggle);
    planItems.push(li);
    $("#plans").append(li);
  });
  updatePlans(false);

  /* ---------- Carta al futuro (se escribe sola) ---------- */
  const future = $("#future");
  const sign = $("#future-sign");
  sign.textContent = C.firma;
  const lines = C.futuro.carta.map((t, i) => {
    const p = ed(el("p", "future__line", t), `futuro.carta.${i}`);
    p.dataset.edItem = "";
    $("#future-lines").append(p);
    return { p, t };
  });
  // Si la carta es larga, la letra se ajusta para que sea cómoda de leer (ver css: is-long / is-xlong)
  const total = lines.reduce((n, l) => n + l.t.length, 0);
  future.classList.toggle("is-long", total > 480);
  future.classList.toggle("is-xlong", total > 1200);
  if (still) future.classList.add("is-done");
  else {
    // Cada renglón ya ocupa su lugar (texto invisible) para que nada salte mientras se escribe
    const caret = el("span", "caret");
    caret.setAttribute("aria-hidden", "true");
    lines.forEach((l) => {
      l.typed = el("span", "future__typed");
      l.rest = el("span", "future__rest", l.t);
      l.p.replaceChildren(l.typed, l.rest);
    });
    // Mientras más larga, más rápido se escribe (unos 20 s como mucho) y se puede tocar para verla completa
    const base = clamp(18000 / Math.max(total, 1), 6, 42);
    const step = Math.max(1, Math.round(total / 2600));
    const skipHint = el("p", "future__skip", "Toca para leerla completa");
    if (total > 300) future.insertBefore(skipHint, sign);
    let timer = 0;
    let skip = false;
    const finish = () => {
      clearTimeout(timer);
      lines.forEach((l) => {
        l.typed.textContent = l.t;
        l.rest.textContent = "";
      });
      caret.remove();
      skipHint.remove();
      future.classList.add("is-done");
    };
    const type = (li = 0, ci = 0) => {
      const l = lines[li];
      if (!l || skip) return finish();
      if (ci === 0) l.p.insertBefore(caret, l.rest);
      const upto = Math.min(l.t.length, ci + step);
      l.typed.textContent = l.t.slice(0, upto);
      l.rest.textContent = l.t.slice(upto);
      const ch = l.t[upto - 1];
      if (upto >= l.t.length) timer = setTimeout(() => type(li + 1, 0), clamp(base * 16, 250, 650));
      else timer = setTimeout(() => type(li, upto), /[.,;:!?…]/.test(ch) ? Math.min(260, base * 7) : base * (0.6 + Math.random() * 0.8));
    };
    future.addEventListener("click", () => {
      if (!future.classList.contains("is-done") && future.classList.contains("is-typing")) skip = true;
    });
    // Empieza cuando el primer renglón está a la vista (aunque la carta sea más alta que la pantalla)
    starters.push(() =>
      onView(lines[0]?.p || future, () => {
        future.classList.add("is-typing");
        timer = setTimeout(() => type(), 500);
      }, 0.6),
    );
  }

  /* ---------- Visor de fotos en grande (fondo borroso) ---------- */
  let box = null;
  function openPhoto(thumb, m, onOpen) {
    if (!box) {
      box = el("div", "lightbox");
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-modal", "true");
      box.hidden = true;
      box.innerHTML =
        '<button type="button" class="lightbox__close" aria-label="Cerrar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
        '<figure class="lightbox__fig"><img class="lightbox__img" alt="" /><figcaption class="lightbox__cap"><span class="lightbox__date"></span><span class="lightbox__title"></span></figcaption></figure>';
      document.body.append(box);
      box.addEventListener("click", (e) => {
        if (!e.target.closest(".lightbox__img")) box.close();
      });
      addEventListener("keydown", (e) => e.key === "Escape" && !box.hidden && box.close());
    }
    const img = $(".lightbox__img", box);
    img.src = thumb.currentSrc || thumb.src;
    img.alt = m.titulo;
    $(".lightbox__date", box).textContent = m.fecha;
    $(".lightbox__title", box).textContent = m.titulo;
    box.setAttribute("aria-label", m.titulo);
    const opener = document.activeElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.hidden = false;
    void box.offsetWidth;
    box.classList.add("is-open");
    $(".lightbox__close", box).focus({ preventScroll: true });

    // La foto sale desde donde estaba en la tarjeta y crece hasta su tamaño completo
    const fly = (reverse) => {
      if (reduceMotion || !img.animate) return null;
      const from = thumb.getBoundingClientRect();
      const to = img.getBoundingClientRect();
      if (!to.width || !from.width) return null;
      const s = Math.max(from.width / to.width, from.height / to.height);
      const dx = from.left + from.width / 2 - (to.left + to.width / 2);
      const dy = from.top + from.height / 2 - (to.top + to.height / 2);
      const frames = [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})`, filter: "blur(10px)", opacity: 0.6 },
        { transform: "none", filter: "blur(0)", opacity: 1 },
      ];
      return img.animate(reverse ? frames.reverse() : frames, { duration: reverse ? 420 : 620, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    };
    const start = () => {
      fly(false);
      burst(innerWidth / 2, innerHeight / 2, 18, 160);
      onOpen?.();
    };
    img.complete ? start() : img.addEventListener("load", start, { once: true });

    box.close = () => {
      box.classList.remove("is-open");
      const anim = fly(true);
      let closed = false;
      const done = () => {
        if (closed) return;
        closed = true;
        box.hidden = true;
        document.body.style.overflow = before;
        opener?.focus?.({ preventScroll: true });
      };
      if (anim) anim.onfinish = done;
      setTimeout(done, anim ? 480 : reduceMotion ? 0 : 300); // por si la animación no llega a terminar
    };
  }

  /* ---------- Toda la página ---------- */
  // Barra de progreso arriba
  const bar = $("#progress span");
  scrollFns.push(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(scrollY / max) : 0})`;
  });

  // El brillo de las tarjetas sigue al dedo / mouse
  addEventListener(
    "pointermove",
    (e) => {
      const card = e.target.closest?.(".glow-card");
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - r.left}px`);
      card.style.setProperty("--my", `${e.clientY - r.top}px`);
    },
    { passive: true },
  );

  // Numeración 01, 02… solo de las secciones que se ven (las ocultas desde el editor no cuentan)
  const numberSections = () => {
    let n = 0;
    $$("#page > section").forEach((s) => {
      const num = $(".section__num", s);
      if (!num || s.style.display === "none" || s.classList.contains("ed-hidden")) return;
      num.textContent = String(++n).padStart(2, "0");
    });
  };
  numberSections();
  document.addEventListener("ari:rendered", numberSections);

  let ticking = false;
  const runScroll = () => {
    ticking = false;
    scrollFns.forEach((f) => f());
  };
  const queue = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(runScroll);
    }
  };

  return {
    start() {
      addEventListener("scroll", queue, { passive: true });
      addEventListener("resize", queue);
      runScroll();
      starters.forEach((f) => f());
    },
  };
}
