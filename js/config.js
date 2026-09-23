// Todo el contenido de la página vive aquí. Edita los textos, nombres,
// fecha y fotos sin tocar el resto del código.

export default {
  herName: "Ari",
  monogram: "A",
  fromName: "Iván",

  // Fecha en que empezaron (formato AAAA-MM-DDTHH:MM:SS)
  startDate: "2024-02-14T00:00:00",

  // Frases que aparecen una por una antes de abrir el regalo
  introLines: ["Hola, Ari.", "Hice algo solo para ti.", "Pero antes…"],

  heroSubtitle: "Un pequeño rincón de internet que existe solo para ti.",

  letter: {
    date: "Para leer despacio",
    greeting: "Ari,",
    paragraphs: [
      "No soy muy bueno diciendo estas cosas en voz alta, así que decidí construirlas.",
      "Esta página es pequeña comparada con lo que siento, pero cada parte la hice pensando en ti: en tu risa, en cómo me miras cuando crees que no me doy cuenta, en lo fácil que es estar contigo.",
      "Aquí vas a encontrar algunos de nuestros recuerdos, un par de sorpresas y cosas que quiero que tengas guardadas para cuando las necesites.",
      "Gracias por elegirme todos los días. Yo también te elijo.",
    ],
    signature: "— Iván",
  },

  // Fotos: pon los archivos en assets/fotos/ y escribe la ruta en "src".
  // "ratio" es la proporción de la foto (ancho/alto), ej. "4/5", "1/1", "3/4".
  memories: [
    { src: "", caption: "El día que nos conocimos", date: "Febrero 2024", ratio: "4/5" },
    { src: "", caption: "Nuestra primera cita", date: "Marzo 2024", ratio: "1/1" },
    { src: "", caption: "Ese viaje", date: "Junio 2024", ratio: "3/4" },
    { src: "", caption: "Tu cumpleaños", date: "Agosto 2024", ratio: "4/5" },
    { src: "", caption: "Un domingo cualquiera", date: "Noviembre 2024", ratio: "3/4" },
    { src: "", caption: "Nosotros", date: "Siempre", ratio: "1/1" },
  ],

  openWhen: [
    {
      title: "estés triste",
      message: "Respira. Lo que sea que esté pasando, no lo vas a cargar sola. Llámame, a la hora que sea. En serio.",
    },
    {
      title: "me extrañes",
      message: "Mándame un mensaje ahora mismo. Te apuesto lo que quieras a que yo te estoy extrañando más.",
    },
    {
      title: "no puedas dormir",
      message: "Pon la música de esta página, apaga la luz y piensa en nuestro próximo plan juntos. Yo invito.",
    },
    {
      title: "necesites reírte",
      message: "Acuérdate de aquella vez que… (aquí va una anécdota graciosa de ustedes dos).",
    },
  ],

  final: {
    title: "Una última cosa",
    button: "No presiones este botón",
    lines: ["Sabía que lo ibas a presionar.", "Por eso te quiero."],
  },

  // Mensaje escondido en el ✦ del pie de página
  secret: "Encontraste el secreto. Tu premio: una cita, cuando quieras y donde quieras. Canjeable con captura de pantalla.",

  // Música: pon un archivo mp3 en assets/ con este nombre
  music: { src: "assets/musica.mp3", volume: 0.6 },
};
