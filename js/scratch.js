// "Rasca aquí": una capa dorada tapa la pregunta final. Hay que rascarla con el dedo (o el mouse):
// el pincel es chico y cada pasada quita muy poco, pero basta con descubrir poco más de la mitad para que se lea.
// Entonces la capa se rompe en destellos, el recuadro brilla y aparecen los botones de Sí y No.

const BRUSH = 16; // grosor del pincel en px: chico a propósito
const POWER = 0.1; // cuánto quita cada "sello" del pincel (se sella cada 5 px): hacen falta ~4 pasadas por zona
const OPEN_BELOW = 110; // un píxel cuenta como descubierto si su capa ya tiene menos de esta opacidad (0-255)
const GOAL = 0.5; // fracción del recuadro que debe quedar descubierta (con eso la pregunta ya se lee completa)

const HINTS = [
  [0, "Rasca aquí"],
  [0.06, "Sigue…"],
  [0.2, "Ya se asoma algo…"],
  [0.33, "Casi…"],
  [0.43, "Un poquito más…"],
];

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

export function setupScratch({ box, canvas, hint, choices, skip, instant = false, onReveal }) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let w = 0;
  let h = 0;
  let dpr = 1;
  let done = false;
  let drawing = false;
  let last = null;
  let lastCheck = 0;
  let progress = 0;

  /* ---------- Partículas: virutas doradas al rascar y destellos al descubrir ---------- */

  const fx = document.createElement("canvas");
  fx.className = "scratch__fx";
  fx.setAttribute("aria-hidden", "true");
  box.append(fx);
  const fctx = fx.getContext("2d");
  let flecks = [];
  let fxRaf = 0;

  function spawn(x, y, n, { speed = 1, up = 0.6, size = 2.2, life = 1 } = {}) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.4 + Math.random() * 1.4) * speed;
      flecks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - up * speed,
        r: size * (0.5 + Math.random()),
        age: 0,
        life: (28 + Math.random() * 26) * life,
        tone: Math.random() < 0.3 ? "255,255,255" : Math.random() < 0.5 ? "243,223,166" : "233,196,106",
        bar: Math.random() < 0.5,
      });
    }
    if (!fxRaf) fxRaf = requestAnimationFrame(stepFx);
  }

  function stepFx() {
    fctx.clearRect(0, 0, w, h);
    flecks = flecks.filter((p) => p.age < p.life);
    for (const p of flecks) {
      p.age++;
      p.vy += 0.12; // gravedad suave
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      const k = 1 - p.age / p.life;
      fctx.fillStyle = `rgba(${p.tone},${(k * 0.95).toFixed(3)})`;
      if (p.bar) fctx.fillRect(p.x, p.y, p.r * 1.6, p.r * 0.8);
      else {
        fctx.beginPath();
        fctx.arc(p.x, p.y, p.r * k + 0.3, 0, Math.PI * 2);
        fctx.fill();
      }
    }
    fxRaf = flecks.length ? requestAnimationFrame(stepFx) : 0;
    if (!fxRaf) fctx.clearRect(0, 0, w, h);
  }

  /* ---------- Final ---------- */

  function setHint(text) {
    if (hint.textContent === text) return;
    hint.classList.remove("swap");
    void hint.offsetWidth; // reinicia la animación del cambio de texto
    hint.textContent = text;
    hint.classList.add("swap");
  }

  function reveal(now = false) {
    if (done) return;
    done = true;
    drawing = false;
    ro.disconnect();
    skip.hidden = true;
    box.classList.remove("is-scratching");
    if (now) {
      canvas.remove();
      fx.remove();
      hint.hidden = true;
      choices.classList.remove("is-waiting");
      onReveal?.();
      return;
    }
    // La capa se desvanece con un destello, el recuadro brilla y los botones suben uno tras otro.
    canvas.classList.add("is-gone");
    box.classList.add("is-revealed");
    hint.classList.add("is-out");
    spawn(w / 2, h / 2, 70, { speed: 3.2, up: 1.4, size: 2.8, life: 1.5 });
    setTimeout(() => {
      hint.hidden = true;
      choices.classList.remove("is-waiting");
    }, 650);
    setTimeout(() => {
      canvas.remove();
      if (!flecks.length) fx.remove();
    }, 1300);
    onReveal?.();
  }

  /* ---------- La capa ---------- */

  function paint() {
    const r = box.getBoundingClientRect();
    w = Math.round(r.width);
    h = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [canvas, fx]) {
      c.width = w * dpr;
      c.height = h * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // Papel dorado, con destellos y granito.
    const g = ctx.createLinearGradient(0, 0, w, h);
    [[0, "#7d6a3c"], [0.22, "#d2b86e"], [0.5, "#f3dfa6"], [0.78, "#bfa45e"], [1, "#6f5d33"]].forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < Math.min(2200, (w * h) / 90); i++) {
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.22)" : "rgba(60,44,12,0.2)";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.6, 1 + Math.random() * 1.6);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 8;
    for (let x = -h; x < w + h; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + h, 0);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(58, 42, 12, 0.9)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `italic 500 ${Math.min(34, w / 9)}px "Cormorant Garamond", Georgia, serif`;
    ctx.fillText("Rasca aquí", w / 2, h / 2 - 8);
    ctx.font = `600 ${Math.min(12, w / 26)}px "Manrope", system-ui, sans-serif`;
    ctx.fillStyle = "rgba(58, 42, 12, 0.65)";
    ctx.fillText("CON EL DEDO  ✦  SIN PRISA", w / 2, h / 2 + 24);
    progress = 0;
    setHint(HINTS[0][1]);
  }

  // Qué fracción del recuadro ya está descubierta (se muestrea cada pocos píxeles).
  function cleared() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const step = Math.max(2, Math.round(5 * dpr));
    let total = 0;
    let open = 0;
    let erased = 0;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        total++;
        const a = data[(y * canvas.width + x) * 4 + 3];
        if (a < OPEN_BELOW) open++;
        erased += 1 - a / 255;
      }
    }
    // open: lo que ya se lee (decide cuándo termina). soft: cuánto se ha raspado en total (para que las pistas avancen con cada pasada).
    return { open: open / total, soft: erased / total };
  }

  function check(force) {
    const now = performance.now();
    if (!force && now - lastCheck < 180) return;
    lastCheck = now;
    const c = cleared();
    progress = c.open;
    const felt = Math.max(c.open, c.soft * 0.85);
    setHint(HINTS.filter(([from]) => felt >= from).pop()[1]);
    if (c.open >= GOAL) reveal();
  }

  function point(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  // El pincel deja un "sello" cada 5 px de recorrido: así rascar rápido o lento quita lo mismo.
  function stroke(a, b) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${POWER})`;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(1, Math.ceil(dist / 5));
    for (let i = 1; i <= n; i++) {
      const x = a.x + ((b.x - a.x) * i) / n;
      const y = a.y + ((b.y - a.y) * i) / n;
      ctx.beginPath();
      ctx.arc(x, y, BRUSH / 2, 0, Math.PI * 2);
      ctx.fill();
      if (i % 2 === 0) spawn(x, y, 1, { speed: 0.9, up: 0.5, size: 1.8, life: 0.7 });
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (done || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    drawing = true;
    box.classList.add("is-scratching");
    canvas.setPointerCapture?.(e.pointerId);
    last = point(e);
    stroke(last, last);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drawing || done) return;
    e.preventDefault();
    const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const p of pts.length ? pts : [e]) {
      const cur = point(p);
      stroke(last, cur);
      last = cur;
    }
    check(false);
  });
  const up = () => {
    if (!drawing) return;
    drawing = false;
    box.classList.remove("is-scratching");
    check(true);
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  // Para teclado y lectores de pantalla (no pueden rascar): botón oculto que descubre la pregunta.
  skip.addEventListener("click", () => reveal());

  // Si cambia el tamaño (girar el celular), la capa se vuelve a pintar completa.
  let timer = 0;
  const ro = new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (done) return;
      const r = box.getBoundingClientRect();
      if (Math.abs(r.width - w) > 2 || Math.abs(r.height - h) > 2) paint();
    }, 150);
  });

  if (instant) return reveal(true);
  paint();
  document.fonts?.ready.then(() => !done && progress === 0 && paint());
  ro.observe(box);
}
