# Carte de Chult : session synchronisée entre deux PC

Date : 2026-10-16 · Branche : `feature/session_sync`

## Objectif

Permettre au MJ de partager la carte en direct avec un ou plusieurs joueurs sur d'autres PC. Le MJ crée une session et obtient un code à 4 chiffres ; les joueurs saisissent ce code et voient les cases révélées, les lieux découverts et le jeton du groupe se mettre à jour en temps réel. L'application peut être servie par GitHub Pages ; la synchronisation se fait de navigateur à navigateur (WebRTC), sans serveur à écrire.

## Décisions

- **Pair à pair avec PeerJS**, bibliothèque copiée dans le dépôt (`vendor/peerjs.min.js`, licence MIT, version exacte fixée dans le plan). Le service public de mise en relation de PeerJS n'est utilisé qu'à l'ouverture de la connexion.
- **Code de salon à 4 chiffres** (`0000` à `9999`). Identifiant PeerJS du MJ : `chult-explo-<code>`. Le code n'est pas un secret fort : un joueur indésirable pourrait le deviner, ce qu'il a lui-même accepté (les cartes sont publiques sur internet).
- **Écran d'accueil au chargement** : deux choix, « Créer une session MJ » et « Rejoindre en tant que joueur ».
- **Le MJ est la source de vérité.** Les joueurs sont en lecture seule : tout message venant d'un joueur est ignoré.
- **Plusieurs joueurs** peuvent rejoindre la même session en même temps.
- **Vue libre** : chaque page joueur garde son propre zoom et sa position ; seuls l'état de la carte et le jeton sont synchronisés.
- **Synchronisé** : les cases révélées et la position du jeton. Les lieux découverts s'en déduisent, comme aujourd'hui.
- Le MJ garde ses sauvegardes locales actuelles (stockage local, export, import). Un joueur ne lit ni n'écrit aucune sauvegarde.
- Le MJ garde le bouton « Mode Joueur » comme aperçu local ; la page joueur n'a aucune commande MJ.

## Parcours

1. **Accueil** (`#landing`), affiché avant toute création de l'application :
   - « Créer une session MJ » : crée l'application en rôle `mj`, démarre la session, affiche le code dans l'indicateur de session avec un bouton pour le copier.
   - « Rejoindre en tant que joueur » : affiche un champ à 4 chiffres (clavier numérique) ; à la validation, tente la connexion. Au premier instantané reçu, l'application est créée en rôle `joueur` et l'accueil disparaît. En cas d'échec (code inconnu ou délai de 10 s dépassé) : message « Aucune session avec ce code. » et retour au champ.
2. **Indicateur de session** (`#session-indicator`, pastille en haut de l'écran) :
   - MJ : `Session 4821 · 2 joueurs · en ligne`, ou bandeau « Hors ligne : les joueurs ne peuvent pas rejoindre » avec un bouton « Réessayer ».
   - Joueur : `Connecté`, `Connexion perdue… nouvelle tentative`, ou `Session terminée`.

## Protocole

Un seul type de message, du MJ vers les joueurs :

```json
{ "type": "state", "version": 1, "revealedHexes": ["44,34", "..."], "partyHex": "43,23" }
```

et un message de fin `{ "type": "bye" }` envoyé par le MJ avant de fermer la session.

- Le MJ envoie l'instantané complet à chaque joueur dès sa connexion, puis à tous les joueurs après chaque changement d'état (appel depuis `saveState()`), regroupés par un délai de 50 ms pour qu'un glissé de pinceau ne produise pas une rafale.
- Pas de différences à fusionner : le joueur remplace son état par l'instantané reçu.
- Validation côté joueur : version égale à 1, `revealedHexes` tableau de chaînes, seules les clés présentes dans `FOG_HEX_KEYS` sont retenues, `partyHex` accepté seulement s'il est de la forme `q,r` avec une case sur la carte (`isInMap`), sinon le jeton reste à sa position de départ. Un message invalide est ignoré.
- Le premier instantané est appliqué sans notification ; les suivants affichent les notifications « Lieu découvert » habituelles.

## Architecture

### `session-protocol.js` (UMD, testé sous Node)

- `generateCode(randomInt) -> string` : 4 chiffres avec zéros initiaux ; `randomInt` est injectable pour les tests, la valeur par défaut utilise `crypto.getRandomValues`.
- `isValidCode(value) -> boolean` : exactement 4 chiffres.
- `peerIdFor(code) -> string` : `chult-explo-<code>`.
- `buildSnapshot({ revealedHexes, partyHex }) -> object` : message `state` ci-dessus.
- `parseSnapshot(message, { fogKeys, isInMap }) -> { revealedHexes: string[], partyHex: string|null } | null` : valide comme décrit.

### `session.js` (UMD, testé sous Node avec le transport en mémoire)

Interface de transport :

```
transport.host(peerId) -> Promise<{ onConnection(cb), onDisconnected(cb), close() }>
   // cb reçoit une connexion { send(message), onMessage(cb), onClose(cb), close() }
   // rejette avec { code: 'unavailable-id' } si l'identifiant est pris
transport.connect(peerId) -> Promise<connexion>   // rejette si aucune session
```

Trois transports :
- `PeerJsTransport` : adaptateur sur la bibliothèque PeerJS (global `Peer`), utilisé par défaut.
- `LoopbackTransport` : en mémoire, pour les tests unitaires.
- `BroadcastChannelTransport` : entre onglets d'un même navigateur, activé par `?transport=local` dans l'URL. Utile pour tester deux onglets sans réseau, et pour une projection sur le même PC hors ligne.

`SessionHost(transport, { getSnapshot, scheduler })` :
- `start({ preferredCode }) -> Promise<string>` : tente le code mémorisé (3 essais espacés de 2 s s'il est encore pris), sinon tire des codes jusqu'à en obtenir un libre (10 essais au plus, puis erreur). Mémorise le code dans le stockage local (`chult_explo_session_code`).
- `broadcast()` : envoi de l'instantané à tous les joueurs, regroupé par 50 ms.
- Événements : `onPlayers(count)`, `onStatus('connecting' | 'online' | 'offline')`. `retry()` relance après un état hors ligne.
- `stop()` : envoie `bye` à chaque joueur puis ferme.

`SessionClient(transport, { onSnapshot, onStatus, scheduler })` :
- `join(code) -> Promise<void>` : se connecte à `peerIdFor(code)` ; rejette si aucun instantané n'arrive en 10 s.
- États : `connecting`, `connected`, `lost` (nouvelle tentative toutes les 3 s, sans limite), `ended` (après `bye` : plus de tentative).
- `leave()`.

### Intégration dans l'application

- `app.js` : `new ChultMapApp({ role, session })`. Rôle `joueur` : mode forcé à `player` (classe `mode-player role-player` sur `<body>`), `loadState`, `saveState`, `setMode` et le raccourci `m` désactivés, `resetMap`, `hideAllHexes`, `revealAllHexes`, `handleFileImport` et `exportSaveFile` inactifs. Rôle `mj` : `saveState()` se termine par `session.broadcast()`.
- `applySnapshot(snapshot)` (rôle joueur) : remplace `revealedHexSet` et `partyHex`, puis `syncMaskHoles()`, `renderParty()`, `syncPois()`, `updateStats()` sans écrire de sauvegarde.
- La création de l'application a lieu après le choix à l'accueil : le MJ la crée immédiatement, le joueur après réception du premier instantané. Le contenu de `window.chultApp` reste l'instance unique.
- `index.html` : écran d'accueil, pastille de session, balises `<script>` de `vendor/peerjs.min.js`, `session-protocol.js` et `session.js` avant `app.js`.
- `styles.css` : accueil, pastille, règles `.role-player` qui masquent export, import, réinitialisation et bascule de mode.

## Robustesse

- Le MJ qui recharge sa page tente de reprendre son code ; les joueurs, qui réessaient toutes les 3 s, se reconnectent tout seuls et reçoivent l'instantané.
- Sans accès au service de mise en relation, le MJ travaille en local (bandeau hors ligne) ; aucune erreur bloquante.
- Message d'un joueur, instantané invalide, version inconnue : ignorés sans erreur affichée.
- Le joueur ne conserve rien : à chaque visite il rejoint à nouveau avec le code.

## Hébergement

Aucun workflow n'est nécessaire : activer GitHub Pages sur `master` (dossier racine) dans les réglages du dépôt. Le `README.md` décrit la marche à suivre et l'usage (créer une session, partager le code, rejoindre).

## Fichiers

| Fichier | Action |
|---|---|
| `vendor/peerjs.min.js` | ajouter (bibliothèque, licence MIT) |
| `session-protocol.js`, `session.js` | créer |
| `test/session-protocol.test.js`, `test/session.test.js` | créer |
| `session-transports.js`, `test/session-transports.test.js` | créer (transports PeerJS et BroadcastChannel) |
| `landing.js` | créer (accueil, création MJ / joueur, pastille de session) |
| `app.js`, `index.html`, `styles.css` | modifier |
| `README.md` | modifier |

## Vérification

- Tests `node:test` du protocole : génération et validation du code (avec générateur injecté), identifiant, construction et lecture d'un instantané (clés hors brouillard retirées, `partyHex` invalide ignoré, version ou type inconnus rejetés).
- Tests `node:test` de `SessionHost` et `SessionClient` avec le transport en mémoire et un ordonnanceur factice : le joueur reçoit l'instantané à la connexion ; une diffusion atteint tous les joueurs ; le compteur de joueurs suit les connexions et déconnexions ; un message de joueur est ignoré ; `bye` termine sans nouvelle tentative ; une coupure provoque des tentatives toutes les 3 s puis une reprise ; un identifiant pris provoque un nouveau tirage ; l'échec de connexion à un code inconnu est rapporté.
- Navigateur, sur un serveur local avec `?transport=local` (deux onglets MJ et joueur) : l'accueil et ses deux parcours, code affiché et copié, révélation d'une case côté MJ visible côté joueur, déplacement du jeton, lieu découvert avec notification, deuxième joueur, rechargement du MJ avec reprise du code, commandes MJ absentes côté joueur, aucune écriture de sauvegarde côté joueur.
- La liaison réelle par le service PeerJS dépend de l'accès réseau du poste ; si elle ne peut pas être testée ici, le dire dans le rapport.

## Limites connues

- Sans serveur de relais (TURN), la connexion peut échouer sur certains réseaux restrictifs.
- Le code à 4 chiffres peut être deviné ; les joueurs sont en lecture seule.
- Le joueur télécharge la carte complète avec ses secrets (accepté).
- Dépendance à un service public de mise en relation pour l'ouverture des connexions.

## Hors périmètre

Vue de carte en miroir, messagerie, authentification, historique des actions, flash de révélation côté joueur.

---
Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
