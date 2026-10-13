// Textos del "No": cada clic lo cambia, para que la respuesta sea cada vez más obvia.
const NO_TEXTS = ["No", "¿Segura?", "¿Segurísima?", "Piénsalo bien…", "Mentira, dale Sí"];

const kicker = document.getElementById("kicker");
const question = document.getElementById("question");
const choices = document.getElementById("choices");
const answer = document.getElementById("answer");
const yesBtn = document.getElementById("yes");
const noBtn = document.getElementById("no");

let noClicks = 0;

noBtn.addEventListener("click", () => {
  noClicks = Math.min(noClicks + 1, NO_TEXTS.length - 1);
  noBtn.textContent = NO_TEXTS[noClicks];
  // Ese botón también crece para que "Sí" se vea cada vez más grande.
  yesBtn.style.transform = `scale(${1 + noClicks * 0.12})`;
});

yesBtn.addEventListener("click", () => {
  kicker.textContent = "";
  question.hidden = true;
  choices.hidden = true;
  answer.hidden = false;
  celebrate();
});

// Corazones que suben
function celebrate() {
  const symbols = ["❤️", "🩷", "✨", "🌼"];
  for (let i = 0; i < 24; i++) {
    const h = document.createElement("span");
    h.className = "heart";
    h.textContent = symbols[i % symbols.length];
    h.style.left = `${Math.random() * 100}vw`;
    h.style.animationDelay = `${Math.random() * 1.5}s`;
    document.body.append(h);
    h.addEventListener("animationend", () => h.remove());
  }
}
