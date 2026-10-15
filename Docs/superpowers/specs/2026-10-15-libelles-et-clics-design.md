# Carte de Chult : libellés des lieux, croix et clics sur les cases

Date : 2026-10-15 · Branche : `wip` · Fait suite à `2026-10-15-grille-brouillard-design.md`

## Problèmes et décisions

1. **Croix des lieux.** Pour chaque lieu visible dès le départ, la croix (le symbole du lieu) doit s'afficher telle qu'elle est sur la carte complète, même si la carte vierge ne la contient pas.
2. **Texte d'un lieu découvert.** Quand un lieu est découvert, tout son texte imprimé doit se voir, y compris par-dessus des cases encore sous le voile (exemple : « Firefinger »).
3. **Texte d'un lieu non découvert.** Tant que la case du symbole n'est pas révélée, le texte du lieu ne doit pas se voir, même si les cases en dessous ont été révélées.
4. **Bordure des cases révélées.** La bordure d'une case révélée ne doit plus capter les clics.

Décisions de l'utilisateur :
- Les textes sont traités **au pixel près** (lettres et halo seuls), pas par cases entières.
- Une case révélée ne réagit plus à un clic simple ni au survol ; Ctrl+clic, clic droit et l'outil Masquer la remettent sous le voile.
- Le badge actuel (pastille + nom, calque `poi-layer`) est conservé tel quel.

Un lieu est **découvert** si sa case centrale (`centerHex`) est hors brouillard ou si elle est révélée. C'est la règle déjà appliquée par `syncPois()`.

## Architecture

### 1. Découpe des libellés (hors ligne)

`tools/label-boxes.json` : pour chacun des 26 lieux, un rectangle en pixels de la carte (6563 × 8925) `{ "x", "y", "w", "h" }` qui englobe le symbole et le texte du lieu, sans autre lieu. Fichier écrit à la main à partir de la carte, validé sur l'image de contrôle.

`tools/extract-labels.mjs` (Node + `sharp`, lancé par `npm run labels`) lit `carte-complete.jpg` et produit, pour chaque lieu :
- `Assets/labels/<id>-text.png` : le libellé et le symbole, en RGBA, fond transparent. L'alpha vaut 1 sur les pixels « texte » et 0 ailleurs.
- `Assets/labels/<id>-patch.png` : une rustine RGBA de même taille qui couvre ces pixels avec de la texture voisine, bord fondu sur 3 px.

et un fichier `labels-data.js` (plain script, chargé par `index.html`) :

```js
const POI_LABELS = { "firefinger": { x: 3560, y: 3150, w: 420, h: 190 }, /* ... */ };
```

Les chemins d'image se déduisent de l'identifiant : `Assets/labels/<id>-text.png` et `-patch.png`.

Fonctions pures dans `tools/label-extract.js` (testées) :
- `buildTextMask(rgb, w, h, params)` : le halo est clair (canal minimum > 190 et écart max-min < 70). On retire les traits fins (grille imprimée, rivières) par érosion puis dilatation. Les lettres et symboles sont les pixels sombres (canal max < 85) à moins de 4 px d'un halo. On ne garde que les composantes connexes qui touchent le rectangle du lieu et on bouche les trous avec une dilatation de 2 px. Les constantes sont en tête du script.
- `buildPatch(rgb, mask, w, h)` : chaque pixel du masque dilaté de 3 px reprend la couleur d'un pixel voisin non masqué, pris à des décalages fixes (90, 140, 200 px) dans cet ordre ; alpha dégradé sur le bord.

`Assets/labels-check.png` (ignoré par git) montre, pour chaque lieu, le texte extrait et la rustine, pour contrôle visuel par l'utilisateur. Si un lieu est mal découpé, on ajuste son rectangle, pas les constantes globales.

### 2. Empilement dans le SVG (`index.html`, `app.js`)

Du bas vers le haut :
1. `img-complete` (inchangée) ;
2. `<g id="poi-patches-layer">` : les rustines des 26 lieux, toujours présentes ;
3. `img-vierge` sous le masque `fog-mask` (inchangé, avec ses trous révélés et les trous `mask-visible` de la légende) ;
4. `<g id="poi-labels-layer">` : les découpes de texte, **uniquement pour les lieux découverts** ;
5. calques existants : grille, survol, fantômes MJ, badges.

Comportement :
- Case révélée sous un texte non découvert : la carte complète s'affiche, texte recouvert par la rustine (règle 3).
- Lieu découvert : sa découpe s'affiche au-dessus de tout le brouillard (règles 1 et 2). Pour un lieu visible dès le départ, la croix vient de la carte complète.
- `renderPoiLabels()` reconstruit `poi-labels-layer` depuis `poi.revealed` ; appelée par `syncPois()` après la mise à jour des états.
- Les découpes et rustines ne reçoivent aucun événement de souris (`pointer-events: none`).
- Les autres textes de la carte (rivières, régions, titres) ne sont pas traités.

### 3. Clics et survols par calcul de case

- `hex-geometry.js` : ajout de `hexAt(x, y) -> { q, r }`, la case dont le centre est le plus proche du point (essai sur la case estimée et ses 6 voisines). Les clés hors de l'image sont possibles : l'appelant filtre avec `fogKeys`.
- `app.js` : les clics (`click`, `contextmenu`), `mousemove` et `mouseleave` sont écoutés sur `#map-svg`. La position souris est convertie en coordonnées carte avec `panX`, `panY` et `zoom` du `stage`, puis en case via `hexAt`. Une case hors de `fogKeys` est ignorée.
- Le polygone interactif par case (`grid-interactive-layer`) est supprimé. Le survol et la prévisualisation du pinceau sont dessinés dans un calque `#hover-layer` (`pointer-events: none`) recréé à chaque déplacement ; le flash de révélation y ajoute un polygone temporaire.
- La surbrillance de survol ne s'affiche que sur les cases que l'action en cours modifierait : outil Révéler → cases non révélées ; outil Masquer ou touche Ctrl enfoncée → cases révélées ; outil Basculer → toutes les cases du brouillard.
- Clic simple avec l'outil Révéler sur une case révélée : aucun effet. Ctrl+clic, clic droit et outil Masquer : la case repasse sous le voile, comme aujourd'hui.
- Le glisser pour déplacer la carte n'est pas modifié ; `hasDragged` continue d'empêcher un clic en fin de glissement.
- `styles.css` : les règles `.grid-interactive polygon` sont retirées ; les styles de survol et de flash passent sur `#hover-layer`.

### 4. Données de lieux

Les 26 `centerHex` ne changent pas. Les identifiants de `pointsOfInterest` et de `POI_LABELS` doivent coïncider ; l'outil échoue avec un message clair si un lieu n'a pas de rectangle.

## Fichiers

| Fichier | Action |
|---|---|
| `hex-geometry.js` | ajouter `hexAt` |
| `tools/label-extract.js` | créer (fonctions pures) |
| `tools/extract-labels.mjs`, `tools/label-boxes.json` | créer |
| `Assets/labels/*.png`, `labels-data.js` | générés, committés |
| `Assets/labels-check.png` | généré, ignoré par git |
| `app.js`, `index.html`, `styles.css` | modifier |
| `package.json` | script `labels` |
| `test/*.test.js` | tests de `hexAt`, `buildTextMask`, `buildPatch` |

## Vérification

- Tests `node:test` : `hexAt` (centre, bords, coins, cases hors carte) ; `buildTextMask` sur une image synthétique (texte sombre avec halo clair sur fond texturé : le masque couvre le texte, ignore une ligne claire fine isolée) ; `buildPatch` (les pixels masqués prennent la couleur voisine, le bord est dégradé).
- Contrôle visuel de `Assets/labels-check.png` par l'utilisateur pour les 26 lieux.
- Navigateur : au chargement, croix et textes des lieux visibles dès le départ ; révéler la case de Firefinger : croix et « Firefinger » apparaissent par-dessus le brouillard ; révéler plusieurs cases sous le texte d'un lieu sans toucher à sa croix : aucun texte ; cliquer à la limite entre une case révélée et une case voilée : la case voilée se révèle ; Ctrl+clic et clic droit sur une case révélée la re-masquent ; survol d'une case révélée sans Ctrl : pas de surbrillance ; pan et zoom fluides.

## Limites connues

- La rustine copie de la texture voisine : un léger raccord peut se voir sur une case révélée sous un texte non découvert.
- Les rectangles de lieux sont réglés à la main ; si une zone change dans la carte, il faut les revoir.

## Hors périmètre

Retrait du badge, textes autres que les 26 lieux, changements d'interface ou de sauvegarde.

---
Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
