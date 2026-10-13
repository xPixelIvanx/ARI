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

  async function fileExists() {
    try {
      const r = await fetch(FILE, { method: "HEAD" });
      return r.ok && /audio|mpeg|octet-stream/i.test(r.headers.get("content-type") || "");
    } catch {
      return false;
    }
  }

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

  // Se llama desde un toque del usuario (los navegadores no dejan sonar antes).
  async function start() {
    if (started) return;
    started = true;
    button.hidden = false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      ctx.resume?.();
    }
    if (await fileExists()) {
      audio = new Audio(FILE);
      audio.loop = true;
      audio.volume = muted ? 0 : VOLUME;
      try {
        await audio.play();
        paint();
        return;
      } catch {
        audio = null;
      }
    }
    startSynth();
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

  button.addEventListener("click", toggle);
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend?.();
    else ctx.resume?.();
    if (audio) document.hidden ? audio.pause() : !muted && audio.play().catch(() => {});
  });

  return { start };
}
