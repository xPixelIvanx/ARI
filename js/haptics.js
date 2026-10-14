// Vibración / respuesta háptica.
//  - Android (Chrome, Firefox): navigator.vibrate.
//  - iPhone (Safari 17.4+): no existe navigator.vibrate; se usa el "tic" que da un interruptor nativo
//    (<input type="checkbox" switch>) al cambiar de estado. Es un golpecito por pulso y solo suena
//    si se dispara desde un toque del usuario.
// Uso: buzz(10) · buzz([40, 70, 40]) · buzz(0) para cancelar.

let sw = null;
let timers = [];

function iosTick() {
  if (!sw) {
    const label = document.createElement("label");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-100px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    input.tabIndex = -1;
    label.append(input);
    document.body.append(label);
    sw = label;
  }
  sw.click();
}

export const nativeVibrate = "vibrate" in navigator;

export function buzz(pattern) {
  if (nativeVibrate) return navigator.vibrate(pattern);

  timers.forEach(clearTimeout);
  timers = [];
  const steps = [].concat(pattern);
  if (!steps.length || steps[0] === 0 && steps.length === 1) return false;
  // En el patrón, los lugares pares son pulsos y los impares pausas: cada pulso es un tic.
  let t = 0;
  steps.forEach((ms, i) => {
    if (i % 2 === 0) {
      if (t === 0) iosTick();
      else timers.push(setTimeout(iosTick, t));
    }
    t += ms;
  });
  return true;
}
