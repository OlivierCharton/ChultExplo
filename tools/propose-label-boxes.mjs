/**
 * Propose un rectangle de texte par lieu (tools/label-boxes.json) à partir de sa case centrale :
 * on cherche, près du centre de la case, la forme de texte (lettres + halo + symbole) et on prend son cadre.
 * C'est un point de départ : à vérifier sur Assets/labels-check-*.png (npm run labels) puis à corriger
 * à la main dans le JSON (rectangle, ou "params" propres au lieu).
 * Refuse d'écraser un tools/label-boxes.json existant (réglé à la main) sauf avec --force.
 * Usage : npm run labels:propose [-- --force]
 */
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { GRID, getCenter } = require('../hex-geometry.js');
const { pointsOfInterest } = require('../poi-data.js');
const { buildTextMask, dilate, erode, components } = require('./label-extract.js');

const WINDOW_X = 380;  // demi-largeur de la fenêtre d'analyse autour du centre (px)
const WINDOW_Y = 260;  // demi-hauteur
const JOIN = 5;        // fermeture qui relie lettres, lignes et symbole d'un même lieu (px)
const MAX_W = 330;     // largeur max d'une forme de texte retenue (px)
const MAX_H = 130;     // hauteur max
const GAP = 22;        // écart max entre deux formes d'un même nom (px)
const SEARCH = 70;     // distance max entre le centre de la case et le texte retenu (px)
const MARGIN = 6;      // marge ajoutée autour du texte (px)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'tools', 'label-boxes.json');
if (existsSync(out) && !process.argv.includes('--force')) {
  console.error('tools/label-boxes.json existe déjà (rectangles réglés à la main) : il ne sera pas écrasé.');
  console.error('Relance avec --force pour le remplacer : npm run labels:propose -- --force');
  process.exit(1);
}
const file = path.join(root, 'carte-complete.jpg');
const boxes = {};

for (const [id, poi] of Object.entries(pointsOfInterest)) {
  const { cx, cy } = getCenter(poi.centerHex.q, poi.centerHex.r);
  const left = Math.max(0, Math.round(cx - WINDOW_X));
  const top = Math.max(0, Math.round(cy - WINDOW_Y));
  const width = Math.min(2 * WINDOW_X, GRID.width - left);
  const height = Math.min(2 * WINDOW_Y, GRID.height - top);

  const { data, info } = await sharp(file, { limitInputPixels: false })
    .extract({ left, top, width, height }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const whole = { x: 0, y: 0, w: width, h: height };
  const mask = buildTextMask(data, width, height, info.channels, whole);
  const joined = erode(dilate(mask, width, height, JOIN), width, height, JOIN);
  const { labels } = components(joined, width, height);

  // boîte de chaque forme jointe ; on écarte les formes trop grandes (rivières, contours de terrain)
  const nLab = labels.reduce((m, v) => (v > m ? v : m), 0) + 1;
  const bb = Array.from({ length: nLab }, () => ({ x0: width, y0: height, x1: -1, y1: -1, near: false }));
  const ccx = Math.round(cx - left), ccy = Math.round(cy - top);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const l = labels[i];
      if (!l || !mask[i]) continue;
      const o = bb[l];
      if (x < o.x0) o.x0 = x; if (x > o.x1) o.x1 = x;
      if (y < o.y0) o.y0 = y; if (y > o.y1) o.y1 = y;
      if (Math.abs(x - ccx) <= SEARCH && Math.abs(y - ccy) <= SEARCH) o.near = true;
    }
  }
  const small = l => l > 0 && bb[l].x1 >= 0 && bb[l].x1 - bb[l].x0 <= MAX_W && bb[l].y1 - bb[l].y0 <= MAX_H;
  const chosen = new Set();
  for (let l = 1; l < nLab; l++) if (small(l) && bb[l].near) chosen.add(l);
  for (let again = true; again;) {   // ajoute les formes voisines (lignes d'un même nom)
    again = false;
    for (let l = 1; l < nLab; l++) {
      if (chosen.has(l) || !small(l)) continue;
      for (const c of chosen) {
        if (bb[l].x0 - GAP <= bb[c].x1 && bb[c].x0 - GAP <= bb[l].x1 && bb[l].y0 - GAP <= bb[c].y1 && bb[c].y0 - GAP <= bb[l].y1) {
          chosen.add(l); again = true; break;
        }
      }
    }
  }
  if (!chosen.size) {
    console.warn(`Aucun texte trouvé près de ${id} (${poi.centerHex.q},${poi.centerHex.r}) : rectangle par défaut`);
    boxes[id] = { x: Math.round(cx - 160), y: Math.round(cy - 60), w: 320, h: 160 };
    continue;
  }
  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (const l of chosen) {
    minX = Math.min(minX, bb[l].x0); minY = Math.min(minY, bb[l].y0);
    maxX = Math.max(maxX, bb[l].x1); maxY = Math.max(maxY, bb[l].y1);
  }
  const x0 = Math.max(0, left + minX - MARGIN);
  const y0 = Math.max(0, top + minY - MARGIN);
  const x1 = Math.min(GRID.width, left + maxX + MARGIN + 1);
  const y1 = Math.min(GRID.height, top + maxY + MARGIN + 1);
  boxes[id] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const sorted = Object.fromEntries(Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(out, JSON.stringify(sorted, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} rectangles écrits dans tools/label-boxes.json`);
