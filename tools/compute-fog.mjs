/**
 * Calcule les cases « brouillard » : celles où Assets/carte-vierge.jpg diffère de Assets/carte-complete.jpg
 * ET qui sont réellement voilées (fond plat) dans Assets/carte-vierge.jpg.
 * Écrit fog-data.js (chargé par index.html) et Assets/fog-check.png (contrôle visuel).
 * Usage : npm run fog
 */
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { GRID, enumerateHexes, getPoints } = require('../hex-geometry.js');
const { diffRatioInHex, colorRatioInHex } = require('./fog-metrics.js');

// Réglages : à ajuster en regardant Assets/fog-check.png
const TOLERANCE = 40;   // écart max par canal (0-255) toléré comme bruit JPEG
const FOG_RATIO = 0.01; // part minimale de pixels différents pour qu'une case soit « brouillard »
// Une case n'est « brouillard » que si elle est réellement voilée dans la carte vierge : le voile est
// une couleur plate exacte ; une case dont la part de cette couleur est inférieure à BLANK_RATIO
// montre du terrain imprimé (elle ne diffère que par une teinte ou une annotation MJ) et reste visible.
const BLANK_COLOR = [255, 246, 221]; // couleur du fond voilé de la carte vierge
const BLANK_TOLERANCE = 3;           // écart max par canal par rapport à BLANK_COLOR
const BLANK_RATIO = 0.08;            // part minimale de pixels de fond voilé (carte vierge)

// Légende de la carte (bas gauche) : absente de la carte vierge, elle doit rester visible en permanence.
// Rectangle en pixels de l'image ; une case différente dont le centre y tombe est « toujours visible ».
const LEGEND_BOX = { x0: 350, y0: 8100, x1: 1600, y1: 8600 };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadRaw(file) {
  const { data, info } = await sharp(path.join(root, file), { limitInputPixels: false })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.width !== GRID.width || info.height !== GRID.height) {
    throw new Error(`${file} fait ${info.width}x${info.height}, attendu ${GRID.width}x${GRID.height}`);
  }
  return { data, channels: info.channels };
}

const complete = await loadRaw('Assets/carte-complete.jpg');
const vierge = await loadRaw('Assets/carte-vierge.jpg');

if (complete.channels !== vierge.channels) {
  throw new Error(`Nombre de canaux différent : ${complete.channels} (complète) contre ${vierge.channels} (vierge)`);
}

const hexes = enumerateHexes();
const changed = hexes.filter(h =>
  diffRatioInHex(complete.data, vierge.data, GRID.width, GRID.height, complete.channels,
    h.cx, h.cy, GRID.R, TOLERANCE) >= FOG_RATIO
);
const inLegend = h => h.cx >= LEGEND_BOX.x0 && h.cx <= LEGEND_BOX.x1 && h.cy >= LEGEND_BOX.y0 && h.cy <= LEGEND_BOX.y1;
const visible = changed.filter(inLegend);
const isVeiled = h =>
  colorRatioInHex(vierge.data, GRID.width, GRID.height, vierge.channels,
    h.cx, h.cy, GRID.R, BLANK_COLOR, BLANK_TOLERANCE) >= BLANK_RATIO;
const fog = changed.filter(h => !inLegend(h) && isVeiled(h));
const changedVisible = changed.filter(h => !inLegend(h) && !isVeiled(h));

const keys = fog.map(h => `${h.q},${h.r}`);
const visibleKeys = visible.map(h => `${h.q},${h.r}`);
const lines = [];
for (let i = 0; i < keys.length; i += 20) {
  lines.push('  ' + keys.slice(i, i + 20).map(k => JSON.stringify(k)).join(', '));
}
writeFileSync(
  path.join(root, 'fog-data.js'),
  '// Fichier généré par tools/compute-fog.mjs : ne pas modifier à la main.\n' +
  `// ${keys.length} cases sous le voile (FOG_HEX_KEYS) sur ${hexes.length}.\n` +
  `// ${visibleKeys.length} cases de légende toujours visibles, non interactives (ALWAYS_VISIBLE_HEX_KEYS).\n` +
  `const FOG_HEX_KEYS = [\n${lines.join(',\n')}\n];\n` +
  `const ALWAYS_VISIBLE_HEX_KEYS = [${visibleKeys.map(k => JSON.stringify(k)).join(', ')}];\n`
);

// Image de contrôle : cases « brouillard » en rouge, cases toujours visibles en vert
const poly = (h, color) => {
  const pts = getPoints(h.cx, h.cy).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<polygon points="${pts}" fill="${color}" fill-opacity="0.45"/>`;
};
const polys = fog.map(h => poly(h, 'red')).join('') + visible.map(h => poly(h, 'green')).join('') +
  changedVisible.map(h => poly(h, 'blue')).join('');
const outW = 1640;
const outH = Math.round((GRID.height * outW) / GRID.width);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID.width} ${GRID.height}" width="${outW}" height="${outH}">${polys}</svg>`;
await sharp(path.join(root, 'Assets', 'carte-complete.jpg'), { limitInputPixels: false })
  .resize(outW, outH)
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(path.join(root, 'Assets', 'fog-check.png'));

console.log(`${keys.length} cases brouillard (rouge) ; ${visibleKeys.length} cases de légende toujours visibles (vert) ; ` +
  `${changedVisible.length} cases qui diffèrent mais restent visibles (bleu) ; sur ${hexes.length} ` +
  `(tolérance ${TOLERANCE}, seuil ${FOG_RATIO * 100} %, fond voilé ≥ ${BLANK_RATIO * 100} %)`);
