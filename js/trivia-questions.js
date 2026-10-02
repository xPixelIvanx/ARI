// Preguntas de la trivia. Todo lo que dice "PLACEHOLDER" se reemplaza con lo real.
//
// Tipos de pregunta (los helpers de abajo arman cada uno):
//   choice(q, [opciones], correcta, imagen?)   opción múltiple (con imagen opcional arriba)
//   grid(q, [{ src, label }], correcta)         elegir la foto correcta (2 a 4 fotos)
//   tf(q, true | false)                         verdad o mentira
//   text(q, ["respuesta", "otra válida"])       respuesta escrita (ignora mayúsculas y acentos)
//   slider(q, { min, max, step, correct, tolerance, unit })   número aproximado
//
// "correcta" es la posición desde 0. Las imágenes van en assets/trivia/ (ej. "assets/trivia/7.jpg");
// si dejas src vacío ("") se ve una caja de placeholder.

export const SETTINGS = {
  passPercent: 70,
  cooldownHours: 24,
  perRound: 10,
  kicker: "Desbloqueo",
  title: "¿Quieres recuperar tu página? Gánatela.",
  intro: "Demuestra que te importan las cosas. 50 preguntas sobre mí, un solo intento, cero trampas.",
  failTitle: "Ni modo, no lo lograste",
  failText: "Vuelve a intentar en 24 horas.",
  passTitle: "Ok, sí te importa",
  passText: "Lo lograste. Tu página te estaba esperando.",
};

// Una por cada bloque de `perRound` preguntas.
export const ROUNDS = [
  { name: "Calentamiento", blurb: "Lo básico. Si fallas aquí, ni sigas." },
  { name: "Lo que se supone que sabes", blurb: "Cosas que he dicho mil veces." },
  { name: "Ahora sí", blurb: "Aquí se separan los que prestan atención." },
  { name: "Nivel difícil", blurb: "Detalles que solo notas si te importa." },
  { name: "La última, no la riegues", blurb: "Todo lo que has acumulado se define aquí." },
];

const PH = ["PLACEHOLDER A", "PLACEHOLDER B", "PLACEHOLDER C", "PLACEHOLDER D"];
const PH_GRID = ["A", "B", "C", "D"].map((label) => ({ src: "", label: `Foto ${label}` }));

const choice = (q, options = PH, correct = 0, image = "") => ({ type: "choice", q, options, correct, image });
const grid = (q, images = PH_GRID, correct = 0) => ({ type: "grid", q, images, correct });
const tf = (q, correct = true) => ({ type: "tf", q, correct });
const text = (q, answer = ["placeholder"]) => ({ type: "text", q, answer });
const slider = (q, o = {}) => ({ type: "slider", q, min: 0, max: 100, step: 1, correct: 50, tolerance: 5, unit: "", ...o });

export const QUESTIONS = [
  // Ronda 1
  choice("¿Cuál es mi comida favorita?"),
  tf("Me gusta madrugar."),
  choice("¿Cuál es mi color favorito?"),
  grid("¿Cuál de estas fotos soy yo de niño?"),
  text("¿Cuál era mi apodo de chiquito?"),
  choice("¿En qué mes es mi cumpleaños?"),
  slider("¿Cuántos años tengo?", { min: 15, max: 40, correct: 20, tolerance: 0, unit: "años" }),
  choice("¿Qué es lo que más me da miedo?"),
  tf("Prefiero quedarme en casa que salir."),
  choice("¿Qué tomo siempre?"),

  // Ronda 2
  choice("¿Cuál es mi película o serie favorita?", PH, 0, ""),
  choice("¿Qué hago cuando estoy nervioso?"),
  tf("Soy de los que contestan los mensajes al instante."),
  grid("¿Cuál de estos lugares es mi favorito?"),
  text("¿Cómo se llama mi mejor amigo?"),
  choice("¿Qué canción me recuerda a ti?"),
  slider("¿A qué hora me duermo normalmente?", { min: 20, max: 28, correct: 24, tolerance: 1, unit: "h (24 = medianoche)" }),
  choice("¿Cuál es mi mayor sueño?"),
  tf("Me da pena bailar."),
  choice("¿Qué es lo que más me molesta?"),

  // Ronda 3
  choice("¿Cuál es mi lugar favorito en el mundo?", PH, 0, ""),
  choice("¿Qué fue lo primero que pensé cuando te conocí?"),
  tf("Soy más de perros que de gatos."),
  grid("¿Cuál de estos regalos me encantaría más?"),
  text("¿Cuál es mi comida de antojo a las 2 a. m.?"),
  choice("¿Cuál es mi mayor inseguridad?"),
  slider("¿Cuántas veces he viajado en avión?", { min: 0, max: 20, correct: 2, tolerance: 1 }),
  choice("¿Qué me hace reír sin falta?"),
  tf("Soy buen cocinero."),
  choice("¿Qué plan perfecto tengo para un domingo?"),

  // Ronda 4
  choice("¿Qué hago cuando estoy enojado?"),
  choice("¿Cuál fue el mejor día que hemos pasado juntos?"),
  tf("Prefiero el mar que la montaña."),
  grid("¿Cuál de estas es mi playera favorita?"),
  text("¿Cómo se llama mi primera mascota (o la que quise tener)?"),
  choice("¿Qué es lo que más valoro en una persona?"),
  slider("¿Cuántas horas duermo en promedio?", { min: 3, max: 12, correct: 7, tolerance: 1, unit: "h" }),
  choice("¿Qué animal soy según yo?"),
  tf("Me cuesta pedir perdón."),
  choice("¿Qué quiero que hagamos algún día juntos?"),

  // Ronda 5
  choice("¿Cuál es mi manera de demostrar que me importas?"),
  choice("¿Qué es lo que más extraño cuando no estamos juntos?"),
  tf("Me acuerdo de todas las fechas importantes."),
  grid("¿Cuál de estas fue nuestra primera foto juntos?"),
  text("¿Qué día nos conocimos? (día y mes)"),
  choice("¿Qué cosa nunca te he dicho que me encanta de ti?"),
  slider("¿Cuántos días llevamos desde que nos conocimos?", { min: 0, max: 800, step: 5, correct: 100, tolerance: 15, unit: "días" }),
  choice("¿Qué es lo que más me dolió de la pelea?"),
  tf("Quiero arreglar las cosas."),
  choice("¿Qué es lo que más quiero que entiendas?"),
];
