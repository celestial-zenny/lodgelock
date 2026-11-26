// Generates the security-print linework used on held-rent notes: a guilloche rosette and a guilloche band.
// Both are single-colour SVGs used as CSS masks, so the page decides the ink colour. Re-run after changing a parameter:
//   node scripts/brand/generate-guilloche.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = path.join(root, "public/print");
mkdirSync(outDir, { recursive: true });

const f = (n) => Math.round(n * 2) / 2; // half-unit precision keeps the files small
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** One epitrochoid (a spirograph curve), rotated by `phase`, centred in a 400 x 400 box. */
function epitrochoid(R, r, d, scale, phase, steps) {
  const turns = r / gcd(R, r);
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI * turns;
    const x = (R + r) * Math.cos(t) - d * Math.cos(((R + r) / r) * t);
    const y = (R + r) * Math.sin(t) - d * Math.sin(((R + r) / r) * t);
    const c = Math.cos(phase), s = Math.sin(phase);
    pts.push(`${f(200 + scale * (x * c - y * s))} ${f(200 + scale * (x * s + y * c))}`);
  }
  return `M${pts.join("L")}Z`;
}

// Rosette: three rings of interleaved curves, like the corner rosette of a banknote.
const rings = [
  { R: 13, r: 1, d: 4.2, scale: 10.4, copies: 6, steps: 420 },
  { R: 11, r: 1, d: 3.0, scale: 9.4, copies: 5, steps: 360 },
  { R: 9, r: 1, d: 2.4, scale: 8.4, copies: 4, steps: 300 },
];
const rosettePaths = rings.flatMap((g) =>
  Array.from({ length: g.copies }, (_, k) => epitrochoid(g.R, g.r, g.d, g.scale, (k * 2 * Math.PI) / (g.R * g.copies), g.steps)),
);
writeFileSync(path.join(outDir, "rosette.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><g fill="none" stroke="#000" stroke-width="0.7">` +
  rosettePaths.map((d) => `<path d="${d}"/>`).join("") + `</g></svg>\n`);

// Band: interlaced sine waves, tileable horizontally (one period per 120 units).
const bandPaths = [];
for (let k = 0; k < 9; k++) {
  const amp = 7 + (k % 3) * 2.2, phase = (k * Math.PI) / 4.5, pts = [];
  for (let x = 0; x <= 120; x += 1) pts.push(`${x} ${f(16 + amp * Math.sin((x / 120) * 4 * Math.PI + phase))}`);
  bandPaths.push(`M${pts.join("L")}`);
}
writeFileSync(path.join(outDir, "band.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 32" preserveAspectRatio="none"><g fill="none" stroke="#000" stroke-width="0.5">` +
  bandPaths.map((d) => `<path d="${d}"/>`).join("") + `</g></svg>\n`);

console.log("guilloche written to public/print/");
