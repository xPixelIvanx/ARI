// "Rasca aquí": una capa dorada tapa la pregunta final. Hay que rascarla con el dedo (o el mouse), y cuesta:
// el pincel es chico y cada pasada solo quita la mitad de la capa. Cuando ya se ve ~90% del texto, la capa
// se desvanece y aparecen los botones de Sí y No.

const BRUSH = 16; // grosor del pincel en px: chico a propósito
const POWER = 0.3; // cuánto quita cada "sello" del pincel (se sella cada 5 px): hacen falta ~2-3 pasadas por zona
const GOAL = 0.9; // fracción del recuadro que debe quedar descubierta

const HINTS = [
  [0, "Rasca aquí"],
  [0.08, "Sigue…"],
  [0.4, "Ya se asoma algo…"],
  [0.7, "Casi…"],
  [0.84, "Un poquito más…"],
];

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

  function reveal(now = false) {
    if (done) return;
    done = true;
    drawing = false;
    ro.disconnect();
    hint.hidden = true;
    skip.hidden = true;
    if (now) canvas.remove();
    else {
      canvas.classList.add("is-gone");
      setTimeout(() => canvas.remove(), 1000);
    }
    setTimeout(() => choices.classList.remove("is-waiting"), now ? 0 : 700);
    onReveal?.();
  }

  function paint() {
    const r = box.getBoundingClientRect();
    w = Math.round(r.width);
    h = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    hint.textContent = HINTS[0][1];
  }

  // Qué fracción del recuadro ya está descubierta (se muestrea cada pocos píxeles).
  function cleared() {
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const step = Math.max(2, Math.round(5 * dpr));
    let total = 0;
    let open = 0;
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        total++;
        if (data[(y * canvas.width + x) * 4 + 3] < 60) open++;
      }
    }
    return open / total;
  }

  function check(force) {
    const now = performance.now();
    if (!force && now - lastCheck < 180) return;
    lastCheck = now;
    progress = cleared();
    const text = HINTS.filter(([from]) => progress >= from).pop()[1];
    if (hint.textContent !== text) hint.textContent = text;
    if (progress >= GOAL) reveal();
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
      ctx.beginPath();
      ctx.arc(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, BRUSH / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (done || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    drawing = true;
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
