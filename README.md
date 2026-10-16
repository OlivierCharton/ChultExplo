# Chult Explo

Carte interactive de Chult (Tomb of Annihilation) avec brouillard de guerre hexagonal, jeton du groupe et session partagée en direct entre le MJ et les joueurs.

## Utilisation

1. Ouvrir la page : un écran d'accueil propose deux choix.
2. **Créer une session MJ** : la version MJ s'ouvre et affiche un code à 4 chiffres en haut de l'écran (bouton pour le copier).
3. **Rejoindre en tant que joueur** (sur un autre PC) : saisir le code. La carte s'affiche en lecture seule et suit en direct les cases révélées, les lieux découverts et le jeton du groupe. Chaque joueur règle librement son zoom et sa position.
4. Si le MJ recharge sa page, il reprend le même code et les joueurs se reconnectent tout seuls.

Sans internet, le MJ peut travailler en local (bandeau « Hors ligne »). Pour tester deux onglets d'un même navigateur sans réseau, ajouter `?transport=local` à l'adresse des deux pages.

La connexion est directe de navigateur à navigateur (PeerJS) ; un service public ne sert qu'à la mise en relation. Elle peut échouer sur certains réseaux très restrictifs. Le code à 4 chiffres n'est pas un secret fort et les joueurs téléchargent la carte complète : à réserver à des tables de confiance.

## Mise en ligne avec GitHub Pages

Aucun workflow n'est nécessaire : dans les réglages du dépôt, **Settings → Pages → Build and deployment**, choisir **Deploy from a branch**, branche `master`, dossier `/ (root)`. La page est ensuite servie à l'adresse `https://<utilisateur>.github.io/<dépôt>/`.

## Développement

```bash
npm install        # dépendances de développement (tests, outils)
npm test           # tests unitaires
npm run fog        # recalcule fog-data.js à partir des cartes
npm run labels     # régénère les textes et croix des lieux
```

Fait avec IA et amour.
