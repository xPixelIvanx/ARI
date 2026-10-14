// Chip de la cuenta en el carrusel: perfil, cerrar sesión y (solo admin) acceso al panel de estadísticas.
// Lo monta js/session.js cuando ya se sabe el rango de la cuenta.

import { avatarEl } from "./stats-lib.js";
import { profileForm, saveProfile } from "./profile.js";

const h = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function mount({ user, rol, fb, profile = {} }) {
  if (document.querySelector(".account")) return;
  let data = { nombre: user.displayName || "", foto: user.photoURL || "", ...profile };

  const wrap = h("div", "account");
  const chip = h("button", "account__chip");
  chip.type = "button";
  chip.setAttribute("aria-haspopup", "menu");
  chip.setAttribute("aria-expanded", "false");
  const paint = () => chip.replaceChildren(avatarEl(data, 30), h("span", "account__name", (data.nombre || "Mi cuenta").split(" ")[0]));
  paint();

  let menu = null;
  const close = () => {
    menu?.remove();
    menu = null;
    chip.setAttribute("aria-expanded", "false");
  };

  const item = (text, onclick, extra = "") => {
    const b = h("button", `account__item ${extra}`, text);
    b.type = "button";
    b.setAttribute("role", "menuitem");
    b.addEventListener("click", () => (close(), onclick()));
    return b;
  };

  function editProfile() {
    const root = h("div", "auth");
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    const box = h("div", "auth__box");
    box.append(
      profileForm({
        user,
        data,
        title: "Mi perfil",
        button: "Guardar",
        onCancel: () => root.remove(),
        onSave: async (perfil) => {
          await saveProfile(fb, user, perfil);
          data = { ...data, ...perfil };
          paint();
          root.remove();
        },
      })
    );
    root.append(box);
    document.body.append(root);
    box.querySelector("input[type=text]")?.focus({ preventScroll: true });
  }

  chip.addEventListener("click", () => {
    if (menu) return close();
    menu = h("div", "account__menu");
    menu.setAttribute("role", "menu");
    const who = h("div", "account__who");
    who.append(h("strong", null, data.nombre || "Mi cuenta"), h("small", null, `${user.email || ""}${rol === "admin" ? " · admin" : ""}`));
    menu.append(who, item("Editar mi perfil", editProfile));
    if (rol === "admin") {
      menu.append(
        item("📊 Panel de estadísticas", () => (location.href = "admin.html")),
        item("🎁 Ver el Wrapped (vista previa)", () => (location.href = "wrapped.html"))
      );
    }
    menu.append(
      item("Cerrar sesión", async () => {
        await fb.signOut(fb.auth).catch(() => {});
        location.reload();
      }, "is-danger")
    );
    wrap.append(menu);
    chip.setAttribute("aria-expanded", "true");
  });
  document.addEventListener("click", (e) => menu && !wrap.contains(e.target) && close());
  document.addEventListener("keydown", (e) => e.key === "Escape" && close());

  wrap.append(chip);
  document.body.append(wrap);
}
