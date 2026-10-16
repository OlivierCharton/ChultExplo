# Carte de Chult : jeton du groupe

Date : 2026-10-16 · Branche : `feature/party_token`

## Objectif

Représenter le groupe de joueurs sur la carte par un jeton (`Assets/party_token.png`, médaillon rond de 200 × 200 px à fond transparent). Le MJ le déplace par glisser-déposer ; déposer le jeton sur une case sous le voile la révèle.

## Décisions

- Position de départ : la case centrale de Port Nyanzaru (`pointsOfInterest["port-nyanzaru"].centerHex`, soit 43,23). C'est une case hors brouillard.
- Taille : le jeton mesure **88 px** de diamètre sur la carte, centré sur sa case. Le cercle inscrit d'une case fait `√3 · R ≈ 96,4` px : le jeton ne dépasse jamais l'hexagone. Constante `TOKEN_SIZE` en tête de `app.js`.
- Le jeton est visible en Mode MJ et en Mode Joueur ; il n'est déplaçable qu'en Mode MJ.
- Déposer sur une case sous le voile non révélée la révèle, comme un clic avec l'outil Révéler (flash, trou dans le masque, lieux découverts, sauvegarde), quel que soit l'outil sélectionné et le rayon du pinceau. Seule la case d'arrivée est révélée, pas celles traversées.
- Déposer sur une case déjà révélée, ou hors brouillard (y compris la mer) : le jeton se déplace, rien n'est révélé.
- Déposer hors de la carte : le jeton revient à sa case précédente.
- La position du groupe est sauvegardée avec la progression.
- « Réinitialiser la carte » et « Tout masquer » remettent le jeton à sa position de départ (état initial). « Tout révéler » ne le déplace pas.

## Architecture

### Géométrie (`hex-geometry.js`)

Ajout de `isInMap(q, r) -> boolean` : vrai si le centre de la case est dans l'image (`0 ≤ cx ≤ GRID.width` et `0 ≤ cy ≤ GRID.height`), c'est-à-dire si la case figure dans `enumerateHexes()`. Test dans `test/hex-geometry.test.js`.

### Affichage (`index.html`, `app.js`, `styles.css`)

- Nouveau calque `<g id="party-layer">` en **dernier** dans le SVG, au-dessus des badges. Il contient une seule `<image id="party-token" href="Assets/party_token.png">` de `TOKEN_SIZE` × `TOKEN_SIZE`, `preserveAspectRatio="xMidYMid meet"`.
- `this.partyHex` : `{ q, r }`, case du groupe. `renderParty()` place l'image centrée sur `HexMath.getCenter(q, r)`. Appelée au démarrage, après chargement de la sauvegarde, après un déplacement et après chaque remise à zéro.
- Le calque a `pointer-events: none` ; l'image n'a `pointer-events: all` et `cursor: grab` qu'en Mode MJ (`cursor: grabbing` pendant le glissement). En Mode Joueur elle n'en a pas.

### Glisser-déposer (`app.js`)

Événements de pointeur (souris et tactile) sur l'image :
1. `pointerdown` (bouton principal, Mode MJ) : `preventDefault()`, `setPointerCapture`, mémorise la case d'origine, efface la surbrillance de survol (`renderHover(null, false)`). Le glissement du jeton ne déplace pas la carte : l'événement ne démarre pas le panoramique (`touchstart` du jeton arrêté avec `stopPropagation()`, `touch-action: none` sur l'image).
2. `pointermove` : le jeton suit le pointeur (centre = position du pointeur en coordonnées carte, calculée comme `eventToHex` avec `panX`, `panY`, `zoom`).
3. `pointerup` : `hexAt(x, y)` ; si `isInMap(q, r)` est faux, le jeton retourne à la case d'origine. Sinon `partyHex` devient cette case, le jeton se cale sur son centre, puis, si la case est dans `fogKeys` et non révélée, `revealHex(q, r)` (qui met à jour les lieux et sauvegarde). La position est sauvegardée dans tous les cas.
4. `pointercancel` : retour à la case d'origine.
5. Le `click` que le navigateur peut émettre après le relâchement ne doit pas déclencher un outil sur la case d'arrivée : un indicateur `this.suppressNextClick` est positionné au `pointerup` et consommé par l'écouteur `click` de `#map-svg`.

### Sauvegarde (`saveState`, `exportSaveFile`, `loadState`, `handleFileImport`)

- Nouveau champ `partyHex: "q,r"` dans l'objet sauvegardé et dans l'export (clé de stockage et format inchangés par ailleurs).
- À la lecture (stockage local et import) : si `partyHex` est absent, mal formé ou si `isInMap` est faux, le jeton revient à la position de départ. Une ancienne sauvegarde sans ce champ reste valable.

### Remises à zéro (`resetMap`, `hideAllHexes`)

Elles remettent `partyHex` à la position de départ, rafraîchissent le jeton et sauvegardent. `revealAllHexes` ne touche pas au jeton.

## Fichiers

| Fichier | Action |
|---|---|
| `Assets/party_token.png` | ajouter au dépôt (déjà présent, non suivi) |
| `hex-geometry.js`, `test/hex-geometry.test.js` | `isInMap` + tests |
| `index.html` | calque `party-layer` et son image |
| `styles.css` | règles du calque et du curseur |
| `app.js` | constante `TOKEN_SIZE`, état, rendu, glisser-déposer, sauvegarde, remises à zéro |

## Vérification

- Tests `node:test` : `isInMap` (case de la carte, case hors image, coins).
- Navigateur (simulations d'événements de pointeur et assertions DOM, sur un serveur local) :
  - au démarrage, le jeton est centré sur la case 43,23 et son diamètre est ≤ 96 px ;
  - déposer sur une case sous le voile : le jeton s'y cale et la case est révélée (et le lieu éventuel découvert) ;
  - déposer sur une case révélée, sur une case hors brouillard : le jeton se déplace, l'ensemble des cases révélées ne change pas ;
  - déposer hors de la carte : retour à la case précédente ;
  - le `click` suivant un dépôt ne bascule pas une case avec l'outil Basculer ;
  - rechargement de la page : le jeton reste à sa case ; une sauvegarde sans `partyHex` le remet à Port Nyanzaru ;
  - « Réinitialiser la carte » et « Tout masquer » le ramènent à Port Nyanzaru, « Tout révéler » ne le déplace pas ;
  - en Mode Joueur, le jeton est affiché mais un `pointerdown` ne le saisit pas.
- Le rendu à l'écran ne pourra pas être contrôlé par capture d'écran si la fenêtre du navigateur intégré est masquée : le dire dans le rapport.

## Hors périmètre

Chemin parcouru, révélation par rayon de vision autour du jeton, plusieurs jetons, déplacement du jeton par les joueurs.

---
Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
