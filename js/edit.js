// Modo edición en vivo (solo cuenta admin; lo carga js/session.js).
//
// Se edita directamente sobre la página, con el dedo o con el mouse:
//   data-ed="ruta"        texto: se toca y se escribe
//   data-ed-img="ruta"    foto o recuadro de foto: se toca y se elige una imagen
//   data-ed-list="ruta"   lista: cada hijo con data-ed-item se arrastra (⠿), se edita (✎) o se quita (✕); hay botón para agregar
// Bloques libres, estilos y secciones ocultas: js/blocks.js. Lo que no está a la vista (nombres, fecha, música…) está en
// "Ajustes" (js/edit-schemas.js). Los cambios son un borrador en este dispositivo hasta que se toca "Publicar".

import { aliasMedia, docFor, draftStore, editMode, files, getAt, getContent, isLocal, putDoc, resolveMedia, setAt, setEditMode, NoDatabase } from "./content.js";
import SCHEMAS, { PAGES } from "./edit-schemas.js";
import { BLOCK_TYPES, applyHidden, applyStyleKey, applyStyleTo, newId, renderBlock, sectionsOf } from "./blocks.js";

const CHUNK = 900_000; // Firestore limita cada documento a 1 MiB: los archivos se guardan en trozos.
const SCROLL_KEY = "ari-edit-scroll";

let page = "";
let getToken = async () => null;
let schema = { lists: {}, settings: [] };
let draft = {};
let dirty = false;
let needReload = false;
let panel = null;
let activeKey = ""; // último texto o bloque tocado (para el botón "Estilo")
let dot;
let dotText;
let menu = null;

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const buzz = (ms = 10) => navigator.vibrate?.(ms);
const cap = (s = "Elemento") => s.charAt(0).toUpperCase() + s.slice(1);

function h(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...children.flat().filter((c) => c != null && c !== false));
  return n;
}

const rendered = () =>
  window.__ariRendered
    ? Promise.resolve()
    : new Promise((resolve) => {
        document.addEventListener("ari:rendered", resolve, { once: true });
        setTimeout(resolve, 6000);
      });

export async function start(opts) {
  page = opts.page;
  getToken = opts.getToken;
  schema = { lists: {}, settings: [], ...(SCHEMAS[page] || {}) };
  document.head.append(h("link", { rel: "stylesheet", href: "css/edit.css" }));
  rendered().then(adminExtras);

  if (!editMode()) {
    document.body.append(
      h("button", { type: "button", class: "ed-ui ed-fab", onclick: () => (setEditMode(true), location.reload()) }, h("span", { "aria-hidden": "true" }, "✎"), " Editar")
    );
    return;
  }
  await activate();
}

// El admin puede entrar a las páginas antes de "la hora": se muestra el botón de la cuenta regresiva.
function adminExtras() {
  const links = $$('[data-t="link"],[data-t="wlink"]');
  if (!links.length) return;
  links.forEach((n) => (n.hidden = false));
  dispatchEvent(new Event("resize")); // el carrusel vuelve a medir sus tarjetas
}

/* ---------- Avisos ---------- */

let toastEl;
let toastTimer = 0;
// kind: info | ok | error | busy (busy se queda hasta el siguiente aviso)
function status(text, kind = "info") {
  if (!toastEl) {
    toastEl = h("div", { class: "ed-ui ed-toast", role: "status", "aria-live": "polite" });
    document.body.append(toastEl);
  }
  clearTimeout(toastTimer);
  toastEl.textContent = text;
  toastEl.dataset.kind = kind;
  toastEl.classList.add("is-on");
  if (kind !== "busy") toastTimer = setTimeout(() => toastEl.classList.remove("is-on"), kind === "error" ? 5500 : 2400);
}

function updateDot() {
  if (!dot) return;
  dot.dataset.kind = dirty ? "dirty" : "ok";
  dotText.textContent = dirty ? "Borrador" : "Publicado";
}

/* ---------- Borrador e historial (deshacer / rehacer) ---------- */

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!draftStore.save(page, draft, dirty)) status("No se pudo guardar el borrador en este dispositivo.", "error");
}
function markDirty() {
  dirty = true;
  persist();
  updateDot();
}

const HIST = () => `ari-edit-hist-${page}`;
function readHist() {
  try {
    return JSON.parse(sessionStorage.getItem(HIST())) || { u: [], r: [] };
  } catch {
    return { u: [], r: [] };
  }
}
const writeHist = (hs) => {
  try {
    sessionStorage.setItem(HIST(), JSON.stringify(hs));
  } catch {}
};

// Guarda cómo está todo ANTES de un cambio, para poder deshacerlo.
function checkpoint() {
  const hs = readHist();
  const snap = JSON.stringify(draft);
  if (hs.u.at(-1) === snap) return;
  hs.u.push(snap);
  if (hs.u.length > 40) hs.u.shift();
  hs.r = [];
  writeHist(hs);
}

function travel(from, to, empty) {
  const hs = readHist();
  const snap = hs[from].pop();
  if (!snap) return status(empty);
  hs[to].push(JSON.stringify(draft));
  writeHist(hs);
  draft = JSON.parse(snap);
  dirty = true;
  buzz();
  reloadPage();
}
const undo = () => travel("u", "r", "No hay nada que deshacer");
const redo = () => travel("r", "u", "No hay nada que rehacer");

// Cambia un valor del contenido y lo refleja en todos los elementos de la página que lo muestran.
function change(path, value, source) {
  setAt(draft, path, value);
  markDirty();
  const shown = $$(`[data-ed="${path}"]`);
  shown.forEach((n) => n !== source && n.textContent !== value && (n.textContent = value));
  if (!shown.length && !$$(`[data-ed-img="${path}"]`).length) needReload = true; // no se ve en la página: hay que repintar al cerrar
  if (shown.length) clearTimeout(change.t), (change.t = setTimeout(() => dispatchEvent(new Event("resize")), 300));
}

function reloadPage() {
  saveNow();
  try {
    sessionStorage.setItem(SCROLL_KEY, String(scrollY));
  } catch {}
  location.reload();
}

/* ---------- Activación ---------- */

async function activate() {
  draft = structuredClone(await getContent(page));
  dirty = draftStore.isDirty(page);
  draft.blocks ??= [];
  draft.styles ??= {};
  draft.hidden ??= {};
  await rendered();

  document.documentElement.classList.add("ed-on");
  $$(".reveal").forEach((n) => n.classList.add("is-in"));

  installGuards();
  $$("[data-ed]").forEach(makeText);
  $$("[data-ed-img]").forEach((n) => n.classList.add("ed-img"));
  document.addEventListener("focusin", (e) => {
    const t = e.target.closest?.("[data-ed]");
    if (!t) return;
    const block = t.closest(".ari-block");
    activeKey = block ? `block:${block.dataset.block}` : t.dataset.ed;
  });
  buildOverlay();
  buildBar();
  updateDot();

  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest?.("[contenteditable],input,textarea,select")) return;
    if (e.key.toLowerCase() === "z") (e.preventDefault(), e.shiftKey ? redo() : undo());
    if (e.key.toLowerCase() === "y") (e.preventDefault(), redo());
  });

  let y = 0;
  try {
    y = Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {}
  if (y) [0, 400, 1200].forEach((ms) => setTimeout(() => scrollTo(0, y), ms));
}

// Que los controles de la propia página (arrastrar el carrusel, abrir el visor, flechas…) no interfieran al editar.
function installGuards() {
  const inEditable = (e) => e.target.closest?.("[data-ed],[data-ed-img],[data-ed-act],[data-drag]");
  ["pointerdown", "mousedown", "touchstart", "keydown", "keyup"].forEach((type) =>
    document.addEventListener(
      type,
      (e) => {
        if (type === "pointerdown") {
          const grip = e.target.closest?.("[data-drag]");
          if (grip) {
            e.stopPropagation();
            return beginDrag(e, grip);
          }
        }
        if (inEditable(e)) e.stopPropagation();
      },
      true
    )
  );
  document.addEventListener(
    "click",
    (e) => {
      if (menu && !e.target.closest?.(".ed-menu,.ed-more")) closeMenu();
      const act = e.target.closest?.("[data-ed-act]");
      if (act) {
        e.preventDefault();
        e.stopPropagation();
        return runAction(act);
      }
      if (e.target.closest?.("[data-drag]")) return e.stopPropagation();
      const img = e.target.closest?.("[data-ed-img]");
      if (img) {
        e.preventDefault();
        e.stopPropagation();
        return pickFor(img);
      }
      if (e.target.closest?.("[data-ed]")) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

/* ---------- Textos editables ---------- */

function makeText(el) {
  const path = el.dataset.ed;
  const value = getAt(draft, path) ?? el.dataset.edDef ?? el.textContent;
  if (typeof value === "string" && el.textContent !== value) el.textContent = value; // quita animaciones por letra/palabra
  el.classList.add("ed-text");
  el.contentEditable = "plaintext-only";
  if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
  el.spellcheck = true;
  el.enterKeyHint = "done";
  el.addEventListener("focus", checkpoint);
  el.addEventListener("input", () => change(el.dataset.ed, el.textContent, el));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      el.blur();
    }
  });
  el.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*\n\s*/g, " "));
  });
}

/* ---------- Imágenes ---------- */

async function compress(file, max = 1600) {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const hh = Math.round(img.naturalHeight * k);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = hh;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, hh);
    ctx.drawImage(img, 0, 0, w, hh);
    const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82));
    return { blob, ratio: `${w}/${hh}` };
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function saveLocal(blob, ext) {
  const id = `idb:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await files.put(id, { blob, ext });
  return id;
}

function chooseFile(accept) {
  return new Promise((resolve) => {
    const input = h("input", { type: "file", accept });
    input.addEventListener("change", () => resolve(input.files[0] || null));
    input.addEventListener("cancel", () => resolve(null));
    input.click();
  });
}

// Elige una foto, la achica y la guarda en este dispositivo. Devuelve { id, ratio } o null.
async function pickImage(max = 1600) {
  const file = await chooseFile("image/*");
  if (!file) return null;
  status("Procesando foto…", "busy");
  try {
    const { blob, ratio } = await compress(file, max);
    const id = await saveLocal(blob, "jpg");
    toastEl?.classList.remove("is-on");
    return { id, ratio };
  } catch {
    status("No se pudo leer esa foto. Prueba con otra (JPG o PNG).", "error");
    return null;
  }
}

async function setImage(path, { id, ratio }) {
  checkpoint();
  change(path, id);
  const parent = path.split(".").slice(0, -1).join(".");
  if (parent && ratio && getAt(draft, parent) && "ratio" in getAt(draft, parent)) setAt(draft, `${parent}.ratio`, ratio);
  const url = await resolveMedia(id);
  let live = true;
  $$(`[data-ed-img="${path}"]`).forEach((n) => {
    const img = n.tagName === "IMG" ? n : n.querySelector("img");
    if (img) {
      img.src = url;
      if (ratio && n.tagName !== "IMG") n.style.aspectRatio = ratio;
    } else live = false; // era un recuadro de muestra: hay que repintar
  });
  return live;
}

async function pickFor(el) {
  const picked = await pickImage();
  if (!picked) return;
  buzz();
  const live = await setImage(el.dataset.edImg, picked);
  if (!live) reloadPage();
}

/* ---------- Herramientas flotantes (listas, bloques, secciones, ranuras) ---------- */

let overlay;
let tools = []; // { item | container, box, pos? }
let placing = false;

function buildOverlay() {
  overlay?.remove();
  tools = [];
  overlay = h("div", { class: "ed-ui ed-overlay" });
  document.body.append(overlay);
  const push = (entry) => (overlay.append(entry.box), tools.push(entry));

  const btn = (act, label, title, data = {}) => h("button", { type: "button", class: "ed-tool", "data-ed-act": act, title, "aria-label": title, ...data }, label);
  const grip = (data) => h("button", { type: "button", class: "ed-tool ed-grip", "data-drag": data.drag, title: "Mantén y arrastra para mover", "aria-label": "Mover", ...data }, "⠿");

  // Listas.
  $$("[data-ed-list]").forEach((container) => {
    const path = container.dataset.edList;
    const def = schema.lists[path] || {};
    const items = [...container.children].filter((n) => n.hasAttribute("data-ed-item"));
    items.forEach((item, i) => {
      item._i = i;
      const box = h(
        "div",
        { class: "ed-tools" },
        !def.fixed && items.length > 1 && grip({ drag: "list" }),
        def.fields && btn("edit", "✎", "Editar todos los campos", { "data-path": path }),
        !def.fixed && btn("del", "✕", "Quitar", { "data-path": path })
      );
      push({ item, box });
    });
    if (def.new != null && !def.fixed) {
      push({ container, box: h("button", { type: "button", class: "ed-add", "data-ed-act": "add", "data-path": path }, `＋ Agregar ${def.label || "elemento"}`), add: true });
    }
  });

  // Bloques libres.
  $$(".ari-block").forEach((item) => {
    const id = item.dataset.block;
    const box = h("div", { class: "ed-tools" }, grip({ drag: "block", "data-id": id }), btn("b-style", "🎨", "Estilo y opciones", { "data-id": id }), btn("b-dup", "⧉", "Duplicar", { "data-id": id }), btn("b-del", "✕", "Quitar", { "data-id": id }));
    push({ item, box });
  });

  // Secciones: ocultar / mostrar.
  sectionsOf().forEach(({ id, node }) => {
    const label = draft.hidden[id] ? "👁 Mostrar sección" : "🙈 Ocultar sección";
    push({ item: node, box: h("button", { type: "button", class: "ed-pill", "data-ed-act": "sec-hide", "data-slot": id }, label), pos: "top" });
  });

  // Ranuras: "＋" debajo de cada sección.
  $$(".ari-slot").forEach((slot) => {
    const b = h("button", { type: "button", class: "ed-add ed-add--slot", "data-ed-act": "slot-add", "data-slot": slot.dataset.slot, "aria-label": "Agregar un bloque aquí" }, h("span", { "aria-hidden": "true" }, "＋"), h("span", { class: "ed-lbl" }, " Bloque aquí"));
    push({ container: slot, box: b, pos: "slot" });
  });

  if (placing) return;
  placing = true;
  const place = () => {
    const bottomLimit = innerHeight - 84;
    for (const t of tools) {
      const r = (t.item || t.container).getBoundingClientRect();
      const visible = r.width > 0 && r.height >= 0 && r.bottom > 0 && r.top < innerHeight && (t.item ? r.height > 0 : true);
      t.box.hidden = !visible;
      if (!visible) continue;
      const w = t.box.offsetWidth;
      let x;
      let y;
      if (t.pos === "top") {
        x = r.left + r.width / 2 - w / 2;
        y = Math.min(Math.max(r.top + 8, 8), Math.max(8, r.bottom - 44));
      } else if (t.pos === "slot") {
        x = 12;
        y = r.bottom - 16;
        t.box.hidden = y > bottomLimit || y < 4;
      } else if (t.add) {
        x = r.left + r.width / 2 - w / 2;
        y = Math.min(Math.max(r.bottom + 6, 6), bottomLimit - 40);
      } else {
        x = Math.min(r.right - w - 6, innerWidth - w - 6);
        y = Math.min(Math.max(r.top - 16, 6), Math.max(6, r.bottom - 46)); // a caballo sobre el borde de arriba
      }
      t.box.style.transform = `translate(${Math.max(6, x)}px, ${y}px)`;
    }
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}

// Después de agregar o mover elementos: hace editable lo nuevo y vuelve a colocar las herramientas.
function refreshEditable() {
  $$("[data-ed]:not(.ed-text)").forEach(makeText);
  $$("[data-ed-img]:not(.ed-img)").forEach((n) => n.classList.add("ed-img"));
  buildOverlay();
}

// Las rutas llevan el número de posición ("memories.3.caption"): al mover algo hay que renumerarlas.
function renumber(scopeNodes, prefixOf) {
  scopeNodes.forEach(({ node, prefix, index }) => {
    [node, ...$$("[data-ed],[data-ed-img]", node)].forEach((n) => {
      for (const a of ["data-ed", "data-ed-img"]) {
        const v = n.getAttribute?.(a);
        if (v?.startsWith(prefix)) n.setAttribute(a, v.replace(new RegExp(`^${prefixOf.replace(/\./g, "\\.")}\\.\\d+`), `${prefixOf}.${index}`));
      }
    });
  });
}

const reindexBlocks = () =>
  draft.blocks.forEach((b, i) => {
    const node = document.querySelector(`.ari-block[data-block="${b.id}"]`);
    if (node) renumber([{ node, prefix: "blocks.", index: i }], "blocks");
  });

/* ---------- Arrastrar y soltar (mouse y táctil) ---------- */

let drag = null;

function beginDrag(e, grip) {
  if (drag || (e.pointerType === "mouse" && e.button !== 0)) return;
  e.preventDefault();
  const kind = grip.dataset.drag;
  const node = kind === "block" ? document.querySelector(`.ari-block[data-block="${grip.dataset.id}"]`) : tools.find((t) => t.box.contains(grip))?.item;
  if (!node) return;

  const r = node.getBoundingClientRect();
  const ghost = node.cloneNode(true);
  [ghost, ...$$("*", ghost)].forEach((n) => ["data-ed", "data-ed-img", "data-ed-item", "contenteditable", "id", "data-block"].forEach((a) => n.removeAttribute?.(a)));
  ghost.classList.add("ed-ghost");
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, maxHeight: "260px" });
  const indicator = h("div", { class: "ed-ui ed-drop" });
  document.body.append(ghost, indicator);
  node.classList.add("ed-dragging");
  document.documentElement.classList.add("ed-dragging-now");
  grip.setPointerCapture?.(e.pointerId);
  buzz(12);

  drag = { kind, node, ghost, indicator, container: node.parentElement, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, target: null, id: e.pointerId, raf: 0 };
  addEventListener("pointermove", dragMove);
  addEventListener("pointerup", dragEnd);
  addEventListener("pointercancel", dragEnd);
  drag.raf = requestAnimationFrame(dragFrame);
}

function dragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  e.preventDefault();
  drag.x = e.clientX;
  drag.y = e.clientY;
}

function dragFrame() {
  if (!drag) return;
  const { ghost, x, y, dx, dy } = drag;
  ghost.style.transform = `translate(${x - dx - parseFloat(ghost.style.left)}px, ${y - dy - parseFloat(ghost.style.top)}px) scale(1.03) rotate(-0.6deg)`;

  // Si el dedo llega al borde de la pantalla, la página se desplaza sola.
  const edge = 90;
  if (y < edge) scrollBy(0, -Math.ceil(((edge - y) / edge) * 18));
  else if (y > innerHeight - edge) scrollBy(0, Math.ceil(((y - (innerHeight - edge)) / edge) * 18));

  const target = drag.kind === "block" ? blockTarget() : listTarget();
  drag.target = target;
  const ind = drag.indicator;
  if (target) {
    const { rect, vertical } = target;
    Object.assign(ind.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: vertical ? "4px" : `${rect.width}px`,
      height: vertical ? `${rect.height}px` : "4px",
    });
    ind.classList.add("is-on");
  } else ind.classList.remove("is-on");
  drag.raf = requestAnimationFrame(dragFrame);
}

// Bloques: el hueco (entre bloques o al final de una sección) más cercano al dedo.
function blockTarget() {
  let best = null;
  for (const slot of $$(".ari-slot")) {
    const kids = [...slot.children].filter((n) => n !== drag.node);
    const sr = slot.getBoundingClientRect();
    const gaps = kids.length
      ? [...kids.map((k) => ({ before: k, y: k.getBoundingClientRect().top })), { before: null, y: kids.at(-1).getBoundingClientRect().bottom }]
      : [{ before: null, y: sr.top }];
    for (const g of gaps) {
      const d = Math.abs(drag.y - g.y);
      if (!best || d < best.d) best = { d, slot, before: g.before, y: g.y };
    }
  }
  if (!best) return null;
  const w = Math.min(innerWidth - 24, 720);
  return { ...best, rect: { left: (innerWidth - w) / 2, top: best.y - 2, width: w, height: 4 }, vertical: false };
}

// Listas: el elemento más cercano al dedo; se suelta antes o después de él.
function listTarget() {
  const items = [...drag.container.children].filter((n) => n.hasAttribute("data-ed-item") && n !== drag.node);
  if (!items.length) return null;
  let best = null;
  for (const it of items) {
    const r = it.getBoundingClientRect();
    const dx = Math.max(r.left - drag.x, 0, drag.x - r.right);
    const dy = Math.max(r.top - drag.y, 0, drag.y - r.bottom);
    const d = Math.hypot(dx, dy);
    if (!best || d < best.d) best = { d, it, r };
  }
  const { it, r } = best;
  const cy = r.top + r.height / 2;
  const cx = r.left + r.width / 2;
  const before = Math.abs(drag.y - cy) > r.height / 4 ? drag.y < cy : drag.x < cx;
  const left0 = items[0].getBoundingClientRect().left;
  const stacked = items.every((n) => Math.abs(n.getBoundingClientRect().left - left0) < 8);
  const rect = stacked
    ? { left: r.left, top: (before ? r.top : r.bottom) - 2, width: r.width, height: 4 }
    : { left: (before ? r.left : r.right) - 2, top: r.top, width: 4, height: r.height };
  return { it, before, rect, vertical: !stacked };
}

function dragEnd(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const d = drag;
  drag = null;
  cancelAnimationFrame(d.raf);
  removeEventListener("pointermove", dragMove);
  removeEventListener("pointerup", dragEnd);
  removeEventListener("pointercancel", dragEnd);
  d.ghost.remove();
  d.indicator.remove();
  d.node.classList.remove("ed-dragging");
  document.documentElement.classList.remove("ed-dragging-now");
  if (e?.type === "pointercancel" || !d.target) return;

  checkpoint();
  if (d.kind === "block") {
    d.target.slot.insertBefore(d.node, d.target.before);
    const byId = new Map(draft.blocks.map((b) => [b.id, b]));
    draft.blocks = $$(".ari-block").map((n) => {
      const b = byId.get(n.dataset.block);
      b.slot = n.parentElement.dataset.slot;
      return b;
    });
    reindexBlocks();
  } else {
    const { it, before } = d.target;
    d.container.insertBefore(d.node, before ? it : it.nextElementSibling);
    const path = d.container.dataset.edList;
    const arr = getAt(draft, path);
    const order = [...d.container.children].filter((n) => n.hasAttribute("data-ed-item"));
    const moved = order.map((n) => arr[n._i]);
    arr.splice(0, arr.length, ...moved);
    renumber(order.map((node, index) => ({ node, prefix: `${path}.`, index })), path);
  }
  markDirty();
  refreshEditable();
  buzz([8, 30, 8]);
  d.node.classList.add("ed-dropped");
  setTimeout(() => d.node.classList.remove("ed-dropped"), 600);
}

/* ---------- Acciones de las herramientas ---------- */

function runAction(btn) {
  const act = btn.dataset.edAct;
  if (act.startsWith("b-")) return blockAction(act, btn.dataset.id);
  if (act === "slot-add") return openBlockMenu(btn.dataset.slot);
  if (act === "sec-hide") {
    const id = btn.dataset.slot;
    checkpoint();
    if (draft.hidden[id]) delete draft.hidden[id];
    else draft.hidden[id] = true;
    markDirty();
    applyHidden(draft.hidden, true);
    btn.textContent = draft.hidden[id] ? "👁 Mostrar sección" : "🙈 Ocultar sección";
    buzz();
    return;
  }

  const path = btn.dataset.path;
  const def = schema.lists[path] || {};
  const arr = getAt(draft, path);
  if (!Array.isArray(arr)) return;
  const owner = tools.find((t) => t.box.contains(btn) || t.box === btn);
  const i = owner?.item?._i ?? -1;

  if (act === "edit") return openPanel(`${cap(def.label)} ${i + 1}`, [fieldsFor(def.fields, `${path}.${i}`)]);
  checkpoint();
  if (act === "add") arr.push(structuredClone(def.new));
  else if (act === "del") {
    if (!confirm("¿Quitar este elemento?")) return;
    arr.splice(i, 1);
  } else return;
  markDirty();
  reloadPage();
}

/* ---------- Bloques libres ---------- */

const slotLabel = (id) => {
  const node = sectionsOf().find((s) => s.id === id)?.node;
  const t = node?.querySelector("h1,h2")?.textContent?.trim();
  return t ? `Después de “${t.slice(0, 28)}”` : `Después de la sección ${id}`;
};

function openBlockMenu(slotId) {
  const slots = sectionsOf().map((s) => s.id);
  let slot = slotId || slots[0];
  const select = h("select", {}, ...slots.map((id) => h("option", { value: id }, slotLabel(id))));
  select.value = slot;
  select.addEventListener("change", () => (slot = select.value));
  const grid = h(
    "div",
    { class: "ed-blocks" },
    ...Object.entries(BLOCK_TYPES).map(([type, def]) =>
      h("button", { type: "button", class: "ed-block-btn", onclick: () => (closePanel(false), addBlock(type, slot)) }, h("span", { class: "ed-block-btn__icon" }, def.icon), h("span", {}, def.label))
    )
  );
  openPanel("Agregar un bloque", [h("label", { class: "ed-field" }, h("span", { class: "ed-label" }, "¿Dónde?"), select), grid], { history: false });
}

function insertBlockNode(b, index, after) {
  const node = renderBlock(b, index);
  const slot = document.querySelector(`.ari-slot[data-slot="${b.slot}"]`);
  if (!slot) return null;
  if (after) after.after(node);
  else slot.append(node);
  return node;
}

function addBlock(type, slotId) {
  checkpoint();
  const b = { id: newId(), type, slot: slotId, ...BLOCK_TYPES[type].make() };
  draft.blocks.push(b);
  const node = insertBlockNode(b, draft.blocks.length - 1);
  if (!node) return;
  markDirty();
  refreshEditable();
  buzz([8, 30, 8]);
  node.classList.add("ed-dropped");
  setTimeout(() => node.classList.remove("ed-dropped"), 600);
  node.scrollIntoView({ behavior: "smooth", block: "center" });
  const first = node.querySelector("[data-ed]");
  if (first) setTimeout(() => (first.focus({ preventScroll: true }), document.execCommand("selectAll")), 450);
}

function blockAction(act, id) {
  const i = draft.blocks.findIndex((b) => b.id === id);
  if (i < 0) return;
  const node = document.querySelector(`.ari-block[data-block="${id}"]`);
  if (act === "b-style") return openStylePanel(`block:${id}`, i);
  checkpoint();
  if (act === "b-dup") {
    const copy = { ...structuredClone(draft.blocks[i]), id: newId() };
    draft.blocks.splice(i + 1, 0, copy);
    if (draft.styles[`block:${id}`]) draft.styles[`block:${copy.id}`] = structuredClone(draft.styles[`block:${id}`]);
    const clone = insertBlockNode(copy, i + 1, node);
    if (clone && draft.styles[`block:${copy.id}`]) applyStyleTo(clone, draft.styles[`block:${copy.id}`]);
    reindexBlocks();
  } else if (act === "b-del") {
    if (!confirm("¿Quitar este bloque?")) return;
    delete draft.styles[`block:${id}`];
    draft.blocks.splice(i, 1);
    node?.remove();
    reindexBlocks();
  }
  markDirty();
  refreshEditable();
  buzz();
}

// Estilo de un texto de la página o de un bloque (color, tamaño, negrita, cursiva, alineación, letra, márgenes).
function openStylePanel(key, blockIndex) {
  const st = (draft.styles[key] ??= {});
  const set = (prop, val) => {
    if (val === "" || val == null) delete st[prop];
    else st[prop] = val;
    markDirty();
    applyStyleKey(key, st);
  };
  const row = (label, ...kids) => h("div", { class: "ed-field" }, h("span", { class: "ed-label" }, label), h("div", { class: "ed-row" }, ...kids));
  const ghost = (text, onclick, pressed) => h("button", { type: "button", class: "ed-btn ed-btn--ghost ed-btn--sm", "aria-pressed": pressed, onclick }, text);

  const slider = (prop, min, max, step, def) => {
    const input = h("input", { type: "range", min, max, step });
    input.value = st[prop] ?? def;
    input.addEventListener("input", () => set(prop, Number(input.value)));
    return [input, ghost("↺", () => (set(prop, null), (input.value = def)))];
  };
  const toggle = (prop, text) => {
    const b = ghost(
      text,
      () => {
        set(prop, st[prop] ? null : true);
        b.setAttribute("aria-pressed", String(!!st[prop]));
      },
      String(!!st[prop])
    );
    return b;
  };

  const align = h("div", { class: "ed-seg" });
  [["left", "Izquierda"], ["center", "Centro"], ["right", "Derecha"]].forEach(([v, text]) => {
    const b = ghost(
      text,
      () => {
        set("align", st.align === v ? null : v);
        $$("button", align).forEach((x) => x.setAttribute("aria-pressed", "false"));
        if (st.align) b.setAttribute("aria-pressed", "true");
      },
      String(st.align === v)
    );
    align.append(b);
  });

  const color = h("input", { type: "color" });
  color.value = st.color || "#000000";
  color.addEventListener("input", () => set("color", color.value));
  const font = h("select", {}, ...[["", "Por defecto"], ["serif", "Elegante (serif)"], ["sans", "Moderna (sans)"], ["mono", "Máquina de escribir"]].map(([v, l]) => h("option", { value: v }, l)));
  font.value = st.font || "";
  font.addEventListener("change", () => set("font", font.value));

  const bodies = [
    row("Color", color, ghost("Quitar", () => set("color", null))),
    row("Tamaño", ...slider("scale", 0.5, 3, 0.05, 1)),
    row("Estilo", toggle("bold", "Negrita"), toggle("italic", "Cursiva")),
    row("Alineación", align),
    row("Letra", font),
    row("Espacio arriba", ...slider("mt", -40, 160, 2, 0)),
    row("Espacio abajo", ...slider("mb", -40, 160, 2, 0)),
  ];

  if (blockIndex != null && draft.blocks[blockIndex]) {
    const b = draft.blocks[blockIndex];
    const base = `blocks.${blockIndex}`;
    const extra = [];
    if (b.type === "button")
      extra.push(fieldEl({ path: `${base}.href`, label: "A dónde lleva (enlace)", help: "Ej: https://… o regalo.html" }), fieldEl({ path: `${base}.bg`, label: "Color del botón", type: "color" }));
    if (b.type === "image")
      extra.push(
        fieldEl({ path: `${base}.w`, label: "Ancho (%)", type: "range", min: 20, max: 100, step: 5 }),
        fieldEl({ path: `${base}.r`, label: "Esquinas redondeadas", type: "range", min: 0, max: 60, step: 2 })
      );
    if (b.type === "spacer") extra.push(fieldEl({ path: `${base}.h`, label: "Alto (px)", type: "range", min: 10, max: 300, step: 5 }));
    bodies.unshift(...extra);
  }
  const title = blockIndex != null ? `Bloque: ${BLOCK_TYPES[draft.blocks[blockIndex]?.type]?.label || ""}` : "Estilo del texto";
  openPanel(title, [h("div", { class: "ed-fields" }, ...bodies)]);
}

/* ---------- Panel de campos (elementos, estilo y ajustes) ---------- */

function openPanel(title, bodies, { history = true } = {}) {
  closePanel(false);
  needReload = false;
  if (history) checkpoint();
  const body = h("div", { class: "ed-panel__body", "data-lenis-prevent": true }, ...bodies);
  panel = h(
    "aside",
    { class: "ed-ui ed-panel", "aria-label": title },
    h("div", { class: "ed-panel__grab", "aria-hidden": "true" }),
    h("header", { class: "ed-panel__head" }, h("p", { class: "ed-panel__title" }, title), h("button", { type: "button", class: "ed-btn ed-btn--sm", onclick: () => closePanel(true) }, "Listo")),
    body
  );
  panel.addEventListener("keydown", (e) => e.stopPropagation());
  document.body.append(panel);
  document.documentElement.classList.add("ed-panel-open");
}

function closePanel(apply) {
  if (!panel) return;
  panel.remove();
  panel = null;
  document.documentElement.classList.remove("ed-panel-open");
  if (apply && needReload) reloadPage();
}

const fieldsFor = (fields, base) => h("div", { class: "ed-fields" }, ...fields.map((f) => fieldEl(f, base)));

function refreshInputs() {
  if (!panel) return;
  $$("[data-field-path]", panel).forEach((n) => {
    const v = getAt(draft, n.dataset.fieldPath);
    if (n.tagName === "IMG") resolveMedia(v).then((url) => (n.src = url));
    else if (typeof v === "string" || typeof v === "number") n.value = v;
  });
}

function fieldEl(f, base) {
  const path = f.path ?? (base ? `${base}.${f.k}` : f.k);
  const type = f.type || "text";
  const label = f.label && h("span", { class: "ed-label" }, f.label);
  const help = f.help && h("span", { class: "ed-help" }, f.help);
  const wrap = (...kids) => h("label", { class: "ed-field" }, label, ...kids, help);

  if (type === "text" || type === "textarea") {
    const input = type === "textarea" ? h("textarea", { rows: f.rows || 3 }) : h("input", { type: "text" });
    input.value = getAt(draft, path) ?? "";
    input.dataset.fieldPath = path;
    input.addEventListener("input", () => change(path, input.value));
    return wrap(input);
  }

  if (type === "datetime") {
    const input = h("input", { type: "datetime-local" });
    input.value = (getAt(draft, path) || "").slice(0, 16);
    input.addEventListener("input", () => input.value && change(path, `${input.value.slice(0, 16)}:00`));
    return wrap(input);
  }

  if (type === "range") {
    const input = h("input", { type: "range", min: f.min ?? 0, max: f.max ?? 1, step: f.step ?? 0.05 });
    input.value = getAt(draft, path) ?? f.def ?? 0.6;
    input.addEventListener("input", () => change(path, Number(input.value)));
    return wrap(input);
  }

  if (type === "color") {
    const input = h("input", { type: "color" });
    input.value = getAt(draft, path) || "#cf6a8a";
    input.addEventListener("input", () => change(path, input.value));
    return wrap(input);
  }

  if (type === "image") {
    const thumb = h("img", { class: "ed-thumb", alt: "", "data-field-path": path });
    const refresh = async () => {
      const url = await resolveMedia(getAt(draft, path));
      thumb.src = url || "";
      thumb.hidden = !url;
    };
    refresh();
    const btn = h("button", { type: "button", class: "ed-btn ed-btn--ghost ed-btn--sm" }, "Elegir foto");
    btn.addEventListener("click", async () => {
      const picked = await pickImage(f.max || 1600);
      if (!picked) return;
      const live = await setImage(path, picked);
      if (!live) needReload = true;
      refresh();
    });
    return h("div", { class: "ed-field" }, label, thumb, btn, help);
  }

  if (type === "audio") {
    const info = h("span", { class: "ed-help" });
    const v = () => getAt(draft, path);
    const describe = () => (info.textContent = isLocal(v()) ? "Canción nueva (sin publicar todavía)." : v() ? `Archivo actual: ${String(v()).startsWith("fb:") ? "publicado ✓" : v()}` : "Ninguna");
    describe();
    const btn = h("button", { type: "button", class: "ed-btn ed-btn--ghost ed-btn--sm" }, "Elegir canción");
    btn.addEventListener("click", async () => {
      const file = await chooseFile("audio/*");
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) return status("Esa canción pesa más de 15 MB; usa una versión más ligera.", "error");
      const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
      try {
        change(path, await saveLocal(file, ext));
        needReload = true;
        describe();
      } catch {
        status("No se pudo guardar la canción en este dispositivo.", "error");
      }
    });
    return h("div", { class: "ed-field" }, label, btn, info);
  }

  if (type === "spotify") {
    const input = h("input", { type: "url", inputmode: "url", autocomplete: "off", placeholder: "https://open.spotify.com/track/…" });
    input.value = getAt(draft, path) || "";
    let last = input.value.trim();
    let n = 0;
    const fill = async () => {
      const value = input.value.trim();
      if (value === last) return;
      last = value;
      change(path, value);
      if (!/spotify/i.test(value)) return;
      const mine = ++n;
      status("Buscando la canción en Spotify…", "busy");
      try {
        const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(value)}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (mine !== n) return;
        const sib = (k) => path.split(".").slice(0, -1).concat(k).join(".");
        if (data.title) change(sib("title"), data.title);
        if (data.author_name) change(sib("artist"), data.author_name);
        // La miniatura de oEmbed es de 300 px; esta variante de la misma portada es de 640 px.
        if (data.thumbnail_url) change(sib("cover"), data.thumbnail_url.replace("ab67616d00001e02", "ab67616d0000b273"));
        needReload = true;
        refreshInputs();
        status(data.author_name ? "Canción encontrada ✓" : "Canción encontrada ✓ Escribe el artista a mano.", "ok");
      } catch {
        last = null;
        status("No se pudo leer ese link. Llena los datos a mano y sube la portada.", "error");
      }
    };
    input.addEventListener("change", fill);
    input.addEventListener("paste", () => setTimeout(fill, 0));
    return wrap(input);
  }

  if (type === "list") return listEditor(path, f.label);
  return h("div");
}

// Lista editable dentro de Ajustes (frases de la intro, flores, textos del botón No…).
function listEditor(path, labelText) {
  const def = schema.lists[path] || {};
  const arr = getAt(draft, path) || (setAt(draft, path, []), getAt(draft, path));
  const wrap = h("div", { class: "ed-list" });
  const structural = () => {
    markDirty();
    needReload = true;
    draw();
  };

  function draw() {
    const tool = (label, title, disabled, onclick) => h("button", { type: "button", class: "ed-tool", title, "aria-label": title, disabled, onclick }, label);
    wrap.replaceChildren(
      labelText && h("span", { class: "ed-label" }, labelText),
      ...arr.map((item, i) => {
        const head = h(
          "div",
          { class: "ed-item__head" },
          h("span", { class: "ed-item__num" }, String(i + 1)),
          !def.fixed && tool("↑", "Subir", i === 0, () => (([arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]), structural())),
          !def.fixed && tool("↓", "Bajar", i === arr.length - 1, () => (([arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]), structural())),
          !def.fixed &&
            tool("✕", "Quitar", false, () => {
              if (!confirm("¿Quitar este elemento?")) return;
              arr.splice(i, 1);
              structural();
            })
        );
        const inner = def.fields ? fieldsFor(def.fields, `${path}.${i}`) : fieldEl({ path: `${path}.${i}`, type: "textarea", rows: def.rows || 2 });
        return h("div", { class: "ed-item" }, head, inner);
      }),
      def.new != null && !def.fixed && h("button", { type: "button", class: "ed-btn ed-btn--ghost ed-btn--sm", onclick: () => (arr.push(structuredClone(def.new)), structural()) }, `+ Agregar ${def.label || "elemento"}`)
    );
  }
  draw();
  return wrap;
}

function openSettings() {
  openPanel(
    "Ajustes de esta página",
    schema.settings.map((s) => h("details", { class: "ed-section" }, h("summary", {}, s.title), h("div", { class: "ed-section__body" }, fieldsFor(s.fields, ""))))
  );
}

/* ---------- Barra inferior ---------- */

function buildBar() {
  dot = h("span", { class: "ed-dot" });
  dotText = h("span", { class: "ed-bar__state" });
  const iconBtn = (icon, label, onclick, extra = "") =>
    h("button", { type: "button", class: `ed-ibtn ${extra}`, title: label, "aria-label": label, onclick }, h("span", { class: "ed-ibtn__icon", "aria-hidden": "true" }, icon), h("span", { class: "ed-lbl" }, label));

  const publishBtn = h("button", { type: "button", class: "ed-btn ed-btn--primary", onclick: () => publish(publishBtn) }, "Publicar");
  const more = h("button", { type: "button", class: "ed-ibtn ed-more", title: "Más opciones", "aria-label": "Más opciones", "aria-haspopup": "menu", onclick: toggleMenu }, h("span", { class: "ed-ibtn__icon", "aria-hidden": "true" }, "⋯"));

  const bar = h(
    "div",
    { class: "ed-ui ed-bar", role: "toolbar", "aria-label": "Modo edición" },
    h("div", { class: "ed-bar__status", title: "Estado del borrador" }, dot, dotText),
    h("div", { class: "ed-bar__tools" }, iconBtn("↶", "Deshacer", undo, "ed-ibtn--solo"), iconBtn("↷", "Rehacer", redo, "ed-ibtn--solo"), sectionsOf().length > 0 && iconBtn("＋", "Bloque", () => openBlockMenu()), iconBtn("🎨", "Estilo", styleActive), schema.settings.length > 0 && iconBtn("⚙", "Ajustes", openSettings)),
    h("div", { class: "ed-bar__end" }, publishBtn, more)
  );
  bar.addEventListener("keydown", (e) => e.stopPropagation());
  document.body.append(bar);
}

function toggleMenu() {
  if (menu) return closeMenu();
  const item = (text, onclick, extra = "") => h("button", { type: "button", role: "menuitem", class: `ed-menu__item ${extra}`, onclick: () => (closeMenu(), onclick()) }, text);
  menu = h(
    "div",
    { class: "ed-ui ed-menu", role: "menu" },
    h("p", { class: "ed-menu__label" }, "Ir a otra página"),
    h("div", { class: "ed-menu__pages" }, ...PAGES.map(([name, href]) => h("a", { class: "ed-chip", href, "aria-current": isCurrentPage(href) ? "page" : null }, name))),
    h("hr", { class: "ed-menu__sep" }),
    item("Descartar cambios sin publicar", discard, "is-danger"),
    item("Salir del modo edición", exit)
  );
  document.body.append(menu);
}

function closeMenu() {
  menu?.remove();
  menu = null;
}

function isCurrentPage(href) {
  const here = location.pathname.split("/").pop().replace(/\.html$/, "") || "index";
  return here === href.replace(/\.html$/, "");
}

function styleActive() {
  if (!activeKey) return status("Toca primero un texto (o usa 🎨 en un bloque) para darle estilo.");
  const m = activeKey.match(/^block:(.+)$/);
  openStylePanel(activeKey, m ? draft.blocks.findIndex((b) => b.id === m[1]) : null);
}

function discard() {
  if (!confirm("¿Descartar los cambios que no has publicado? Volverá a lo último publicado.")) return;
  draftStore.clear(page);
  try {
    sessionStorage.removeItem(HIST());
  } catch {}
  location.reload();
}

function exit() {
  if (dirty && !confirm("Tienes cambios sin publicar. Se guardan en este dispositivo y los verás al volver a editar, pero ella no los verá. ¿Salir?")) return;
  saveNow();
  setEditMode(false);
  location.reload();
}

/* ---------- Publicar ---------- */

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

function localRefs(node, found = []) {
  if (node && typeof node === "object") {
    for (const k of Object.keys(node)) {
      if (isLocal(node[k])) found.push([node, k]);
      else localRefs(node[k], found);
    }
  }
  return found;
}

async function publish(button) {
  if (!confirm("¿Publicar los cambios? Ella los verá la próxima vez que abra o recargue la página.")) return;
  saveNow();
  closePanel(false);
  button.disabled = true;
  try {
    const token = await getToken();
    if (!token) throw new Error("No hay sesión iniciada. Recarga e inicia sesión de nuevo.");
    const out = structuredClone(draft);
    const pending = localRefs(out);
    const locals = pending.map(([o, key]) => o[key]);

    for (const [k, [o, key]] of pending.entries()) {
      status(`Subiendo archivos… ${k + 1} de ${pending.length}`, "busy");
      const local = o[key];
      const rec = await files.get(local);
      if (!rec) throw new Error("Falta un archivo; vuelve a elegirlo.");
      const b64 = await toBase64(rec.blob);
      const id = local.slice(4);
      const n = Math.max(1, Math.ceil(b64.length / CHUNK));
      for (let i = 0; i < n; i++) {
        await putDoc(`archivos/${id}-${i}`, { data: { stringValue: b64.slice(i * CHUNK, (i + 1) * CHUNK) } }, token);
      }
      const cloudSrc = `fb:${id}:${n}:${rec.ext}`;
      await files.put(cloudSrc, rec);
      aliasMedia(local, cloudSrc);
      o[key] = cloudSrc;
    }

    status("Publicando…", "busy");
    await putDoc(docFor(page), { json: { stringValue: JSON.stringify(out) }, actualizado: { timestampValue: new Date().toISOString() } }, token);
    locals.forEach((l) => files.del(l).catch(() => {}));
    draft = out;
    dirty = false;
    saveNow();
    updateDot();
    buzz([10, 40, 10]);
    status("¡Publicado! ✓ Ya lo puede ver.", "ok");
  } catch (err) {
    status(err instanceof NoDatabase ? "Falta crear la base de datos en Firebase (Firestore)." : err.message || "Algo salió mal al publicar.", "error");
  } finally {
    button.disabled = false;
  }
}
