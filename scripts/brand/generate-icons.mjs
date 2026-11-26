// Renders the LodgeLock logo into every icon the app needs. Re-run after changing the mark:
//   node scripts/brand/generate-icons.mjs
// Needs Playwright with Chromium (dev machines / CI only; not a runtime dependency).
// Outputs: src/app/icon.svg, src/app/favicon.ico, src/app/apple-icon.png, public/icons/*.png,
//          src/app/opengraph-image.png and src/app/twitter-image.png (+ .alt.txt).
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// require() so a globally installed Playwright works too (NODE_PATH=$(npm root -g)).
const { chromium } = createRequire(import.meta.url)("playwright");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const out = (p) => path.join(root, p);

const INDIGO = "#2c2f86";
const NIGHT = "#13153a";
const BRASS = "#f2b42b";

// Same geometry as src/components/logo.tsx (48 x 48 grid).
const SHACKLE = "M14 23.5V18.6L24 10l10 8.6v4.9";
const KEYHOLE = "M24 26.2a3.2 3.2 0 0 1 1.7 5.9l.9 4.4h-5.2l.9-4.4a3.2 3.2 0 0 1 1.7-5.9Z";

/** The app-icon mark: brass shackle, white body, indigo keyhole, on an indigo tile. */
function tileSvg({ size, radius = 11, inset = 0, bg = INDIGO }) {
  const s = (48 - inset * 2) / 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}">
  <rect width="48" height="48" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${inset} ${inset}) scale(${s})">
    <path d="${SHACKLE}" fill="none" stroke="${BRASS}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="10" y="22" width="28" height="19" rx="4.5" fill="#ffffff"/>
    <path d="${KEYHOLE}" fill="${bg}"/>
  </g>
</svg>`;
}

const fontUrl = "data:font/woff2;base64," + readFileSync(out("src/app/fonts/BricolageGrotesque-Latin.woff2")).toString("base64");
const fontCss = `@font-face{font-family:B;src:url(${fontUrl}) format("woff2");font-weight:200 800;font-stretch:75% 100%}`;

const ogHtml = `<!doctype html><html><head><style>${fontCss}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:${NIGHT};color:#fff;font-family:B;display:flex;flex-direction:column;
  justify-content:space-between;padding:72px 80px;position:relative;overflow:hidden}
.brand{display:flex;align-items:center;gap:22px;font-size:46px;font-weight:800;font-variation-settings:"wdth" 82,"opsz" 48;letter-spacing:-.01em}
h1{font-size:92px;line-height:.98;font-weight:800;font-variation-settings:"wdth" 78,"opsz" 96;letter-spacing:-.02em;max-width:900px}
p{font-size:30px;color:#c9ccf0;font-variation-settings:"opsz" 24;max-width:980px;line-height:1.3}
.bar{width:120px;height:10px;border-radius:5px;background:${BRASS};margin-bottom:36px}
</style></head><body>
<div class="brand">${tileSvg({ size: 76 })}LodgeLock</div>
<div><div class="bar"></div><h1>Your rent stays locked until you get the keys.</h1>
<p style="margin-top:28px">Verified lodges near FUTO: Eziobodo, Umuchima and Ihiagwa.</p></div>
</body></html>`;

/** PNG-in-ICO container (Vista+): header, directory, then the PNGs. */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(pngs.length, 4);
  const dir = Buffer.alloc(16 * pngs.length);
  let offset = 6 + dir.length;
  pngs.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2); dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4); dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8); dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([header, dir, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function renderSvg(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  return page.locator("svg").screenshot({ omitBackground: true });
}

writeFileSync(out("src/app/icon.svg"), tileSvg({ size: 48 }) + "\n");
writeFileSync(out("public/icons/icon-192.png"), await renderSvg(tileSvg({ size: 192 }), 192));
writeFileSync(out("public/icons/icon-512.png"), await renderSvg(tileSvg({ size: 512 }), 512));
// Maskable: full-bleed square, mark inside the 80% safe zone.
writeFileSync(out("public/icons/maskable-512.png"), await renderSvg(tileSvg({ size: 512, radius: 0, inset: 7 }), 512));
// Apple applies its own corner mask: give it a square.
writeFileSync(out("src/app/apple-icon.png"), await renderSvg(tileSvg({ size: 180, radius: 0, inset: 4 }), 180));
const icoPngs = [];
for (const size of [16, 32, 48]) icoPngs.push({ size, data: await renderSvg(tileSvg({ size }), size) });
writeFileSync(out("src/app/favicon.ico"), ico(icoPngs));

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(ogHtml);
await page.evaluate(() => document.fonts.ready);
const og = await page.screenshot({ type: "png" });
const alt = "LodgeLock: your rent stays locked until you get the keys. Verified lodges near FUTO.\n";
for (const name of ["opengraph-image", "twitter-image"]) {
  writeFileSync(out(`src/app/${name}.png`), og);
  writeFileSync(out(`src/app/${name}.alt.txt`), alt);
}

await browser.close();
console.log("brand assets written");
