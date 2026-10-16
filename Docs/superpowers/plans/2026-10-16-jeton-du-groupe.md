# Jeton du groupe : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Représenter le groupe sur la carte par un jeton (`Assets/party_token.png`) que le MJ déplace par glisser-déposer, et qui révèle la case d'arrivée si elle est sous le voile.

**Architecture:** Un calque SVG `party-layer` (dernier du SVG) contient une `<image>` de 88 px centrée sur la case du groupe (`this.partyHex`). Le glissement utilise les événements de pointeur ; au relâchement, `HexGeometry.hexAt` donne la case d'arrivée, validée par un nouveau `HexGeometry.isInMap`. La position est sauvegardée avec la progression.

**Tech Stack:** HTML/CSS/JS sans build côté navigateur (doit fonctionner en `file://`), Node 24 + `node:test`.

## Global Constraints

Reprises de la spec `Docs/superpowers/specs/2026-10-16-jeton-du-groupe-design.md` :

- Position de départ : la case centrale de Port Nyanzaru (`pointsOfInterest["port-nyanzaru"].centerHex`, soit 43,23).
- Taille : le jeton mesure **88 px** de diamètre sur la carte, centré sur sa case (cercle inscrit d'une case : `√3 · R ≈ 96,4` px). Constante `TOKEN_SIZE` en tête de `app.js`.
- Le jeton est visible en Mode MJ et en Mode Joueur ; il n'est déplaçable qu'en Mode MJ.
- Déposer sur une case sous le voile non révélée la révèle, comme un clic avec l'outil Révéler, quel que soit l'outil sélectionné et le rayon du pinceau. Seule la case d'arrivée est révélée.
- Déposer sur une case déjà révélée ou hors brouillard (y compris la mer) : le jeton se déplace, rien n'est révélé.
- Déposer hors de la carte : le jeton revient à sa case précédente.
- La position du groupe est sauvegardée avec la progression (`partyHex: "q,r"`), clé de stockage et format inchangés par ailleurs. Absent, mal formé ou hors carte : position de départ.
- « Réinitialiser la carte » et « Tout masquer » remettent le jeton à sa position de départ ; « Tout révéler » ne le déplace pas.
- Le `click` émis après un dépôt ne doit pas déclencher d'outil sur la case d'arrivée.
- `index.html` doit fonctionner en `file://` : aucun `fetch`, aucun module ES côté navigateur.
- Travail sur la branche `feature/party_token`. Ne jamais ajouter `id_ed25519_chult*` à git. `git add` explicite (jamais `-A`). Commits terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Les fichiers de l'application peuvent être en CRLF ou en LF selon la machine : conserve l'encodage du fichier que tu modifies (les chaînes multi-lignes d'`Edit` doivent suivre ses fins de ligne).

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `Assets/party_token.png` | Image du jeton (déjà dans le dossier, non suivie : à ajouter à git avec la tâche 2). |
| `hex-geometry.js`, `test/hex-geometry.test.js` | `isInMap(q, r)` et ses tests. |
| `index.html` | Calque `party-layer` et son image. |
| `styles.css` | Règles du calque, du curseur et du glissement. |
| `app.js` | `TOKEN_SIZE`, état et rendu du jeton, sauvegarde, remises à zéro, glisser-déposer. |

---

### Task 1: `isInMap` dans la géométrie

**Files:**
- Modify: `hex-geometry.js`, `test/hex-geometry.test.js`

**Interfaces:**
- Produces: `HexGeometry.isInMap(q, r) -> boolean` : vrai si le centre de la case est dans l'image (`0 ≤ cx ≤ GRID.width` et `0 ≤ cy ≤ GRID.height`), c'est-à-dire si la case figure dans `enumerateHexes()`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `test/hex-geometry.test.js`, remplacer la ligne d'import :

```js
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes, hexAt } = require('../hex-geometry.js');
```

par :

```js
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes, hexAt, isInMap } = require('../hex-geometry.js');
```

et ajouter à la fin du fichier :

```js
test('isInMap accepte les cases de la carte et refuse celles hors image', () => {
  assert.equal(isInMap(0, 0), true);
  assert.equal(isInMap(43, 23), true);   // Port Nyanzaru
  assert.equal(isInMap(-1, 0), false);   // centre à gauche de l'image
  assert.equal(isInMap(78, 0), false);   // centre à droite de l'image
  assert.equal(isInMap(20, -1), false);  // centre au-dessus de l'image
  assert.equal(isInMap(20, 93), false);  // centre sous l'image
});

test('isInMap est cohérent avec enumerateHexes', () => {
  const inMap = new Set(enumerateHexes().map(h => `${h.q},${h.r}`));
  for (let q = -2; q <= 80; q++) {
    for (let r = -2; r <= 95; r++) {
      assert.equal(isInMap(q, r), inMap.has(`${q},${r}`), `${q},${r}`);
    }
  }
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL (`isInMap is not a function`).

- [ ] **Step 3: Implémenter `isInMap`**

Dans `hex-geometry.js`, juste avant la ligne `  function enumerateHexes() {`, ajouter :

```js
  // La case figure-t-elle sur la carte (centre dans l'image) ?
  function isInMap(q, r) {
    const { cx, cy } = getCenter(q, r);
    return cx >= 0 && cx <= GRID.width && cy >= 0 && cy <= GRID.height;
  }

```

et remplacer la dernière ligne de la fabrique :

```js
  return { GRID, getCenter, getPoints, containsPoint, hexAt, enumerateHexes };
```

par :

```js
  return { GRID, getCenter, getPoints, containsPoint, hexAt, isInMap, enumerateHexes };
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (31 tests : les 29 existants + 2 nouveaux).

- [ ] **Step 5: Commit**

```bash
git add hex-geometry.js test/hex-geometry.test.js
git commit -m "feat: isInMap pour valider une case de la carte

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Jeton affiché, sauvegardé et remis à zéro

**Files:**
- Modify: `index.html`, `styles.css`, `app.js`
- Add to git: `Assets/party_token.png`

**Interfaces:**
- Consumes: `HexGeometry.isInMap` (Task 1) ; `this.pois['port-nyanzaru'].centerHex` ; `HexMath.getCenter`.
- Produces (sur `ChultMapApp`) :
  - `TOKEN_SIZE` (constante globale, 88)
  - `this.partyHex: { q, r }`, `this.partyToken: SVGImageElement`
  - `getPartyStartHex() -> { q, r }`, `parsePartyHex(value) -> { q, r }`
  - `placePartyToken(cx, cy)` (centre l'image sur un point carte), `renderParty()` (la centre sur `partyHex`)

- [ ] **Step 1: Ajouter le calque et l'image dans `index.html`**

Juste après la ligne `<g id="poi-layer" class="poi-markers"></g>` (et avant `</svg>`), ajouter :

```html

          <!-- Layer 7: Jeton du groupe (déplaçable en Mode MJ) -->
          <g id="party-layer" class="party-layer">
            <image id="party-token" href="Assets/party_token.png" xlink:href="Assets/party_token.png" width="88" height="88" preserveAspectRatio="xMidYMid meet" />
          </g>
```

- [ ] **Step 2: Règles CSS du calque**

Dans `styles.css`, juste avant le commentaire `/* Rustines et textes des lieux : jamais d'événement souris */`, ajouter :

```css
/* Jeton du groupe : aucun événement tant que le glisser-déposer n'est pas actif (Mode MJ) */
.party-layer,
#party-token {
  pointer-events: none;
}

```

- [ ] **Step 3: Constante, état et initialisation dans `app.js`**

Après les lignes :

```js
// 4. Clé de stockage LocalStorage
const STORAGE_KEY = 'chult_explo_save_v1';
```

ajouter :

```js

// 5. Jeton du groupe : diamètre sur la carte (px), inférieur au cercle inscrit d'une case (√3·R ≈ 96,4)
const TOKEN_SIZE = 88;
```

Dans le constructeur, remplacer :

```js
    // Hover cache
    this.hoveredHex = null;
```

par :

```js
    // Hover cache
    this.hoveredHex = null;

    // Jeton du groupe
    this.partyHex = this.getPartyStartHex();
```

et remplacer :

```js
    this.loadState();
    this.initEvents();
```

par :

```js
    this.loadState();
    this.renderParty();
    this.initEvents();
```

Dans `initDOM()`, après la ligne `this.poiLabelsLayer = document.getElementById('poi-labels-layer');`, ajouter :

```js
    this.partyToken = document.getElementById('party-token');
```

- [ ] **Step 4: Méthodes du jeton**

Juste avant la méthode `loadState() {`, ajouter :

```js
  // Position de départ du groupe : la case de Port Nyanzaru
  getPartyStartHex() {
    const { q, r } = this.pois['port-nyanzaru'].centerHex;
    return { q, r };
  }

  // "q,r" -> { q, r } si la case est sur la carte, sinon la position de départ
  parsePartyHex(value) {
    if (typeof value === 'string') {
      const m = /^(-?\d+),(-?\d+)$/.exec(value);
      if (m) {
        const q = parseInt(m[1], 10);
        const r = parseInt(m[2], 10);
        if (HexGeometry.isInMap(q, r)) return { q, r };
      }
    }
    return this.getPartyStartHex();
  }

  // Centre le jeton sur un point de la carte
  placePartyToken(cx, cy) {
    this.partyToken.setAttribute('width', TOKEN_SIZE);
    this.partyToken.setAttribute('height', TOKEN_SIZE);
    this.partyToken.setAttribute('x', cx - TOKEN_SIZE / 2);
    this.partyToken.setAttribute('y', cy - TOKEN_SIZE / 2);
  }

  // Centre le jeton sur la case du groupe
  renderParty() {
    const { cx, cy } = HexMath.getCenter(this.partyHex.q, this.partyHex.r);
    this.placePartyToken(cx, cy);
  }

```

- [ ] **Step 5: Sauvegarde, chargement, import, export**

Dans `loadState()`, remplacer :

```js
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
        }
      }
```

par :

```js
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
        }
        this.partyHex = this.parsePartyHex(data.partyHex);
      }
```

Dans `saveState()`, remplacer :

```js
        revealedHexes: Array.from(this.revealedHexSet),
        revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
        stats: {
          revealedCount: this.getExploredCount(),
          totalFogHexes: FOG_HEX_KEYS.length,
          percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveObj));
```

par :

```js
        revealedHexes: Array.from(this.revealedHexSet),
        partyHex: `${this.partyHex.q},${this.partyHex.r}`,
        revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
        stats: {
          revealedCount: this.getExploredCount(),
          totalFogHexes: FOG_HEX_KEYS.length,
          percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveObj));
```

Dans `exportSaveFile()`, remplacer :

```js
      revealedHexes: Array.from(this.revealedHexSet),
      revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
      stats: {
        revealedCount: this.getExploredCount(),
        totalFogHexes: FOG_HEX_KEYS.length,
        percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
      }
    };

    const dataStr
```

par :

```js
      revealedHexes: Array.from(this.revealedHexSet),
      partyHex: `${this.partyHex.q},${this.partyHex.r}`,
      revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
      stats: {
        revealedCount: this.getExploredCount(),
        totalFogHexes: FOG_HEX_KEYS.length,
        percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
      }
    };

    const dataStr
```

Dans `handleFileImport(e)`, remplacer :

```js
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
          this.syncMaskHoles();
          this.syncPois();
          this.saveState();
```

par :

```js
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
          this.partyHex = this.parsePartyHex(data.partyHex);
          this.renderParty();
          this.syncMaskHoles();
          this.syncPois();
          this.saveState();
```

- [ ] **Step 6: Remises à zéro**

Dans `resetMap()`, remplacer :

```js
  resetMap() {
    this.revealedHexSet.clear();
```

par :

```js
  resetMap() {
    this.revealedHexSet.clear();
    this.partyHex = this.getPartyStartHex();
    this.renderParty();
```

Dans `hideAllHexes()`, remplacer :

```js
  hideAllHexes() {
    this.revealedHexSet.clear();
```

par :

```js
  hideAllHexes() {
    this.revealedHexSet.clear();
    this.partyHex = this.getPartyStartHex();
    this.renderParty();
```

(`revealAllHexes` ne change pas.)

- [ ] **Step 7: Vérifier dans le navigateur**

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan), ouvrir `http://localhost:8080/index.html`, mettre le viewport à 1200×800 (`resize_window`), vider la sauvegarde (`localStorage.removeItem('chult_explo_save_v1'); location.reload()`), puis dans la console :

```js
const a = chultApp;
const t = document.getElementById('party-token');
const c = HexMath.getCenter(43, 23);
({
  start: a.partyHex,
  centreX: +t.getAttribute('x') + TOKEN_SIZE / 2 - c.cx,
  centreY: +t.getAttribute('y') + TOKEN_SIZE / 2 - c.cy,
  taille: [+t.getAttribute('width'), +t.getAttribute('height')],
  href: t.getAttribute('href'),
  pointerEvents: getComputedStyle(t).pointerEvents
})
```

Expected : `start: {q: 43, r: 23}`, `centreX` et `centreY` égaux à `0`, `taille: [88, 88]`, `href: "Assets/party_token.png"`, `pointerEvents: "none"`. Aucune erreur console et aucune requête en 404 pour `party_token.png` (`performance.getEntriesByType('resource').filter(r => r.name.includes('party_token')).map(r => r.responseStatus)` donne `[200]`).

Sauvegarde et remises à zéro :

```js
a.partyHex = { q: 44, r: 30 }; a.renderParty(); a.saveState();
const saved = JSON.parse(localStorage.getItem('chult_explo_save_v1')).partyHex;   // "44,30"
const s = JSON.parse(localStorage.getItem('chult_explo_save_v1')); delete s.partyHex;
localStorage.setItem('chult_explo_save_v1', JSON.stringify(s)); location.reload();
```

Après le rechargement : `chultApp.partyHex` vaut `{q: 43, r: 23}` (sauvegarde sans `partyHex`). Puis :

```js
const a = chultApp;
a.partyHex = { q: 44, r: 30 }; a.saveState(); location.reload();
```

Après ce second rechargement `chultApp.partyHex` vaut `{q: 44, r: 30}`. Puis `chultApp.revealAllHexes()` : la position ne change pas ; `chultApp.resetMap()` : `{q: 43, r: 23}` ; remettre `44,30`, puis `chultApp.hideAllHexes()` : `{q: 43, r: 23}`. Une valeur invalide dans la sauvegarde (`s.partyHex = "999,999"` puis rechargement) redonne `{q: 43, r: 23}`. Arrêter le serveur ensuite et remettre le viewport par défaut.

- [ ] **Step 8: Commit**

```bash
git add Assets/party_token.png index.html styles.css app.js
git commit -m "feat: jeton du groupe affiché à Port Nyanzaru, sauvegardé et remis à zéro

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Glisser-déposer du jeton

**Files:**
- Modify: `app.js`, `styles.css`

**Interfaces:**
- Consumes: `this.partyHex`, `this.partyToken`, `renderParty()`, `placePartyToken(cx, cy)` (Task 2) ; `HexGeometry.hexAt`, `HexGeometry.isInMap` ; `this.fogKeys`, `this.revealedHexSet`, `revealHex(q, r)`, `saveState()`, `renderHover(hex, ctrl)`, `this.mode`.
- Produces (sur `ChultMapApp`) : `eventToMapPoint(e) -> { x, y }` (coordonnées carte d'un événement souris/pointeur), `initPartyEvents()`, `endPartyDrag(hex)`, `moveParty(q, r)`, `this.partyDrag`, `this.suppressNextClick`.

- [ ] **Step 1: Règles CSS du glisser-déposer**

Dans `styles.css`, juste après le bloc ajouté à la tâche 2 :

```css
.party-layer,
#party-token {
  pointer-events: none;
}
```

ajouter :

```css

/* Mode MJ : le jeton se saisit et se déplace */
.mode-mj #party-token {
  pointer-events: all;
  cursor: grab;
  touch-action: none;
}

.mode-mj #party-token.dragging {
  cursor: grabbing;
}
```

- [ ] **Step 2: État du glissement**

Dans le constructeur, remplacer :

```js
    // Jeton du groupe
    this.partyHex = this.getPartyStartHex();
```

par :

```js
    // Jeton du groupe
    this.partyHex = this.getPartyStartHex();
    this.partyDrag = null; // { pointerId, from } pendant un glissement
    this.suppressNextClick = false;
```

- [ ] **Step 3: Coordonnées carte d'un événement**

Remplacer la méthode `eventToHex(e)` :

```js
  eventToHex(e) {
    const rect = this.viewport.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.panX) / this.zoom;
    const y = (e.clientY - rect.top - this.panY) / this.zoom;
    const { q, r } = HexGeometry.hexAt(x, y);
```

par :

```js
  // Point de la carte (coordonnées image) sous un événement souris ou pointeur
  eventToMapPoint(e) {
    const rect = this.viewport.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - this.panX) / this.zoom,
      y: (e.clientY - rect.top - this.panY) / this.zoom
    };
  }

  eventToHex(e) {
    const { x, y } = this.eventToMapPoint(e);
    const { q, r } = HexGeometry.hexAt(x, y);
```

- [ ] **Step 4: Méthodes du glisser-déposer**

Juste avant la méthode `placePartyToken(cx, cy) {`, ajouter :

```js
  initPartyEvents() {
    const token = this.partyToken;
    const isActive = (e) => this.partyDrag && e.pointerId === this.partyDrag.pointerId;

    token.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'mj' || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      try { token.setPointerCapture(e.pointerId); } catch (err) { /* pointeur synthétique */ }
      this.partyDrag = { pointerId: e.pointerId, from: { ...this.partyHex } };
      this.renderHover(null, false);
      token.classList.add('dragging');
    });

    token.addEventListener('pointermove', (e) => {
      if (!isActive(e)) return;
      const { x, y } = this.eventToMapPoint(e);
      this.placePartyToken(x, y);
    });

    token.addEventListener('pointerup', (e) => {
      if (!isActive(e)) return;
      const { x, y } = this.eventToMapPoint(e);
      this.endPartyDrag(HexGeometry.hexAt(x, y));
    });

    token.addEventListener('pointercancel', (e) => {
      if (!isActive(e)) return;
      this.endPartyDrag(null);
    });

    // Un glissement du jeton ne doit pas déplacer la carte (souris et tactile)
    token.addEventListener('mousedown', (e) => e.stopPropagation());
    token.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
  }

  // Fin du glissement : `hex` est la case d'arrivée, ou null pour annuler
  endPartyDrag(hex) {
    const drag = this.partyDrag;
    this.partyDrag = null;
    this.partyToken.classList.remove('dragging');

    // Le click qui suit le relâchement ne doit pas déclencher d'outil sur la case d'arrivée
    this.suppressNextClick = true;
    setTimeout(() => { this.suppressNextClick = false; }, 50);

    if (!hex || !HexGeometry.isInMap(hex.q, hex.r)) {
      this.partyHex = drag.from;
      this.renderParty();
      return;
    }
    this.moveParty(hex.q, hex.r);
  }

  // Déplace le groupe ; révèle la case d'arrivée si elle est sous le voile
  moveParty(q, r) {
    this.partyHex = { q, r };
    this.renderParty();
    const key = `${q},${r}`;
    if (this.fogKeys.has(key) && !this.revealedHexSet.has(key)) {
      this.revealHex(q, r); // met à jour masque, lieux et sauvegarde
    } else {
      this.saveState();
    }
  }

```

- [ ] **Step 5: Brancher les événements et neutraliser les conflits**

Dans `initEvents()`, remplacer :

```js
    this.svg.addEventListener('click', (e) => {
      if (this.hasDragged) return;
```

par :

```js
    this.initPartyEvents();

    this.svg.addEventListener('click', (e) => {
      if (this.suppressNextClick) {
        this.suppressNextClick = false;
        return;
      }
      if (this.hasDragged) return;
```

Dans l'écouteur `mousemove` de `this.svg`, remplacer :

```js
      if (this.isDragging) {
        this.renderHover(null, false);
        return;
      }
```

par :

```js
      if (this.isDragging || this.partyDrag) {
        this.renderHover(null, false);
        return;
      }
```

- [ ] **Step 6: Vérifier dans le navigateur**

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan), ouvrir `http://localhost:8080/index.html`, mettre le viewport à 1200×800 (`resize_window`), vider la sauvegarde (`localStorage.removeItem('chult_explo_save_v1'); location.reload()`), puis dans la console :

```js
const a = chultApp;
a.zoom = 1; a.panX = 0; a.panY = 0; a.updateTransform();
const rect = a.viewport.getBoundingClientRect();
const client = (mx, my) => ({ clientX: rect.left + a.panX + mx * a.zoom, clientY: rect.top + a.panY + my * a.zoom });
const t = document.getElementById('party-token');
const fire = (el, type, mx, my, extra = {}) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 1, button: 0, ...client(mx, my), ...extra }));
const drop = (mx, my) => { const s = HexMath.getCenter(a.partyHex.q, a.partyHex.r); fire(t, 'pointerdown', s.cx, s.cy); fire(t, 'pointermove', mx, my); fire(t, 'pointerup', mx, my); };
const dropOn = (q, r) => { const c = HexMath.getCenter(q, r); drop(c.cx, c.cy); };
const tokenCenter = () => ({ x: +t.getAttribute('x') + TOKEN_SIZE / 2, y: +t.getAttribute('y') + TOKEN_SIZE / 2 });
const panAvant = [a.panX, a.panY];

// 1. case sous le voile, non révélée : le jeton s'y cale et la case est révélée
const veil = '44,34'; const before1 = a.revealedHexSet.has(veil);
dropOn(44, 34);
const c1 = HexMath.getCenter(44, 34);
const r1 = { fog: a.fogKeys.has(veil), avant: before1, apres: a.revealedHexSet.has(veil), party: a.partyHex, calage: [tokenCenter().x - c1.cx, tokenCenter().y - c1.cy], sauve: JSON.parse(localStorage.getItem('chult_explo_save_v1')).partyHex };

// 2. case déjà révélée : le jeton se déplace, l'ensemble des cases révélées ne change pas
const taille = a.revealedHexSet.size; dropOn(44, 33);   // 44,33 : visible (hors brouillard)
const r2 = { party: a.partyHex, taille: a.revealedHexSet.size === taille };

// 3. case de mer hors brouillard : déplacement sans révélation
dropOn(0, 0);
const r3 = { party: a.partyHex, taille: a.revealedHexSet.size === taille };

// 4. hors de la carte : retour à la case précédente
drop(-500, -500);
const r4 = { party: a.partyHex };

// 5. le click qui suit un dépôt ne déclenche pas d'outil (outil Basculer)
a.currentTool = 'toggle';
const cible = HexMath.getCenter(44, 36);          // case du brouillard non révélée
dropOn(44, 36);                                    // révélée par le dépôt
a.svg.dispatchEvent(new MouseEvent('click', { bubbles: true, ...client(cible.cx, cible.cy) }));
const r5 = { toujoursRevelee: a.revealedHexSet.has('44,36') };
a.currentTool = 'reveal';

// 6. la carte n'a pas bougé pendant les glissements
const r6 = { pan: [a.panX, a.panY], identique: a.panX === panAvant[0] && a.panY === panAvant[1] };

// 7. Mode Joueur : le jeton n'est pas saisissable
a.setMode('player');
const avantJoueur = a.partyHex; fire(t, 'pointerdown', 0, 0);
const r7 = { saisi: a.partyDrag !== null, pointerEvents: getComputedStyle(t).pointerEvents };
a.setMode('mj');
({ r1, r2, r3, r4, r5, r6, r7 })
```

Expected : `r1: { fog: true, avant: false, apres: true, party: {q: 44, r: 34}, calage: [0, 0], sauve: "44,34" }` ; `r2: { party: {q: 44, r: 33}, taille: true }` ; `r3: { party: {q: 0, r: 0}, taille: true }` ; `r4: { party: {q: 0, r: 0} }` (retour à la case précédente) ; `r5: { toujoursRevelee: true }` ; `r6: { identique: true }` ; `r7: { saisi: false, pointerEvents: "none" }`. Le diamètre du jeton (`TOKEN_SIZE`) est 88, inférieur à 96,4. Aucune erreur console. Si une des attentes diffère, corriger puis refaire.

Vérifier aussi, si possible, un glissement réel à la souris du jeton vers une case voilée (le jeton suit la souris, la carte ne se déplace pas, la case est révélée). Si les captures d'écran échouent (fenêtre masquée), le dire dans le rapport au lieu d'inventer un résultat. Arrêter le serveur ensuite et remettre le viewport par défaut.

- [ ] **Step 7: Lancer les tests et committer**

Run: `npm test`
Expected: PASS (31 tests). Puis `node --check app.js` ne dit rien.

```bash
git add app.js styles.css
git commit -m "feat: déplacer le jeton du groupe par glisser-déposer (révèle la case d'arrivée)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
