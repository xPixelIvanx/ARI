// Bloques libres y estilos que el admin agrega desde el modo edición (js/edit.js).
// Lo ven todas las cuentas: se pintan al terminar de cargar cada página (content.js > markRendered).
//
// Datos (dentro del contenido de la página):
//   blocks: [{ id, type, slot, text, caption, src, href, h, w, r, bg }]  → bloques, en orden
//   styles: { "<ruta data-ed>" | "block:<id>": { color, scale, bold, italic, align, font, mt, mb } }
//   hidden: { "<id de sección>": true }                                    → secciones ocultas
//
// Una "ranura" (slot) es el espacio justo debajo de cada sección de la página (las secciones son los hijos
// de [data-ed-root]). Las páginas sin [data-ed-root] (el carrusel) no tienen bloques.

import { editMode, getContent, resolveMedia } from "./content.js";

export const BLOCK_TYPES = {
  heading: { icon: "T", label: "Título", make: () => ({ text: "Un título" }) },
  text: { icon: "¶", label: "Texto", make: () => ({ text: "Escribe aquí lo que quieras." }) },
  quote: { icon: "❝", label: "Frase", make: () => ({ text: "Una frase especial." }) },
  emoji: { icon: "💛", label: "Emoji grande", make: () => ({ text: "💛" }) },
  image: { icon: "🖼", label: "Foto", make: () => ({ src: "", caption: "Pie de foto", w: 80, r: 14 }) },
  button: { icon: "🔗", label: "Botón / enlace", make: () => ({ text: "Toca aquí", href: "", bg: "" }) },
  divider: { icon: "✦", label: "Separador", make: () => ({ text: "✦" }) },
  spacer: { icon: "↕", label: "Espacio", make: () => ({ h: 60 }) },
};

const FONTS = {
  serif: '"Cormorant Garamond", Georgia, serif',
  sans: '"Manrope", system-ui, sans-serif',
  mono: 'ui-monospace, "SFMono-Regular", Consolas, monospace',
};

const el = (tag, className, text) => {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
};

export const newId = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------- Ranuras ---------- */

export function sectionsOf(root = document.querySelector("[data-ed-root]")) {
  if (!root) return [];
  return [...root.children]
    .filter((n) => (n.tagName === "SECTION" || n.tagName === "HEADER") && !n.classList.contains("ari-slot"))
    .map((node) => ({ id: node.id || "inicio", node }));
}

function buildSlots() {
  const slots = new Map();
  for (const { id, node } of sectionsOf()) {
    node.dataset.edSlotOf = id;
    let slot = node.nextElementSibling;
    if (!slot?.classList.contains("ari-slot")) {
      slot = el("div", "ari-slot");
      node.after(slot);
    }
    slot.dataset.slot = id;
    slots.set(id, slot);
  }
  return slots;
}

/* ---------- Bloques ---------- */

export function renderBlock(b, i) {
  const wrap = el("div", `ari-block ari-${b.type}`);
  wrap.dataset.block = b.id;
  const text = (tag) => {
    const n = el(tag, "ari-t", b.text ?? "");
    n.dataset.ed = `blocks.${i}.text`;
    return n;
  };

  switch (b.type) {
    case "heading":
      wrap.append(text("h2"));
      break;
    case "text":
      wrap.append(text("p"));
      break;
    case "quote":
      wrap.append(text("blockquote"));
      break;
    case "emoji":
      wrap.append(text("div"));
      break;
    case "divider":
      wrap.append(text("div"));
      break;
    case "spacer":
      wrap.style.height = `${Number(b.h) || 60}px`;
      wrap.style.padding = "0";
      break;
    case "button": {
      const a = text("a");
      a.classList.add("ari-btn");
      if (b.href) {
        a.href = b.href;
        if (/^https?:/i.test(b.href)) (a.target = "_blank"), (a.rel = "noopener noreferrer");
      }
      if (b.bg) a.style.background = b.bg;
      wrap.append(a);
      break;
    }
    case "image": {
      const fig = el("figure", "ari-figure");
      fig.style.width = `${Number(b.w) || 80}%`;
      let media;
      if (b.src) {
        media = el("img");
        media.alt = b.caption || "";
        media.loading = "lazy";
        resolveMedia(b.src).then((url) => url && (media.src = url));
        media.style.borderRadius = `${Number(b.r) || 0}px`;
      } else {
        media = el("div", "ari-ph", "Toca para elegir una foto");
        media.style.borderRadius = `${Number(b.r) || 0}px`;
      }
      media.dataset.edImg = `blocks.${i}.src`;
      const cap = el("figcaption", "ari-t", b.caption ?? "");
      cap.dataset.ed = `blocks.${i}.caption`;
      fig.append(media, cap);
      wrap.append(fig);
      break;
    }
  }
  return wrap;
}

/* ---------- Estilos ---------- */

const STYLE_PROPS = ["color", "zoom", "fontWeight", "fontStyle", "textAlign", "fontFamily", "marginTop", "marginBottom", "display"];

export function applyStyleTo(node, st = {}) {
  STYLE_PROPS.forEach((p) => (node.style[p] = ""));
  if (st.color) node.style.color = st.color;
  if (st.scale && Number(st.scale) !== 1) {
    node.style.zoom = String(st.scale);
    if (getComputedStyle(node).display === "inline") node.style.display = "inline-block";
  }
  if (st.bold != null) node.style.fontWeight = st.bold ? "700" : "400";
  if (st.italic != null) node.style.fontStyle = st.italic ? "italic" : "normal";
  if (st.align) node.style.textAlign = st.align;
  if (st.font && FONTS[st.font]) node.style.fontFamily = FONTS[st.font];
  if (st.mt != null && st.mt !== "") node.style.marginTop = `${st.mt}px`;
  if (st.mb != null && st.mb !== "") node.style.marginBottom = `${st.mb}px`;
}

export function nodesForKey(key) {
  return key.startsWith("block:")
    ? [...document.querySelectorAll(`.ari-block[data-block="${key.slice(6)}"]`)]
    : [...document.querySelectorAll(`[data-ed="${key}"]`)];
}

export function applyStyleKey(key, st) {
  nodesForKey(key).forEach((n) => applyStyleTo(n, st));
}

// En el modo edición las secciones ocultas se ven atenuadas (para poder volver a mostrarlas).
export function applyHidden(hidden = {}, editing = editMode()) {
  for (const { id, node } of sectionsOf()) {
    const off = !!hidden[id];
    node.style.display = off && !editing ? "none" : "";
    node.classList.toggle("ed-hidden", off && editing);
  }
}

/* ---------- Pintar todo ---------- */

function injectCss() {
  if (document.querySelector('link[data-blocks-css]')) return;
  const link = el("link");
  link.rel = "stylesheet";
  link.href = "css/blocks.css";
  link.dataset.blocksCss = "";
  document.head.append(link);
}

export async function decorate(page, content) {
  content ??= await getContent(page);
  injectCss();

  // Estilos de textos que ya existen en la página.
  for (const [key, st] of Object.entries(content.styles || {})) applyStyleKey(key, st);
  applyHidden(content.hidden);

  const slots = buildSlots();
  if (!slots.size) return;
  const order = [...slots.keys()];
  (content.blocks || []).forEach((b, i) => {
    const slot = slots.get(b.slot) || slots.get(order[order.length - 1]);
    const node = renderBlock(b, i);
    slot.append(node);
    if (content.styles?.[`block:${b.id}`]) applyStyleTo(node, content.styles[`block:${b.id}`]);
  });
}
