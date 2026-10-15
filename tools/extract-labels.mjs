/**
 * Découpe le texte et la croix de chaque lieu (rectangles : tools/label-boxes.json) et écrit :
 *  - Assets/labels/<id>-text.png  (texte + symbole, fond transparent)
 *  - Assets/labels/<id>-patch.png (rustine de texture qui recouvre le texte)
 *  - labels-data.js               (const POI_LABELS = { id: { x, y, w, h } })
 *  - Assets/labels-check-N.png    (planches de contrôle, ignorées par git)
 * Usage : npm run labels
 */
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { GRID } = require('../hex-geometry.js');
const { pointsOfInterest } = require('../poi-data.js');
const { extractLabel } = require('./label-extract.js');

const PAD = 210;       // marge de lecture autour du rectangle (sources de texture de la rustine)
const CHECK_PAD = 30;  // marge affichée sur les planches de contrôle
const PER_SHEET = 5;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'carte-complete.jpg');
const boxes = JSON.parse(readFileSync(path.join(root, 'tools', 'label-boxes.json'), 'utf8'));
const ids = Object.keys(pointsOfInterest);

const missing = ids.filter(id => !boxes[id]);
if (missing.length) throw new Error(`Rectangle manquant pour : ${missing.join(', ')}`);
const unknown = Object.keys(boxes).filter(id => !pointsOfInterest[id]);
if (unknown.length) throw new Error(`Rectangle sans lieu : ${unknown.join(', ')}`);

mkdirSync(path.join(root, 'Assets', 'labels'), { recursive: true });
const rows = [];
const data = {};

for (const id of ids.sort()) {
  const b = boxes[id];
  if (b.x < 0 || b.y < 0 || b.w <= 0 || b.h <= 0 || b.x + b.w > GRID.width || b.y + b.h > GRID.height) {
    throw new Error(`Rectangle hors de la carte pour ${id} : ${JSON.stringify(b)}`);
  }
  const left = Math.max(0, b.x - PAD), top = Math.max(0, b.y - PAD);
  const right = Math.min(GRID.width, b.x + b.w + PAD), bottom = Math.min(GRID.height, b.y + b.h + PAD);
  const { data: rgb, info } = await sharp(file, { limitInputPixels: false })
    .extract({ left, top, width: right - left, height: bottom - top }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const box = { x: b.x - left, y: b.y - top, w: b.w, h: b.h };
  const { text, patch, count } = extractLabel({
    rgb, width: info.width, height: info.height, channels: info.channels, box, params: b.params
  });

  const textPng = await sharp(text, { raw: { width: b.w, height: b.h, channels: 4 } }).png().toBuffer();
  const patchPng = await sharp(patch, { raw: { width: b.w, height: b.h, channels: 4 } }).png().toBuffer();
  writeFileSync(path.join(root, 'Assets', 'labels', `${id}-text.png`), textPng);
  writeFileSync(path.join(root, 'Assets', 'labels', `${id}-patch.png`), patchPng);
  data[id] = { x: b.x, y: b.y, w: b.w, h: b.h };
  console.log(`${id.padEnd(20)} ${count} px de texte, rectangle ${b.w}x${b.h}`);

  // ligne de contrôle : original | texte extrait sur gris | original avec rustine
  const cl = Math.max(0, b.x - CHECK_PAD), ct = Math.max(0, b.y - CHECK_PAD);
  const cr = Math.min(GRID.width, b.x + b.w + CHECK_PAD), cb = Math.min(GRID.height, b.y + b.h + CHECK_PAD);
  const cw = cr - cl, ch = cb - ct, ox = b.x - cl, oy = b.y - ct;
  const crop = await sharp(file, { limitInputPixels: false }).extract({ left: cl, top: ct, width: cw, height: ch }).png().toBuffer();
  const gray = await sharp({ create: { width: cw, height: ch, channels: 3, background: '#808080' } })
    .composite([{ input: textPng, left: ox, top: oy }]).png().toBuffer();
  const patched = await sharp(crop).composite([{ input: patchPng, left: ox, top: oy }]).png().toBuffer();
  const rowW = cw * 3 + 20;
  const title = `<svg xmlns="http://www.w3.org/2000/svg" width="${rowW}" height="22"><rect width="${rowW}" height="22" fill="white"/><text x="4" y="16" font-size="15" font-family="Arial" font-weight="bold">${id} : ${count} px de texte</text></svg>`;
  const row = await sharp({ create: { width: rowW, height: ch + 22, channels: 3, background: 'white' } })
    .composite([
      { input: Buffer.from(title), left: 0, top: 0 },
      { input: crop, left: 0, top: 22 },
      { input: gray, left: cw + 10, top: 22 },
      { input: patched, left: 2 * cw + 20, top: 22 }
    ]).png().toBuffer();
  rows.push({ buf: row, w: rowW, h: ch + 22 });
}

const entries = Object.entries(data).map(([id, v]) => `  ${JSON.stringify(id)}: ${JSON.stringify(v)}`);
writeFileSync(
  path.join(root, 'labels-data.js'),
  '// Fichier généré par tools/extract-labels.mjs : ne pas modifier à la main.\n' +
  `const POI_LABELS = {\n${entries.join(',\n')}\n};\n`
);

for (let i = 0, n = 1; i < rows.length; i += PER_SHEET, n++) {
  const grp = rows.slice(i, i + PER_SHEET);
  const w = Math.max(...grp.map(r => r.w));
  const h = grp.reduce((s, r) => s + r.h + 8, 0);
  let top = 0;
  const comp = grp.map(r => { const c = { input: r.buf, left: 0, top }; top += r.h + 8; return c; });
  await sharp({ create: { width: w, height: h, channels: 3, background: 'white' } })
    .composite(comp).png().toFile(path.join(root, 'Assets', `labels-check-${n}.png`));
}
console.log(`${ids.length} lieux écrits ; planches : Assets/labels-check-*.png`);
