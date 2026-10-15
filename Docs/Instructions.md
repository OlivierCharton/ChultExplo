Génère une application web monopage (Single Page Application) interactive et entièrement locale (HTML, CSS, JS dans un dossier unique, sans serveur nécessaire pour le développement, fonctionnant directement via `index.html`).

L'objectif est de permettre à un Maître de Jeu (MJ) de révéler progressivement la carte de Chult (Jeu de rôle "Tomb of Annihilation") à ses joueurs, case par case (brouillard de guerre hexagonal), tout en gérant l'apparition des noms de lieux importants uniquement lorsqu'ils sont découverts.

---

### STRUCTURE DES FICHIERS ATTENDUE
- `index.html` : Structure principale et interface utilisateur.
- `styles.css` : Design, grille, positionnements et overlays.
- `app.js` : Toute la logique de gestion de la carte, de la grille, des interactions et des sauvegardes.
- `carte-complete.jpg` : (Image MJ avec tous les détails - image_0.png)
- `carte-vierge.jpg` : (Image Joueurs avec cases blanches - image_1.png)

---

### INTERFACE UTILISATEUR (UI)
- Un grand conteneur pour la carte, avec support du Zoom (Molette) et Pan (Glisser-déposer) fluide.
- Une barre d'outils flottante ou latérale :
  - Un bouton "Exporter la progression" (téléchargement d'un fichier JSON).
  - Un bouton "Importer une progression" (chargement d'un fichier JSON).
  - Un bouton "Réinitialiser la carte" (demande de confirmation).
  - Un sélecteur de mode : "Mode MJ" (cliquer révèle les cases/textes) et "Mode Joueur" (affichage seul, pour projection).

---

### FONCTIONNALITÉS TECHNIQUES REQUISES

1. SUPERPOSITION DES COUCHES ET RENDU (MÉTHODE A)
- Couche arrière-plan : `carte-complete.jpg` (qui contient tous les détails géographiques et les lieux).
- Couche avant-plan / masquage : `carte-vierge.jpg` découpée dynamiquement.
- Implémenter une grille de masquage hexagonale (Hexagonal Grid) par-dessus la carte.
- Au chargement, tous les hexagones du "brouillard de guerre" affichent la texture de la carte vierge (image_1.png).
- Lorsqu'un hexagone est cliqué/révélé :
  - Il devient transparent, révélant la "vrai" carte (`carte-complete.jpg`) en dessous pour cette case précise.
  - La grille hexagonale doit épouser parfaitement le tracé de la carte originale de Chult (environ 78 colonnes x 93 lignes d'hexagones, calibrées dans `hex-geometry.js`).

2. GESTION DES TEXTES DE LIEUX (MÉTHODE A)
- Pour éviter que la révélation d'une case de jungle n'affiche la fin d'un nom de ville (ex: "...mu" de Omu) alors que la ville elle-même n'est pas découverte, nous gérons un calque de textes/marqueurs virtuels en JS.
- Déclarer un dictionnaire de points d'intérêt majeurs (ex: Omu, Camp Righteous, Mezro, Port Nyanzaru, etc.) avec leurs coordonnées d'hexagone central et leur nom/étiquette.
- Le texte ne s'affiche en overlay de manière complète et lisible que lorsque l'hexagone central de la ville est formellement révélé.
- Les textes doivent s'adapter au zoom de la carte pour rester lisibles et alignés.

3. GRID & REPERES
- Les hexagones sont orientés « flat-topped » (côtés plats en haut et en bas, pointes à gauche et à droite) pour correspondre exactement aux hexagones de l'image.
- Un survol d'une case affiche une légère surbrillance. Un clic "révèle" (ou masque à nouveau en mode édition du MJ, par exemple avec Ctrl+Clic ou clic droit).

4. SAUVEGARDE ET PERSISTANCE
- L'état de chaque hexagone (Révélé : True/False) doit être automatiquement enregistré dans le `localStorage` du navigateur à chaque modification.
- Importer/Exporter l'état via un fichier JSON (ex: `sauvegarde-carte-chult.json`) contenant la liste des identifiants d'hexagones révélés, la date de la sauvegarde et les POI découverts.

---

### EXEMPLE DE CODE JS SOUHAITÉ POUR LE DICTIONNAIRE DE LIEUX (MÉTHODE A)
```javascript
const pointsOfInterest = {
  "omu": {
    name: "Omu",
    centerHex: { q: 15, r: 32 }, // Coordonnées de l'hexagone central
    labelSize: "16px",
    revealed: false
  },
  "camp-righteous": {
    name: "Camp Righteous",
    centerHex: { q: 10, r: 15 },
    labelSize: "14px",
    revealed: false
  }
};