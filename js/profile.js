// Perfil de cada cuenta: nombre y foto. Se pide la primera vez que alguien inicia sesión y se puede editar
// después desde el menú de la cuenta (js/account.js). Se guarda en usuarios/{uid}: nombre, avatar (foto chica en base64), perfil: true.

import { avatarEl } from "./stats-lib.js";

const MAX_NAME = 30;

async function toAvatar(file, size = 256) {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    // Recorte cuadrado desde el centro.
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(src);
  }
}

export async function saveProfile(fb, user, { nombre, avatar }) {
  const { db, doc, setDoc } = fb;
  await setDoc(doc(db, "usuarios", user.uid), { nombre, avatar, perfil: true }, { merge: true });
}

// Devuelve el formulario (nodo). onSave({ nombre, avatar }) debe devolver una promesa; onCancel es opcional.
export function profileForm({ user, data = {}, title, text, button = "Continuar", onSave, onCancel }) {
  const h = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  };
  let nombre = data.nombre || user.displayName || "";
  let avatar = data.avatar || "";
  const preview = h("div", "profile__preview");
  const paint = () => preview.replaceChildren(avatarEl({ nombre, avatar, foto: data.foto || user.photoURL || "" }, 112));
  paint();

  const file = h("input");
  file.type = "file";
  file.accept = "image/*";
  file.hidden = true;
  const pick = h("button", "auth__btn auth__btn--ghost", "Elegir foto");
  pick.type = "button";
  pick.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files[0];
    file.value = "";
    if (!f) return;
    try {
      avatar = await toAvatar(f);
      paint();
    } catch {
      err.textContent = "No se pudo leer esa foto. Prueba con otra (JPG o PNG).";
    }
  });

  const label = h("label", "profile__field");
  label.append(h("span", "auth__text", "Tu nombre"));
  const input = h("input");
  input.type = "text";
  input.maxLength = MAX_NAME;
  input.autocomplete = "given-name";
  input.placeholder = "¿Cómo te llamas?";
  input.value = nombre;
  input.addEventListener("input", () => {
    nombre = input.value;
    if (!avatar && !(data.foto || user.photoURL)) paint();
  });
  label.append(input);

  const err = h("p", "auth__error");
  err.setAttribute("role", "alert");
  const ok = h("button", "auth__btn", button);
  ok.type = "button";
  ok.addEventListener("click", async () => {
    const name = nombre.trim().slice(0, MAX_NAME);
    if (!name) return (err.textContent = "Escribe tu nombre para continuar.");
    ok.disabled = true;
    err.textContent = "";
    try {
      await onSave({ nombre: name, avatar });
    } catch {
      err.textContent = "No se pudo guardar. Intenta de nuevo.";
      ok.disabled = false;
    }
  });
  const actions = h("div", "profile__actions");
  actions.append(ok);
  if (onCancel) {
    const cancel = h("button", "auth__btn auth__btn--ghost", "Cancelar");
    cancel.type = "button";
    cancel.addEventListener("click", onCancel);
    actions.append(cancel);
  }

  const form = h("div", "profile");
  form.append(h("h1", "auth__title", title), text ? h("p", "auth__text", text) : "", preview, pick, file, label, err, actions);
  return form;
}
