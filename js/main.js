import BASE_CONFIG from "./config.js";
import { loadContent, resolveMedia } from "./content.js";
import Lenis from "./vendor/lenis.mjs";

// modo edición (temporal)
const editor = new URLSearchParams(location.search).has("editar") ? await import("./editor.js") : null;
const CONFIG = editor ? await editor.loadDraft(BASE_CONFIG) : await loadContent(BASE_CONFIG);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const lenis = reduceMotion ? null : new Lenis({ autoRaf: true, anchors: true, lerp: 0.085 });
lenis?.stop();

// Firebase se carga en segundo plano para no retrasar la página.
const firebase = import("./firebase.js").catch(() => null);
const track = (name, params) =>
  firebase.then((m) => m && m.track(name, params)).catch(() => {});

function setSrc(media, src) {
  resolveMedia(src).then((url) => {
    if (url) media.src = url;
  });
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/* ---------- Petals (canvas) ---------- */

const petals = (() => {
  const canvas = $("#petals");
  const ctx = canvas.getContext("2d");
  const colors = ["#F8D0DB", "#F2B3C4", "#FCE8EE", "#E38CA5"];
  const ambient = [];
  const bursts = [];
  let w = 0;
  let h = 0;
  let raf = 0;
  let last = 0;

  // En móvil la barra del navegador cambia innerHeight al hacer scroll;
  // solo redimensionar si cambia el ancho o crece el alto evita saltos.
  function resize() {
    const nw = window.innerWidth;
    const nh = window.innerHeight;
    if (nw === w && nh <= h) return;
    h = nw === w ? Math.max(h, nh) : nh;
    w = nw;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function makePetal() {
    return {
      x: Math.random() * w,
      y: -20 - Math.random() * h,
      s: 5 + Math.random() * 7,
      vx: -0.15 + Math.random() * 0.3,
      vy: 0.3 + Math.random() * 0.5,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.02,
      sway: Math.random() * Math.PI * 2,
      flip: Math.random() * Math.PI * 2,
      color: colors[(Math.random() * colors.length) | 0],
      alpha: 0.3 + Math.random() * 0.4,
    };
  }

  function draw(p, alpha) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, 0.35 + Math.abs(Math.cos(p.flip)) * 0.65);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -p.s);
    ctx.bezierCurveTo(p.s * 0.9, -p.s * 0.6, p.s * 0.7, p.s * 0.7, 0, p.s);
    ctx.bezierCurveTo(-p.s * 0.7, p.s * 0.7, -p.s * 0.9, -p.s * 0.6, 0, -p.s);
    ctx.fill();
    ctx.restore();
  }

  function frame(t) {
    // f = 1 a 60 fps; escala el movimiento para que sea igual a cualquier Hz.
    const f = last ? Math.min(t - last, 50) / (1000 / 60) : 1;
    last = t;
    const drag = Math.pow(0.985, f);
    ctx.clearRect(0, 0, w, h);

    for (const p of ambient) {
      p.sway += 0.012 * f;
      p.flip += 0.02 * f;
      p.x += (p.vx + Math.sin(p.sway) * 0.35) * f;
      p.y += p.vy * f;
      p.rot += p.vr * f;
      if (p.y > h + 20) Object.assign(p, makePetal(), { y: -20 });
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      draw(p, p.alpha);
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.vx *= drag;
      p.vy = p.vy * drag + 0.09 * f;
      p.x += p.vx * f;
      p.y += p.vy * f;
      p.rot += p.vr * f;
      p.flip += 0.08 * f;
      p.life -= f;
      if (p.life <= 0) {
        bursts.splice(i, 1);
        continue;
      }
      draw(p, p.alpha * Math.min(1, p.life / 40));
    }

    raf = ambient.length || bursts.length ? requestAnimationFrame(frame) : 0;
  }

  function start() {
    if (!raf && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function startAmbient() {
    if (reduceMotion || ambient.length) return;
    const count = w < 600 ? 12 : 20;
    for (let i = 0; i < count; i++) ambient.push(makePetal());
    start();
  }

  function burst(x, y, count = 40) {
    if (reduceMotion) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      const life = 90 + Math.random() * 60;
      bursts.push({
        ...makePetal(),
        x,
        y,
        s: 6 + Math.random() * 7,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        vr: (Math.random() - 0.5) * 0.2,
        alpha: 0.85,
        life,
      });
    }
    start();
  }

  resize();
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (ambient.length || bursts.length) {
      start();
    }
  });

  return { startAmbient, burst };
})();

/* ---------- Music ---------- */

const music = (() => {
  const btn = $("#music");
  const audio = new Audio();
  audio.loop = true;
  audio.preload = "none";
  resolveMedia(CONFIG.music.src).then((url) => {
    if (url) audio.src = url;
    else btn.hidden = true;
  });

  let unlocked = false;
  let wantPlay = false;
  let playing = false;
  let fadeRaf = 0;

  audio.addEventListener("error", () => {
    btn.hidden = true;
  });

  function setPlaying(value) {
    playing = value;
    btn.classList.toggle("is-playing", value);
    btn.setAttribute("aria-pressed", String(value));
    btn.setAttribute("aria-label", value ? "Pausar música" : "Reproducir música");
  }

  function fadeTo(target, duration) {
    cancelAnimationFrame(fadeRaf);
    const from = audio.volume;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / duration);
      audio.volume = from + (target - from) * k;
      if (k < 1) fadeRaf = requestAnimationFrame(step);
    };
    fadeRaf = requestAnimationFrame(step);
  }

  // iOS solo deja reproducir audio si play() se llama dentro de un gesto;
  // este "desbloqueo" silencioso permite arrancar la música más tarde.
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    audio.muted = true;
    audio
      .play()
      .then(() => {
        if (!wantPlay) {
          audio.pause();
          audio.currentTime = 0;
        }
        audio.muted = false;
      })
      .catch(() => {
        audio.muted = false;
      });
  }

  function play() {
    wantPlay = true;
    audio.muted = false;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        setPlaying(true);
        fadeTo(CONFIG.music.volume ?? 0.6, 2500);
      })
      .catch(() => setPlaying(false));
  }

  function pause() {
    wantPlay = false;
    audio.pause();
    setPlaying(false);
  }

  btn.addEventListener("click", () => (playing ? pause() : play()));

  return { unlock, play };
})();

/* ---------- Content ---------- */

function splitChars(node) {
  const text = node.textContent;
  node.setAttribute("aria-label", text);
  node.replaceChildren(
    ...[...text].map((ch, i) => {
      const outer = el("span", "char");
      outer.setAttribute("aria-hidden", "true");
      const inner = el("span", "char__inner", ch === " " ? " " : ch);
      inner.style.setProperty("--c", i);
      outer.append(inner);
      return outer;
    })
  );
}

function splitWords(node) {
  const text = node.textContent.trim();
  node.setAttribute("aria-label", text);
  node.classList.add("split");
  node.replaceChildren();
  text.split(/\s+/).forEach((word, i) => {
    if (i) node.append(" ");
    const outer = el("span", "word");
    outer.setAttribute("aria-hidden", "true");
    const inner = el("span", "word__inner", word);
    inner.style.setProperty("--w", i);
    outer.append(inner);
    node.append(outer);
  });
}

function renderContent() {
  $$("[data-her-name]").forEach((n) => (n.textContent = CONFIG.herName));
  $$("[data-from-name]").forEach((n) => (n.textContent = CONFIG.fromName));
  $$("[data-monogram]").forEach((n) => (n.textContent = CONFIG.monogram));
  $("#hero-subtitle").textContent = CONFIG.heroSubtitle;

  const lines = $("#intro-lines");
  CONFIG.introLines.forEach((text) => lines.append(el("p", "intro__line", text)));

  const { letter } = CONFIG;
  $("#letter-date").textContent = letter.date;
  const greeting = $("#letter-greeting");
  greeting.textContent = letter.greeting;
  greeting.style.setProperty("--i", 0);
  const body = $("#letter-body");
  letter.paragraphs.forEach((text, i) => {
    const p = el("p", null, text);
    p.style.setProperty("--i", i + 1);
    body.append(p);
  });
  const sign = $("#letter-sign");
  sign.textContent = letter.signature;
  sign.style.setProperty("--i", letter.paragraphs.length + 1);

  $("#final-title").textContent = CONFIG.final.title;
  $("#final-btn").textContent = CONFIG.final.button;
  const reveal = $("#final-reveal");
  CONFIG.final.lines.forEach((text, i) => {
    const line = el("span", "final__line", text);
    line.style.setProperty("--i", i);
    reveal.append(line);
  });

  splitChars($("#hero-title"));
  $$(".section__title").forEach(splitWords);
}

/* ---------- Intro ---------- */

function setupGate() {
  const gate = $("#gate");
  $("#gate-btn").addEventListener(
    "click",
    async () => {
      music.unlock();
      gate.classList.add("is-gone");
      track("intro_started");
      await wait(reduceMotion ? 100 : 1500);
      gate.remove();
      playIntro();
    },
    { once: true }
  );
}

async function playIntro() {
  const lines = $$(".intro__line");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isLast = i === lines.length - 1;
    line.classList.add("is-visible");
    // Tiempo de lectura: aparece (~1.6 s) + un tiempo según el largo de la frase.
    const readMs = isLast ? 2400 : 1600 + 2200 + line.textContent.length * 60;
    await wait(reduceMotion ? 2000 : readMs);
    if (!isLast) {
      line.classList.remove("is-visible");
      line.classList.add("is-gone");
      await wait(reduceMotion ? 200 : 1500);
    }
  }
  $("#intro").classList.add("show-seal");
}

function setupSeal() {
  const seal = $("#seal");
  const ring = $(".seal__progress");
  const circumference = 2 * Math.PI * 56;
  const HOLD_MS = 1500;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference;

  let progress = 0;
  let holding = false;
  let done = false;
  let raf = 0;
  let last = 0;

  const render = () => {
    ring.style.strokeDashoffset = circumference * (1 - progress);
    seal.style.setProperty("--p", progress);
  };

  const tick = (t) => {
    const dt = last ? t - last : 16;
    last = t;
    progress += holding ? dt / HOLD_MS : -dt / (HOLD_MS / 3);
    progress = Math.min(1, Math.max(0, progress));
    render();
    if (progress >= 1) {
      raf = 0;
      openGift();
      return;
    }
    if (holding || progress > 0) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = 0;
      last = 0;
    }
  };

  const loop = () => {
    if (!raf) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };

  const start = (e) => {
    if (done) return;
    e.preventDefault();
    holding = true;
    seal.classList.add("is-holding");
    music.unlock();
    navigator.vibrate?.(10);
    loop();
  };

  const stop = () => {
    if (done || !holding) return;
    holding = false;
    seal.classList.remove("is-holding");
    loop();
  };

  seal.addEventListener("pointerdown", start);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  seal.addEventListener("contextmenu", (e) => e.preventDefault());
  seal.addEventListener("keydown", (e) => {
    if ((e.key === " " || e.key === "Enter") && !e.repeat) start(e);
  });
  seal.addEventListener("keyup", (e) => {
    if (e.key === " " || e.key === "Enter") stop();
  });

  async function openGift() {
    done = true;
    holding = false;
    const intro = $("#intro");
    navigator.vibrate?.([20, 60, 30]);

    intro.classList.add("is-open");
    document.body.classList.remove("is-locked");
    document.body.classList.add("is-open");
    $("#site").inert = false;
    lenis?.start();

    music.play();
    petals.burst(window.innerWidth / 2, window.innerHeight / 2, 60);
    setTimeout(() => petals.startAmbient(), 1400);
    setTimeout(countUp, 1500);
    track("gift_opened");

    await wait(2100);
    intro.remove();
  }

  return openGift;
}

/* ---------- Counter ---------- */

function setupCounter() {
  const start = new Date(CONFIG.startDate).getTime();
  const days = $("#c-days");
  const hours = $("#c-hours");
  const mins = $("#c-mins");
  const secs = $("#c-secs");
  const pad = (n) => String(n).padStart(2, "0");

  // k va de 0 a 1 durante la animación de conteo inicial.
  let k = 0;

  const update = () => {
    let s = Math.max(0, Math.floor((Date.now() - start) / 1000));
    const d = Math.floor(s / 86400);
    s -= d * 86400;
    const h = Math.floor(s / 3600);
    s -= h * 3600;
    const m = Math.floor(s / 60);
    s -= m * 60;
    const e = 1 - Math.pow(1 - k, 4);
    days.textContent = Math.round(d * e).toLocaleString("es");
    hours.textContent = pad(Math.round(h * e));
    mins.textContent = pad(Math.round(m * e));
    secs.textContent = pad(Math.round(s * e));
  };

  update();
  setInterval(update, 1000);

  return function countUp() {
    if (reduceMotion) {
      k = 1;
      update();
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      k = Math.min(1, (t - t0) / 2600);
      update();
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
}

/* ---------- Letter ---------- */

function setupLetter() {
  const envelope = $("#envelope");
  const wrap = $("#envelope-wrap");
  const letter = $("#letter");

  const open = async () => {
    if (envelope.classList.contains("is-open")) return;
    envelope.classList.add("is-open");
    wrap.classList.add("is-opening");
    envelope.setAttribute("aria-disabled", "true");
    track("letter_opened");

    await wait(reduceMotion ? 200 : 2300);
    wrap.classList.add("is-leaving");
    await wait(reduceMotion ? 0 : 800);
    wrap.hidden = true;
    letter.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => letter.classList.add("is-visible")));
  };

  envelope.addEventListener("click", open);
  envelope.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  });
}

/* ---------- Gallery + lightbox ---------- */

function placeholder(i, className) {
  const ph = el("div", `${className} is-placeholder ph-${i % 4}`);
  ph.append(el("span", "ph-label", "Tu foto aquí"));
  return ph;
}

const lightbox = (() => {
  const root = $("#lightbox");
  const media = $("#lb-media");
  const caption = $("#lb-caption");
  const date = $("#lb-date");
  const items = CONFIG.memories;
  let index = 0;
  let lastFocus = null;
  let touchX = null;

  function show(i) {
    index = (i + items.length) % items.length;
    const m = items[index];
    media.replaceChildren();
    if (m.src) {
      const img = el("img");
      setSrc(img, m.src);
      img.alt = m.caption;
      img.decoding = "async";
      media.append(img);
    } else {
      const ph = placeholder(index, "lightbox__ph");
      ph.style.aspectRatio = m.ratio || "4/5";
      media.append(ph);
    }
    caption.textContent = m.caption;
    date.textContent = m.date;
    if (!reduceMotion) {
      media.animate(
        [
          { opacity: 0, transform: "scale(0.97)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }
      );
    }
  }

  function open(i) {
    lastFocus = document.activeElement;
    show(i);
    root.hidden = false;
    requestAnimationFrame(() => root.classList.add("is-open"));
    document.body.classList.add("no-scroll");
    lenis?.stop();
    $("#lb-close").focus({ preventScroll: true });
    track("memory_viewed", { index: i });
  }

  function close() {
    root.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
    lenis?.start();
    setTimeout(() => (root.hidden = true), 400);
    lastFocus?.focus({ preventScroll: true });
  }

  $("#lb-close").addEventListener("click", close);
  $("#lb-prev").addEventListener("click", () => show(index - 1));
  $("#lb-next").addEventListener("click", () => show(index + 1));
  root.addEventListener("click", (e) => {
    if (e.target === root) close();
  });
  document.addEventListener("keydown", (e) => {
    if (root.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(index - 1);
    if (e.key === "ArrowRight") show(index + 1);
  });
  root.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  root.addEventListener("touchend", (e) => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
    touchX = null;
  });

  return { open };
})();

function renderGallery() {
  const grid = $("#gallery");
  CONFIG.memories.forEach((m, i) => {
    const fig = el("figure", "memory reveal");
    fig.style.setProperty("--d", `${(i % 3) * 0.1}s`);

    let media;
    if (m.src) {
      media = el("button", "memory__media");
      const img = el("img");
      setSrc(img, m.src);
      img.alt = m.caption;
      img.loading = "lazy";
      img.decoding = "async";
      media.append(img);
    } else {
      media = el("button");
      media.className = `memory__media is-placeholder ph-${i % 4}`;
      media.append(el("span", "ph-label", "Tu foto aquí"));
    }
    media.type = "button";
    media.style.aspectRatio = m.ratio || "4/5";
    media.setAttribute("aria-label", `Ver recuerdo: ${m.caption}`);
    media.addEventListener("click", () => lightbox.open(i));

    const cap = el("figcaption");
    cap.append(el("span", "memory__caption", m.caption), el("span", "memory__date", m.date));
    fig.append(media, cap);
    grid.append(fig);
  });
}

/* ---------- Songs ---------- */

function coverArt(song, i, className) {
  if (song.cover) {
    const img = el("img", className);
    setSrc(img, song.cover);
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }
  const ph = el("span", `${className} is-placeholder ph-${i % 4}`);
  ph.append(el("span", "ph-label", "♪"));
  return ph;
}

function renderSongs() {
  const wrap = $("#songs");
  (CONFIG.songs || []).forEach((s, i) => {
    const item = el("article", "song reveal");

    const deck = el("button", "song__deck");
    deck.type = "button";
    deck.setAttribute("aria-expanded", "false");
    deck.setAttribute("aria-label", `Sacar el disco: ${s.title}`);
    const vinyl = el("span", "song__vinyl");
    const disc = el("span", "song__disc");
    const label = el("span", "song__label");
    label.append(coverArt(s, i, "song__label-art"));
    disc.append(label);
    vinyl.append(disc);
    const sleeve = el("span", "song__sleeve");
    sleeve.append(coverArt(s, i, "song__sleeve-art"));
    deck.append(vinyl, sleeve);

    const text = el("div", "song__text");
    text.append(
      el("p", "song__title", s.title),
      el("p", "song__artist", s.artist),
      el("p", "song__hint", "Toca el disco"),
      el("blockquote", "song__quote", s.quote)
    );

    let opened = false;
    deck.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      deck.setAttribute("aria-expanded", String(open));
      if (open && !opened) {
        opened = true;
        track("song_opened", { song: s.title });
      }
    });

    item.append(deck, text);
    wrap.append(item);
  });
}

/* ---------- Open-when cards ---------- */

function renderCards() {
  const wrap = $("#cards");
  CONFIG.openWhen.forEach((c, i) => {
    const card = el("button", "card reveal");
    card.type = "button";
    card.style.setProperty("--d", `${(i % 4) * 0.08}s`);
    card.setAttribute("aria-expanded", "false");

    const inner = el("span", "card__inner");
    const front = el("span", "card__face card__face--front");
    front.append(el("span", "card__eyebrow", "Abre cuando…"), el("span", "card__title", c.title));
    const foot = el("span", "card__foot", "Toca para abrir");
    foot.append(el("span", "card__dot"));
    front.append(foot);

    const back = el("span", "card__face card__face--back");
    back.append(el("span", "card__msg", c.message));

    inner.append(front, back);
    card.append(inner);

    let opened = false;
    card.addEventListener("click", () => {
      const flipped = card.classList.toggle("is-flipped");
      card.setAttribute("aria-expanded", String(flipped));
      if (flipped && !opened) {
        opened = true;
        track("open_when", { card: c.title });
      }
    });
    wrap.append(card);
  });
}

/* ---------- Surprises ---------- */

function showToast(text, ms = 5000) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), ms);
}

function setupSurprises() {
  const finalSection = $("#final");
  $("#final-btn").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    petals.burst(r.left + r.width / 2, r.top + r.height / 2, 80);
    navigator.vibrate?.([20, 40, 20]);
    finalSection.classList.add("is-revealed");
    track("final_surprise");
  });

  $("#secret").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    petals.burst(r.left + r.width / 2, r.top, 30);
    showToast(CONFIG.secret, 7000);
    track("secret_found");
  });

  let taps = 0;
  let tapTimer = 0;
  $("#hero-title").addEventListener("click", (e) => {
    taps++;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => (taps = 0), 800);
    if (taps >= 3) {
      taps = 0;
      petals.burst(e.clientX, e.clientY, 40);
    }
  });
}

/* ---------- Scroll reveal ---------- */

function setupReveal() {
  const items = $$(".reveal");
  if (!("IntersectionObserver" in window)) {
    items.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
  );
  items.forEach((n) => io.observe(n));
}

// El contenido del inicio sube más lento que el scroll y se desvanece.
function setupParallax() {
  if (reduceMotion) return;
  const inner = $("#hero-inner");
  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    const y = Math.min(window.scrollY, vh);
    const k = y / vh;
    inner.style.transform = `translate3d(0, ${(y * 0.35).toFixed(2)}px, 0)`;
    inner.style.opacity = String(Math.max(0, 1 - k * 1.25).toFixed(3));
  };
  window.addEventListener(
    "scroll",
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
}

/* ---------- Init ---------- */

if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

renderContent();
renderGallery();
renderSongs();
renderCards();
const countUp = setupCounter();
setupLetter();
setupSurprises();
setupReveal();
setupParallax();
const openGift = setupSeal();
setupGate();
editor?.mount({ openGift, lenis }); // modo edición (temporal)
