// Contenido publicado en Firestore + archivos (fotos, portadas, música) guardados en trozos.

const FIRESTORE = "https://firestore.googleapis.com/v1/projects/ariii-c43e3/databases/(default)/documents";
const API_KEY = "AIzaSyC8e2W2bL-a4VtARDVhq0z7HTOVYPabe6A";
export const CONTENT_DOC = "edicion/contenido";

export class NoDatabase extends Error {}

export async function cloud(path, { method = "GET", body, timeout = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(`${FIRESTORE}/${path}?key=${API_KEY}`, {
      method,
      cache: "no-store",
      signal: ctrl.signal,
      headers: body ? { "Content-Type": "application/json" } : {},
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
  if (res.status === 403)
    throw new Error("Firebase no dejó publicar: revisa las reglas de Firestore (el modo de prueba dura 30 días).");
  throw new Error(`Firebase respondió con un error (${res.status}). Intenta de nuevo.`);
}

export const putDoc = (path, fields) => cloud(path, { method: "PATCH", body: { fields } });

export async function fetchPublished(timeout) {
  const doc = await cloud(CONTENT_DOC, { timeout });
  return doc ? JSON.parse(doc.fields.json.stringValue) : null;
}

// Si Firestore no responde a tiempo, la página usa config.js.
export async function loadContent(base, timeout = 4000) {
  try {
    const data = await fetchPublished(timeout);
    if (data) return { ...structuredClone(base), ...data };
  } catch {}
  return base;
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
