// Modo edición temporal: se activa con ?editar en la URL.
// Para quitarlo: borrar este archivo, css/editor.css y las líneas marcadas "modo edición" en main.js.

const REPO = "xPixelIvanx/ARI";
const DEFAULT_BRANCH = "claude/novia-firebase-github-setup-osl50n";
const KEYS = { draft: "ari-editor-draft", prefs: "ari-editor-prefs", scroll: "ari-editor-scroll" };

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

/* ---------- Archivos del borrador (IndexedDB) ---------- */

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("ari-editor", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("files", mode);
    const req = fn(t.objectStore("files"));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const files = {
  get: (id) => tx("readonly", (s) => s.get(id)),
  put: (id, rec) => tx("readwrite", (s) => s.put(rec, id)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
  clear: () => tx("readwrite", (s) => s.clear()),
};

const isLocal = (src) => typeof src === "string" && src.startsWith("idb:");
const urls = new Map();

async function urlFor(src) {
  if (urls.has(src)) return urls.get(src);
  if (!isLocal(src)) return src;
  const rec = await files.get(src).catch(() => null);
  const url = rec ? URL.createObjectURL(rec.blob) : "";
  urls.set(src, url);
  return url;
}

async function saveLocal(blob, ext) {
  const id = `idb:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  await files.put(id, { blob, ext });
  return id;
}

function dropLocal(id) {
  if (!isLocal(id)) return;
  files.del(id).catch(() => {});
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
const prefs = { skipIntro: true, branch: DEFAULT_BRANCH, token: "", ...store.get(KEYS.prefs, {}) };
const savePrefs = () => store.set(KEYS.prefs, prefs);

export async function loadDraft(base) {
  draft = { ...structuredClone(base), ...store.get(KEYS.draft, {}) };
  const view = structuredClone(draft);
  await Promise.all([
    ...view.memories.map(async (m) => (m.src = await urlFor(m.src))),
    urlFor(view.music.src).then((u) => (view.music.src = u)),
  ]);
  return view;
}

let saveTimer = 0;
function saveNow() {
  clearTimeout(saveTimer);
  if (!store.set(KEYS.draft, draft)) status("No se pudo guardar el borrador en este dispositivo.", "error");
}
function changed() {
  status("Cambios sin previsualizar");
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

/* ---------- Secciones ---------- */

function photoItem(m) {
  const thumb = h("div", { class: "ed-thumb" });
  const showThumb = async () => {
    thumb.style.aspectRatio = m.ratio || "4/5";
    const url = await urlFor(m.src);
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

function musicSection() {
  const info = h("span", { class: "ed-help" });
  const describe = () =>
    (info.textContent = isLocal(draft.music.src)
      ? "Canción nueva lista para publicar."
      : `Archivo actual: ${draft.music.src || "ninguno"}`);
  describe();

  const input = h("input", { type: "file", accept: "audio/*", class: "ed-file" });
  input.addEventListener("change", async () => {
    const file = input.files[0];
    input.value = "";
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      status("Esa canción pesa más de 20 MB; usa una versión más ligera.", "error");
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

function publishSection() {
  const token = h("input", { type: "password", autocomplete: "off", spellcheck: "false", placeholder: "github_pat_…" });
  token.value = prefs.token;
  token.addEventListener("input", () => {
    prefs.token = token.value.trim();
    savePrefs();
  });

  const branch = h("input", { type: "text", autocomplete: "off", spellcheck: "false" });
  branch.value = prefs.branch;
  branch.addEventListener("input", () => {
    prefs.branch = branch.value.trim();
    savePrefs();
  });

  const skip = h("input", { type: "checkbox" });
  skip.checked = prefs.skipIntro;
  skip.addEventListener("change", () => {
    prefs.skipIntro = skip.checked;
    savePrefs();
  });

  return h(
    "details",
    { class: "ed-section", id: "ed-publish" },
    h("summary", {}, "Publicar y ajustes"),
    h(
      "div",
      { class: "ed-section__body" },
      h(
        "p",
        { class: "ed-help" },
        "Para publicar necesitas un token de GitHub (solo una vez): en GitHub ve a Settings → Developer settings → Fine-grained tokens → Generate new token. En “Repository access” elige solo ARI y en “Permissions → Contents” pon “Read and write”. Cópialo y pégalo aquí. Se guarda solo en este dispositivo."
      ),
      h("a", { class: "ed-link", href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener" }, "Crear token en GitHub ↗"),
      h("label", { class: "ed-field" }, h("span", { class: "ed-label" }, "Token de GitHub"), token),
      h("label", { class: "ed-field" }, h("span", { class: "ed-label" }, "Rama"), branch, h("span", { class: "ed-help" }, "La rama que Vercel publica.")),
      h("label", { class: "ed-check" }, skip, h("span", {}, "Saltar la intro al previsualizar")),
      h(
        "button",
        {
          type: "button",
          class: "ed-btn ed-btn--danger ed-btn--sm",
          onclick: async () => {
            if (!confirm("¿Descartar todos los cambios que no has publicado?")) return;
            store.del(KEYS.draft);
            await files.clear().catch(() => {});
            location.reload();
          },
        },
        "Descartar borrador"
      )
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
      h("label", { class: "ed-field" }, h("span", { class: "ed-label" }, "Juntos desde"), datetime, h("span", { class: "ed-help" }, "Fecha y hora desde la que cuenta el contador."))
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
    publishSection(),
  ];
}

/* ---------- Publicar en GitHub ---------- */

function github(token) {
  return async (path, { method = "GET", body, allow404 = false } = {}) => {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
        method,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error("No hay conexión con GitHub. Revisa tu internet.");
    }
    if (res.status === 404 && allow404) return null;
    if (res.status === 401) throw new Error("El token no es válido o ya expiró.");
    if (res.status === 403 || res.status === 404)
      throw new Error("El token no tiene permiso de escritura en ARI, o la rama no existe.");
    if (!res.ok) throw new Error(`GitHub respondió con un error (${res.status}). Intenta de nuevo.`);
    return res.json();
  };
}

const toConfigSource = (cfg) =>
  `// Todo el contenido de la página vive aquí. Editado con el modo edición (?editar).\n\nexport default ${JSON.stringify(cfg, null, 2)};\n`;

async function publish(buttons, rebuild) {
  if (!prefs.token) {
    document.getElementById("ed-publish").open = true;
    status("Primero pega tu token de GitHub en “Publicar y ajustes”.", "error");
    return;
  }
  if (!confirm("¿Publicar los cambios? La página en línea se actualizará en un minuto más o menos.")) return;

  saveNow();
  buttons.forEach((b) => (b.disabled = true));
  const branch = (prefs.branch || DEFAULT_BRANCH).split("/").map(encodeURIComponent).join("/");
  const api = github(prefs.token);

  try {
    status("Conectando con GitHub…");
    const head = (await api(`/git/ref/heads/${branch}`)).object.sha;
    const baseTree = (await api(`/git/commits/${head}`)).tree.sha;

    const out = structuredClone(draft);
    const stamp = Date.now().toString(36);
    const jobs = [];
    out.memories.forEach((m, i) => {
      if (isLocal(m.src)) jobs.push({ obj: m, id: m.src, path: (ext) => `assets/fotos/${stamp}-${i + 1}.${ext}` });
    });
    if (isLocal(out.music.src)) jobs.push({ obj: out.music, id: out.music.src, path: (ext) => `assets/musica.${ext}` });

    const tree = [];
    for (const [n, job] of jobs.entries()) {
      status(`Subiendo archivos… ${n + 1} de ${jobs.length}`);
      const rec = await files.get(job.id);
      if (!rec) throw new Error("Falta un archivo del borrador; vuelve a elegirlo.");
      const blob = await api("/git/blobs", { method: "POST", body: { content: await toBase64(rec.blob), encoding: "base64" } });
      job.obj.src = job.path(rec.ext);
      tree.push({ path: job.obj.src, mode: "100644", type: "blob", sha: blob.sha });
    }

    const used = new Set(out.memories.map((m) => m.src));
    const existing = (await api(`/contents/assets/fotos?ref=${branch}`, { allow404: true })) || [];
    for (const f of existing) {
      if (f.type === "file" && !f.name.startsWith(".") && !used.has(f.path))
        tree.push({ path: f.path, mode: "100644", type: "blob", sha: null });
    }

    tree.push({ path: "js/config.js", mode: "100644", type: "blob", content: toConfigSource(out) });

    status("Guardando cambios…");
    const newTree = await api("/git/trees", { method: "POST", body: { base_tree: baseTree, tree } });
    const commit = await api("/git/commits", {
      method: "POST",
      body: { message: "Actualizar contenido desde el modo edición", tree: newTree.sha, parents: [head] },
    });
    await api(`/git/refs/heads/${branch}`, { method: "PATCH", body: { sha: commit.sha } });

    for (const job of jobs) {
      if (urls.has(job.id)) urls.set(job.obj.src, urls.get(job.id));
      dropLocal(job.id);
    }
    draft = out;
    saveNow();
    rebuild();
    status("¡Publicado! La página en línea se actualiza en un minuto más o menos.", "ok");
  } catch (err) {
    status(err.message || "Algo salió mal al publicar.", "error");
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

/* ---------- Montaje ---------- */

export function mount({ openGift, lenis }) {
  document.head.append(h("link", { rel: "stylesheet", href: "css/editor.css" }));

  const body = h("div", { class: "ed-body", "data-lenis-prevent": true });
  const rebuild = () => body.replaceChildren(...buildSections());
  rebuild();

  statusEl = h("p", { class: "ed-status", role: "status", "aria-live": "polite" }, "Los cambios se guardan como borrador en este dispositivo.");

  const preview = h("button", { type: "button", class: "ed-btn ed-btn--ghost" }, "Vista previa");
  const publishBtn = h("button", { type: "button", class: "ed-btn" }, "Publicar");
  preview.addEventListener("click", () => {
    saveNow();
    store.set(KEYS.scroll, window.scrollY, sessionStorage);
    location.reload();
  });
  publishBtn.addEventListener("click", () => publish([preview, publishBtn], rebuild));

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
    h("footer", { class: "ed-foot" }, statusEl, h("div", { class: "ed-actions" }, preview, publishBtn))
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
