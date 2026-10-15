# Carte de Chult : grille de brouillard exacte

Date : 2026-10-15 · Branche : `wip`

## Problème

`initHexGrid()` (`app.js`) ne crée un polygone cliquable que pour les 917 cases de `BLANK_HEX_COORDINATES`, détectées par comparaison des deux images, plus les centres de POI. Les cases de lisière, à moitié blanches dans `carte-vierge.jpg` mais non détectées, n'ont aucun polygone : elles sont impossibles à cliquer. De plus, au premier lancement, toute case non détectée est considérée comme déjà révélée alors que le voile la masque encore en partie.

## Décisions

- **Seules les cases sous le voile sont interactives.** Une case visible au départ (mer, côtes, zone de Port Nyanzaru) n'a ni polygone, ni ligne de grille, ni trou de masque ; elle ne peut ni être cliquée ni être masquée. Ctrl+clic et clic droit n'y font rien.
- **Le brouillard est calculé exactement, hors ligne**, par un script Node. Il ne dépend plus d'une détection approximative.
- **Une case est « brouillard » dès qu'elle contient une part même faible de pixels réellement blancs**, de façon à rendre cliquables les cases de lisière.

## Architecture

### 1. `tools/compute-fog.mjs` (hors ligne, Node 24)

- Dépendance de développement : `sharp`, déclarée dans `package.json`. `node_modules/` est ignoré par git.
- Charge `carte-complete.jpg` et `carte-vierge.jpg` (6563 × 8925).
- Énumère les hexagones de la géométrie calibrée (`dx`, `dy`, `x0`, `y0`, `R`, flat-topped, colonnes impaires décalées de `dy/2`) dont le centre est dans l'image.
- Pour chaque hexagone, mesure la part de pixels de son polygone où les deux images diffèrent au-delà d'une tolérance par pixel (bruit JPEG ignoré). La case est « brouillard » si cette différence atteint 1 % (`FOG_RATIO`) ET si au moins 8 % de ses pixels dans la carte vierge sont du fond voilé (couleur plate RGB 255, 246, 221 à ±3 par canal ; `BLANK_RATIO`) ; sinon elle est visible et inerte, même si elle diffère par une teinte ou une annotation MJ (constantes en tête de script).
- Écrit `fog-data.js` : `const FOG_HEX_KEYS = ["q,r", ...];`.
- Écrit `Assets/fog-check.png` : la carte avec les cases en brouillard en rouge, pour contrôle visuel.
- Affiche le nombre de cases en brouillard.

`fog-data.js` est chargé par une balise `<script>` dans `index.html`, car `index.html` doit fonctionner en `file://`, où `fetch` d'un JSON est bloqué. Le runtime ne dépend pas de Node.

### 2. `app.js`

- `BLANK_HEX_COORDINATES` est supprimé. `initHexGrid()` lit `FOG_HEX_KEYS` et ne crée polygones interactifs et lignes de grille que pour ces cases.
- `loadState()` : sans sauvegarde, aucune case n'est révélée. Le bloc qui révélait les cases « hors brouillard » est supprimé.
- Les compteurs (`stats`, `saveState`) utilisent `FOG_HEX_KEYS.length`.
- Le masque SVG ne reçoit de trou que pour les cases révélées du brouillard.
- Les POI dont la case centrale n'est pas dans `FOG_HEX_KEYS` sont révélés dès le départ, avec libellé. Au démarrage, la console liste ces POI pour permettre de corriger les coordonnées mal calées.
- Les POI dont la case centrale est dans le brouillard gardent le comportement actuel. Les marqueurs « fantômes » du MJ ne s'affichent que pour ces POI, et révéler un fantôme révèle la case centrale.
- Le pinceau (rayon 1 ou 2) et `applyTool` ignorent les cases qui ne sont pas dans `FOG_HEX_KEYS`.

### 3. Sauvegarde

- Aucun changement de format ni de clé (`chult_explo_save_v1`) : le site n'a pas encore été utilisé, donc aucune migration.
- Par sécurité, le chargement (localStorage et import JSON) ignore les clés qui ne sont pas dans `FOG_HEX_KEYS`.
- L'import d'un fichier JSON applique le même filtrage.

### 4. Nettoyage (listé à l'utilisateur avant toute suppression)

- `Docs/Instructions.md` : corriger l'orientation des hexagones (flat-topped, comme le code).
- `.gitignore` : réécrit en UTF-8, car l'encodage UTF-16 d'origine était ignoré par git. Il exclut `id_ed25519_chult*` et `node_modules/`.
- Candidats à la suppression après mise en place de `fog-data.js` : `build_app.py`, `blank_coords.json`, `blank_hexes.json`, `grid_data.json`, `coords_snippet.js`, `poi_clean.json`, `pois.json`, `app_pois.json` et les captures de debug dans `Assets/`.

## Vérification

- Le script affiche le nombre de cases et produit `Assets/fog-check.png`. L'utilisateur juge la lisière à l'œil et ajuste le seuil si besoin.
- Test navigateur : cliquer chaque case de lisière citée (Camp Vengeance, Mbala, Ataaz Kahakla, Kir Sabal, Valley of Dread) et vérifier qu'elle se révèle sans artefact.
- Vérifier qu'une case visible au départ ne réagit ni au survol ni au clic, ni au Ctrl+clic ni au clic droit.
- Vérifier la sauvegarde automatique, l'import et l'export JSON.
- Vérifier la fluidité du pan/zoom avec le nombre réel de cases. Si elle est insuffisante, regrouper les traits de grille en un seul `<path>`.

## Hors périmètre

Aucune évolution de l'interface, du zoom, des outils MJ ou du design visuel.

---
Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
