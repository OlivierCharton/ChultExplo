# Grille de brouillard exacte : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre cliquables toutes les cases de lisière du voile de `carte-vierge.jpg`, en calculant exactement les cases « brouillard » et en laissant les cases visibles au départ totalement inertes.

**Architecture:** Un module de géométrie hexagonale unique (`hex-geometry.js`), partagé entre le navigateur et un script Node hors ligne. Ce script (`tools/compute-fog.mjs`) compare les deux images case par case et écrit `fog-data.js` (liste des clés `q,r` sous le voile). `app.js` ne crée polygones, grille et trous de masque que pour ces cases ; tout le reste de la carte est visible et non interactif.

**Tech Stack:** HTML/CSS/JS sans build côté navigateur (doit fonctionner en `file://`), Node 24 + `sharp` (dev uniquement), `node:test` pour les tests.

## Global Constraints

Reprises de la spec `Docs/superpowers/specs/2026-10-15-grille-brouillard-design.md` :

- `index.html` doit fonctionner en `file://` : aucun `fetch` de JSON, aucun module ES côté navigateur, le runtime ne dépend pas de Node.
- Une case visible au départ n'a ni polygone, ni ligne de grille, ni trou de masque ; elle ne peut être ni cliquée ni masquée (clic, Ctrl+clic, clic droit, pinceau sans effet).
- Une case est « brouillard » dès qu'elle contient une part même faible (~1 %) de pixels qui diffèrent entre les deux images, bruit JPEG ignoré. Seuil et tolérance sont des constantes en tête du script.
- Sauvegarde : même clé `chult_explo_save_v1`, aucun changement de format, aucune migration. Le chargement (localStorage et import JSON) ignore les clés hors `FOG_HEX_KEYS`.
- Un POI dont la case centrale n'est pas dans le brouillard est révélé dès le départ ; la console liste ces POI au démarrage.
- Les compteurs d'exploration se basent sur `FOG_HEX_KEYS.length`.
- Supprimer des fichiers existants : les lister à l'utilisateur et attendre son accord avant tout `git rm`.
- Travail sur la branche `wip`. Ne jamais ajouter `id_ed25519_chult*` à git.
- Messages de commit terminés par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Sur Windows, le dossier existant s'appelle `Docs` (majuscule) : toujours utiliser ce chemin dans `git add`.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `hex-geometry.js` (créer) | Géométrie de la grille : constantes calibrées, centre/sommets d'une case, test d'appartenance d'un point, énumération des cases de l'image. Chargé par `index.html` (global `HexGeometry`) et par Node (`require`). |
| `tools/fog-metrics.js` (créer) | Fonction pure `diffRatioInHex` : part de pixels qui diffèrent dans un hexagone. |
| `tools/compute-fog.mjs` (créer) | Script hors ligne : lit les deux JPG, écrit `fog-data.js` et `Assets/fog-check.png`. |
| `fog-data.js` (généré) | `const FOG_HEX_KEYS = [...]`. |
| `test/hex-geometry.test.js`, `test/fog-metrics.test.js` (créer) | Tests `node:test`. |
| `package.json` (créer) | Scripts `test` et `fog`, dépendance de dev `sharp`. |
| `app.js` (modifier) | Utilise `HexGeometry` et `FOG_HEX_KEYS`, supprime `BLANK_HEX_COORDINATES`. |
| `index.html` (modifier) | Charge `hex-geometry.js` et `fog-data.js` avant `app.js`. |

---

### Task 1: Module de géométrie hexagonale partagé

**Files:**
- Create: `package.json`, `hex-geometry.js`, `test/hex-geometry.test.js`
- Modify: `app.js:8-19` (MAP_CONFIG), `app.js:320-345` (HexMath.getCenter/getPoints), `index.html:290`

**Interfaces:**
- Produces (`HexGeometry`, global navigateur ou `require('./hex-geometry.js')`) :
  - `GRID`: `{ width, height, dx, dy, x0, y0, R }` (objet gelé)
  - `getCenter(q, r) -> { cx, cy }`
  - `getPoints(cx, cy, radius = GRID.R) -> Array<{ x, y }>` (6 sommets, flat-topped)
  - `containsPoint(cx, cy, x, y, radius = GRID.R) -> boolean`
  - `enumerateHexes() -> Array<{ q, r, cx, cy }>` (toutes les cases dont le centre est dans l'image)

- [ ] **Step 1: Créer `package.json` et écrire le test qui échoue**

`package.json` :

```json
{
  "name": "chult-explo",
  "private": true,
  "description": "Carte interactive de Chult avec brouillard de guerre hexagonal",
  "scripts": {
    "test": "node --test \"test/**/*.test.js\"",
    "fog": "node tools/compute-fog.mjs"
  }
}
```

`test/hex-geometry.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes } = require('../hex-geometry.js');

const near = (a, b, eps = 0.1) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('getCenter reproduit les centres calibrés connus', () => {
  const c = getCenter(20, 49);
  near(c.cx, 1726.9);
  near(c.cy, 4742.7);
  near(getCenter(20, 51).cy, 4935.6);
});

test('getCenter décale les colonnes impaires de dy/2', () => {
  const even = getCenter(20, 49);
  const odd = getCenter(21, 49);
  near(odd.cy - even.cy, GRID.dy / 2);
  near(odd.cx - even.cx, GRID.dx);
});

test('getPoints renvoie 6 sommets flat-topped', () => {
  const pts = getPoints(100, 100, 10);
  assert.equal(pts.length, 6);
  near(pts[2].x, 110); // pointe droite
  near(pts[5].x, 90);  // pointe gauche
  near(pts[0].y, 100 - (Math.sqrt(3) * 10) / 2);
});

test('containsPoint accepte l\'intérieur et refuse l\'extérieur', () => {
  const R = 10;
  const h = Math.sqrt(3) * R;
  assert.equal(containsPoint(100, 100, 100, 100, R), true);
  assert.equal(containsPoint(100, 100, 100 + R - 1, 100, R), true);
  assert.equal(containsPoint(100, 100, 100 + R + 1, 100, R), false);
  assert.equal(containsPoint(100, 100, 100, 100 + h / 2 - 1, R), true);
  assert.equal(containsPoint(100, 100, 100, 100 + h / 2 + 1, R), false);
  // coin : dans le rectangle englobant mais hors de l'hexagone
  assert.equal(containsPoint(100, 100, 100 + R - 1, 100 + h / 2 - 1, R), false);
});

test('enumerateHexes couvre toute l\'image sans doublon', () => {
  const hexes = enumerateHexes();
  assert.ok(hexes.length > 7000 && hexes.length < 7600, `count=${hexes.length}`);
  const keys = new Set(hexes.map(h => `${h.q},${h.r}`));
  assert.equal(keys.size, hexes.length);
  assert.ok(keys.has('20,49'));
  for (const h of hexes) {
    assert.ok(h.cx >= 0 && h.cx <= GRID.width, `cx ${h.cx}`);
    assert.ok(h.cy >= 0 && h.cy <= GRID.height, `cy ${h.cy}`);
  }
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test`
Expected: FAIL avec `Cannot find module '../hex-geometry.js'`.

- [ ] **Step 3: Écrire `hex-geometry.js`**

```js
/**
 * Géométrie de la grille hexagonale de la carte de Chult (flat-topped).
 * Partagé entre le navigateur (global HexGeometry) et Node (tools/compute-fog.mjs, tests).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.HexGeometry = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Calibrage de la carte de Chult (6563 x 8925 px)
  const GRID = Object.freeze({
    width: 6563,
    height: 8925,
    dx: 83.51082968693343,
    dy: 96.43,
    x0: 56.7053015834631,
    y0: 17.64,
    R: 55.67388645795562
  });

  function getCenter(q, r) {
    const cx = GRID.x0 + q * GRID.dx;
    const shift = (Math.abs(q) % 2 === 1) ? (GRID.dy / 2) : 0;
    const cy = GRID.y0 + r * GRID.dy + shift;
    return { cx, cy };
  }

  function getPoints(cx, cy, radius = GRID.R) {
    const h = Math.sqrt(3) * radius;
    return [
      { x: cx - radius / 2, y: cy - h / 2 },
      { x: cx + radius / 2, y: cy - h / 2 },
      { x: cx + radius,     y: cy },
      { x: cx + radius / 2, y: cy + h / 2 },
      { x: cx - radius / 2, y: cy + h / 2 },
      { x: cx - radius,     y: cy }
    ];
  }

  function containsPoint(cx, cy, x, y, radius = GRID.R) {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    const halfH = (Math.sqrt(3) * radius) / 2;
    if (dx > radius || dy > halfH) return false;
    return dy <= Math.sqrt(3) * (radius - dx);
  }

  function enumerateHexes() {
    const hexes = [];
    for (let q = 0; ; q++) {
      const { cx } = getCenter(q, 0);
      if (cx > GRID.width) break;
      for (let r = 0; ; r++) {
        const { cy } = getCenter(q, r);
        if (cy > GRID.height) break;
        hexes.push({ q, r, cx, cy: getCenter(q, r).cy });
      }
    }
    return hexes;
  }

  return { GRID, getCenter, getPoints, containsPoint, enumerateHexes };
});
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (5 tests).

- [ ] **Step 5: Brancher `app.js` et `index.html` sur le module**

Dans `index.html`, ligne 290, remplacer :

```html
  <script src="app.js"></script>
```

par :

```html
  <script src="hex-geometry.js"></script>
  <script src="app.js"></script>
```

Dans `app.js`, remplacer le bloc `MAP_CONFIG` (lignes 8-19) :

```js
// 1. Configuration géométrique calibrée de la carte de Chult (6563 x 8925 px)
const MAP_CONFIG = {
  width: 6563,
  height: 8925,
  dx: 83.51082968693343,
  dy: 96.43,
  x0: 56.7053015834631,
  y0: 17.64,
  R: 55.67388645795562,
  minZoom: 0.12,
  maxZoom: 2.5
};
```

par :

```js
// 1. Configuration géométrique calibrée de la carte de Chult (6563 x 8925 px)
// La géométrie de la grille vit dans hex-geometry.js (partagée avec tools/compute-fog.mjs).
const MAP_CONFIG = {
  ...HexGeometry.GRID,
  minZoom: 0.12,
  maxZoom: 2.5
};
```

Dans `HexMath`, remplacer `getCenter` et `getPoints` (lignes 323-340) :

```js
  getCenter(q, r) {
    const cx = MAP_CONFIG.x0 + q * MAP_CONFIG.dx;
    const shift = (Math.abs(q) % 2 === 1) ? (MAP_CONFIG.dy / 2) : 0;
    const cy = MAP_CONFIG.y0 + r * MAP_CONFIG.dy + shift;
    return { cx, cy };
  },

  getPoints(cx, cy, radius = MAP_CONFIG.R) {
    const h = Math.sqrt(3) * radius;
    return [
      { x: cx - radius / 2, y: cy - h / 2 },
      { x: cx + radius / 2, y: cy - h / 2 },
      { x: cx + radius,     y: cy },
      { x: cx + radius / 2, y: cy + h / 2 },
      { x: cx - radius / 2, y: cy + h / 2 },
      { x: cx - radius,     y: cy }
    ];
  },
```

par :

```js
  getCenter(q, r) {
    return HexGeometry.getCenter(q, r);
  },

  getPoints(cx, cy, radius = MAP_CONFIG.R) {
    return HexGeometry.getPoints(cx, cy, radius);
  },
```

- [ ] **Step 6: Vérifier que l'application charge toujours à l'identique**

Ouvrir `file:///C:/git/Others/ChultExplo/index.html` dans le navigateur (si `file://` est refusé : `npx --yes http-server . -p 8080` puis `http://localhost:8080`). Dans la console :

```js
[document.querySelectorAll('.hex-cell').length, chultApp.allHexMap.size, HexGeometry.GRID.R]
```

Expected: `[917 + (nb de centres de POI hors brouillard), mêmes, 55.67…]` ; aucune erreur console ; la grille s'affiche comme avant.

- [ ] **Step 7: Commit**

```bash
git add package.json hex-geometry.js test/hex-geometry.test.js app.js index.html
git commit -m "refactor: extraire la géométrie hexagonale dans hex-geometry.js

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Script de calcul du brouillard et fichier `fog-data.js`

**Files:**
- Create: `tools/fog-metrics.js`, `tools/compute-fog.mjs`, `test/fog-metrics.test.js`
- Generate: `fog-data.js`, `Assets/fog-check.png`
- Modify: `package.json` (ajout de `sharp` par npm), `package-lock.json` (généré)

**Interfaces:**
- Consumes: `HexGeometry.enumerateHexes()`, `getPoints`, `containsPoint`, `GRID` (Task 1)
- Produces:
  - `diffRatioInHex(a, b, width, height, channels, cx, cy, R, tolerance) -> number` (0..1), où `a` et `b` sont des buffers raw entrelacés (`channels` octets par pixel)
  - `fog-data.js` : `const FOG_HEX_KEYS = ["q,r", ...];`

- [ ] **Step 1: Écrire le test qui échoue**

`test/fog-metrics.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { diffRatioInHex } = require('../tools/fog-metrics.js');

const W = 60, H = 60, C = 3;
const blank = () => Buffer.alloc(W * H * C, 0);

function fillRect(buf, x0, y0, x1, y1, value) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      buf[i] = buf[i + 1] = buf[i + 2] = value;
    }
  }
}

const hex = { cx: 30, cy: 30, R: 10 };
const ratio = (a, b, tol = 40) => diffRatioInHex(a, b, W, H, C, hex.cx, hex.cy, hex.R, tol);

test('images identiques : ratio 0', () => {
  assert.equal(ratio(blank(), blank()), 0);
});

test('hexagone entièrement différent : ratio 1', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 255);
  assert.equal(ratio(blank(), b), 1);
});

test('différence hors de l\'hexagone : ratio 0', () => {
  const b = blank();
  fillRect(b, 0, 0, 10, 10, 255);
  assert.equal(ratio(blank(), b), 0);
});

test('bruit sous la tolérance ignoré', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 10);
  assert.equal(ratio(blank(), b, 40), 0);
});

test('moitié gauche différente : ratio proche de 0.5', () => {
  const b = blank();
  fillRect(b, 0, 0, 30, H, 255);
  const r = ratio(blank(), b);
  assert.ok(r > 0.4 && r < 0.6, `ratio=${r}`);
});

test('hexagone coupé par le bord de l\'image ne plante pas', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 255);
  const r = diffRatioInHex(blank(), b, W, H, C, 2, 2, 10, 40);
  assert.equal(r, 1);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `npm test`
Expected: FAIL avec `Cannot find module '../tools/fog-metrics.js'`.

- [ ] **Step 3: Écrire `tools/fog-metrics.js`**

```js
const { containsPoint } = require('../hex-geometry.js');

/**
 * Part (0..1) des pixels d'un hexagone dont les deux images diffèrent
 * d'au moins `tolerance` sur un canal. `a` et `b` : buffers raw entrelacés.
 */
function diffRatioInHex(a, b, width, height, channels, cx, cy, R, tolerance) {
  const halfH = (Math.sqrt(3) * R) / 2;
  const xMin = Math.max(0, Math.floor(cx - R));
  const xMax = Math.min(width - 1, Math.ceil(cx + R));
  const yMin = Math.max(0, Math.floor(cy - halfH));
  const yMax = Math.min(height - 1, Math.ceil(cy + halfH));

  let total = 0;
  let diff = 0;
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      if (!containsPoint(cx, cy, x + 0.5, y + 0.5, R)) continue;
      total++;
      const i = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        if (Math.abs(a[i + c] - b[i + c]) > tolerance) {
          diff++;
          break;
        }
      }
    }
  }
  return total === 0 ? 0 : diff / total;
}

module.exports = { diffRatioInHex };
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (11 tests au total).

- [ ] **Step 5: Installer `sharp` et écrire `tools/compute-fog.mjs`**

Run: `npm install --save-dev sharp`
Expected: `package.json` gagne `devDependencies.sharp`, `package-lock.json` est créé, `node_modules/` est ignoré par git.

`tools/compute-fog.mjs` :

```js
/**
 * Calcule les cases « brouillard » : celles où carte-vierge.jpg diffère de carte-complete.jpg.
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
const { diffRatioInHex } = require('./fog-metrics.js');

// Réglages : à ajuster en regardant Assets/fog-check.png
const TOLERANCE = 40;   // écart max par canal (0-255) toléré comme bruit JPEG
const FOG_RATIO = 0.01; // part minimale de pixels différents pour qu'une case soit « brouillard »

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

const complete = await loadRaw('carte-complete.jpg');
const vierge = await loadRaw('carte-vierge.jpg');

const hexes = enumerateHexes();
const fog = hexes.filter(h =>
  diffRatioInHex(complete.data, vierge.data, GRID.width, GRID.height, complete.channels,
    h.cx, h.cy, GRID.R, TOLERANCE) >= FOG_RATIO
);

const keys = fog.map(h => `${h.q},${h.r}`);
const lines = [];
for (let i = 0; i < keys.length; i += 20) {
  lines.push('  ' + keys.slice(i, i + 20).map(k => JSON.stringify(k)).join(', '));
}
writeFileSync(
  path.join(root, 'fog-data.js'),
  '// Fichier généré par tools/compute-fog.mjs : ne pas modifier à la main.\n' +
  `// ${keys.length} cases sous le voile sur ${hexes.length}.\n` +
  `const FOG_HEX_KEYS = [\n${lines.join(',\n')}\n];\n`
);

// Image de contrôle : cases « brouillard » en rouge sur la carte complète
const polys = fog.map(h => {
  const pts = getPoints(h.cx, h.cy).map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  return `<polygon points="${pts}" fill="red" fill-opacity="0.45"/>`;
}).join('');
const outW = 1640;
const outH = Math.round((GRID.height * outW) / GRID.width);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID.width} ${GRID.height}" width="${outW}" height="${outH}">${polys}</svg>`;
await sharp(path.join(root, 'carte-complete.jpg'), { limitInputPixels: false })
  .resize(outW, outH)
  .composite([{ input: Buffer.from(svg) }])
  .png()
  .toFile(path.join(root, 'Assets', 'fog-check.png'));

console.log(`${keys.length} cases en brouillard sur ${hexes.length} (tolérance ${TOLERANCE}, seuil ${FOG_RATIO * 100} %)`);
```

- [ ] **Step 6: Générer `fog-data.js`**

Run: `npm run fog`
Expected: une ligne `N cases en brouillard sur ~7250 (tolérance 40, seuil 1 %)` avec N autour de 1000 à 1400 ; création de `fog-data.js` et `Assets/fog-check.png`. Si le script échoue sur les dimensions, les JPG ne font pas 6563×8925 : s'arrêter et le signaler.

- [ ] **Step 7: Vérifier que le résultat contient l'ancienne détection et lister les nouvelles cases**

Run (depuis la racine du dépôt) :

```bash
node -e "
const fs=require('fs');
const old=new Set(JSON.parse(fs.readFileSync('blank_coords.json','utf8')).map(c=>c.q+','+c.r));
const src=fs.readFileSync('fog-data.js','utf8');
const fog=new Set(eval(src+';FOG_HEX_KEYS'));
const missing=[...old].filter(k=>!fog.has(k));
const added=[...fog].filter(k=>!old.has(k));
console.log('anciennes cases absentes du nouveau calcul :',missing.length,missing.slice(0,10));
console.log('nouvelles cases (lisière) :',added.length,added.slice(0,8));
"
```

Expected : `anciennes cases absentes` proche de 0 (quelques cases d'une ancienne détection trop généreuse sont tolérées ; si c'est plus de ~3 % de 917, baisser `TOLERANCE` ou `FOG_RATIO` et relancer `npm run fog`). Noter les 8 « nouvelles cases » : elles servent de cibles de clic à la Task 3.

- [ ] **Step 8: Contrôle visuel avec l'utilisateur**

Ouvrir `Assets/fog-check.png` et vérifier que la zone rouge enveloppe tout le voile, y compris autour de Camp Vengeance, Mbala, Ataaz Kahakla, Kir Sabal et Valley of Dread, sans déborder largement sur la mer ni sur la zone de Port Nyanzaru. Demander à l'utilisateur de valider ou d'ajuster `TOLERANCE` / `FOG_RATIO` avant de continuer.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tools test/fog-metrics.test.js fog-data.js Assets/fog-check.png
git commit -m "feat: calculer le brouillard exact case par case (tools/compute-fog.mjs)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `app.js` ne gère plus que les cases du brouillard

**Files:**
- Modify: `index.html:290`, `app.js` (blocs détaillés ci-dessous)

**Interfaces:**
- Consumes: `FOG_HEX_KEYS` (global de `fog-data.js`), `HexGeometry` (Task 1)
- Produces: `ChultMapApp.fogKeys: Set<string>`, `allHexMap` limitée aux cases du brouillard (`{ key, q, r, cx, cy, pointsStr }`), `syncPois(silent = false)`.

- [ ] **Step 1: Charger `fog-data.js`**

Dans `index.html`, remplacer :

```html
  <script src="hex-geometry.js"></script>
  <script src="app.js"></script>
```

par :

```html
  <script src="hex-geometry.js"></script>
  <script src="fog-data.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: Supprimer `BLANK_HEX_COORDINATES`**

Dans `app.js`, supprimer entièrement le commentaire `// 2. Coordonnées des 917 hexagones...` et la constante `BLANK_HEX_COORDINATES` (la ligne `const BLANK_HEX_COORDINATES = [[20, 49], ... [70, 62]];`) et la remplacer par :

```js
// 2. Cases sous le voile : FOG_HEX_KEYS ("q,r") est généré par tools/compute-fog.mjs (fog-data.js)
```

- [ ] **Step 3: Constructeur : ensemble des cases du brouillard**

Remplacer :

```js
    this.allHexMap = new Map(); // key 'q,r' -> { q, r, cx, cy, pointsStr, isInitialFog }
    this.pois = pointsOfInterest;
```

par :

```js
    this.allHexMap = new Map(); // cases sous le voile uniquement : key 'q,r' -> { key, q, r, cx, cy, pointsStr }
    this.fogKeys = new Set(FOG_HEX_KEYS);
    this.pois = pointsOfInterest;
```

- [ ] **Step 4: Remplacer `initHexGrid`**

Remplacer toute la méthode `initHexGrid()` par :

```js
  initHexGrid() {
    const gridLinesFragment = document.createDocumentFragment();
    const gridInteractiveFragment = document.createDocumentFragment();

    // Seules les cases sous le voile existent : les autres sont visibles et inertes.
    FOG_HEX_KEYS.forEach(key => {
      const [qStr, rStr] = key.split(',');
      const q = parseInt(qStr, 10);
      const r = parseInt(rStr, 10);
      const { cx, cy } = HexMath.getCenter(q, r);
      const pointsStr = HexMath.getPointsString(cx, cy);

      this.allHexMap.set(key, { key, q, r, cx, cy, pointsStr });

      // Trait de grille
      const linePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      linePoly.setAttribute('points', pointsStr);
      linePoly.setAttribute('id', `grid-line-${q}-${r}`);
      gridLinesFragment.appendChild(linePoly);

      // Cellule interactive
      const interactivePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      interactivePoly.setAttribute('points', pointsStr);
      interactivePoly.setAttribute('id', `hex-cell-${q}-${r}`);
      interactivePoly.setAttribute('class', 'hex-cell');
      interactivePoly.dataset.q = q;
      interactivePoly.dataset.r = r;
      interactivePoly.dataset.key = key;
      gridInteractiveFragment.appendChild(interactivePoly);
    });

    this.gridLinesLayer.appendChild(gridLinesFragment);
    this.gridInteractiveLayer.appendChild(gridInteractiveFragment);

    const outside = Object.values(this.pois)
      .filter(p => !this.fogKeys.has(`${p.centerHex.q},${p.centerHex.r}`))
      .map(p => p.name);
    if (outside.length > 0) {
      console.info('POI visibles dès le départ (case centrale hors brouillard) :', outside.join(', '));
    }
  }
```

- [ ] **Step 5: Remplacer `loadState` (plus de révélation par défaut)**

Remplacer toute la méthode `loadState()` par :

```js
  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
        }
      }
    } catch (err) {
      console.warn('Impossible de charger la sauvegarde:', err);
    }

    this.syncMaskHoles();
    this.syncPois(true);
  }
```

- [ ] **Step 6: Compteurs basés sur `FOG_HEX_KEYS`**

Remplacer toutes les occurrences de `BLANK_HEX_COORDINATES.length` par `FOG_HEX_KEYS.length` (5 occurrences : `saveState`, `exportSaveFile`, `updateStats`).

Remplacer `getExploredCount()` par :

```js
  getExploredCount() {
    let count = 0;
    this.revealedHexSet.forEach(key => {
      if (this.fogKeys.has(key)) count++;
    });
    return count;
  }
```

- [ ] **Step 7: POI hors brouillard révélés d'office, sans toast au chargement**

Remplacer le début de `syncPois()` :

```js
  syncPois() {
    let newlyDiscovered = [];

    Object.entries(this.pois).forEach(([id, poi]) => {
      const centerKey = `${poi.centerHex.q},${poi.centerHex.r}`;
      const isRevealed = this.revealedHexSet.has(centerKey);
```

par :

```js
  syncPois(silent = false) {
    let newlyDiscovered = [];

    Object.entries(this.pois).forEach(([id, poi]) => {
      const centerKey = `${poi.centerHex.q},${poi.centerHex.r}`;
      // Case centrale hors brouillard : le lieu est visible dès le départ
      const isRevealed = !this.fogKeys.has(centerKey) || this.revealedHexSet.has(centerKey);
```

et remplacer `if (newlyDiscovered.length > 0) {` par `if (!silent && newlyDiscovered.length > 0) {`.

- [ ] **Step 8: Gardes pour les cases hors brouillard**

Dans `applyTool`, remplacer :

```js
    targets.forEach(({ q: tq, r: tr }) => {
      const key = `${tq},${tr}`;
      const isCurrentlyRevealed = this.revealedHexSet.has(key);
```

par :

```js
    targets.forEach(({ q: tq, r: tr }) => {
      const key = `${tq},${tr}`;
      if (!this.fogKeys.has(key)) return; // case visible au départ : inerte
      const isCurrentlyRevealed = this.revealedHexSet.has(key);
```

Dans `revealHex`, remplacer :

```js
    const key = `${q},${r}`;
    if (!this.revealedHexSet.has(key)) {
      this.revealedHexSet.add(key);
      this.addHole(key);
      this.flashHex(q, r);
```

par :

```js
    const key = `${q},${r}`;
    if (this.fogKeys.has(key) && !this.revealedHexSet.has(key)) {
      this.revealedHexSet.add(key);
      this.addHole(key);
      this.flashHex(q, r);
```

Dans `updateHudHover`, remplacer :

```js
    const isRevealed = this.revealedHexSet.has(key);
```

par :

```js
    const isRevealed = !this.fogKeys.has(key) || this.revealedHexSet.has(key);
```

- [ ] **Step 9: Import et réinitialisation**

Dans `handleFileImport`, remplacer :

```js
          this.revealedHexSet = new Set(data.revealedHexes);
```

par :

```js
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
```

Remplacer `resetMap()` par :

```js
  resetMap() {
    this.revealedHexSet.clear();
    this.syncMaskHoles();
    this.syncPois();
    this.saveState();
    this.showToast('La carte a été réinitialisée.');
  }
```

- [ ] **Step 10: Vérifier dans le navigateur**

Vider d'abord le stockage : dans la console, `localStorage.removeItem('chult_explo_save_v1'); location.reload()`. Puis, console :

```js
({
  cells: document.querySelectorAll('.hex-cell').length,
  fog: FOG_HEX_KEYS.length,
  map: chultApp.allHexMap.size,
  revealed: chultApp.revealedHexSet.size,
  nyanzaru: chultApp.pois['port-nyanzaru'].revealed,
  omu: chultApp.pois['omu'].revealed,
  seaCell: document.getElementById('hex-cell-0-0')
})
```

Expected : `cells === fog === map`, `revealed: 0`, `nyanzaru: true`, `omu: false`, `seaCell: null`. La console affiche la ligne « POI visibles dès le départ ». Aucun toast « Lieu découvert » au chargement.

Case inerte : `chultApp.applyTool(0, 0); chultApp.revealedHexSet.size` → `0`. Avec le pinceau 19 cases sur une case de lisière, seules les cases du brouillard sont révélées (taille de l'ensemble ≤ 19).

Cases de lisière (cibles notées à la Task 2, Step 7 ; remplacer Q et R) :

```js
const c = document.getElementById('hex-cell-Q-R');
c.dispatchEvent(new MouseEvent('click', { bubbles: true }));
[chultApp.revealedHexSet.has('Q,R'), !!document.getElementById('mask-hole-Q-R')]
```

Expected : `[true, true]`, et la case se révèle visuellement sans bande de voile résiduelle. Répéter pour les 8 cibles, puis cliquer à la souris dans le navigateur sur au moins trois d'entre elles (autour de Camp Vengeance, Mbala, Kir Sabal). Ctrl+clic ou clic droit sur une case révélée la remasque.

Persistance : recharger la page, `chultApp.revealedHexSet.size` conserve les cases révélées. Export/import : exporter, cliquer « Réinitialiser », importer le fichier, les cases reviennent. « Révéler tout » puis « Recouvrir » fonctionnent, et le compteur affiche `0 / N` après réinitialisation. Pan et zoom restent fluides (environ N cases au lieu de 7 000).

- [ ] **Step 11: Commit**

```bash
git add app.js index.html
git commit -m "fix: seules les cases sous le voile sont interactives

Les cases de lisière non détectées sont maintenant cliquables ; les cases
visibles au départ n'existent plus côté interface.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nettoyage et documentation

**Files:**
- Modify: `Docs/Instructions.md:35,44`
- Delete (après accord de l'utilisateur) : voir Step 2

- [ ] **Step 1: Corriger `Docs/Instructions.md`**

Ligne 35, remplacer :

```
  - La grille hexagonale doit épouser parfaitement le tracé de la carte originale de Chult (environ 24 colonnes x 40 lignes d'hexagones, à calibrer dynamiquement).
```

par :

```
  - La grille hexagonale doit épouser parfaitement le tracé de la carte originale de Chult (environ 78 colonnes x 93 lignes d'hexagones, calibrées dans `hex-geometry.js`).
```

Ligne 44, remplacer :

```
- Les hexagones doivent être orientés "pointes en haut" (flat-topped) ou "coins en haut" (pointy-topped) pour correspondre exactement aux hexagones de l'image (Chult utilise des hexagones pointy-topped, pointe en haut/bas, à aligner).
```

par :

```
- Les hexagones sont orientés « flat-topped » (côtés plats en haut et en bas, pointes à gauche et à droite) pour correspondre exactement aux hexagones de l'image.
```

- [ ] **Step 2: Lister les fichiers obsolètes à l'utilisateur et attendre son accord**

Candidats : `build_app.py`, `blank_coords.json`, `blank_hexes.json`, `grid_data.json`, `coords_snippet.js`, `poi_clean.json`, `pois.json`, `app_pois.json`, et les captures de debug de `Assets/` (tout sauf `carte-*`, `thumb-*`, `preview_*`, `fog-check.png` : à confirmer fichier par fichier avec l'utilisateur). Vérifier d'abord qu'aucun fichier gardé ne les référence :

Run: `git grep -n -E "blank_coords|blank_hexes|grid_data|coords_snippet|poi_clean|pois\.json|app_pois|build_app" -- . ":!Docs/superpowers"`
Expected : aucune ligne (sinon traiter ces références avant de supprimer).

Présenter la liste à l'utilisateur et ne rien supprimer sans sa réponse explicite.

- [ ] **Step 3: Supprimer les fichiers confirmés**

```bash
git rm build_app.py blank_coords.json blank_hexes.json grid_data.json coords_snippet.js poi_clean.json pois.json app_pois.json
```

(ajuster la liste selon l'accord de l'utilisateur, et ajouter les captures de `Assets/` qu'il a validées).

- [ ] **Step 4: Vérification finale**

Run: `npm test`
Expected: PASS (11 tests).

Recharger `index.html` dans le navigateur : l'application fonctionne, aucune erreur console, `git status` ne montre aucun fichier `id_ed25519_chult*` à ajouter (ils doivent être ignorés).

- [ ] **Step 5: Commit**

```bash
git add Docs/Instructions.md
git commit -m "chore: nettoyer les fichiers de calibrage obsolètes et corriger les instructions

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
