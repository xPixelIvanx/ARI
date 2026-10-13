// Música de fondo. Si existe assets/proximo.mp3 se usa ese archivo;
// si no, suena una melodía suave generada por el navegador (no necesita ningún archivo).

const FILE = "assets/proximo.mp3";
const VOLUME = 0.55;
const SYNTH_VOLUME = 0.2;

// Acordes (notas MIDI): La menor, Fa, Do, Sol
const CHORDS = [
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [60, 64, 67, 72],
  [55, 59, 62, 67],
];
const PATTERN = [0, 1, 2, 3, 2, 1, 3, 2];
const NOTE_SECONDS = 0.46;
const hz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

export function createMusic(button) {
  let started = false;
  let muted = false;
  let ctx = null;
  let master = null;
  let audio = null;
  let timer = 0;

  const paint = () => {
    button.setAttribute("aria-pressed", String(started && !muted));
    button.classList.toggle("is-playing", started && !muted);
    button.setAttribute("aria-label", started && !muted ? "Pausar música" : "Reproducir música");
  };

  function startSynth() {
    if (!ctx) return;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(muted ? 0 : SYNTH_VOLUME, ctx.currentTime + 3);

    // Eco suave para que suene amplio
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.37;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    delay.connect(feedback).connect(delay);
    delay.connect(wet).connect(master);

    const note = (freq, when, length, type, gain) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(gain, when + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, when + length);
      osc.connect(env);
      env.connect(master);
      env.connect(delay);
      osc.start(when);
      osc.stop(when + length + 0.05);
    };

    let next = ctx.currentTime + 0.1;
    let step = 0;
    const schedule = () => {
      while (next < ctx.currentTime + 1.2) {
        const chord = CHORDS[Math.floor(step / PATTERN.length) % CHORDS.length];
        note(hz(chord[PATTERN[step % PATTERN.length]]), next, 1.8, "triangle", 0.5);
        if (step % PATTERN.length === 0) note(hz(chord[0] - 12), next, 3.4, "sine", 0.55);
        next += NOTE_SECONDS;
        step++;
      }
    };
    schedule();
    timer = setInterval(schedule, 250);
  }

  // Safari (iPhone) solo deja sonar durante el toque del usuario. Por eso NADA se espera
  // (ni red ni promesas) antes de llamar a play() y resume(): todo ocurre en el mismo toque.
  // Si el archivo no existe, play() falla y entonces arranca la melodía generada.
  function resume() {
    if (ctx && ctx.state !== "running") ctx.resume?.();
  }

  function start() {
    if (started) return resume();
    started = true;
    button.hidden = false;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = AC ? new AC() : null;
    resume();

    audio = new Audio(FILE);
    audio.loop = true;
    audio.volume = muted ? 0 : VOLUME;
    audio.play().then(
      () => paint(),
      () => {
        audio = null;
        startSynth();
        paint();
      },
    );
    paint();
  }

  function toggle() {
    if (!started) return start();
    muted = !muted;
    if (audio) audio.volume = muted ? 0 : VOLUME;
    if (master && ctx) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.linearRampToValueAtTime(muted ? 0 : SYNTH_VOLUME, ctx.currentTime + 0.4);
    }
    paint();
  }

  // ---------- Efectos de las flores ----------
  // Se disparan desde el mismo toque que los inicia, así que Safari también los deja sonar.

  // Una nota que sube mientras mantienes presionado: es el "crecimiento".
  let grow = null;

  function pluck(freq, when, length, type, peak) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(peak, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + length);
    osc.connect(env).connect(ctx.destination);
    osc.start(when);
    osc.stop(when + length + 0.05);
  }

  function growStart(durationMs) {
    if (!ctx || muted) return;
    resume();
    growStop();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + durationMs / 1000);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    grow = { osc, gain };
  }

  function growStop() {
    if (!grow || !ctx) return;
    const { osc, gain } = grow;
    grow = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.stop(t + 0.15);
  }

  // Al florecer: tres notas en arpegio y un brillo agudo.
  function bloom() {
    if (!ctx || muted) return;
    resume();
    const t = ctx.currentTime + 0.02;
    [76, 83, 88].forEach((midi, i) => pluck(hz(midi), t + i * 0.09, 1.6, "triangle", 0.22));
    pluck(hz(95), t + 0.27, 1.8, "sine", 0.1);
  }

  // Al completar el ramo: el acorde de Do mayor, más largo.
  function finale() {
    if (!ctx || muted) return;
    resume();
    const t = ctx.currentTime + 0.05;
    CHORDS[2].forEach((midi, i) => pluck(hz(midi + 12), t + i * 0.12, 4, "triangle", 0.2));
    pluck(hz(60 + 24), t + 0.5, 4, "sine", 0.08);
  }

  button.addEventListener("click", toggle);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.();
    else ctx.resume?.();
    if (audio) document.hidden ? audio.pause() : !muted && audio.play().catch(() => {});
  });

  return { start, growStart, growStop, bloom, finale };
}
