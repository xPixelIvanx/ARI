// Modo edición en vivo (solo cuenta admin; lo carga js/session.js).
//
// Se edita directamente sobre la página:
//   data-ed="ruta"        texto: se toca y se escribe
//   data-ed-img="ruta"    foto o recuadro de foto: se toca y se elige una imagen
//   data-ed-list="ruta"   lista: cada hijo con data-ed-item recibe ↑ ↓ ✕ (y ✎ si tiene campos) y se pueden agregar elementos
// Lo que no está a la vista (nombres, fecha, música, frases de la intro…) está en "Ajustes" (js/edit-schemas.js).
// Los cambios se guardan como borrador en este dispositivo; "Confirmar cambios" los publica en Firestore.

import { aliasMedia, docFor, draftStore, editMode, files, getAt, getContent, isLocal, putDoc, resolveMedia, setAt, setEditMode, NoDatabase } from "./content.js";
import SCHEMAS from "./edit-schemas.js";

const CHUNK = 900_000; // Firestore limita cada documento a 1 MiB: los archivos se guardan en trozos.
const SCROLL_KEY = "ari-edit-scroll";

let page = "";
let getToken = async () => null;
let schema = { lists: {}, settings: [] };
let draft = {};
let dirty = false;
let needReload = false;
let statusEl;
let panel = null;

const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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

export async function start(opts) {
  page = opts.page;
  getToken = opts.getToken;
  schema = { lists: {}, settings: [], ...(SCHEMAS[page] || {}) };
  document.head.append(h("link", { rel: "stylesheet", href: "css/edit.css" }));

  if (!editMode()) {
    document.body.append(
      h("button", { type: "button", class: "ed-ui ed-fab", onclick: () => (setEditMode(true), location.reload()) }, "✎ Editar")
    );
    return;
  }
  await activate();
}

/* ---------- Estado y borrador ---------- */

let saveTimer = 0;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!draftStore.save(page, draft, dirty)) status("No se pudo guardar el borrador en este dispositivo.", "error");
}

function status(text, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}
const idleStatus = () => status(dirty ? "Cambios sin publicar" : "Todo publicado", dirty ? "dirty" : "ok");

// Cambia un valor del contenido y lo refleja en todos los elementos de la página que lo muestran.
function change(path, value, source) {
  setAt(draft, path, value);
  dirty = true;
  persist();
  idleStatus();
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

  if (!window.__ariRendered) {
    await new Promise((resolve) => {
      document.addEventListener("ari:rendered", resolve, { once: true });
      setTimeout(resolve, 6000);
    });
  }
  document.documentElement.classList.add("ed-on");
  $$(".reveal").forEach((n) => n.classList.add("is-in"));

  installGuards();
  $$("[data-ed]").forEach(makeText);
  $$("[data-ed-img]").forEach((n) => n.classList.add("ed-img"));
  buildOverlay();
  buildBar();
  idleStatus();

  let y = 0;
  try {
    y = Number(sessionStorage.getItem(SCROLL_KEY)) || 0;
    sessionStorage.removeItem(SCROLL_KEY);
  } catch {}
  if (y) [0, 400, 1200].forEach((ms) => setTimeout(() => scrollTo(0, y), ms));
}

// Que los controles de la propia página (arrastrar el carrusel, abrir el visor, flechas…) no interfieran al editar.
function installGuards() {
  const inEditable = (e) => e.target.closest?.("[data-ed],[data-ed-img],[data-ed-act]");
  ["pointerdown", "mousedown", "touchstart", "keydown", "keyup"].forEach((type) =>
    document.addEventListener(type, (e) => inEditable(e) && e.stopPropagation(), true)
  );
  document.addEventListener(
    "click",
    (e) => {
      const act = e.target.closest?.("[data-ed-act]");
      if (act) {
        e.preventDefault();
        e.stopPropagation();
        return runAction(act);
      }
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
  el.addEventListener("input", () => change(path, el.textContent, el));
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
  status("Procesando foto…");
  try {
    const { blob, ratio } = await compress(file, max);
    const id = await saveLocal(blob, "jpg");
    idleStatus();
    return { id, ratio };
  } catch {
    status("No se pudo leer esa foto. Prueba con otra (JPG o PNG).", "error");
    return null;
  }
}

async function setImage(path, { id, ratio }) {
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
  const live = await setImage(el.dataset.edImg, picked);
  if (!live) reloadPage();
}

/* ---------- Listas: herramientas sobre cada elemento ---------- */

let overlay;
const tools = []; // { item, box }

function buildOverlay() {
  overlay = h("div", { class: "ed-ui ed-overlay" });
  document.body.append(overlay);

  $$("[data-ed-list]").forEach((container) => {
    const path = container.dataset.edList;
    const def = schema.lists[path] || {};
    const items = [...container.children].filter((n) => n.hasAttribute("data-ed-item"));
    items.forEach((item, i) => {
      const btn = (act, label, title, disabled) =>
        h("button", { type: "button", class: "ed-tool", "data-ed-act": act, "data-path": path, "data-i": i, title, "aria-label": title, disabled }, label);
      const box = h(
        "div",
        { class: "ed-tools" },
        def.fields && btn("edit", "✎", "Editar todos los campos"),
        !def.fixed && btn("up", "↑", "Subir", i === 0),
        !def.fixed && btn("down", "↓", "Bajar", i === items.length - 1),
        !def.fixed && btn("del", "✕", "Quitar", false)
      );
      overlay.append(box);
      tools.push({ item, box });
    });
    if (def.new != null && !def.fixed) {
      const add = h("button", { type: "button", class: "ed-add", "data-ed-act": "add", "data-path": path }, `+ Agregar ${def.label || "elemento"}`);
      overlay.append(add);
      tools.push({ container, box: add, add: true });
    }
  });

  if (!tools.length) return;
  const place = () => {
    for (const t of tools) {
      const r = (t.item || t.container).getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
      t.box.hidden = !visible;
      if (!visible) continue;
      const w = t.box.offsetWidth;
      if (t.add) {
        const y = Math.min(Math.max(r.bottom + 6, 6), innerHeight - 90);
        t.box.style.transform = `translate(${Math.max(6, r.left + r.width / 2 - w / 2)}px, ${y}px)`;
      } else {
        const y = Math.min(Math.max(r.top + 6, 6), Math.max(6, r.bottom - 40));
        t.box.style.transform = `translate(${Math.max(6, Math.min(r.right - w - 6, innerWidth - w - 6))}px, ${y}px)`;
      }
    }
    requestAnimationFrame(place);
  };
  requestAnimationFrame(place);
}

function runAction(btn) {
  const path = btn.dataset.path;
  const def = schema.lists[path] || {};
  const arr = getAt(draft, path);
  const i = Number(btn.dataset.i);
  const act = btn.dataset.edAct;
  if (!Array.isArray(arr)) return;

  if (act === "edit") return openPanel(`${cap(def.label)} ${i + 1}`, [fieldsFor(def.fields, `${path}.${i}`)]);
  if (act === "add") arr.push(structuredClone(def.new));
  else if (act === "up" && i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
  else if (act === "down" && i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]];
  else if (act === "del") {
    if (!confirm("¿Quitar este elemento?")) return;
    arr.splice(i, 1);
  } else return;
  dirty = true;
  reloadPage();
}

const cap = (s = "Elemento") => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- Panel de campos (item y ajustes) ---------- */

function openPanel(title, bodies) {
  closePanel(false);
  needReload = false;
  const body = h("div", { class: "ed-panel__body", "data-lenis-prevent": true }, ...bodies);
  panel = h(
    "aside",
    { class: "ed-ui ed-panel", "aria-label": title },
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
    const input = h("input", { type: "range", min: "0", max: "1", step: "0.05" });
    input.value = getAt(draft, path) ?? 0.6;
    input.addEventListener("input", () => change(path, Number(input.value)));
    return wrap(input);
  }

  if (type === "image") {
    const thumb = h("img", { class: "ed-thumb", alt: "", "data-field-path": path });
    const refresh = async () => {
      const v = getAt(draft, path);
      const url = await resolveMedia(v);
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
      status("Buscando la canción en Spotify…");
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
    dirty = true;
    needReload = true;
    persist();
    idleStatus();
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
  statusEl = h("p", { class: "ed-status", role: "status", "aria-live": "polite" });
  const publishBtn = h("button", { type: "button", class: "ed-btn" }, "Confirmar cambios");
  publishBtn.addEventListener("click", () => publish(publishBtn));

  const bar = h(
    "div",
    { class: "ed-ui ed-bar", role: "toolbar", "aria-label": "Modo edición" },
    h("div", { class: "ed-bar__info" }, h("p", { class: "ed-kicker" }, "Modo edición"), statusEl),
    h(
      "div",
      { class: "ed-bar__actions" },
      schema.settings.length > 0 && h("button", { type: "button", class: "ed-btn ed-btn--ghost", onclick: openSettings }, "Ajustes"),
      h("button", { type: "button", class: "ed-btn ed-btn--ghost", onclick: discard }, "Descartar"),
      publishBtn,
      h("button", { type: "button", class: "ed-btn ed-btn--ghost", onclick: exit, title: "Ver la página como la ve ella" }, "Salir")
    )
  );
  bar.addEventListener("keydown", (e) => e.stopPropagation());
  document.body.append(bar);
}

function discard() {
  if (!confirm("¿Descartar los cambios que no has publicado? Volverá a lo último publicado.")) return;
  draftStore.clear(page);
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
  if (!confirm("¿Confirmar los cambios? Ella los verá la próxima vez que abra o recargue la página.")) return;
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
      status(`Subiendo archivos… ${k + 1} de ${pending.length}`);
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

    status("Publicando…");
    await putDoc(
      docFor(page),
      { json: { stringValue: JSON.stringify(out) }, actualizado: { timestampValue: new Date().toISOString() } },
      token
    );
    locals.forEach((l) => files.del(l).catch(() => {}));
    draft = out;
    dirty = false;
    saveNow();
    status("¡Publicado! ✓ Ya lo puede ver.", "ok");
  } catch (err) {
    status(err instanceof NoDatabase ? "Falta crear la base de datos en Firebase (Firestore)." : err.message || "Algo salió mal al publicar.", "error");
  } finally {
    button.disabled = false;
  }
}
