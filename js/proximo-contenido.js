// Todo el texto de la página de la propuesta está aquí. Cámbialo a tu gusto.
//
// Fotos: sube la imagen a assets/fotos/ y pon la ruta en `foto` / `src`
// (ej. "assets/fotos/1.jpg"). Si lo dejas vacío ("") se ve un recuadro de muestra.
// Música: si subes assets/proximo.mp3 se usa ese archivo; si no, suena una melodía suave generada.

export default {
  nombre: "Ari",
  firma: "— Iván",

  // Primera frase, antes de que crezca la primera flor
  frase: "Una vez me pediste algo hecho a mano, con el corazón.",

  // Las 5 flores. Cada una revela un motivo (y una foto opcional).
  flores: [
    { titulo: "Tu risa", texto: "Es mi sonido favorito. Haría lo que fuera por escucharla un día más.", foto: "" },
    { titulo: "Tu forma de mirarme", texto: "Cuando crees que no me doy cuenta, es cuando más me enamoro de ti.", foto: "" },
    { titulo: "Tu corazón", texto: "Eres de las personas más bonitas que he conocido, por dentro y por fuera.", foto: "" },
    { titulo: "Lo fácil que es contigo", texto: "Contigo hasta lo más normal se siente especial.", foto: "" },
    { titulo: "Que me elijas", texto: "Todos los días. Y yo te elijo a ti.", foto: "" },
  ],

  // Cuando ya crecieron las 5 flores
  ramo: {
    titulo: "Para ti",
    texto: "Cinco flores, cinco razones. Y todavía hay más.",
  },

  // ---------- Secciones nuevas (todo es de ejemplo: cámbialo por lo de ustedes) ----------

  // Línea de tiempo: se dibuja una línea dorada mientras ella baja
  historia: {
    titulo: "Nuestra historia",
    texto: "Cómo llegamos hasta aquí, un momento a la vez.",
    momentos: [
      { fecha: "El comienzo", titulo: "El día que nos conocimos", texto: "No sabía que esa conversación iba a cambiarlo todo.", foto: "" },
      { fecha: "Unos días después", titulo: "El primer mensaje", texto: "Lo escribí y lo borré como diez veces antes de mandarlo.", foto: "" },
      { fecha: "Nuestra primera salida", titulo: "Los nervios", texto: "Llegué temprano, me reí de más y aun así quisiste volver a verme.", foto: "" },
      { fecha: "Ese día", titulo: "Cuando lo supe", texto: "Que no quería conocer a nadie más. Que eras tú.", foto: "" },
      { fecha: "Hoy", titulo: "Esta página", texto: "Hecha a mano, con el corazón, como me pediste.", foto: "" },
    ],
    // Al final de la línea: lo que falta por escribir
    cierre: "Hasta ahora…",
    cierreTexto: "Lo que sigue todavía no lo escribimos. Y es lo que más ganas me da.",
  },

  // Antes y ahora: se cambia con el botón
  antes: {
    titulo: "Lo que pensé la primera vez",
    texto: "Y lo que pienso ahora.",
    entonces: "Entonces",
    hoy: "Hoy",
    pares: [
      { entonces: "«Qué bonita sonrisa.»", hoy: "Es lo primero que quiero ver cada día." },
      { entonces: "«Seguro no me va a contestar.»", hoy: "Me contesta, me escucha y me entiende." },
      { entonces: "«Ojalá pueda volver a verla.»", hoy: "Ojalá pueda verte siempre." },
      { entonces: "«¿Y si no le caigo bien?»", hoy: "Ahora sé que te gusta hasta lo raro de mí." },
    ],
  },

  // Se iluminan una por una al bajar
  ensenaste: {
    titulo: "Cosas que me enseñaste",
    texto: "Sin proponértelo.",
    lista: [
      "Que lo simple también puede ser especial.",
      "Que está bien no tener todo resuelto.",
      "A escuchar de verdad, no solo a esperar mi turno para hablar.",
      "Que los detalles pequeños dicen mucho.",
      "Que puedo ser yo, sin miedo.",
      "Lo bonito que es esperar algo con ganas.",
    ],
    // Al final de la lista
    cierre: "…y eso es solo hasta ahora.",
    cierreTexto: "Me faltan muchas cosas por aprender contigo, y quiero aprenderlas todas.",
  },

  // Lista de planes: ella puede ir palomeándolos
  planes: {
    titulo: "Planes contigo",
    texto: "Una lista que quiero ir tachando a tu lado.",
    lista: [
      { titulo: "Ver un amanecer", texto: "Aunque nos cueste levantarnos." },
      { titulo: "Un viaje, solo los dos", texto: "A donde tú quieras." },
      { titulo: "Cocinar algo juntos", texto: "Y que salga mal, y reírnos." },
      { titulo: "Un picnic con flores amarillas", texto: "Obviamente." },
      { titulo: "Bailar en la cocina", texto: "Sin música, si hace falta." },
      { titulo: "Una noche de estrellas", texto: "Contar cuántas vemos." },
    ],
  },

  // Carta que se escribe sola
  futuro: {
    titulo: "Para nosotros, en el futuro",
    texto: "Lo que espero que sigamos siendo.",
    carta: [
      "Espero que sigamos riéndonos de las mismas tonterías.",
      "Que cuando algo se ponga difícil, lo resolvamos juntos.",
      "Y que si algún día lees esto otra vez, sonrías. Porque yo voy a seguir eligiéndote.",
    ],
  },

  // Sección de promesas
  promesas: {
    titulo: "Lo que te prometo",
    texto: "Cosas pequeñas, pero dichas en serio.",
    lista: [
      { titulo: "Escucharte", texto: "Cuando estés feliz, cuando estés cansada y cuando no sepas ni qué sientes." },
      { titulo: "Hacerte reír", texto: "Aunque sea con mis chistes malos. Sobre todo con mis chistes malos." },
      { titulo: "Seguir haciendo cosas a mano", texto: "Detalles hechos con tiempo y con el corazón, como me pediste." },
      { titulo: "Elegirte", texto: "Hoy, mañana y los días que no sean tan fáciles." },
    ],
  },

  // La pregunta
  pregunta: {
    kicker: "Y ahora sí, lo que quería preguntarte",
    texto: "¿Quieres ser mi novia?",
    noTextos: ["No", "¿Segura?", "¿Segurísima?", "Piénsalo bien…", "Mentira, dale Sí"],
  },

  // Después del "Sí"
  respuesta: {
    grande: "¡Sí! ❤️",
    texto: "Ahora sí es oficial.",
    extra: "Tu carta, escrita a mano como me pediste, te está esperando.",
  },
};
