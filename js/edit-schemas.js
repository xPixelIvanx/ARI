// Qué se puede editar en cada página además de lo que ya se edita directamente sobre ella (atributos data-ed / data-ed-img / data-ed-list).
//
// lists:    listas editables. `new` es el elemento que se agrega con "+"; `fields` son sus campos.
//           Si `new` es un texto, la lista es de textos sueltos. `fixed: true` = no se puede agregar ni quitar.
// settings: bloques del panel "Ajustes" (lo que no está a la vista o no es un texto simple).
//
// Para una página nueva: agrega aquí su entrada, ponle data-ed a los textos en el HTML y listo.
// Campo: { k | path, label, type: text | textarea | datetime | range | image | audio | spotify | list }

export default {
  regalo: {
    lists: {
      memories: {
        label: "foto",
        new: { src: "", caption: "Nuevo recuerdo", date: "Fecha", ratio: "4/5" },
        fields: [
          { k: "src", label: "Foto", type: "image" },
          { k: "caption", label: "Texto" },
          { k: "date", label: "Fecha" },
        ],
      },
      songs: {
        label: "canción",
        new: { spotify: "", cover: "", title: "Nombre de la canción", artist: "Artista", quote: "La frase que me recuerda a ti." },
        fields: [
          { k: "spotify", label: "Link de Spotify", type: "spotify", help: "En Spotify: ••• → Compartir → Copiar enlace. Se llenan solos el nombre y la portada." },
          { k: "title", label: "Canción" },
          { k: "artist", label: "Artista" },
          { k: "cover", label: "Portada", type: "image" },
          { k: "quote", label: "Frase", type: "textarea", rows: 3 },
        ],
      },
      openWhen: {
        label: "tarjeta",
        new: { title: "necesites algo", message: "Tu mensaje aquí." },
        fields: [
          { k: "title", label: "Abre cuando…" },
          { k: "message", label: "Mensaje", type: "textarea", rows: 5 },
        ],
      },
      "letter.paragraphs": { label: "párrafo", new: "Escribe aquí.", rows: 4 },
      introLines: { label: "frase", new: "Una frase nueva.", rows: 2 },
      "final.lines": { label: "frase", new: "Una frase nueva.", rows: 2 },
    },
    settings: [
      {
        title: "Nombres",
        fields: [
          { path: "herName", label: "Su nombre" },
          { path: "monogram", label: "Inicial del sello" },
          { path: "fromName", label: "Tu nombre" },
        ],
      },
      { title: "Contador", fields: [{ path: "startDate", label: "Juntos desde", type: "datetime" }] },
      { title: "Frases de la intro", fields: [{ path: "introLines", type: "list" }] },
      {
        title: "Sorpresa final",
        fields: [
          { path: "final.button", label: "Texto del botón" },
          { path: "final.lines", label: "Frases al presionarlo", type: "list" },
        ],
      },
      { title: "Secreto (✦)", fields: [{ path: "secret", type: "textarea", rows: 4 }] },
      {
        title: "Música",
        fields: [
          { path: "music.src", label: "Canción de fondo", type: "audio" },
          { path: "music.volume", label: "Volumen", type: "range" },
        ],
      },
    ],
  },

  proximo: {
    lists: {
      flores: {
        label: "flor",
        fixed: true,
        fields: [
          { k: "titulo", label: "Título" },
          { k: "texto", label: "Texto", type: "textarea", rows: 3 },
          { k: "foto", label: "Foto", type: "image" },
        ],
      },
      "nosotros.fotos": {
        label: "foto",
        new: { src: "", pie: "Nuevo momento" },
        fields: [
          { k: "src", label: "Foto", type: "image" },
          { k: "pie", label: "Texto" },
        ],
      },
      "promesas.lista": {
        label: "promesa",
        new: { titulo: "Nueva promesa", texto: "Escribe aquí." },
        fields: [
          { k: "titulo", label: "Título" },
          { k: "texto", label: "Texto", type: "textarea", rows: 3 },
        ],
      },
      "pregunta.noTextos": { label: "texto", new: "Otro texto", rows: 1 },
    },
    settings: [
      {
        title: "Nombres",
        fields: [
          { path: "nombre", label: "Su nombre" },
          { path: "firma", label: "Firma" },
        ],
      },
      { title: "Frase de la intro", fields: [{ path: "frase", type: "textarea", rows: 2 }] },
      { title: "Las 5 flores", fields: [{ path: "flores", type: "list" }] },
      {
        title: "Al terminar las flores",
        fields: [
          { path: "ramo.titulo", label: "Título (después va su nombre)" },
          { path: "ramo.texto", label: "Texto", type: "textarea", rows: 2 },
        ],
      },
      { title: "Textos del botón No", fields: [{ path: "pregunta.noTextos", type: "list" }] },
      {
        title: "Después del Sí",
        fields: [
          { path: "respuesta.grande", label: "Grande" },
          { path: "respuesta.texto", label: "Texto" },
          { path: "respuesta.extra", label: "Extra", type: "textarea", rows: 2 },
        ],
      },
    ],
  },

  index: {
    lists: {},
    settings: [{ title: "Cuenta regresiva", fields: [{ path: "propuesta", label: "Fecha y hora de la propuesta", type: "datetime" }] }],
  },
};
