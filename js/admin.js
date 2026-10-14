// Panel de estadísticas (solo admin): quién entró, cuánto tiempo pasó y qué hizo. Datos en vivo desde usuarios/{uid}.
// Las reglas de Firestore también lo protegen: solo el admin puede leer los documentos de otras cuentas.

import { ACTION_NAMES, PAGE_NAMES, ago, avatarEl, awards, derived, entries, fmtDate, fmtDuration, hourLabel, sectionName } from "./stats-lib.js";

const app = document.getElementById("app");

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const append = (parent, ...kids) => (parent.append(...kids.flat().filter(Boolean)), parent);

let state = { users: [], roles: {}, fb: null };

/* ---------- Pantallas ---------- */

function message(title, text, link = true) {
  const box = h("section", "adm__empty");
  append(box, h("h1", "adm__title", title), h("p", "adm__muted", text), link && Object.assign(h("a", "adm__btn", "Volver"), { href: "index.html" }));
  app.replaceChildren(box);
}

function bars(rows, { max, format = fmtDuration } = {}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const list = h("ul", "bars");
  rows.forEach((r) => {
    const li = h("li", "bars__row");
    const fill = h("span", "bars__fill");
    fill.style.width = `${Math.max(2, (r.value / top) * 100)}%`;
    append(li, h("span", "bars__label", r.label), append(h("span", "bars__track"), fill), h("span", "bars__value", format(r.value)));
    list.append(li);
  });
  return list;
}

function columns(items, { label = (x) => x.label, tip = (x) => `${x.label}: ${fmtDuration(x.value)}` } = {}) {
  const top = Math.max(1, ...items.map((i) => i.value));
  const wrap = h("div", "cols");
  items.forEach((it) => {
    const c = h("span", "cols__bar");
    c.style.height = `${it.value ? Math.max(6, (it.value / top) * 100) : 0}%`;
    c.title = tip(it);
    const slot = h("span", "cols__slot");
    slot.append(c);
    const wrapCol = h("span", "cols__col");
    append(wrapCol, slot, h("span", "cols__label", label(it)));
    wrap.append(wrapCol);
  });
  return wrap;
}

function kpi(value, label) {
  return append(h("div", "kpi"), h("strong", "kpi__value", value), h("span", "kpi__label", label));
}

function userRow(u) {
  const d = derived(u);
  const rol = state.roles[u.id]?.rol || "viewer";
  const a = h("a", "urow");
  a.href = `#${u.id}`;
  append(
    a,
    avatarEl(u, 46),
    append(h("span", "urow__main"), h("strong", null, u.nombre || u.correo || "Sin nombre"), h("small", null, `${u.correo || ""}`)),
    append(h("span", "urow__stats"), h("b", null, fmtDuration(d.total)), h("small", null, `${d.aperturas} aperturas · ${ago(u.ultimaVisita)}`)),
    rol === "admin" && h("span", "badge", "admin")
  );
  return a;
}

function overview() {
  const users = [...state.users].sort((a, b) => (b.segundos || 0) - (a.segundos || 0));
  const total = users.reduce((n, u) => n + (u.segundos || 0), 0);
  const opens = users.reduce((n, u) => n + (u.aperturas || 0), 0);
  const view = h("section");
  append(
    view,
    h("h2", "adm__sub", "Resumen"),
    append(h("div", "kpis"), kpi(String(users.length), users.length === 1 ? "cuenta" : "cuentas"), kpi(fmtDuration(total), "tiempo total"), kpi(String(opens), "aperturas"), kpi(users[0] ? ago(users.map((u) => u.ultimaVisita?.toMillis?.() ?? 0).sort((a, b) => b - a)[0]) : "—", "última visita")),
    h("h2", "adm__sub", "Cuentas"),
    users.length ? append(h("div", "ulist"), users.map(userRow)) : h("p", "adm__muted", "Todavía nadie ha iniciado sesión.")
  );
  return view;
}

function detail(u) {
  const x = derived(u);
  const rol = state.roles[u.id]?.rol || "viewer";
  const view = h("section");

  // Cabecera de la persona
  const head = h("div", "dhead");
  append(
    head,
    avatarEl(u, 72),
    append(h("div", "dhead__main"), h("h1", "adm__title", u.nombre || "Sin nombre"), h("p", "adm__muted", u.correo || ""), h("p", "adm__muted", `Se unió el ${fmtDate(u.creada)} · última visita ${ago(u.ultimaVisita)}`))
  );

  // Rol
  const select = h("select", "adm__select");
  [["viewer", "Visualizador (solo ve)"], ["admin", "Admin (puede editar)"]].forEach(([v, t]) => select.append(Object.assign(h("option", null, t), { value: v })));
  select.value = rol;
  select.addEventListener("change", async () => {
    const { db, doc, setDoc } = state.fb;
    select.disabled = true;
    try {
      await setDoc(doc(db, "roles", u.id), { rol: select.value }, { merge: true });
    } catch {
      alert("No se pudo cambiar el rango.");
      select.value = rol;
    }
    select.disabled = false;
  });
  const actions = append(h("div", "dactions"), Object.assign(h("a", "adm__btn", "🎁 Ver su Wrapped"), { href: `wrapped.html?uid=${u.id}` }), append(h("label", "adm__field"), h("span", "adm__muted", "Rango"), select));

  const kpis = append(
    h("div", "kpis"),
    kpi(fmtDuration(x.total), "tiempo total"),
    kpi(String(x.aperturas), "aperturas"),
    kpi(String(x.sesiones || "—"), "sesiones"),
    kpi(x.sesiones ? fmtDuration(x.promedioSesion) : "—", "promedio por sesión"),
    kpi(String(x.diasActivos || "—"), "días activos"),
    kpi(hourLabel(x.horaFavorita), "hora favorita")
  );

  // Últimos 30 días
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    days.push({ label: String(d.getDate()), value: u.dias?.[key] || 0, key });
  }
  const hours = Array.from({ length: 24 }, (_, i) => ({ label: i % 3 === 0 ? String(i) : "", value: u.horas?.[i] || 0, hour: i }));

  const card = (title, ...kids) => append(h("section", "dcard"), h("h3", "dcard__title", title), kids);

  append(
    view,
    head,
    actions,
    kpis,
    card("Por página", x.topPaginas.length ? bars(x.topPaginas.map(([k, v]) => ({ label: PAGE_NAMES[k] || k, value: v }))) : h("p", "adm__muted", "Sin datos todavía.")),
    card("Dónde pasa más tiempo", x.topApartados.length ? bars(x.topApartados.slice(0, 10).map(([k, v]) => ({ label: sectionName(k), value: v }))) : h("p", "adm__muted", "Sin datos todavía.")),
    card("Últimos 30 días", columns(days, { tip: (d) => `${d.key}: ${fmtDuration(d.value)}` })),
    card("A qué horas", columns(hours, { tip: (d) => `${hourLabel(d.hour)}: ${fmtDuration(d.value)}` })),
    card(
      "Lo que ha hecho",
      entries(x.acciones).length
        ? bars(entries(x.acciones).map(([k, v]) => ({ label: ACTION_NAMES[k] || k, value: v })), { format: (n) => `${n}×` })
        : h("p", "adm__muted", "Todavía no ha tocado nada especial.")
    ),
    card("Sus premios (así saldrían en el Wrapped)", append(h("ul", "awards"), awards(u).map((a) => append(h("li", "award"), h("span", "award__emoji", a.emoji), append(h("span"), h("strong", null, a.title), h("small", null, a.detail)))))),
  );
  return view;
}

/* ---------- Render ---------- */

export function render(data) {
  if (data) state = { ...state, ...data };
  const id = decodeURIComponent(location.hash.slice(1));
  const user = id && state.users.find((u) => u.id === id);

  const top = h("header", "adm__top");
  const back = Object.assign(h("a", "adm__back", user ? "← Todas las cuentas" : "← Volver"), { href: user ? "#" : "index.html" });
  append(top, back, h("span", "adm__tag", "Panel · solo admin"));
  const body = user ? detail(user) : append(h("div"), h("h1", "adm__title", "Estadísticas"), overview());
  app.replaceChildren(top, body);
}

/* ---------- Arranque ---------- */

function whenRole() {
  return window.ARI?.rol
    ? Promise.resolve(window.ARI)
    : new Promise((resolve) => document.addEventListener("ari:role", (e) => resolve(e.detail), { once: true }));
}

async function boot() {
  const ari = await whenRole();
  if (ari.rol !== "admin") return message("Solo para admins", "Esta sección es del dueño de la página.");
  const { db, collection, onSnapshot } = ari.fb;
  state.fb = ari.fb;
  let ready = 0;
  const done = () => ++ready >= 2 && render();
  onSnapshot(collection(db, "usuarios"), (snap) => {
    state.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    done();
    if (ready >= 2) render();
  }, () => message("No se pudieron leer las estadísticas", "Revisa que las reglas de Firestore estén publicadas (firestore.rules)."));
  onSnapshot(collection(db, "roles"), (snap) => {
    state.roles = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
    done();
    if (ready >= 2) render();
  }, () => {});
  addEventListener("hashchange", () => render());
}

boot();
