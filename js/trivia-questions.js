// Preguntas de la trivia. Edita este archivo con las respuestas reales.
//
// Opción múltiple:  { q: "Pregunta", options: ["A", "B", "C", "D"], correct: 0 }   (correct = posición, desde 0)
// Respuesta escrita: { q: "Pregunta", answer: ["respuesta", "otra forma válida"] }  (ignora mayúsculas y acentos)

export const SETTINGS = {
  passPercent: 70,
  cooldownHours: 24,
  kicker: "Antes de entrar",
  title: "¿Qué tanto me conoces?",
  intro: "Un solo intento. Contesta con calma, sin buscar ayuda, y sin mirar atrás.",
  failTitle: "Ni modo, no lo lograste",
  failText: "Vuelve a intentar en 24 horas.",
  passTitle: "Sí me conoces",
  passText: "Pasaste. Gracias por intentarlo. Tu regalo te estaba esperando.",
};

// TODO: reemplazar las opciones "Cambia esto" por las reales y marcar la correcta.
export const QUESTIONS = [
  { q: "¿Cuál es mi comida favorita?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi color favorito?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué es lo que más me da miedo?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿En qué mes es mi cumpleaños?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi segundo nombre o mi apodo de niño?", answer: ["cambia esto"] },
  { q: "¿Qué hago cuando estoy nervioso?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi película o serie favorita?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué canción me recuerda a ti?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi mayor sueño?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué es lo que más me molesta?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cómo me gusta el café (o qué tomo siempre)?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi lugar favorito en el mundo?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué hacía yo de niño que nunca se me quitó?", answer: ["cambia esto"] },
  { q: "¿Qué fue lo primero que pensé cuando te conocí?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué cosa nunca te he dicho que me encanta de ti?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi mayor inseguridad?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué me hace reír sin falta?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué plan perfecto tengo para un domingo?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál fue el mejor día que hemos pasado juntos?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué es lo que más valoro en una persona?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Cuál es mi manera de decir que te quiero sin decirlo?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué animal soy según yo?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué hago cuando estoy enojado?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué quiero que hagamos algún día juntos?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
  { q: "¿Qué es lo que más extraño cuando no estamos juntos?", options: ["Cambia esto 1", "Cambia esto 2", "Cambia esto 3", "Cambia esto 4"], correct: 0 },
];
