// Utilidades compartidas por el panel de admin y el Wrapped: nombres legibles, formatos y premios (de broma).
// Los datos vienen del documento usuarios/{uid} que escribe js/session.js.

export const PAGE_NAMES = { index: "El carrusel", regalo: "El regalo", proximo: "La pregunta", wrapped: "El Wrapped", admin: "Panel" };

export const SECTION_NAMES = {
  index_regalo: "Carrusel · el regalo",
  index_cuenta_regresiva: "Carrusel · la cuenta regresiva",
  index_proximamente: "Carrusel · próximamente",
  index_wrapped: "Carrusel · el Wrapped",
  regalo_intro: "Regalo · la intro",
  regalo_inicio: "Regalo · el inicio",
  regalo_carta: "Regalo · la carta",
  regalo_recuerdos: "Regalo · los recuerdos",
  regalo_canciones: "Regalo · las canciones",
  regalo_abre_cuando: "Regalo · abre cuando…",
  regalo_final: "Regalo · la sorpresa final",
  proximo_intro: "La pregunta · las flores",
  proximo_inicio: "La pregunta · el inicio",
  proximo_nosotros: "La pregunta · nosotros",
  proximo_promesas: "La pregunta · las promesas",
  proximo_pregunta: "La pregunta · la pregunta",
};

export const ACTION_NAMES = {
  intro_started: "Tocó “comenzar” en la intro",
  gift_opened: "Abrió el regalo",
  letter_opened: "Abrió la carta",
  memory_viewed: "Vio un recuerdo en grande",
  song_opened: "Sacó un disco",
  open_when: "Abrió una tarjeta “abre cuando…”",
  final_surprise: "Presionó el botón prohibido",
  secret_found: "Encontró el secreto ✦",
  proximo_entrar: "Hizo crecer las 5 flores",
  proximo_rascado: "Rascó la pregunta final",
  proximo_no: "Le dio a “No”",
  proximo_si: "Dijo que sí",
};

export const sectionName = (key) => SECTION_NAMES[key] || key.replace(/_/g, " · ");

export function fmtDuration(sec = 0) {
  sec = Math.round(sec);
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  const hr = Math.floor(m / 60);
  return `${hr} h ${String(m % 60).padStart(2, "0")} min`;
}

export const fmtDate = (ts, opts = { day: "numeric", month: "short", year: "numeric" }) => {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  return d ? d.toLocaleDateString("es", opts) : "—";
};

export function ago(ts) {
  const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null;
  if (!d) return "nunca";
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 90) return "justo ahora";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 86400 * 30) return `hace ${Math.round(s / 86400)} d`;
  return fmtDate(d);
}

export const entries = (obj = {}) => Object.entries(obj).filter(([, v]) => typeof v === "number" && v > 0).sort((a, b) => b[1] - a[1]);
export const sum = (obj = {}) => Object.values(obj).reduce((a, v) => a + (typeof v === "number" ? v : 0), 0);

// Quita lo que no es un apartado "real" para los rankings.
export const sectionEntries = (d) => entries(d.apartados).filter(([k]) => !k.endsWith("_inicio") || true);

export function derived(d = {}) {
  const total = d.segundos || 0;
  const sesiones = d.sesiones || 0;
  const dias = entries(d.dias);
  const horas = d.horas || {};
  const topHora = entries(horas)[0];
  return {
    total,
    aperturas: d.aperturas || 0,
    sesiones,
    promedioSesion: sesiones ? total / sesiones : 0,
    diasActivos: dias.length,
    mejorDia: dias[0] ? { dia: dias[0][0], seg: dias[0][1] } : null,
    horaFavorita: topHora ? Number(topHora[0]) : null,
    topApartados: entries(d.apartados),
    topPaginas: entries(Object.fromEntries(Object.entries(d.paginas || {}).map(([k, v]) => [k, v?.segundos || 0]))),
    acciones: d.acciones || {},
  };
}

export const hourLabel = (h) => (h == null ? "—" : `${String(h).padStart(2, "0")}:00`);

// Premios de broma. Siempre hay al menos el primero; el resto aparece si hay datos que lo justifiquen.
export function awards(d = {}) {
  const x = derived(d);
  const a = x.acciones;
  const sec = (k) => d.apartados?.[k] || 0;
  const list = [
    {
      emoji: "🏆",
      title: "Persona más dedicada del año",
      sub: "Ganó por goleada: fue la única participante.",
      detail: `${fmtDuration(x.total)} dentro de la página`,
    },
  ];
  if (x.aperturas >= 2)
    list.push({ emoji: "🔁", title: "Cliente frecuente", sub: "Volvió tantas veces que ya le toca descuento.", detail: `${x.aperturas} aperturas` });
  if (x.diasActivos >= 2)
    list.push({ emoji: "🔥", title: "Racha oficial", sub: "Días distintos en los que vino a ver qué había de nuevo.", detail: `${x.diasActivos} días` });
  if (sec("regalo_carta") >= 20)
    list.push({ emoji: "💌", title: "Reina de las cartas", sub: "Se leyó la carta completita (eso dice el cronómetro).", detail: fmtDuration(sec("regalo_carta")) });
  if (sec("regalo_recuerdos") >= 20)
    list.push({ emoji: "📸", title: "Paparazzi oficial", sub: "Revisó los recuerdos con lupa.", detail: fmtDuration(sec("regalo_recuerdos")) });
  if ((a.song_opened || 0) >= 1)
    list.push({ emoji: "🎧", title: "Oído fino", sub: "Sacó los discos uno por uno.", detail: `${a.song_opened} discos` });
  if ((a.open_when || 0) >= 1)
    list.push({ emoji: "🗝️", title: "Abre-cuando profesional", sub: "No esperó a estar triste para abrir las tarjetas. Hizo bien.", detail: `${a.open_when} tarjetas` });
  if ((a.final_surprise || 0) >= 1)
    list.push({ emoji: "🕵️", title: "Chismosa oficial", sub: "Dijeron “NO PRESIONES” y presionó. Obvio.", detail: `${a.final_surprise} ${a.final_surprise === 1 ? "vez" : "veces"}` });
  if ((a.secret_found || 0) >= 1)
    list.push({ emoji: "✦", title: "Detective del año", sub: "Encontró el secreto escondido.", detail: "Caso resuelto" });
  if (x.horaFavorita != null) {
    const hr = x.horaFavorita;
    const [emoji, title, sub] =
      hr >= 22 || hr < 5
        ? ["🌙", "Noctámbula certificada", "Su hora favorita para venir: cuando todos duermen."]
        : hr < 12
          ? ["☀️", "Madrugadora", "Viene con el café en la mano."]
          : hr < 19
            ? ["🌤️", "Visitante de la tarde", "Ni muy temprano ni muy tarde: puntualidad perfecta."]
            : ["🌆", "Gente de atardecer", "Hora dorada, página dorada."];
    list.push({ emoji, title, sub, detail: `Su hora favorita: ${hourLabel(hr)}` });
  }
  if ((a.proximo_si || 0) >= 1) list.push({ emoji: "💍", title: "Respuesta del año", sub: "Dijo que sí. Sin comentarios.", detail: "Sí ❤️" });
  return list;
}

export const initial = (name = "") => (name.trim()[0] || "?").toUpperCase();

export function avatarEl(data = {}, size = 40) {
  const src = data.avatar || data.foto || "";
  const box = document.createElement("span");
  box.className = "avatar";
  box.style.cssText = `display:inline-grid;place-items:center;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex:none;background:#cf6a8a;color:#fff;font:italic 500 ${Math.round(size * 0.5)}px "Cormorant Garamond",Georgia,serif`;
  if (src) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.style.cssText = "width:100%;height:100%;object-fit:cover";
    img.onerror = () => ((box.textContent = initial(data.nombre)), img.remove());
    box.append(img);
  } else box.textContent = initial(data.nombre);
  return box;
}
