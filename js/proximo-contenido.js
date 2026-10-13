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

  // Sección de fotos
  nosotros: {
    titulo: "Nosotros",
    texto: "Algunos momentos que quiero guardar contigo.",
    fotos: [
      { src: "", pie: "El día que nos conocimos" },
      { src: "", pie: "Nuestra primera salida" },
      { src: "", pie: "Cuando nos reímos sin parar" },
      { src: "", pie: "Ese día que no quería que terminara" },
      { src: "", pie: "Contigo, en cualquier lugar" },
      { src: "", pie: "Una de mis favoritas" },
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
