// Contenido publicado en Firestore + archivos (fotos, portadas, música) guardados en trozos.

const FIRESTORE = "https://firestore.googleapis.com/v1/projects/ariii-c43e3/databases/(default)/documents";
const API_KEY = "AIzaSyC8e2W2bL-a4VtARDVhq0z7HTOVYPabe6A";
export const CONTENT_DOC = "edicion/contenido";

export class NoDatabase extends Error {}

export async function cloud(path, { method = "GET", body, timeout = 30000, token } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    const headers = body ? { "Content-Type": "application/json" } : {};
    if (token) headers.Authorization = `Bearer ${token}`;
    res = await fetch(`${FIRESTORE}/${path}?key=${API_KEY}`, {
      method,
      cache: "no-store",
      signal: ctrl.signal,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("No hay conexión con Firebase. Revisa tu internet.");
  } finally {
    clearTimeout(timer);
  }
  if (res.ok) return res.json();
  const msg = (await res.json().catch(() => ({})))?.error?.message || "";
  if (res.status === 404 && /database .* does not exist/i.test(msg)) throw new NoDatabase();
  if (res.status === 404) return null;
  if (res.status === 403 || res.status === 401)
    throw new Error("Firebase no te dejó guardar: solo la cuenta admin puede publicar (revisa las reglas de Firestore).");
  throw new Error(`Firebase respondió con un error (${res.status}). Intenta de nuevo.`);
}

export const putDoc = (path, fields, token) => cloud(path, { method: "PATCH", body: { fields }, token });

/* ---------- Contenido por página ---------- */
// Cada página (regalo, proximo, index, …) tiene su documento en Firestore: edicion/<página>.
// "regalo" conserva el documento de siempre (edicion/contenido).

export const docFor = (page) => (page === "regalo" ? CONTENT_DOC : `edicion/${page}`);

export async function fetchPublished(timeout, page = "regalo") {
  const doc = await cloud(docFor(page), { timeout });
  return doc ? JSON.parse(doc.fields.json.stringValue) : null;
}

// Modo edición: solo lo activa la cuenta admin (js/edit.js). Guarda un borrador por página en este dispositivo.
const ls = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
};
export const editMode = () => ls.get("ari-edit-mode") === "1";
export const setEditMode = (on) => ls.set("ari-edit-mode", on ? "1" : null);
export const draftStore = {
  load: (page) => {
    try {
      return JSON.parse(ls.get(`ari-draft-${page}`));
    } catch {
      return null;
    }
  },
  save: (page, data, dirty) => ls.set(`ari-draft-${page}`, JSON.stringify(data)) && ls.set(`ari-dirty-${page}`, dirty ? "1" : null),
  isDirty: (page) => ls.get(`ari-dirty-${page}`) === "1",
  clear: (page) => (ls.set(`ari-draft-${page}`, null), ls.set(`ari-dirty-${page}`, null)),
};

const loaded = new Map();

// Devuelve lo publicado (o el borrador sin publicar si estás editando); si Firestore no responde a tiempo, usa `base`.
// El resultado se comparte con js/edit.js (misma promesa por página).
export function loadContent(base, page = "regalo", timeout = 4000) {
  if (!loaded.has(page)) {
    loaded.set(
      page,
      (async () => {
        const merge = (data) => ({ ...structuredClone(base), ...(data || {}) });
        if (editMode() && draftStore.isDirty(page)) {
          const local = draftStore.load(page);
          if (local) return merge(local);
        }
        try {
          const data = await fetchPublished(editMode() ? 8000 : timeout, page);
          if (data) return merge(data);
        } catch {}
        return merge(editMode() ? draftStore.load(page) : null);
      })()
    );
  }
  return loaded.get(page);
}

export const getContent = (page) => loadContent({}, page);

/* ---------- Rutas ("memories.0.caption") ---------- */

export const getAt = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

export function setAt(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  let o = obj;
  keys.forEach((k, i) => {
    if (o[k] == null || typeof o[k] !== "object") o[k] = /^\d+$/.test(keys[i + 1] ?? last) ? [] : {};
    o = o[k];
  });
  o[last] = value;
}

// Textos/imágenes que están escritos a mano en el HTML: se reemplazan con lo publicado (data-ed / data-ed-img).
export function applyStatic(content, root = document) {
  root.querySelectorAll("[data-ed]").forEach((n) => {
    if (n.dataset.edDef === undefined) n.dataset.edDef = n.textContent;
    const v = getAt(content, n.dataset.ed);
    if (typeof v === "string") n.textContent = v;
  });
  root.querySelectorAll("img[data-ed-img]").forEach((n) => {
    const v = getAt(content, n.dataset.edImg);
    if (typeof v === "string" && v) resolveMedia(v).then((url) => url && (n.src = url));
  });
}

// Cada página avisa cuando ya pintó todo, para que el editor sepa que puede preparar los elementos.
export function markRendered() {
  window.__ariRendered = true;
  document.dispatchEvent(new Event("ari:rendered"));
}

/* ---------- Archivos ---------- */

let dbPromise;
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("ari-editor", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("blocked"));
    setTimeout(() => reject(new Error("timeout")), 3000);
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

export const files = {
  get: (id) => tx("readonly", (s) => s.get(id)),
  put: (id, rec) => tx("readwrite", (s) => s.put(rec, id)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
};

// "idb:<id>" = archivo que solo está en este dispositivo (sin publicar);
// "fb:<id>:<trozos>:<ext>" = archivo publicado en Firestore.
export const isLocal = (src) => typeof src === "string" && src.startsWith("idb:");
export const isCloud = (src) => typeof src === "string" && src.startsWith("fb:");

const mimeFor = (ext) => (ext === "jpg" ? "image/jpeg" : ext === "mp3" ? "audio/mpeg" : `audio/${ext}`);

async function download(src) {
  const [, id, n, ext] = src.split(":");
  const parts = await Promise.all(Array.from({ length: Number(n) }, (_, i) => cloud(`archivos/${id}-${i}`)));
  if (parts.some((p) => !p)) throw new Error("missing");
  const b64 = parts.map((p) => p.fields.data.stringValue).join("");
  const blob = await (await fetch(`data:${mimeFor(ext)};base64,${b64}`)).blob();
  return { blob, ext };
}

const urls = new Map();

export function resolveMedia(src) {
  if (!src) return Promise.resolve("");
  if (!isLocal(src) && !isCloud(src)) return Promise.resolve(src);
  if (!urls.has(src)) {
    urls.set(
      src,
      (async () => {
        let rec = await files.get(src).catch(() => null);
        if (!rec && isCloud(src)) {
          rec = await download(src).catch(() => null);
          if (rec) files.put(src, rec).catch(() => {});
        }
        return rec ? URL.createObjectURL(rec.blob) : "";
      })()
    );
  }
  return urls.get(src);
}

export function aliasMedia(from, to) {
  if (urls.has(from)) urls.set(to, urls.get(from));
}
