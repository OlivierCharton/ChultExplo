# Libellés des lieux et clics sur les cases : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher le texte et la croix de chaque lieu seulement quand le lieu est découvert (au pixel près, même par-dessus le brouillard), et supprimer la bordure cliquable des cases révélées.

**Architecture:** Un outil Node découpe, pour chacun des 26 lieux, son libellé (`<id>-text.png`) et une rustine de texture (`<id>-patch.png`) à partir de `carte-complete.jpg`. Dans le SVG, les rustines recouvrent le texte sur la carte complète (sous le brouillard) et les découpes de texte des lieux découverts sont dessinées au-dessus du brouillard. Les clics et survols passent par un calcul de case à partir de la position de la souris (`hexAt`) au lieu d'un polygone par case.

**Tech Stack:** HTML/CSS/JS sans build côté navigateur (doit fonctionner en `file://`), Node 24 + `sharp` (dev uniquement), `node:test`.

## Global Constraints

Reprises de la spec `Docs/superpowers/specs/2026-10-15-libelles-et-clics-design.md` :

- `index.html` doit fonctionner en `file://` : aucun `fetch`, aucun module ES côté navigateur, le runtime ne dépend pas de Node.
- Un lieu est **découvert** si sa case centrale (`centerHex`) est hors brouillard ou révélée : c'est la règle de `syncPois()`, inchangée.
- Lieu découvert : croix et texte entiers s'affichent par-dessus le brouillard. Lieu non découvert : aucun texte, même sur des cases révélées.
- Le badge actuel (pastille + nom, calque `poi-layer`) est conservé tel quel.
- Une case révélée ne réagit plus à un clic simple ni au survol ; Ctrl+clic, clic droit et l'outil Masquer la remettent sous le voile ; les cases hors brouillard restent inertes.
- Les autres textes de la carte (rivières, régions, titres) ne sont pas traités.
- Sauvegarde : même clé `chult_explo_save_v1`, aucun changement de format.
- Travail sur la branche `wip`. Ne jamais ajouter `id_ed25519_chult*` à git. `git add` explicite des fichiers (jamais `-A`).
- Messages de commit terminés par la ligne `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Sur Windows, le dossier existant s'appelle `Docs` (majuscule) : toujours utiliser ce chemin dans `git add`.
- Les fichiers de l'application existants sont en fins de ligne CRLF : n'en changez pas l'encodage.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `tools/label-extract.js` (créer) | Fonctions pures : masque de texte, rustine, image de texte, `extractLabel`. |
| `test/label-extract.test.js` (créer) | Tests de ces fonctions sur une image synthétique. |
| `poi-data.js` (créer) | Dictionnaire `pointsOfInterest`, déplacé hors d'`app.js`, partagé navigateur/Node. |
| `tools/propose-label-boxes.mjs` (créer) | Propose un rectangle de texte par lieu dans `tools/label-boxes.json`. |
| `tools/label-boxes.json` (généré puis corrigeable à la main) | Rectangle `{x, y, w, h}` par lieu, avec `params` optionnels. |
| `tools/extract-labels.mjs` (créer) | Lit les rectangles, écrit `Assets/labels/*.png`, `labels-data.js` et les planches de contrôle. |
| `Assets/labels/*.png`, `labels-data.js` (générés, committés) | 26 × 2 images et le tableau `POI_LABELS`. |
| `Assets/labels-check-*.png` (générées, ignorées) | Planches de contrôle visuel. |
| `hex-geometry.js` (modifier) | Ajout de `hexAt(x, y)`. |
| `app.js`, `index.html`, `styles.css` (modifier) | Calques de rustines/textes, calcul de case pour les clics et survols. |
| `package.json` (modifier) | Scripts `labels` et `labels:propose`. |

---

### Task 1: Fonctions de découpe de libellés

**Files:**
- Create: `tools/label-extract.js`, `test/label-extract.test.js`

**Interfaces:**
- Produces (`require('./tools/label-extract.js')`) :
  - `DEFAULTS` : paramètres par défaut (objet gelé)
  - `dilate(mask, w, h, r) -> Uint8Array`, `erode(mask, w, h, r) -> Uint8Array` (carré de rayon `r`)
  - `components(mask, w, h) -> { labels: Int32Array, sizes: number[] }` (8-connexité, `labels[i] === 0` pour le fond, `sizes[label]` = aire)
  - `buildTextMask(rgb, width, height, channels, box, params?) -> Uint8Array` (1 sur les pixels de texte, limité à `box`)
  - `buildPatch(rgb, mask, width, height, channels, box, params?) -> Buffer` (RGBA, taille `box.w * box.h * 4`)
  - `buildTextImage(rgb, mask, width, channels, box) -> Buffer` (RGBA, taille `box.w * box.h * 4`)
  - `extractLabel({ rgb, width, height, channels, box, params? }) -> { text: Buffer, patch: Buffer, count: number }`
  - `box` = `{ x, y, w, h }` en pixels, dans le repère de la région `rgb` (largeur `width`, hauteur `height`).

- [ ] **Step 1: Écrire les tests qui échouent**

`test/label-extract.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dilate, components, buildTextMask, buildPatch, buildTextImage, extractLabel
} = require('../tools/label-extract.js');

const W = 320, H = 240, C = 3;
const BOX = { x: 120, y: 80, w: 60, h: 70 };

// Fond de jungle à deux verts sombres en damier
function bg(x, y) { return (((x >> 3) + (y >> 3)) % 2) ? [60, 110, 60] : [70, 120, 70]; }

function makeRegion() {
  const rgb = Buffer.alloc(W * H * C);
  const set = (x, y, c) => { const o = (y * W + x) * C; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, bg(x, y));
  for (let y = 94; y <= 135; y++) for (let x = 134; x <= 165; x++) set(x, y, [245, 235, 225]); // halo crème
  for (let y = 100; y <= 129; y++) for (let x = 140; x <= 159; x++) set(x, y, [20, 20, 20]);   // symbole sombre
  for (let x = 10; x < 300; x++) set(x, 145, [250, 250, 250]);                                     // ligne claire fine, éloignée
  set(125, 85, [10, 10, 10]);                                                                      // pixel sombre isolé
  return rgb;
}

const px = (buf, x, y, w, c) => Array.from(buf.subarray((y * w + x) * c, (y * w + x) * c + c));

test('dilate agrandit une forme d\'un rayon carré', () => {
  const m = new Uint8Array(9 * 9);
  m[4 * 9 + 4] = 1;
  const d = dilate(m, 9, 9, 2);
  assert.equal(d[4 * 9 + 6], 1);
  assert.equal(d[2 * 9 + 2], 1);
  assert.equal(d[4 * 9 + 7], 0);
});

test('components compte les formes 8-connexes et leur aire', () => {
  const w = 6, h = 4;
  const m = new Uint8Array(w * h);
  [[0, 0], [1, 1], [4, 3], [5, 3]].forEach(([x, y]) => { m[y * w + x] = 1; });
  const { labels, sizes } = components(m, w, h);
  assert.equal(labels[0], labels[1 * w + 1]);          // diagonale : même forme
  assert.notEqual(labels[0], labels[3 * w + 4]);
  assert.equal(sizes[labels[0]], 2);
  assert.equal(sizes[labels[3 * w + 4]], 2);
});

test('le masque couvre le symbole sombre et son halo', () => {
  const m = buildTextMask(makeRegion(), W, H, C, BOX);
  assert.equal(m[115 * W + 150], 1); // intérieur du symbole
  assert.equal(m[115 * W + 136], 1); // halo
});

test('le masque ignore une ligne claire éloignée et un pixel sombre isolé', () => {
  const m = buildTextMask(makeRegion(), W, H, C, BOX);
  assert.equal(m[145 * W + 130], 0);
  assert.equal(m[85 * W + 125], 0);
});

test('le masque reste dans le rectangle du lieu', () => {
  const small = { x: 140, y: 100, w: 20, h: 30 };
  const m = buildTextMask(makeRegion(), W, H, C, small);
  assert.equal(m[115 * W + 136], 0);   // halo hors rectangle
  assert.equal(m[115 * W + 150], 1);
});

test('la rustine reprend la texture voisine et déborde en fondu', () => {
  const rgb = makeRegion();
  const mask = buildTextMask(rgb, W, H, C, BOX);
  const patch = buildPatch(rgb, mask, W, H, C, BOX);
  const at = (x, y) => px(patch, x - BOX.x, y - BOX.y, BOX.w, 4);

  const inside = at(150, 100);                 // source : (150, 10), décalage (0, -90)
  assert.deepEqual(inside.slice(0, 3), bg(150, 10));
  assert.equal(inside[3], 255);
  assert.equal(at(121, 81)[3], 0);             // loin du texte
  const edge = at(129, 115)[3];                // 2 px au-delà du bord élargi
  assert.ok(edge > 0 && edge < 255, `alpha=${edge}`);
});

test('l\'image de texte garde les pixels du masque et rend le reste transparent', () => {
  const rgb = makeRegion();
  const mask = buildTextMask(rgb, W, H, C, BOX);
  const t = buildTextImage(rgb, mask, W, C, BOX);
  assert.deepEqual(px(t, 150 - BOX.x, 115 - BOX.y, BOX.w, 4), [20, 20, 20, 255]);
  assert.deepEqual(px(t, 136 - BOX.x, 115 - BOX.y, BOX.w, 4), [245, 235, 225, 255]);
  assert.equal(px(t, 1, 1, BOX.w, 4)[3], 0);
});

test('extractLabel renvoie les deux images à la taille du rectangle', () => {
  const { text, patch, count } = extractLabel({ rgb: makeRegion(), width: W, height: H, channels: C, box: BOX });
  assert.equal(text.length, BOX.w * BOX.h * 4);
  assert.equal(patch.length, BOX.w * BOX.h * 4);
  assert.ok(count > 600, `count=${count}`);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL avec `Cannot find module '../tools/label-extract.js'`.

- [ ] **Step 3: Écrire `tools/label-extract.js`**

```js
'use strict';

/**
 * Découpe des libellés de lieux sur la carte complète.
 * Un libellé = lettres/symboles sombres entourés d'un halo clair et peu saturé.
 * Toutes les fonctions travaillent sur une région RGB entrelacée (`channels` octets par pixel).
 */

const DEFAULTS = Object.freeze({
  haloMin: 190,        // canal minimum d'un pixel de halo (crème)
  haloSpread: 70,      // écart max-min d'un pixel de halo (peu saturé)
  glyphMax: 85,        // canal maximum d'un pixel de lettre ou de symbole (sombre)
  glyphTouch: 2,       // une forme sombre n'est retenue que si elle touche un halo à ≤ 2 px
  minGlyphArea: 12,    // aire minimale (px) d'une forme sombre retenue
  haloReach: 7,        // le halo ne compte qu'à ≤ 7 px d'une forme retenue
  closeGap: 2,         // fermeture des petits trous du masque (px)
  patchGrow: 3,        // la rustine déborde du texte de 3 px
  feather: 3,          // rayon du fondu de bord de la rustine (px)
  offsets: [[0, -90], [0, 90], [0, -140], [0, 140], [-120, 0], [120, 0], [0, -200], [0, 200], [-200, 0], [200, 0]]
});

function dilate(mask, w, h, r) {
  if (r <= 0) return Uint8Array.from(mask);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (!mask[row + x]) continue;
      const a = Math.max(0, x - r), b = Math.min(w - 1, x + r);
      for (let k = a; k <= b; k++) tmp[row + k] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!tmp[y * w + x]) continue;
      const a = Math.max(0, y - r), b = Math.min(h - 1, y + r);
      for (let k = a; k <= b; k++) out[k * w + x] = 1;
    }
  }
  return out;
}

function erode(mask, w, h, r) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < w * h; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    next++;
    let n = 0;
    labels[s] = next;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const q = yy * w + xx;
          if (mask[q] && !labels[q]) { labels[q] = next; stack.push(q); }
        }
      }
    }
    sizes.push(n);
  }
  return { labels, sizes };
}

function boxBlur(mask, w, h, r) {
  const k = 2 * r + 1;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) s += mask[y * w + xx]; }
      tmp[y * w + x] = s / k;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) s += tmp[yy * w + x]; }
      out[y * w + x] = s / k;
    }
  }
  return out;
}

function buildTextMask(rgb, width, height, channels, box, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const n = width * height;
  const halo = new Uint8Array(n);
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mn > p.haloMin && mx - mn < p.haloSpread) halo[i] = 1;
    if (mx < p.glyphMax) dark[i] = 1;
  }

  // Formes sombres retenues : celles qui touchent un halo et ont une aire suffisante
  const haloNear = dilate(halo, width, height, p.glyphTouch);
  const { labels, sizes } = components(dark, width, height);
  const keep = new Uint8Array(sizes.length);
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l && haloNear[i] && sizes[l] >= p.minGlyphArea) keep[l] = 1;
  }
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (labels[i] && keep[labels[i]]) core[i] = 1;

  // Texte = formes retenues + halo situé à portée d'une forme retenue
  const reach = dilate(core, width, height, p.haloReach);
  let text = new Uint8Array(n);
  for (let i = 0; i < n; i++) text[i] = (core[i] || (halo[i] && reach[i])) ? 1 : 0;
  text = erode(dilate(text, width, height, p.closeGap), width, height, p.closeGap);

  // Confiné au rectangle du lieu
  const out = new Uint8Array(n);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) out[y * width + x] = text[y * width + x];
  }
  return out;
}

function buildPatch(rgb, mask, width, height, channels, box, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const n = width * height;
  const grown = dilate(mask, width, height, p.patchGrow);

  // Couleur de repli : moyenne des pixels non couverts de la région
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (grown[i]) continue;
    sr += rgb[i * channels]; sg += rgb[i * channels + 1]; sb += rgb[i * channels + 2]; cnt++;
  }
  const avg = cnt ? [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)] : [0, 0, 0];

  const soft = boxBlur(grown, width, height, p.feather);
  const out = Buffer.alloc(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const X = box.x + x, Y = box.y + y, i = Y * width + X;
      const a = grown[i] ? 1 : soft[i];
      if (a <= 0) continue;
      let c = avg;
      for (const [dx, dy] of p.offsets) {
        const sx = X + dx, sy = Y + dy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const j = sy * width + sx;
        if (grown[j]) continue;
        c = [rgb[j * channels], rgb[j * channels + 1], rgb[j * channels + 2]];
        break;
      }
      const o = (y * box.w + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

function buildTextImage(rgb, mask, width, channels, box) {
  const out = Buffer.alloc(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const i = (box.y + y) * width + box.x + x;
      if (!mask[i]) continue;
      const o = (y * box.w + x) * 4;
      out[o] = rgb[i * channels]; out[o + 1] = rgb[i * channels + 1]; out[o + 2] = rgb[i * channels + 2]; out[o + 3] = 255;
    }
  }
  return out;
}

function extractLabel({ rgb, width, height, channels, box, params }) {
  const mask = buildTextMask(rgb, width, height, channels, box, params);
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i];
  return {
    text: buildTextImage(rgb, mask, width, channels, box),
    patch: buildPatch(rgb, mask, width, height, channels, box, params),
    count
  };
}

module.exports = { DEFAULTS, dilate, erode, components, buildTextMask, buildPatch, buildTextImage, extractLabel };
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (les 11 tests existants + 8 nouveaux = 19).

- [ ] **Step 5: Commit**

```bash
git add tools/label-extract.js test/label-extract.test.js
git commit -m "feat: fonctions de découpe de libellés (masque de texte, rustine)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Données des lieux, rectangles de texte et images générées

**Files:**
- Create: `poi-data.js`, `tools/propose-label-boxes.mjs`, `tools/extract-labels.mjs`, `tools/label-boxes.json` (généré), `labels-data.js` (généré), `Assets/labels/*.png` (générés)
- Modify: `app.js:18-307` (suppression du dictionnaire), `index.html` (balise script), `package.json`, `.gitignore`

**Interfaces:**
- Consumes: `extractLabel`, `buildTextMask`, `dilate`, `erode`, `components` (Task 1) ; `HexGeometry.getCenter`, `GRID` (`hex-geometry.js`).
- Produces :
  - `poi-data.js` : global `pointsOfInterest` (navigateur) et `require('./poi-data.js').pointsOfInterest` (Node). Même contenu qu'aujourd'hui.
  - `labels-data.js` : `const POI_LABELS = { "<id>": { x, y, w, h }, ... }`. Les images sont `Assets/labels/<id>-text.png` et `Assets/labels/<id>-patch.png`, de taille `w × h`, à placer en `(x, y)` sur la carte.

- [ ] **Step 1: Déplacer le dictionnaire dans `poi-data.js`**

Créer `poi-data.js` avec ce contenu de départ :

```js
/**
 * Points d'intérêt de Chult : identifiant -> nom, case centrale (q, r), icône, catégorie.
 * Partagé entre le navigateur (global pointsOfInterest) et Node (tools/).
 */
```

Puis, depuis la racine du dépôt :

```bash
sed -n '19,306p' app.js >> poi-data.js
printf '\nif (typeof module === "object" && module.exports) {\n  module.exports = { pointsOfInterest };\n}\n' >> poi-data.js
sed -i '18,307d' app.js
```

(La ligne 18 d'`app.js` est le commentaire `// 3. Dictionnaire ...`, les lignes 19 à 306 sont la constante, la ligne 307 est vide.)

Dans `index.html`, remplacer :

```html
  <script src="fog-data.js"></script>
  <script src="app.js"></script>
```

par :

```html
  <script src="fog-data.js"></script>
  <script src="poi-data.js"></script>
  <script src="app.js"></script>
```

Vérifier : `node -e "console.log(Object.keys(require('./poi-data.js').pointsOfInterest).length)"` affiche `26`, `node --check app.js` ne dit rien, `grep -n "pointsOfInterest" app.js` ne montre plus que les usages (`this.pois = pointsOfInterest;`).

- [ ] **Step 2: Écrire `tools/propose-label-boxes.mjs` et l'enregistrer comme script**

Dans `package.json`, remplacer le bloc `scripts` par :

```json
  "scripts": {
    "test": "node --test \"test/**/*.test.js\"",
    "fog": "node tools/compute-fog.mjs",
    "labels:propose": "node tools/propose-label-boxes.mjs",
    "labels": "node tools/extract-labels.mjs"
  },
```

`tools/propose-label-boxes.mjs` :

```js
/**
 * Propose un rectangle de texte par lieu (tools/label-boxes.json) à partir de sa case centrale :
 * on cherche, près du centre de la case, la forme de texte (lettres + halo + symbole) et on prend son cadre.
 * C'est un point de départ : à vérifier sur Assets/labels-check-*.png (npm run labels) puis à corriger
 * à la main dans le JSON (rectangle, ou "params" propres au lieu). Usage : npm run labels:propose
 */
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { GRID, getCenter } = require('../hex-geometry.js');
const { pointsOfInterest } = require('../poi-data.js');
const { buildTextMask, dilate, erode, components } = require('./label-extract.js');

const WINDOW_X = 380;  // demi-largeur de la fenêtre d'analyse autour du centre (px)
const WINDOW_Y = 260;  // demi-hauteur
const JOIN = 8;        // fermeture qui relie lettres, lignes et symbole d'un même lieu (px)
const SEARCH = 70;     // distance max entre le centre de la case et le texte retenu (px)
const MARGIN = 6;      // marge ajoutée autour du texte (px)

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

  // pixel de texte le plus proche du centre de la case
  const ccx = Math.round(cx - left), ccy = Math.round(cy - top);
  let best = 0, bestD = Infinity;
  for (let y = Math.max(0, ccy - SEARCH); y <= Math.min(height - 1, ccy + SEARCH); y++) {
    for (let x = Math.max(0, ccx - SEARCH); x <= Math.min(width - 1, ccx + SEARCH); x++) {
      const i = y * width + x;
      if (!mask[i] || !labels[i]) continue;
      const d = (x - ccx) ** 2 + (y - ccy) ** 2;
      if (d < bestD) { bestD = d; best = labels[i]; }
    }
  }
  if (!best) {
    console.warn(`Aucun texte trouvé près de ${id} (${poi.centerHex.q},${poi.centerHex.r}) : rectangle par défaut`);
    boxes[id] = { x: Math.round(cx - 160), y: Math.round(cy - 60), w: 320, h: 160 };
    continue;
  }

  let minX = width, minY = height, maxX = 0, maxY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (labels[i] !== best || !mask[i]) continue;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  const x0 = Math.max(0, left + minX - MARGIN);
  const y0 = Math.max(0, top + minY - MARGIN);
  const x1 = Math.min(GRID.width, left + maxX + MARGIN + 1);
  const y1 = Math.min(GRID.height, top + maxY + MARGIN + 1);
  boxes[id] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const sorted = Object.fromEntries(Object.entries(boxes).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(path.join(root, 'tools', 'label-boxes.json'), JSON.stringify(sorted, null, 2) + '\n');
console.log(`${Object.keys(sorted).length} rectangles écrits dans tools/label-boxes.json`);
```

- [ ] **Step 3: Écrire `tools/extract-labels.mjs`**

```js
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
```

Ajouter dans `.gitignore` (ASCII, une ligne par motif) la ligne `Assets/labels-check-*.png`.

- [ ] **Step 4: Proposer les rectangles puis générer les images**

Run: `npm run labels:propose`
Expected: `26 rectangles écrits dans tools/label-boxes.json` ; les avertissements « Aucun texte trouvé » éventuels sont à traiter à l'étape 6.

Run: `npm run labels`
Expected: une ligne par lieu avec un nombre de pixels de texte > 0, puis `26 lieux écrits ; planches : Assets/labels-check-*.png` ; création de `labels-data.js`, de 52 PNG dans `Assets/labels/` et de 6 planches.

- [ ] **Step 5: Vérifier que l'application charge toujours**

Run: `npm test` (19 tests passent) et `node --check app.js`.

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan), ouvrir `http://localhost:8080/index.html` dans le navigateur intégré et vérifier dans la console : `[Object.keys(pointsOfInterest).length, document.querySelectorAll('.hex-cell').length]` renvoie `[26, 1202]`, sans erreur console. Arrêter le serveur ensuite.

- [ ] **Step 6: Contrôle visuel et réglage des rectangles**

Ouvrir chaque `Assets/labels-check-N.png` : colonne de gauche l'original, au milieu le texte extrait sur gris, à droite la carte avec la rustine. Pour chaque lieu vérifier que :
1. tout le texte et le symbole du lieu sont dans la colonne du milieu ;
2. aucun texte d'un autre lieu, ni nom de rivière ou de région, n'est dans la colonne du milieu ;
3. dans la colonne de droite, il ne reste pas de lettres du lieu, et la rustine se fond raisonnablement dans la jungle.

Corrections : modifier le rectangle du lieu dans `tools/label-boxes.json` (`x`, `y`, `w`, `h`), ou ajouter un objet `"params": { "haloMin": 200 }` (clés de `DEFAULTS` dans `tools/label-extract.js`) pour ce lieu seulement, puis relancer `npm run labels`. Ne pas changer `DEFAULTS` sans accord. Faire au plus 4 itérations ; au-delà, lister les lieux restants dans le rapport. Les planches finales sont à montrer à l'utilisateur avant de passer à la tâche suivante.

- [ ] **Step 7: Commit**

```bash
git add poi-data.js app.js index.html package.json .gitignore tools/propose-label-boxes.mjs tools/extract-labels.mjs tools/label-boxes.json labels-data.js Assets/labels
git commit -m "feat: découper le texte et la croix de chaque lieu (poi-data.js, Assets/labels)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Calques de rustines et de textes dans le SVG

**Files:**
- Modify: `index.html` (calques et script `labels-data.js`), `app.js` (constructeur, `initDOM`, `syncPois`, nouvelles méthodes), `styles.css`

**Interfaces:**
- Consumes: `POI_LABELS` et les images de la tâche 2 ; `this.pois[id].revealed` (mis à jour par `syncPois()`).
- Produces : `ChultMapApp.renderPoiPatches()` (une fois, au démarrage), `ChultMapApp.renderPoiLabels()` (reconstruit `#poi-labels-layer` depuis `poi.revealed`), `ChultMapApp.makeLabelImage(src, label, id) -> SVGImageElement`.

- [ ] **Step 1: Ajouter les calques et le script dans `index.html`**

Après la ligne `<image id="img-complete" ... />`, ajouter :

```html

          <!-- Layer 1b: Rustines de texture qui recouvrent le texte imprimé des lieux (sous le brouillard) -->
          <g id="poi-patches-layer" class="poi-label-layer"></g>
```

Après la ligne `<image id="img-vierge" ... />`, ajouter :

```html

          <!-- Layer 2b: Texte et croix des lieux découverts, au-dessus du brouillard -->
          <g id="poi-labels-layer" class="poi-label-layer"></g>
```

Remplacer :

```html
  <script src="poi-data.js"></script>
  <script src="app.js"></script>
```

par :

```html
  <script src="poi-data.js"></script>
  <script src="labels-data.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: Ajouter la règle CSS**

Dans `styles.css`, juste avant le commentaire `/* ==== POI Markers & Fantasy Labels` (section qui précède `.poi-markers, .dm-ghosts`), ajouter :

```css
/* Rustines et textes des lieux : jamais d'événement souris */
.poi-label-layer {
  pointer-events: none;
}

```

- [ ] **Step 3: Brancher les calques dans `app.js`**

Dans `initDOM()`, après la ligne `this.poiLayer = document.getElementById('poi-layer');`, ajouter :

```js
    this.poiPatchesLayer = document.getElementById('poi-patches-layer');
    this.poiLabelsLayer = document.getElementById('poi-labels-layer');
```

Dans le constructeur, remplacer :

```js
    this.initHexGrid();
    this.loadState();
```

par :

```js
    this.initHexGrid();
    this.renderPoiPatches();
    this.loadState();
```

Dans `syncPois()`, remplacer :

```js
    this.renderPoiMarkers();
    this.renderDmGhosts();
```

par :

```js
    this.renderPoiMarkers();
    this.renderPoiLabels();
    this.renderDmGhosts();
```

Juste avant la méthode `renderPoiMarkers() {`, ajouter :

```js
  makeLabelImage(src, label, id) {
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('id', id);
    img.setAttribute('href', src);
    img.setAttribute('x', label.x);
    img.setAttribute('y', label.y);
    img.setAttribute('width', label.w);
    img.setAttribute('height', label.h);
    img.setAttribute('preserveAspectRatio', 'none');
    return img;
  }

  // Rustines : recouvrent le texte imprimé de chaque lieu sur la carte complète (sous le brouillard)
  renderPoiPatches() {
    const fragment = document.createDocumentFragment();
    Object.keys(this.pois).forEach(id => {
      const label = POI_LABELS[id];
      if (!label) return;
      fragment.appendChild(this.makeLabelImage(`Assets/labels/${id}-patch.png`, label, `poi-patch-${id}`));
    });
    this.poiPatchesLayer.appendChild(fragment);
  }

  // Texte et croix des lieux découverts, au-dessus du brouillard
  renderPoiLabels() {
    this.poiLabelsLayer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    Object.entries(this.pois).forEach(([id, poi]) => {
      const label = POI_LABELS[id];
      if (!poi.revealed || !label) return;
      fragment.appendChild(this.makeLabelImage(`Assets/labels/${id}-text.png`, label, `poi-text-${id}`));
    });
    this.poiLabelsLayer.appendChild(fragment);
  }

```

- [ ] **Step 4: Vérifier dans le navigateur**

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan), ouvrir `http://localhost:8080/index.html`, vider la sauvegarde (`localStorage.removeItem('chult_explo_save_v1'); location.reload()`), puis dans la console :

```js
({
  patches: document.querySelectorAll('#poi-patches-layer image').length,
  labels: document.querySelectorAll('#poi-labels-layer image').length,
  revealedPois: Object.values(chultApp.pois).filter(p => p.revealed).length,
  missing: Object.keys(chultApp.pois).filter(id => !POI_LABELS[id])
})
```

Expected : `patches: 26`, `labels` égal à `revealedPois` (10 au départ avec les coordonnées actuelles), `missing: []`.

Révéler la case de Firefinger puis relire le compte :

```js
chultApp.revealHex(44, 33);
[document.querySelectorAll('#poi-labels-layer image').length, !!document.getElementById('poi-text-firefinger')]
```

Expected : le compte augmente de 1 et `true`. Ensuite `chultApp.applyTool(44, 33, true)` (re-masquer) : le compte revient à sa valeur de départ et `poi-text-firefinger` disparaît.

Contrôle visuel dans l'application (si les captures d'écran marchent ; fenêtre du navigateur intégré visible, `resize_window` à 1200×800) : placer la vue sur Firefinger (`chultApp.zoom = 0.6` et pan centré sur la case 44,33), vérifier que « Firefinger » et la croix apparaissent après `revealHex(44, 33)` par-dessus les cases voilées, et qu'ils disparaissent quand on révèle des cases voisines sans la case 44,33. Si les captures échouent, le dire dans le rapport au lieu d'inventer un résultat. Arrêter le serveur ensuite.

- [ ] **Step 5: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat: afficher texte et croix d'un lieu selon qu'il est découvert

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Clics et survols par calcul de case

**Files:**
- Modify: `hex-geometry.js`, `test/hex-geometry.test.js`, `app.js`, `index.html`, `styles.css`

**Interfaces:**
- Consumes: `HexGeometry.getCenter` ; `this.fogKeys`, `this.allHexMap`, `this.revealedHexSet`, `this.currentTool`, `this.brushRadius`, `this.mode`, `this.hoveredHex` (déjà initialisé à `null` dans le constructeur), `applyTool(q, r, explicitConceal)`.
- Produces :
  - `HexGeometry.hexAt(x, y) -> { q, r }` : case dont le centre est le plus proche du point (coordonnées carte).
  - `ChultMapApp.eventToHex(e) -> { q, r, key } | null` (`null` hors brouillard), `wouldChange(key, ctrl) -> boolean`, `renderHover(hex, ctrl)`, `flashHex(q, r)` (polygone temporaire dans `#flash-layer`).

- [ ] **Step 1: Écrire les tests de `hexAt` qui échouent**

Dans `test/hex-geometry.test.js`, remplacer la ligne d'import :

```js
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes } = require('../hex-geometry.js');
```

par :

```js
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes, hexAt } = require('../hex-geometry.js');
```

et ajouter à la fin du fichier :

```js
test('hexAt renvoie la case dont le centre est touché', () => {
  for (const [q, r] of [[0, 0], [1, 0], [20, 49], [21, 49], [54, 50], [77, 92]]) {
    const { cx, cy } = getCenter(q, r);
    assert.deepEqual(hexAt(cx, cy), { q, r });
  }
});

test('hexAt est cohérent avec containsPoint près des bords et des coins', () => {
  const { cx, cy } = getCenter(21, 49);
  const R = GRID.R, h = Math.sqrt(3) * R;
  const inside = [[0.9 * R, 0], [-0.9 * R, 0], [0, 0.45 * h], [0, -0.45 * h], [0.4 * R, 0.4 * h], [-0.4 * R, -0.4 * h]];
  for (const [dx, dy] of inside) {
    assert.equal(containsPoint(cx, cy, cx + dx, cy + dy), true);
    assert.deepEqual(hexAt(cx + dx, cy + dy), { q: 21, r: 49 }, `dx=${dx} dy=${dy}`);
  }
});

test('hexAt change de case de part et d\'autre d\'une arête', () => {
  const a = getCenter(20, 49), b = getCenter(20, 50);
  const midY = (a.cy + b.cy) / 2;
  assert.deepEqual(hexAt(a.cx, midY - 1), { q: 20, r: 49 });
  assert.deepEqual(hexAt(a.cx, midY + 1), { q: 20, r: 50 });
});

test('hexAt place chaque point d\'une grille d\'essai dans l\'hexagone de la case renvoyée', () => {
  for (let x = 100; x < GRID.width - 100; x += 397) {
    for (let y = 100; y < GRID.height - 100; y += 389) {
      const { q, r } = hexAt(x, y);
      const { cx, cy } = getCenter(q, r);
      assert.equal(containsPoint(cx, cy, x, y), true, `(${x},${y}) -> ${q},${r}`);
    }
  }
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL (`hexAt is not a function`).

- [ ] **Step 3: Implémenter `hexAt`**

Dans `hex-geometry.js`, avant `function enumerateHexes() {`, ajouter :

```js
  // Case dont le centre est le plus proche du point (x, y), en coordonnées carte
  function hexAt(x, y) {
    const q0 = Math.round((x - GRID.x0) / GRID.dx);
    let best = null;
    let bestD = Infinity;
    for (let q = q0 - 1; q <= q0 + 1; q++) {
      const shift = (Math.abs(q) % 2 === 1) ? GRID.dy / 2 : 0;
      const r0 = Math.round((y - GRID.y0 - shift) / GRID.dy);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        const { cx, cy } = getCenter(q, r);
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestD) { bestD = d; best = { q, r }; }
      }
    }
    return best;
  }

```

et remplacer la dernière ligne de la fabrique :

```js
  return { GRID, getCenter, getPoints, containsPoint, enumerateHexes };
```

par :

```js
  return { GRID, getCenter, getPoints, containsPoint, hexAt, enumerateHexes };
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (23 tests).

- [ ] **Step 5: Remplacer les polygones interactifs par des calques de survol et de flash**

Dans `index.html`, remplacer :

```html
          <!-- Layer 4: Interactive Hex Cells (hover highlight & click handling) -->
          <g id="grid-interactive-layer" class="grid-interactive"></g>
```

par :

```html
          <!-- Layer 4: Surbrillance de survol et flash de révélation (aucun événement : les clics sont calculés par case) -->
          <g id="hover-layer" class="hover-layer"></g>
          <g id="flash-layer" class="flash-layer"></g>
```

Dans `styles.css`, remplacer le bloc qui va de `.grid-interactive polygon {` jusqu'à la fin de la règle `.mode-mj .grid-interactive polygon.brush-hover { ... }` :

```css
.grid-interactive polygon {
  fill: transparent;
  stroke: transparent;
  stroke-width: 1.5px;
  cursor: pointer;
  pointer-events: all;
  transition: fill 0.12s ease, stroke 0.12s ease;
}

/* Mode MJ Hover and Active States */
.mode-mj .grid-interactive polygon:hover {
  fill: rgba(255, 230, 100, 0.32);
  stroke: var(--accent-gold-hover);
  stroke-width: 2px;
}

.mode-mj .grid-interactive polygon.brush-hover {
  fill: rgba(255, 215, 0, 0.42) !important;
  stroke: #ffea75 !important;
  stroke-width: 2.5px !important;
}

/* Flash animation on hex reveal */
```

par :

```css
/* Surbrillance de survol (cases que l'action en cours modifierait) et flash de révélation */
.hover-layer,
.flash-layer {
  pointer-events: none;
}

.hover-layer polygon {
  fill: rgba(255, 215, 0, 0.42);
  stroke: #ffea75;
  stroke-width: 2.5px;
}

.flash-layer polygon {
  fill: transparent;
  stroke: transparent;
}

/* Flash animation on hex reveal */
```

Supprimer ensuite, plus bas dans `styles.css`, le bloc :

```css
/* Mode Joueur: disable pointer events on cells so clicks don't edit */
.mode-player .grid-interactive polygon {
  pointer-events: none;
  cursor: default;
}

```

- [ ] **Step 6: Remplacer la gestion des cases dans `app.js`**

1. Dans `initDOM()`, remplacer :

```js
    this.gridInteractiveLayer = document.getElementById('grid-interactive-layer');
```

par :

```js
    this.hoverLayer = document.getElementById('hover-layer');
    this.flashLayer = document.getElementById('flash-layer');
```

2. Dans `initHexGrid()` : supprimer la ligne `const gridInteractiveFragment = document.createDocumentFragment();`, supprimer le bloc

```js

      // Cellule interactive
      const interactivePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      interactivePoly.setAttribute('points', pointsStr);
      interactivePoly.setAttribute('id', `hex-cell-${q}-${r}`);
      interactivePoly.setAttribute('class', 'hex-cell');
      interactivePoly.dataset.q = q;
      interactivePoly.dataset.r = r;
      interactivePoly.dataset.key = key;
      gridInteractiveFragment.appendChild(interactivePoly);
```

et supprimer la ligne `this.gridInteractiveLayer.appendChild(gridInteractiveFragment);`.

3. Remplacer toute la méthode `flashHex(q, r) { ... }` par :

```js
  flashHex(q, r) {
    const hex = this.allHexMap.get(`${q},${r}`);
    if (!hex) return;
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', hex.pointsStr);
    poly.setAttribute('class', 'hex-flash-reveal');
    poly.addEventListener('animationend', () => poly.remove());
    this.flashLayer.appendChild(poly);
  }
```

4. Dans `initEvents()`, remplacer les quatre écouteurs `this.gridInteractiveLayer.addEventListener('click' ...)`, `'contextmenu'`, `'mouseover'` et `'mouseleave'` (du `this.gridInteractiveLayer.addEventListener('click', (e) => {` jusqu'à la fin de l'écouteur `mouseleave`) par :

```js
    this.svg.addEventListener('click', (e) => {
      if (this.hasDragged) return;
      const hex = this.eventToHex(e);
      if (!hex) return;
      this.applyTool(hex.q, hex.r, e.ctrlKey || e.metaKey);
    });

    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const hex = this.eventToHex(e);
      if (!hex) return;
      this.applyTool(hex.q, hex.r, true);
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.renderHover(null, false);
        return;
      }
      const hex = this.eventToHex(e);
      this.hoveredHex = hex;
      if (hex) this.updateHudHover(hex.q, hex.r);
      this.renderHover(hex, e.ctrlKey || e.metaKey);
    });

    this.svg.addEventListener('mouseleave', () => {
      this.hoveredHex = null;
      this.renderHover(null, false);
      this.hudCoords.textContent = '🧭 Hex: —';
      this.hudStatus.textContent = 'Statut: —';
      this.hudPoi.textContent = 'Lieu: Aucun';
    });

    const onCtrlChange = (e) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        this.renderHover(this.hoveredHex, e.ctrlKey || e.metaKey);
      }
    };
    window.addEventListener('keydown', onCtrlChange);
    window.addEventListener('keyup', onCtrlChange);
```

5. Remplacer les méthodes `updateBrushHover(centerQ, centerR) { ... }` et `clearBrushHover() { ... }` par :

```js
  // Case du brouillard sous la souris (null si hors brouillard), calculée sans polygone
  eventToHex(e) {
    const rect = this.viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    const { q, r } = HexGeometry.hexAt(x, y);
    const key = `${q},${r}`;
    return this.fogKeys.has(key) ? { q, r, key } : null;
  }

  // La case changerait-elle d'état avec l'outil en cours (ou Ctrl = masquer) ?
  wouldChange(key, ctrl) {
    const revealed = this.revealedHexSet.has(key);
    if (ctrl) return revealed;
    if (this.currentTool === 'reveal') return !revealed;
    if (this.currentTool === 'hide') return revealed;
    return true;
  }

  renderHover(hex, ctrl) {
    this.hoverLayer.innerHTML = '';
    this.svg.style.cursor = '';
    if (this.mode !== 'mj' || !hex) return;

    const fragment = document.createDocumentFragment();
    HexMath.getNeighborsWithinRadius(hex.q, hex.r, this.brushRadius).forEach(({ q, r }) => {
      const cell = this.allHexMap.get(`${q},${r}`);
      if (!cell || !this.wouldChange(cell.key, ctrl)) return;
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', cell.pointsStr);
      fragment.appendChild(poly);
    });
    if (fragment.childNodes.length > 0) {
      this.hoverLayer.appendChild(fragment);
      this.svg.style.cursor = 'pointer';
    }
  }
```

6. Dans `setMode(newMode)`, juste après la ligne `this.mode = newMode;`, ajouter :

```js
    this.renderHover(null, false);
```

7. Vérifier qu'il ne reste aucune référence aux anciens éléments :
`grep -n -E "grid-interactive|hex-cell|brush-hover|gridInteractiveLayer|clearBrushHover|updateBrushHover" app.js index.html styles.css` ne doit rien afficher. `node --check app.js` ne dit rien ; `npm test` passe (23 tests).

- [ ] **Step 7: Vérifier dans le navigateur**

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan), ouvrir `http://localhost:8080/index.html`, mettre le viewport à 1200×800 (`resize_window`), vider la sauvegarde (`localStorage.removeItem('chult_explo_save_v1'); location.reload()`) puis, dans la console :

```js
const a = chultApp;
a.zoom = 1; a.panX = 0; a.panY = 0; a.updateTransform();
const rect = a.viewport.getBoundingClientRect();
const toClient = (mx, my) => ({ clientX: rect.left + a.panX + mx * a.zoom, clientY: rect.top + a.panY + my * a.zoom });
const fire = (type, mx, my, extra = {}) => a.svg.dispatchEvent(new MouseEvent(type, { bubbles: true, ...toClient(mx, my), ...extra }));
const A = HexMath.getCenter(44, 33), B = HexMath.getCenter(44, 34);   // voisines verticales
const mid = { x: (A.cx + B.cx) / 2, y: (A.cy + B.cy) / 2 };
a.revealHex(44, 33);

fire('click', mid.x, mid.y - 3);                    // côté A, déjà révélée : rien
const r1 = a.revealedHexSet.has('44,34');           // attendu : false
fire('click', mid.x, mid.y + 3);                    // côté B, sous le voile : révélée
const r2 = a.revealedHexSet.has('44,34');           // attendu : true

fire('mousemove', A.cx, A.cy);                      // survol d'une case révélée, outil Révéler
const h1 = a.hoverLayer.childNodes.length;          // attendu : 0
fire('mousemove', A.cx, A.cy, { ctrlKey: true });   // avec Ctrl : elle serait masquée
const h2 = a.hoverLayer.childNodes.length;          // attendu : 1
a.revealedHexSet.delete('44,34'); a.removeHole('44,34');
fire('mousemove', B.cx, B.cy);                      // case voilée
const h3 = a.hoverLayer.childNodes.length;          // attendu : 1

fire('click', A.cx, A.cy, { ctrlKey: true });       // Ctrl+clic : A remasquée
const r3 = a.revealedHexSet.has('44,33');           // attendu : false
fire('contextmenu', B.cx, B.cy);                    // clic droit sur une case voilée : rien
const sea = HexMath.getCenter(0, 0); fire('click', sea.cx, sea.cy);   // hors brouillard : rien
({ r1, r2, h1, h2, h3, r3, cellsPolys: document.querySelectorAll('.hex-cell').length, size: a.revealedHexSet.size })
```

Expected : `r1: false, r2: true, h1: 0, h2: 1, h3: 1, r3: false, cellsPolys: 0`, et `size` cohérent (aucune case hors brouillard dans l'ensemble). Vérifier aussi : en mode Joueur (`chultApp.setMode('player')`), `fire('mousemove', B.cx, B.cy)` laisse `hoverLayer` vide ; le glisser pour déplacer la carte et la molette fonctionnent toujours ; révéler une case produit un flash (`document.querySelectorAll('#flash-layer polygon').length` vaut 1 juste après, 0 une seconde plus tard). Arrêter le serveur ensuite.

- [ ] **Step 8: Commit**

```bash
git add hex-geometry.js test/hex-geometry.test.js app.js index.html styles.css
git commit -m "fix: clics et survols calculés par case, bordure des cases révélées inerte

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
