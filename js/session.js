// Inicio de sesión con Google (Firebase Auth) + estadísticas de uso en Firestore (usuarios/{uid}).
// Se carga en cada página con <script type="module" src="js/session.js" data-page="...">.
// Rangos (colección roles/{uid}): "admin" puede editar (js/edit.js); cualquier otra cuenta es "viewer" y solo ve.
// El primer admin se define por correo en firestore.rules.

const PAGE = document.currentScript?.dataset.page || document.querySelector('script[src*="session.js"]')?.dataset.page || "index";

// Cómo saber en qué apartado está ella ahora mismo (se evalúa cada segundo).
const SECTIONS = {
  regalo: [["inicio", "header.hero"], ["carta", "#carta"], ["recuerdos", "#recuerdos"], ["canciones", "#canciones"], ["abre_cuando", "#abre-cuando"], ["final", "#final"]],
  proximo: [
    ["inicio", "header.hero"], ["historia", "#historia"], ["antes", "#antes"], ["ensenaste", "#ensenaste"],
    ["planes", "#planes"], ["promesas", "#promesas"], ["futuro", "#futuro"], ["pregunta", "#pregunta"],
  ],
};
const CAROUSEL = ["regalo", "cuenta_regresiva", "proximamente", "wrapped"];

function currentSection() {
  if (PAGE === "index") return CAROUSEL[Number(document.getElementById("scene")?.dataset.front)] ?? null;
  if (document.body.classList.contains("is-locked")) return "intro";
  const mid = innerHeight / 2;
  for (const [id, sel] of SECTIONS[PAGE] || []) {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    if (r && r.top <= mid && r.bottom > mid) return id;
  }
  return null;
}

start();

async function start() {
  const gate = buildGate();
  document.body.append(gate.root);

  let fb;
  try {
    fb = await import("./firebase.js");
  } catch {
    gate.fail("No se pudo conectar. Revisa tu internet y recarga la página.");
    return;
  }

  fb.getRedirectResult(fb.auth).catch((e) => gate.fail(message(e)));

  let started = false;
  fb.onAuthStateChanged(fb.auth, async (user) => {
    if (!user) return gate.ask(() => signIn(fb, gate));
    if (started) return;
    started = true;
    // Cuenta nueva (o sin nombre/foto todavía): se crea su documento y se pide el perfil antes de dejarla pasar.
    const data = await prepareUser(fb, user, gate).catch(() => ({}));
    gate.close();
    track(fb, user).catch(() => {});
    loadRole(fb, user, data).catch(() => {});
  });
}

async function prepareUser(fb, user, gate) {
  const { db, doc, getDoc, setDoc, serverTimestamp } = fb;
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);
  let data = snap.exists() ? snap.data() : null;
  if (!data) {
    data = {
      uid: user.uid,
      nombre: user.displayName || "",
      correo: user.email || "",
      foto: user.photoURL || "",
      creada: serverTimestamp(),
      aperturas: 0,
      segundos: 0,
      sesiones: 0,
      paginas: {},
      apartados: {},
    };
    await setDoc(ref, data);
  }
  if (!data.perfil) {
    const { profileForm, saveProfile } = await import("./profile.js");
    data = await new Promise((resolve) =>
      gate.show(
        profileForm({
          user,
          data,
          title: "¡Bienvenida!",
          text: "Antes de entrar, dinos cómo te llamas y elige tu foto.",
          button: "Entrar",
          onSave: async (perfil) => {
            await saveProfile(fb, user, perfil);
            resolve({ ...data, ...perfil, perfil: true });
          },
        })
      )
    );
  }
  return data;
}

// Averigua el rango de la cuenta (y lo crea la primera vez). Solo "admin" carga el modo edición.
async function loadRole(fb, user, profile = {}) {
  const { db, doc, getDoc, setDoc, serverTimestamp } = fb;
  const ref = doc(db, "roles", user.uid);
  let rol = "viewer";
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) rol = snap.data().rol;
    else {
      // Las reglas solo aceptan "admin" para el correo del dueño; para cualquier otra cuenta se crea como "viewer".
      const base = { correo: user.email || "", creado: serverTimestamp() };
      try {
        await setDoc(ref, { ...base, rol: "admin" });
        rol = "admin";
      } catch {
        await setDoc(ref, { ...base, rol: "viewer" });
      }
    }
  } catch {}
  // Marca solo para mostrar al admin lo que todavía está oculto (la tarjeta del Wrapped); la seguridad real son las reglas.
  let wasAdmin = false;
  try {
    wasAdmin = localStorage.getItem("ari-admin") === "1";
    if (rol === "admin") localStorage.setItem("ari-admin", "1");
    else localStorage.removeItem("ari-admin");
  } catch {}
  if (rol === "admin" && !wasAdmin && PAGE === "index") location.reload();
  window.ARI = { user, rol, page: PAGE, fb, profile };
  document.documentElement.dataset.rol = rol;
  document.dispatchEvent(new CustomEvent("ari:role", { detail: window.ARI }));
  if (PAGE === "index") import("./account.js").then((m) => m.mount(window.ARI)).catch(() => {});
  if (rol === "admin") {
    const edit = await import("./edit.js");
    edit.start({ page: PAGE, getToken: () => user.getIdToken() });
  }
}

async function signIn(fb, gate) {
  const provider = new fb.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await fb.signInWithPopup(fb.auth, provider);
  } catch (e) {
    if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
      return fb.signInWithRedirect(fb.auth, provider);
    }
    gate.fail(message(e));
  }
}

function message(e) {
  switch (e?.code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";
    case "auth/network-request-failed":
      return "Sin conexión. Revisa tu internet e intenta de nuevo.";
    case "auth/unauthorized-domain":
      return "Este dominio no está autorizado en Firebase (Authentication > Settings > Authorized domains).";
    case "auth/operation-not-allowed":
      return "Falta activar Google en Firebase (Authentication > Sign-in method).";
    default:
      return "No se pudo iniciar sesión. Intenta de nuevo.";
  }
}

/* ---------- Pantalla de login ---------- */

function buildGate() {
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    n.className = cls;
    if (text) n.textContent = text;
    return n;
  };
  const root = h("div", "auth");
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "Iniciar sesión");
  const box = h("div", "auth__box");
  box.append(h("div", "auth__spin"));
  root.append(box);

  const api = {
    root,
    ask(onClick) {
      box.replaceChildren();
      root.classList.remove("is-leaving");
      const mono = h("span", "auth__mono", "A");
      mono.setAttribute("aria-hidden", "true");
      const btn = h("button", "auth__btn");
      btn.type = "button";
      btn.innerHTML =
        '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg><span>Continuar con Google</span>';
      const err = h("p", "auth__error");
      err.setAttribute("role", "alert");
      api.err = err;
      api.btn = btn;
      btn.addEventListener("click", () => {
        btn.disabled = true;
        err.textContent = "";
        onClick();
      });
      box.append(mono, h("h1", "auth__title", "Antes de entrar"), h("p", "auth__text", "Inicia sesión con tu cuenta de Google para continuar."), btn, err);
      btn.focus({ preventScroll: true });
    },
    // Reemplaza el contenido de la pantalla (por ejemplo, con el formulario de perfil).
    show(node) {
      box.replaceChildren(node);
      node.querySelector("input[type=text]")?.focus({ preventScroll: true });
    },
    fail(text) {
      if (api.btn) {
        api.btn.disabled = false;
        api.err.textContent = text;
      } else {
        box.replaceChildren(h("p", "auth__text", text));
      }
    },
    close() {
      root.classList.add("is-leaving");
      setTimeout(() => root.remove(), 600);
    },
  };
  return api;
}

/* ---------- Estadísticas ---------- */

async function track(fb, user) {
  const { db, doc, setDoc, increment, serverTimestamp } = fb;
  const ref = doc(db, "usuarios", user.uid);

  // Cada carga de página cuenta como una apertura; la primera de cada pestaña, además, como una sesión.
  let newSession = false;
  try {
    newSession = !sessionStorage.getItem("ari-sesion");
    sessionStorage.setItem("ari-sesion", "1");
  } catch {}
  await setDoc(
    ref,
    {
      aperturas: increment(1),
      ...(newSession ? { sesiones: increment(1) } : {}),
      ultimaVisita: serverTimestamp(),
      paginas: { [PAGE]: { aperturas: increment(1) } },
    },
    { merge: true }
  );

  // Acciones (abrió la carta, sacó un disco…): las páginas avisan con el evento "ari:action".
  const actions = {};
  addEventListener("ari:action", (e) => {
    const name = String(e.detail?.name || "").replace(/[^a-z0-9_]/gi, "");
    if (name) actions[name] = (actions[name] || 0) + 1;
  });

  // Tiempo: un segundo por vez mientras la pestaña está visible; se guarda cada 15 s y al salir.
  const pending = { total: 0, sections: {}, days: {}, hours: {} };
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const now = new Date();
    pending.total++;
    const day = dayKey(now);
    pending.days[day] = (pending.days[day] || 0) + 1;
    const hour = String(now.getHours());
    pending.hours[hour] = (pending.hours[hour] || 0) + 1;
    const s = currentSection();
    if (s) pending.sections[s] = (pending.sections[s] || 0) + 1;
  }, 1000);

  const bump = (obj, prefix = "") => Object.fromEntries(Object.entries(obj).map(([k, n]) => [prefix + k, increment(n)]));

  const flush = () => {
    const names = Object.keys(actions);
    if (!pending.total && !names.length) return;
    const payload = { ultimaVisita: serverTimestamp() };
    if (pending.total) {
      payload.segundos = increment(pending.total);
      payload.paginas = { [PAGE]: { segundos: increment(pending.total) } };
      payload.apartados = bump(pending.sections, `${PAGE}_`);
      payload.dias = bump(pending.days);
      payload.horas = bump(pending.hours);
    }
    if (names.length) payload.acciones = bump(actions);
    pending.total = 0;
    pending.sections = {};
    pending.days = {};
    pending.hours = {};
    for (const k of names) delete actions[k];
    setDoc(ref, payload, { merge: true }).catch(() => {});
  };
  setInterval(flush, 15000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  addEventListener("pagehide", flush);
}
