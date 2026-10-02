// Ilustraciones en SVG para la trivia: jerseys, hoodies y la barra con discos del press de banca.

const JERSEY = "M44 12 24 18 8 40 22 50 30 42 30 108 90 108 90 42 98 50 112 40 96 18 76 12Q60 26 44 12Z";

export function jersey({ base, sleeve = base, number, num = "#fff", outline = "none", stripe = null, edge = "rgba(0,0,0,.28)" }) {
  const stripes = stripe
    ? `<path d="M13 34 27 44M107 34 93 44" stroke="${stripe}" stroke-width="4" fill="none"/>`
    : "";
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
  <path d="${JERSEY}" fill="${base}"/>
  <path d="M24 18 8 40 22 50 30 42 32 24ZM96 18 112 40 98 50 90 42 88 24Z" fill="${sleeve}"/>
  ${stripes}
  <path d="M44 12Q60 26 76 12" stroke="${sleeve}" stroke-width="4" fill="none"/>
  <text x="60" y="90" text-anchor="middle" font-family="Manrope, system-ui, sans-serif" font-weight="800" font-size="38" letter-spacing="-1" fill="${num}" stroke="${outline}" stroke-width="3" paint-order="stroke">${number}</text>
  <path d="${JERSEY}" fill="none" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
}

const HOODIE = "M40 18Q60 0 80 18L100 26 114 94 99 98 92 58 92 110 28 110 28 58 21 98 6 94 20 26Z";

export function hoodie(color, edge = "rgba(0,0,0,.3)") {
  return `<svg viewBox="0 0 120 120" aria-hidden="true">
  <path d="${HOODIE}" fill="${color}"/>
  <ellipse cx="60" cy="22" rx="15" ry="9" fill="rgba(0,0,0,.28)"/>
  <path d="M54 30 53 50M66 30 67 50" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/>
  <path d="M38 78H82L88 100H32Z" fill="rgba(0,0,0,.14)"/>
  <path d="M28 104H92" stroke="rgba(0,0,0,.18)" stroke-width="4"/>
  <path d="${HOODIE}" fill="none" stroke="${edge}" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
}

// [kg, color, alto, ancho]
const PLATES = [
  [25, "#d23c3c", 86, 13],
  [20, "#2f6fde", 86, 11],
  [15, "#f2c230", 74, 10],
  [10, "#2e9e5b", 62, 9],
  [5, "#f6f1f3", 46, 7],
  [2.5, "#8a8487", 36, 6],
];

export function barbell(kg) {
  let side = Math.max(0, (kg - 20) / 2);
  const plates = [];
  for (const p of PLATES) {
    while (side >= p[0] - 1e-9) {
      plates.push(p);
      side -= p[0];
    }
  }
  let left = 70;
  let right = 170;
  const rects = plates
    .map(([, color, hgt, w], i) => {
      const y = 50 - hgt / 2;
      const l = `<rect class="plate" style="--i:${i}" x="${left - w}" y="${y}" width="${w}" height="${hgt}" rx="2" fill="${color}"/>`;
      const r = `<rect class="plate" style="--i:${i}" x="${right}" y="${y}" width="${w}" height="${hgt}" rx="2" fill="${color}"/>`;
      left -= w + 1;
      right += w + 1;
      return l + r;
    })
    .join("");
  return `<svg viewBox="0 0 240 100" aria-hidden="true">
  <rect x="2" y="47" width="236" height="6" rx="3" fill="#bdb5b9"/>
  <rect x="70" y="41" width="6" height="18" rx="2" fill="#8f878b"/>
  <rect x="164" y="41" width="6" height="18" rx="2" fill="#8f878b"/>
  ${rects}
</svg>`;
}
