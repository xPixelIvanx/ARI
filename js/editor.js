// Modo edición temporal: se activa con ?editar en la URL.
// "Publicar" sube el contenido a Firestore y la página normal lo lee al cargar.
// Para quitarlo: borrar este archivo, css/editor.css y las líneas marcadas "modo edición" en main.js.

import { CONTENT_DOC, NoDatabase, aliasMedia, fetchPublished, files, isCloud, isLocal, putDoc, resolveMedia } from "./content.js";

const CONSOLE_URL = "https://console.firebase.google.com/project/ariii-c43e3/firestore";
// Firestore limita cada documento a 1 MiB; los archivos se guardan en trozos.
const CHUNK = 900_000;
const KEYS = { draft: "ari-editor-draft", dirty: "ari-editor-dirty", prefs: "ari-editor-prefs", scroll: "ari-editor-scroll" };

const store = {
  get(key, fallback, area = localStorage) {
    try {
      const v = area.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value, area = localStorage) {
    try {
      area.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key, area = localStorage) {
    try {
      area.removeItem(key);
    } catch {}
  },
};

async function saveLocal(blob, ext) {
  const id = `idb:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await files.put(id, { blob, ext });
  return id;
}

function dropLocal(src) {
  if (isLocal(src)) files.del(src).catch(() => {});
}

async function compress(file, max = 1600) {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.82)
    );
    return { blob, ratio: `${w}/${h}` };
  } finally {
    URL.revokeObjectURL(src);
  }
}

const toBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/* ---------- Borrador ---------- */

let draft;
let loadError = null;
const prefs = { skipIntro: true, ...store.get(KEYS.prefs, {}) };
const savePrefs = () => store.set(KEYS.prefs, prefs);
const isDirty = () => store.get(KEYS.dirty, false);

export async function loadDraft(base) {
  let data = store.get(KEYS.draft, null);
  if (!isDirty()) {
    try {
      const published = await fetchPublished(8000);
      if (published) {
        data = published;
        store.set(KEYS.draft, data);
      }
    } catch (err) {
      loadError = err;
    }
  }
  draft = { ...structuredClone(base), ...(data || {}) };
  return structuredClone(draft);
}

let saveTimer = 0;
function saveNow() {
  clearTimeout(saveTimer);
  if (!store.set(KEYS.draft, draft)) status("No se pudo guardar el borrador en este dispositivo.", "error");
}
function changed() {
  store.set(KEYS.dirty, true);
  status("Tienes cambios sin publicar.");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

/* ---------- UI helpers ---------- */

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

function field(label, get, set, { multiline = false, rows = 3, help, ...attrs } = {}) {
  const input = multiline ? h("textarea", { rows, ...attrs }) : h("input", { type: "text", ...attrs });
  input.value = get() ?? "";
  input.addEventListener("input", () => {
    set(input.value);
    changed();
  });
  return h(
    "label",
    { class: "ed-field" },
    label && h("span", { class: "ed-label" }, label),
    input,
    help && h("span", { class: "ed-help" }, help)
  );
}

function list(arr, renderItem, makeNew, addLabel, onRemove) {
  const wrap = h("div", { class: "ed-list" });
  const move = (i, j) => {
    [arr[i], arr[j]] = [arr[j], arr[i]];
    changed();
    draw();
  };
  const tool = (label, title, disabled, onclick) =>
    h("button", { type: "button", class: "ed-tool", title, "aria-label": title, disabled, onclick }, label);

  function draw() {
    wrap.replaceChildren(
      ...arr.map((item, i) =>
        h(
          "div",
          { class: "ed-item" },
          h(
            "div",
            { class: "ed-item__head" },
            h("span", { class: "ed-item__num" }, String(i + 1)),
            tool("↑", "Subir", i === 0, () => move(i, i - 1)),
            tool("↓", "Bajar", i === arr.length - 1, () => move(i, i + 1)),
            tool("✕", "Quitar", false, () => {
              if (!confirm("¿Quitar este elemento?")) return;
              const [gone] = arr.splice(i, 1);
              onRemove?.(gone);
              changed();
              draw();
            })
          ),
          renderItem(item, (v) => (arr[i] = v))
        )
      ),
      h(
        "button",
        {
          type: "button",
          class: "ed-add",
          onclick: () => {
            arr.push(makeNew());
            changed();
            draw();
          },
        },
        `+ ${addLabel}`
      )
    );
  }
  draw();
  return wrap;
}

const textItem = (rows) => (value, set) => field(null, () => value, set, { multiline: true, rows });

function section(title, ...children) {
  return h("details", { class: "ed-section" }, h("summary", {}, title), h("div", { class: "ed-section__body" }, ...children));
}

let statusEl;
function status(text, kind = "") {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.dataset.kind = kind;
}

const setupBox = h(
  "div",
  { class: "ed-setup", hidden: true },
  h("p", { class: "ed-setup__title" }, "Falta un paso (solo la primera vez)"),
  h(
    "ol",
    {},
    h("li", {}, "Abre Firestore en la consola de Firebase con el botón de abajo."),
    h("li", {}, "Toca “Crear base de datos”."),
    h("li", {}, "Elige “Comenzar en modo de prueba” y cualquier ubicación."),
    h("li", {}, "Vuelve aquí y toca “Publicar”.")
  ),
  h("a", { class: "ed-btn ed-btn--sm", href: CONSOLE_URL, target: "_blank", rel: "noopener" }, "Abrir Firestore ↗")
);

/* ---------- Secciones ---------- */

function photoItem(m) {
  const thumb = h("div", { class: "ed-thumb" });
  const showThumb = async () => {
    thumb.style.aspectRatio = m.ratio || "4/5";
    const url = await resolveMedia(m.src);
    thumb.replaceChildren(url ? h("img", { src: url, alt: "" }) : h("span", {}, "Sin foto"));
  };
  showThumb();

  const pickText = h("span", {}, m.src ? "Cambiar foto" : "Elegir foto");
  const input = h("input", { type: "file", accept: "image/*", class: "ed-file" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    status("Procesando foto…");
    try {
      const { blob, ratio } = await compress(file);
      const id = await saveLocal(blob, "jpg");
      dropLocal(m.src);
      m.src = id;
      m.ratio = ratio;
      pickText.textContent = "Cambiar foto";
      await showThumb();
      changed();
    } catch {
      status("No se pudo leer esa foto. Prueba con otra (JPG o PNG).", "error");
    }
  });

  return h(
    "div",
    { class: "ed-photo" },
    thumb,
    h(
      "div",
      { class: "ed-photo__fields" },
      h("label", { class: "ed-btn ed-btn--ghost ed-btn--sm" }, pickText, input),
      field("Texto", () => m.caption, (v) => (m.caption = v)),
      field("Fecha", () => m.date, (v) => (m.date = v))
    )
  );
}

async function spotifyInfo(link) {
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(link)}`);
  if (!res.ok) throw new Error(String(res.status));
  const data = await res.json();
  // La miniatura de oEmbed es de 300 px; esta variante de la misma portada es de 640 px.
  const cover = (data.thumbnail_url || "").replace("ab67616d00001e02", "ab67616d0000b273");
  return { title: data.title || "", artist: data.author_name || "", cover };
}

function songItem(s) {
  const thumb = h("div", { class: "ed-thumb ed-thumb--square" });
  const showThumb = async () => {
    const url = await resolveMedia(s.cover);
    thumb.replaceChildren(url ? h("img", { src: url, alt: "" }) : h("span", {}, "Sin portada"));
  };
  showThumb();

  const titleField = field("Canción", () => s.title, (v) => (s.title = v));
  const artistField = field("Artista", () => s.artist, (v) => (s.artist = v));

  const link = h("input", { type: "url", inputmode: "url", autocomplete: "off", placeholder: "https://open.spotify.com/track/…" });
  link.value = s.spotify || "";
  let lookup = 0;
  let lastLink = null;
  const fill = async () => {
    const value = link.value.trim();
    if (value === lastLink) return;
    lastLink = value;
    s.spotify = value;
    changed();
    if (!/spotify/i.test(value)) return;
    const n = ++lookup;
    status("Buscando la canción en Spotify…");
    try {
      const info = await spotifyInfo(value);
      if (n !== lookup) return;
      if (info.title) {
        s.title = info.title;
        titleField.querySelector("input").value = info.title;
      }
      if (info.artist) {
        s.artist = info.artist;
        artistField.querySelector("input").value = info.artist;
      }
      if (info.cover) {
        dropLocal(s.cover);
        s.cover = info.cover;
        await showThumb();
      }
      changed();
      status(info.artist ? "Canción encontrada ✓" : "Canción encontrada ✓ Escribe el artista a mano.", "ok");
    } catch {
      if (n !== lookup) return;
      lastLink = null;
      status("No se pudo leer ese link. Llena los datos a mano y sube la portada.", "error");
    }
  };
  link.addEventListener("change", fill);
  link.addEventListener("paste", () => setTimeout(fill, 0));

  const input = h("input", { type: "file", accept: "image/*", class: "ed-file" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    status("Procesando portada…");
    try {
      const { blob } = await compress(file, 800);
      const id = await saveLocal(blob, "jpg");
      dropLocal(s.cover);
      s.cover = id;
      await showThumb();
      changed();
    } catch {
      status("No se pudo leer esa imagen. Prueba con otra (JPG o PNG).", "error");
    }
  });

  return [
    h(
      "label",
      { class: "ed-field" },
      h("span", { class: "ed-label" }, "Link de Spotify"),
      link,
      h("span", { class: "ed-help" }, "En Spotify: ••• → Compartir → Copiar enlace. Se llenan solos el nombre y la portada.")
    ),
    h(
      "div",
      { class: "ed-photo" },
      thumb,
      h(
        "div",
        { class: "ed-photo__fields" },
        titleField,
        artistField,
        h("label", { class: "ed-btn ed-btn--ghost ed-btn--sm" }, "Subir portada", input)
      )
    ),
    field("Frase", () => s.quote, (v) => (s.quote = v), { multiline: true, rows: 3 }),
  ];
}

function musicSection() {
  const info = h("span", { class: "ed-help" });
  const describe = () => {
    const src = draft.music.src;
    info.textContent = isLocal(src)
      ? "Canción nueva (sin publicar todavía)."
      : isCloud(src)
        ? "Canción publicada ✓"
        : `Archivo actual: ${src || "ninguno"}`;
  };
  describe();

  const input = h("input", { type: "file", accept: "audio/*", class: "ed-file" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      status("Esa canción pesa más de 15 MB; usa una versión más ligera.", "error");
      return;
    }
    const ext = (file.name.split(".").pop() || "mp3").toLowerCase().replace(/[^a-z0-9]/g, "") || "mp3";
    try {
      const id = await saveLocal(file, ext);
      dropLocal(draft.music.src);
      draft.music.src = id;
      describe();
      changed();
    } catch {
      status("No se pudo guardar la canción en este dispositivo.", "error");
    }
  });

  const volume = h("input", { type: "range", min: "0", max: "1", step: "0.05" });
  volume.value = draft.music.volume ?? 0.6;
  volume.addEventListener("input", () => {
    draft.music.volume = Number(volume.value);
    changed();
  });

  return section(
    "Música",
    h("label", { class: "ed-btn ed-btn--ghost ed-btn--sm" }, "Elegir canción", input),
    info,
    h("label", { class: "ed-field" }, h("span", { class: "ed-label" }, "Volumen"), volume)
  );
}

function settingsSection() {
  const skip = h("input", { type: "checkbox" });
  skip.checked = prefs.skipIntro;
  skip.addEventListener("change", () => {
    prefs.skipIntro = skip.checked;
    savePrefs();
  });

  return section(
    "Ajustes",
    h("label", { class: "ed-check" }, skip, h("span", {}, "Saltar la intro al previsualizar")),
    h(
      "button",
      {
        type: "button",
        class: "ed-btn ed-btn--danger ed-btn--sm",
        onclick: () => {
          if (!confirm("¿Descartar los cambios que no has publicado?")) return;
          store.del(KEYS.draft);
          store.del(KEYS.dirty);
          location.reload();
        },
      },
      "Descartar cambios sin publicar"
    )
  );
}

function buildSections() {
  const d = draft;
  const datetime = h("input", { type: "datetime-local" });
  datetime.value = (d.startDate || "").slice(0, 16);
  datetime.addEventListener("input", () => {
    if (!datetime.value) return;
    d.startDate = `${datetime.value.slice(0, 16)}:00`;
    changed();
  });

  return [
    section(
      "Nombres",
      field("Su nombre", () => d.herName, (v) => (d.herName = v)),
      field("Inicial del sello", () => d.monogram, (v) => (d.monogram = v), { maxlength: "2" }),
      field("Tu nombre", () => d.fromName, (v) => (d.fromName = v))
    ),
    section(
      "Contador",
      h(
        "label",
        { class: "ed-field" },
        h("span", { class: "ed-label" }, "Juntos desde"),
        datetime,
        h("span", { class: "ed-help" }, "Fecha y hora desde la que cuenta el contador.")
      )
    ),
    section(
      "Intro e inicio",
      h("span", { class: "ed-label" }, "Frases de la intro"),
      list(d.introLines, textItem(2), () => "", "Agregar frase"),
      field("Frase bajo su nombre", () => d.heroSubtitle, (v) => (d.heroSubtitle = v), { multiline: true, rows: 2 })
    ),
    section(
      "Carta",
      field("Encabezado pequeño", () => d.letter.date, (v) => (d.letter.date = v)),
      field("Saludo", () => d.letter.greeting, (v) => (d.letter.greeting = v)),
      h("span", { class: "ed-label" }, "Párrafos"),
      list(d.letter.paragraphs, textItem(5), () => "", "Agregar párrafo"),
      field("Firma", () => d.letter.signature, (v) => (d.letter.signature = v))
    ),
    section(
      "Fotos",
      h("p", { class: "ed-help" }, "Las fotos se achican automáticamente para que la página cargue rápido."),
      list(d.memories, photoItem, () => ({ src: "", caption: "", date: "", ratio: "4/5" }), "Agregar foto", (m) => dropLocal(m.src))
    ),
    section(
      "Canciones",
      h("p", { class: "ed-help" }, "Pega el link de la canción y escribe la frase que te recuerda a ella. En la página no suena; solo se ve el disco."),
      list(
        d.songs,
        songItem,
        () => ({ spotify: "", cover: "", title: "", artist: "", quote: "" }),
        "Agregar canción",
        (s) => dropLocal(s.cover)
      )
    ),
    section(
      "Abre cuando…",
      list(
        d.openWhen,
        (c) => [
          field("Abre cuando…", () => c.title, (v) => (c.title = v)),
          field("Mensaje", () => c.message, (v) => (c.message = v), { multiline: true, rows: 4 }),
        ],
        () => ({ title: "", message: "" }),
        "Agregar tarjeta"
      )
    ),
    section(
      "Sorpresa final",
      field("Título", () => d.final.title, (v) => (d.final.title = v)),
      field("Texto del botón", () => d.final.button, (v) => (d.final.button = v)),
      h("span", { class: "ed-label" }, "Frases al presionarlo"),
      list(d.final.lines, textItem(2), () => "", "Agregar frase")
    ),
    section("Secreto (✦)", field(null, () => d.secret, (v) => (d.secret = v), { multiline: true, rows: 4 })),
    musicSection(),
    settingsSection(),
  ];
}

/* ---------- Publicar en Firebase ---------- */

async function publish(buttons, rebuild) {
  if (!confirm("¿Publicar los cambios? Se verán de inmediato en la página normal.")) return;
  saveNow();
  buttons.forEach((b) => (b.disabled = true));
  try {
    const out = structuredClone(draft);
    const pending = [
      ...out.memories.map((o) => [o, "src"]),
      ...out.songs.map((o) => [o, "cover"]),
      [out.music, "src"],
    ].filter(([o, key]) => isLocal(o[key]));
    const uploaded = [];

    for (const [k, [o, key]] of pending.entries()) {
      status(`Subiendo archivos… ${k + 1} de ${pending.length}`);
      const local = o[key];
      const rec = await files.get(local);
      if (!rec) throw new Error("Falta un archivo; vuelve a elegirlo.");
      const b64 = await toBase64(rec.blob);
      const id = local.slice(4);
      const n = Math.max(1, Math.ceil(b64.length / CHUNK));
      for (let i = 0; i < n; i++) {
        await putDoc(`archivos/${id}-${i}`, { data: { stringValue: b64.slice(i * CHUNK, (i + 1) * CHUNK) } });
      }
      const cloudSrc = `fb:${id}:${n}:${rec.ext}`;
      await files.put(cloudSrc, rec);
      aliasMedia(local, cloudSrc);
      uploaded.push(local);
      o[key] = cloudSrc;
    }

    status("Publicando…");
    await putDoc(CONTENT_DOC, {
      json: { stringValue: JSON.stringify(out) },
      actualizado: { timestampValue: new Date().toISOString() },
    });

    uploaded.forEach(dropLocal);
    draft = out;
    saveNow();
    store.set(KEYS.dirty, false);
    setupBox.hidden = true;
    rebuild();
    status("¡Publicado! ✓ Ya se ve en la página normal.", "ok");
  } catch (err) {
    if (err instanceof NoDatabase) {
      setupBox.hidden = false;
      setupBox.scrollIntoView({ block: "nearest" });
      status("Todavía no se puede publicar: falta crear la base de datos (mira arriba).", "error");
    } else {
      status(err.message || "Algo salió mal al publicar.", "error");
    }
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

/* ---------- Montaje ---------- */

export function mount({ openGift, lenis }) {
  document.head.append(h("link", { rel: "stylesheet", href: "css/editor.css" }));

  const sections = h("div", { class: "ed-sections" });
  const rebuild = () => sections.replaceChildren(...buildSections());
  rebuild();
  const body = h("div", { class: "ed-body", "data-lenis-prevent": true }, setupBox, sections);

  statusEl = h("p", { class: "ed-status", role: "status", "aria-live": "polite" });
  if (loadError instanceof NoDatabase) {
    setupBox.hidden = false;
    status("Puedes editar y previsualizar; para publicar falta un paso (arriba).");
  } else if (loadError) {
    status("No se pudo cargar lo publicado; estás viendo el borrador de este dispositivo.", "error");
  } else {
    status(isDirty() ? "Tienes cambios sin publicar." : "Todo publicado.");
  }

  const preview = h("button", { type: "button", class: "ed-btn ed-btn--ghost" }, "Vista previa");
  const publishBtn = h("button", { type: "button", class: "ed-btn" }, "Publicar");
  preview.addEventListener("click", () => {
    saveNow();
    store.set(KEYS.scroll, window.scrollY, sessionStorage);
    location.reload();
  });
  publishBtn.addEventListener("click", () => publish([preview, publishBtn], rebuild));

  const live = h(
    "a",
    { class: "ed-live", href: location.pathname, target: "_blank", rel: "noopener" },
    "Ver la página como la ve ella ↗"
  );

  const panel = h(
    "aside",
    { class: "ed-panel", "aria-label": "Modo edición", hidden: true },
    h(
      "header",
      { class: "ed-head" },
      h("div", {}, h("p", { class: "ed-kicker" }, "Modo edición"), h("p", { class: "ed-title" }, "Solo tú ves esto")),
      h("button", { type: "button", class: "ed-close", "aria-label": "Cerrar", onclick: () => toggle(false) }, "✕")
    ),
    body,
    h("footer", { class: "ed-foot" }, statusEl, h("div", { class: "ed-actions" }, preview, publishBtn), live)
  );

  const fab = h("button", { type: "button", class: "ed-fab", onclick: () => toggle(true) }, "✎ Editar");

  function toggle(open) {
    panel.hidden = !open;
    fab.hidden = open;
    document.documentElement.classList.toggle("ed-open", open);
  }

  document.body.append(fab, panel);

  if (prefs.skipIntro) {
    document.getElementById("gate")?.remove();
    openGift();
    const y = store.get(KEYS.scroll, 0, sessionStorage);
    store.del(KEYS.scroll, sessionStorage);
    if (y) {
      requestAnimationFrame(() => (lenis ? lenis.scrollTo(y, { immediate: true, force: true }) : window.scrollTo(0, y)));
    }
  }
}
