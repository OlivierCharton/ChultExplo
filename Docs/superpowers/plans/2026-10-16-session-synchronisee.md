# Session synchronisée entre deux PC : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le MJ crée une session (code à 4 chiffres) et les joueurs la rejoignent depuis d'autres PC : cases révélées, lieux découverts et jeton du groupe se synchronisent en direct, en lecture seule côté joueur.

**Architecture:** Le MJ est l'hôte : il envoie un instantané complet (cases révélées + position du jeton) à chaque joueur à la connexion puis après chaque `saveState()`. La logique réseau est écrite contre une interface de transport interchangeable (PeerJS en vrai, `BroadcastChannel` entre onglets pour les tests et le hors-ligne, un transport en mémoire pour les tests unitaires). Un écran d'accueil (`landing.js`) choisit le rôle avant de créer l'application.

**Tech Stack:** HTML/CSS/JS sans build côté navigateur, PeerJS 1.5.4 copié dans `vendor/`, Node 24 + `node:test`.

## Global Constraints

Reprises de la spec `Docs/superpowers/specs/2026-10-16-session-synchronisee-design.md` :

- Code de salon à 4 chiffres (`0000` à `9999`) ; identifiant PeerJS du MJ : `chult-explo-<code>`.
- Le MJ est la source de vérité ; les joueurs sont en lecture seule : tout message d'un joueur est ignoré. Plusieurs joueurs possibles.
- Vue libre : seul l'état de la carte (cases révélées) et le jeton sont synchronisés, jamais le zoom ni la position de la vue.
- Message d'état : `{ "type": "state", "version": 1, "revealedHexes": [...], "partyHex": "q,r" }` ; message de fin : `{ "type": "bye" }`. Validation côté joueur : version 1, tableau de chaînes filtré sur `FOG_HEX_KEYS`, `partyHex` accepté seulement s'il est de la forme `q,r` avec une case sur la carte (`isInMap`). Message invalide : ignoré.
- Diffusion regroupée par 50 ms. Premier instantané appliqué sans notification, les suivants avec les notifications « Lieu découvert ».
- Un joueur ne lit ni n'écrit aucune sauvegarde (stockage local, export, import, réinitialisation inactifs).
- Le MJ garde le bouton « Mode Joueur » comme aperçu local ; il garde ses sauvegardes locales actuelles (clé `chult_explo_save_v1` inchangée).
- Le MJ qui recharge sa page reprend son code (clé de stockage `chult_explo_session_code` ; 3 essais espacés de 2 s, puis nouveau code). Le joueur réessaie toutes les 3 s après une coupure ; `bye` termine sans nouvelle tentative ; délai de connexion initial de 10 s.
- Sans accès au service de mise en relation : le MJ travaille en local avec un bandeau « Hors ligne : les joueurs ne peuvent pas rejoindre » et un bouton « Réessayer ».
- Le transport `BroadcastChannel` s'active avec `?transport=local` dans l'URL ; PeerJS est le transport par défaut.
- L'application doit rester utilisable depuis un serveur de fichiers statiques (GitHub Pages) : aucun `fetch`, aucun module ES côté navigateur, aucun serveur à écrire.
- Travail sur la branche `feature/session_sync`. Ne jamais ajouter `id_ed25519_chult*` à git. `git add` explicite (jamais `-A`). Commits terminés par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Les fichiers de l'application peuvent être en CRLF ou en LF selon la machine : conserve l'encodage du fichier que tu modifies (les chaînes multi-lignes d'`Edit` doivent suivre ses fins de ligne). 31 tests existent avant ce plan.

## Écarts assumés avec la spec

- Le démarrage de l'application (écran d'accueil, création du MJ ou du joueur, pastille de session) vit dans un nouveau fichier `landing.js`, pour ne pas alourdir `app.js` ; les transports vivent dans `session-transports.js`. La table « Fichiers » de la spec est mise à jour dans la tâche 4.
- `SessionHost` et `SessionClient` reçoivent leurs fonctions de rappel (`onPlayers`, `onStatus`, `onSnapshot`) par leurs options plutôt que par des événements.

## Structure des fichiers

| Fichier | Rôle |
|---|---|
| `session-protocol.js`, `test/session-protocol.test.js` | Code, identifiant, instantané : fonctions pures. |
| `session.js`, `test/session.test.js` | `SessionHost`, `SessionClient`, transport en mémoire. |
| `session-transports.js`, `test/session-transports.test.js` | Transports `BroadcastChannel` et PeerJS. |
| `vendor/peerjs.min.js`, `vendor/LICENSE-peerjs.txt` | PeerJS 1.5.4 (MIT), copié depuis le paquet npm. |
| `landing.js` (créer) | Accueil, création MJ / joueur, pastille de session. |
| `app.js`, `index.html`, `styles.css` | Rôles, instantané, accueil, pastille, règles `.role-player`. |
| `README.md` | Usage et mise en ligne sur GitHub Pages. |

---

### Task 1: Protocole de session

**Files:**
- Create: `session-protocol.js`, `test/session-protocol.test.js`

**Interfaces:**
- Produces (`require('./session-protocol.js')` ou global `SessionProtocol`) :
  - `generateCode(randomInt?) -> string` : 4 chiffres avec zéros initiaux ; `randomInt(max)` renvoie un entier dans `[0, max[` (défaut : `crypto.getRandomValues`).
  - `isValidCode(value) -> boolean` : chaîne d'exactement 4 chiffres.
  - `peerIdFor(code) -> string` : `chult-explo-<code>`.
  - `buildSnapshot({ revealedHexes, partyHex }) -> { type: 'state', version: 1, revealedHexes: string[], partyHex }`.
  - `parseSnapshot(message, { fogKeys: Set<string>, isInMap: (q, r) => boolean }) -> { revealedHexes: string[], partyHex: string|null } | null`.

- [ ] **Step 1: Écrire les tests qui échouent**

`test/session-protocol.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { generateCode, isValidCode, peerIdFor, buildSnapshot, parseSnapshot } = require('../session-protocol.js');
const { isInMap } = require('../hex-geometry.js');

const ctx = { fogKeys: new Set(['44,34', '45,34']), isInMap };

test('generateCode complète avec des zéros et suit le générateur fourni', () => {
  assert.equal(generateCode(() => 0), '0000');
  assert.equal(generateCode(() => 42), '0042');
  assert.equal(generateCode(() => 9999), '9999');
});

test('generateCode demande un entier sous 10000', () => {
  let asked = null;
  generateCode((max) => { asked = max; return 1; });
  assert.equal(asked, 10000);
});

test('generateCode par défaut produit toujours un code valide', () => {
  for (let i = 0; i < 300; i++) assert.equal(isValidCode(generateCode()), true);
});

test('isValidCode n\'accepte que 4 chiffres', () => {
  assert.equal(isValidCode('1234'), true);
  assert.equal(isValidCode('0000'), true);
  for (const bad of ['123', '12345', 'abcd', '12 3', '', '12.3', 1234, null, undefined]) {
    assert.equal(isValidCode(bad), false, String(bad));
  }
});

test('peerIdFor préfixe le code', () => {
  assert.equal(peerIdFor('4821'), 'chult-explo-4821');
});

test('buildSnapshot construit le message d\'état sans partager le tableau', () => {
  const source = new Set(['44,34']);
  const msg = buildSnapshot({ revealedHexes: source, partyHex: '43,23' });
  assert.deepEqual(msg, { type: 'state', version: 1, revealedHexes: ['44,34'], partyHex: '43,23' });
  source.add('45,34');
  assert.deepEqual(msg.revealedHexes, ['44,34']);
});

test('parseSnapshot accepte un message valide', () => {
  const msg = { type: 'state', version: 1, revealedHexes: ['44,34', '45,34'], partyHex: '43,23' };
  assert.deepEqual(parseSnapshot(msg, ctx), { revealedHexes: ['44,34', '45,34'], partyHex: '43,23' });
});

test('parseSnapshot retire les clés hors brouillard et non textuelles', () => {
  const msg = { type: 'state', version: 1, revealedHexes: ['44,34', '0,0', 12, null, '999,999'], partyHex: '43,23' };
  assert.deepEqual(parseSnapshot(msg, ctx).revealedHexes, ['44,34']);
});

test('parseSnapshot ignore un partyHex invalide ou hors carte', () => {
  const base = { type: 'state', version: 1, revealedHexes: [] };
  for (const bad of ['abc', '43', '43,23,1', '999,999', '-5,3', 12, null, undefined]) {
    assert.equal(parseSnapshot({ ...base, partyHex: bad }, ctx).partyHex, null, String(bad));
  }
});

test('parseSnapshot rejette les messages inconnus', () => {
  const ok = { type: 'state', version: 1, revealedHexes: [], partyHex: '43,23' };
  assert.equal(parseSnapshot(null, ctx), null);
  assert.equal(parseSnapshot('state', ctx), null);
  assert.equal(parseSnapshot({ ...ok, type: 'bye' }, ctx), null);
  assert.equal(parseSnapshot({ ...ok, version: 2 }, ctx), null);
  assert.equal(parseSnapshot({ ...ok, revealedHexes: 'x' }, ctx), null);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL (`Cannot find module '../session-protocol.js'`).

- [ ] **Step 3: Écrire `session-protocol.js`**

```js
/**
 * Protocole de la session synchronisée : code de salon, identifiant PeerJS, instantané d'état.
 * Partagé entre le navigateur (global SessionProtocol) et Node (tests).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.SessionProtocol = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const PEER_PREFIX = 'chult-explo-';
  const SNAPSHOT_VERSION = 1;

  function defaultRandomInt(max) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function generateCode(randomInt = defaultRandomInt) {
    return String(randomInt(10000)).padStart(4, '0');
  }

  function isValidCode(value) {
    return typeof value === 'string' && /^[0-9]{4}$/.test(value);
  }

  function peerIdFor(code) {
    return PEER_PREFIX + code;
  }

  function buildSnapshot({ revealedHexes, partyHex }) {
    return { type: 'state', version: SNAPSHOT_VERSION, revealedHexes: Array.from(revealedHexes), partyHex };
  }

  function parseSnapshot(message, { fogKeys, isInMap }) {
    if (!message || message.type !== 'state' || message.version !== SNAPSHOT_VERSION) return null;
    if (!Array.isArray(message.revealedHexes)) return null;

    const revealedHexes = message.revealedHexes.filter(k => typeof k === 'string' && fogKeys.has(k));
    let partyHex = null;
    if (typeof message.partyHex === 'string') {
      const m = /^(-?[0-9]+),(-?[0-9]+)$/.exec(message.partyHex);
      if (m && isInMap(parseInt(m[1], 10), parseInt(m[2], 10))) partyHex = message.partyHex;
    }
    return { revealedHexes, partyHex };
  }

  return { generateCode, isValidCode, peerIdFor, buildSnapshot, parseSnapshot };
});
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (31 existants + 10 nouveaux = 41).

- [ ] **Step 5: Commit**

```bash
git add session-protocol.js test/session-protocol.test.js
git commit -m "feat: protocole de session (code à 4 chiffres, instantané d'état)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `SessionHost`, `SessionClient` et transport en mémoire

**Files:**
- Create: `session.js`, `test/session.test.js`

**Interfaces:**
- Consumes: `SessionProtocol` (Task 1).
- Interface de transport (partagée avec la tâche 3) :
  - `transport.host(peerId) -> Promise<handle>` avec `handle = { onConnection(cb), onDisconnected(cb), close() }` ; `cb` de `onConnection` reçoit une connexion. Rejette avec `{ code: 'unavailable-id' }` si l'identifiant est pris.
  - `transport.connect(peerId) -> Promise<connexion>` ; rejette si aucune session.
  - connexion = `{ send(message), onMessage(cb), onClose(cb), close() }`.
- Produces (`require('./session.js')` ou global `ChultSession`) :
  - `createLoopbackTransport() -> transport` (en mémoire ; le `handle` expose en plus `simulateDisconnect()`).
  - `new SessionHost(transport, { getSnapshot, onPlayers, onStatus, scheduler, random })` avec :
    - `getSnapshot() -> { revealedHexes, partyHex }` (obligatoire)
    - `start({ preferredCode }) -> Promise<string>` : le code obtenu
    - `broadcast()` ; `retry() -> Promise<string>` ; `stop()`
    - propriétés `code`, `status` (`'connecting' | 'online' | 'offline'`), `players` (Set)
    - rappels : `onPlayers(count)`, `onStatus(status)`
  - `new SessionClient(transport, { parse, onSnapshot, onStatus, scheduler, retryMs = 3000, joinTimeoutMs = 10000 })` avec :
    - `join(code) -> Promise<void>` (résolu après le premier instantané ; rejeté avec `Error('Aucune session avec ce code.')`)
    - `leave()` ; propriété `status` (`'connecting' | 'connected' | 'lost' | 'ended'`)
    - rappels : `parse(message) -> snapshot|null`, `onSnapshot(snapshot, isFirst)`, `onStatus(status)`
  - `scheduler = { setTimeout(fn, ms) -> handle, clearTimeout(handle) }` (défaut : les minuteurs réels).

- [ ] **Step 1: Écrire les tests qui échouent**

`test/session.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { SessionHost, SessionClient, createLoopbackTransport } = require('../session.js');
const { peerIdFor, parseSnapshot, buildSnapshot } = require('../session-protocol.js');
const { isInMap } = require('../hex-geometry.js');

const ctx = { fogKeys: new Set(['44,34', '44,36', '38,40']), isInMap };
const tick = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

function createFakeScheduler() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    setTimeout(fn, ms) { const id = nextId++; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const target = now + ms;
      for (;;) {
        let best = null;
        for (const [id, t] of timers) if (t.at <= target && (!best || t.at < best.t.at)) best = { id, t };
        if (!best) break;
        timers.delete(best.id);
        now = best.t.at;
        best.t.fn();
      }
      now = target;
    },
    get count() { return timers.size; }
  };
}

function setup() {
  const transport = createLoopbackTransport();
  const scheduler = createFakeScheduler();
  const state = { revealedHexes: ['44,34'], partyHex: '43,23' };
  const log = { players: [], statuses: [] };
  const host = new SessionHost(transport, {
    getSnapshot: () => ({ revealedHexes: state.revealedHexes.slice(), partyHex: state.partyHex }),
    onPlayers: (n) => log.players.push(n),
    onStatus: (s) => log.statuses.push(s),
    scheduler
  });
  return { transport, scheduler, state, log, host };
}

function makeClient(transport, scheduler, extra = {}) {
  const log = { snapshots: [], statuses: [] };
  const client = new SessionClient(transport, {
    parse: (m) => parseSnapshot(m, ctx),
    onSnapshot: (s, first) => log.snapshots.push({ s, first }),
    onStatus: (st) => log.statuses.push(st),
    scheduler,
    ...extra
  });
  return { client, log };
}

test('start renvoie un code à 4 chiffres et passe en ligne', async () => {
  const { host, log } = setup();
  const code = await host.start();
  assert.match(code, /^[0-9]{4}$/);
  assert.equal(host.code, code);
  assert.equal(host.status, 'online');
  assert.deepEqual(log.statuses, ['connecting', 'online']);
});

test('start tire un autre code si le premier est déjà pris', async () => {
  const transport = createLoopbackTransport();
  await transport.host(peerIdFor('1111'));
  const seq = [1111, 2222];
  const host = new SessionHost(transport, { getSnapshot: () => ({ revealedHexes: [], partyHex: null }), random: () => seq.shift() });
  assert.equal(await host.start(), '2222');
});

test('le code mémorisé est repris dès qu\'il se libère', async () => {
  const { transport, scheduler, host } = setup();
  const blocker = await transport.host(peerIdFor('1234'));
  const started = host.start({ preferredCode: '1234' });
  await tick();
  blocker.close();
  scheduler.advance(2000);
  assert.equal(await started, '1234');
});

test('retombe sur un nouveau code si le code mémorisé reste pris', async () => {
  const transport = createLoopbackTransport();
  const scheduler = createFakeScheduler();
  await transport.host(peerIdFor('1234'));
  const host = new SessionHost(transport, { getSnapshot: () => ({ revealedHexes: [], partyHex: null }), scheduler, random: () => 5555 });
  const started = host.start({ preferredCode: '1234' });
  await tick();
  scheduler.advance(2000);
  await tick();
  scheduler.advance(2000);
  assert.equal(await started, '5555');
});

test('start rejette et passe hors ligne si le réseau échoue', async () => {
  const failing = { host: () => Promise.reject(new Error('réseau')), connect: () => Promise.reject(new Error('réseau')) };
  const statuses = [];
  const host = new SessionHost(failing, { getSnapshot: () => ({ revealedHexes: [], partyHex: null }), onStatus: (s) => statuses.push(s) });
  await assert.rejects(host.start(), /réseau/);
  assert.deepEqual(statuses, ['connecting', 'offline']);
});

test('un joueur reçoit l\'instantané à la connexion', async () => {
  const { transport, scheduler, host, log } = setup();
  const code = await host.start();
  const { client, log: clientLog } = makeClient(transport, scheduler);
  await client.join(code);
  assert.deepEqual(clientLog.snapshots, [{ s: { revealedHexes: ['44,34'], partyHex: '43,23' }, first: true }]);
  assert.equal(client.status, 'connected');
  assert.deepEqual(clientLog.statuses, ['connecting', 'connected']);
  assert.equal(log.players.at(-1), 1);
});

test('une diffusion atteint tous les joueurs et regroupe les appels rapprochés', async () => {
  const { transport, scheduler, state, host } = setup();
  const code = await host.start();
  const a = makeClient(transport, scheduler);
  const b = makeClient(transport, scheduler);
  await a.client.join(code);
  await b.client.join(code);
  state.revealedHexes.push('44,36');
  host.broadcast();
  host.broadcast();
  scheduler.advance(50);
  await tick();
  for (const { log } of [a, b]) {
    assert.equal(log.snapshots.length, 2);
    assert.equal(log.snapshots[1].first, false);
    assert.deepEqual(log.snapshots[1].s.revealedHexes, ['44,34', '44,36']);
  }
});

test('le compteur de joueurs suit les départs', async () => {
  const { transport, scheduler, host, log } = setup();
  const code = await host.start();
  const a = makeClient(transport, scheduler);
  await a.client.join(code);
  assert.equal(log.players.at(-1), 1);
  a.client.leave();
  await tick();
  assert.equal(log.players.at(-1), 0);
});

test('les messages d\'un joueur sont ignorés', async () => {
  const { transport, scheduler, host, log } = setup();
  const code = await host.start();
  const raw = await transport.connect(peerIdFor(code));
  raw.onMessage(() => {});
  raw.send({ type: 'state', version: 1, revealedHexes: ['38,40'], partyHex: '44,36' });
  raw.send('garbage');
  await tick();
  assert.equal(log.players.at(-1), 1);
  assert.equal(scheduler.count, 0);
});

test('stop prévient les joueurs par bye, sans nouvelle tentative', async () => {
  const { transport, scheduler, host } = setup();
  const code = await host.start();
  const { client } = makeClient(transport, scheduler);
  await client.join(code);
  host.stop();
  await tick();
  scheduler.advance(200);
  await tick();
  assert.equal(client.status, 'ended');
  assert.equal(scheduler.count, 0);
  assert.equal(host.status, 'offline');
});

test('une coupure déclenche des tentatives toutes les 3 s puis une reprise', async () => {
  const { transport, scheduler, host } = setup();
  const code = await host.start();
  const { client, log } = makeClient(transport, scheduler);
  await client.join(code);

  host.handle.close(); // le MJ disparaît sans bye
  await tick();
  assert.equal(client.status, 'lost');
  assert.equal(scheduler.count, 1);

  scheduler.advance(3000); // tentative sans hôte : échec, nouvelle tentative planifiée
  await tick();
  assert.equal(client.status, 'lost');
  assert.equal(scheduler.count, 1);

  const second = new SessionHost(transport, { getSnapshot: () => ({ revealedHexes: ['44,34', '44,36'], partyHex: '44,36' }), scheduler });
  await second.start({ preferredCode: code });
  scheduler.advance(3000);
  await tick();
  assert.equal(client.status, 'connected');
  assert.equal(log.snapshots.at(-1).first, false);
  assert.deepEqual(log.snapshots.at(-1).s, { revealedHexes: ['44,34', '44,36'], partyHex: '44,36' });
});

test('rejoindre un code inconnu échoue sans minuteur résiduel', async () => {
  const transport = createLoopbackTransport();
  const scheduler = createFakeScheduler();
  const { client } = makeClient(transport, scheduler);
  await assert.rejects(client.join('9999'), /Aucune session avec ce code/);
  assert.equal(scheduler.count, 0);
});

test('rejoindre sans instantané échoue après 10 s', async () => {
  const transport = createLoopbackTransport();
  const scheduler = createFakeScheduler();
  const raw = await transport.host(peerIdFor('4242'));
  raw.onConnection(() => {});
  const { client } = makeClient(transport, scheduler);
  const joined = client.join('4242');
  await tick();
  scheduler.advance(10000);
  await assert.rejects(joined, /Aucune session avec ce code/);
  assert.equal(scheduler.count, 0);
});

test('un message invalide est ignoré, le premier instantané valide est pris', async () => {
  const transport = createLoopbackTransport();
  const scheduler = createFakeScheduler();
  const raw = await transport.host(peerIdFor('4242'));
  raw.onConnection((conn) => {
    conn.onMessage(() => {});
    conn.send('garbage');
    conn.send({ type: 'state', version: 99 });
    conn.send(buildSnapshot({ revealedHexes: ['44,34'], partyHex: '43,23' }));
  });
  const { client, log } = makeClient(transport, scheduler);
  await client.join('4242');
  assert.equal(log.snapshots.length, 1);
});

test('leave arrête les tentatives', async () => {
  const { transport, scheduler, host } = setup();
  const code = await host.start();
  const { client } = makeClient(transport, scheduler);
  await client.join(code);
  host.handle.close();
  await tick();
  assert.equal(scheduler.count, 1);
  client.leave();
  assert.equal(scheduler.count, 0);
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL (`Cannot find module '../session.js'`).

- [ ] **Step 3: Écrire `session.js`**

```js
/**
 * Session synchronisée : hôte (MJ) et client (joueur), indépendants du transport réseau.
 * Partagé entre le navigateur (global ChultSession) et Node (tests).
 */
(function (root, factory) {
  const protocol = (typeof module === 'object' && module.exports) ? require('./session-protocol.js') : root.SessionProtocol;
  const api = factory(protocol);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ChultSession = api;
  }
})(typeof self !== 'undefined' ? self : this, function (protocol) {
  const defaultScheduler = {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (handle) => clearTimeout(handle)
  };

  // ---------------------------------------------------------------------------
  // Transport en mémoire (tests unitaires)
  // ---------------------------------------------------------------------------
  function createLoopbackTransport() {
    const hosts = new Map(); // peerId -> { connectionCbs, disconnectedCbs, connections }

    function makePair() {
      const ends = [
        { messageCbs: [], closeCbs: [], closed: false },
        { messageCbs: [], closeCbs: [], closed: false }
      ];
      const wrap = (end, other) => ({
        send(message) {
          if (end.closed || other.closed) return;
          const copy = JSON.parse(JSON.stringify(message));
          setTimeout(() => other.messageCbs.forEach((cb) => cb(copy)), 0);
        },
        onMessage(cb) { end.messageCbs.push(cb); },
        onClose(cb) { end.closeCbs.push(cb); },
        close() {
          if (end.closed) return;
          end.closed = true;
          other.closed = true;
          setTimeout(() => {
            end.closeCbs.forEach((cb) => cb());
            other.closeCbs.forEach((cb) => cb());
          }, 0);
        }
      });
      return [wrap(ends[0], ends[1]), wrap(ends[1], ends[0])];
    }

    return {
      host(peerId) {
        if (hosts.has(peerId)) return Promise.reject({ code: 'unavailable-id' });
        const entry = { connectionCbs: [], disconnectedCbs: [], connections: [] };
        hosts.set(peerId, entry);
        return Promise.resolve({
          onConnection(cb) { entry.connectionCbs.push(cb); },
          onDisconnected(cb) { entry.disconnectedCbs.push(cb); },
          close() {
            hosts.delete(peerId);
            entry.connections.forEach((conn) => conn.close());
          },
          simulateDisconnect() { entry.disconnectedCbs.forEach((cb) => cb()); }
        });
      },
      connect(peerId) {
        const entry = hosts.get(peerId);
        if (!entry) return Promise.reject({ code: 'peer-unavailable' });
        const [hostEnd, clientEnd] = makePair();
        entry.connections.push(hostEnd);
        entry.connectionCbs.forEach((cb) => cb(hostEnd));
        return Promise.resolve(clientEnd);
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Hôte (MJ)
  // ---------------------------------------------------------------------------
  class SessionHost {
    constructor(transport, { getSnapshot, onPlayers, onStatus, scheduler, random } = {}) {
      this.transport = transport;
      this.getSnapshot = getSnapshot;
      this.onPlayers = onPlayers || (() => {});
      this.onStatus = onStatus || (() => {});
      this.scheduler = scheduler || defaultScheduler;
      this.random = random;
      this.handle = null;
      this.code = null;
      this.players = new Set();
      this.pending = null;
      this.status = 'offline';
    }

    setStatus(status) {
      this.status = status;
      this.onStatus(status);
    }

    wait(ms) {
      return new Promise((resolve) => this.scheduler.setTimeout(resolve, ms));
    }

    // Renvoie { code, handle }, ou null si l'identifiant est déjà pris ; les autres erreurs sont propagées
    async tryHost(code) {
      try {
        return { code, handle: await this.transport.host(protocol.peerIdFor(code)) };
      } catch (err) {
        if (err && err.code === 'unavailable-id') return null;
        throw err;
      }
    }

    async start({ preferredCode } = {}) {
      this.closeHandle();
      this.setStatus('connecting');
      let result = null;
      try {
        if (protocol.isValidCode(preferredCode)) {
          for (let attempt = 0; attempt < 3 && !result; attempt++) {
            result = await this.tryHost(preferredCode);
            if (!result && attempt < 2) await this.wait(2000);
          }
        }
        for (let attempt = 0; attempt < 10 && !result; attempt++) {
          result = await this.tryHost(protocol.generateCode(this.random));
        }
      } catch (err) {
        this.setStatus('offline');
        throw err;
      }
      if (!result) {
        this.setStatus('offline');
        throw new Error('Aucun code de session disponible.');
      }
      this.handle = result.handle;
      this.code = result.code;
      this.handle.onConnection((conn) => this.addPlayer(conn));
      this.handle.onDisconnected(() => this.setStatus('offline'));
      this.setStatus('online');
      return this.code;
    }

    retry() {
      return this.start({ preferredCode: this.code });
    }

    snapshotMessage() {
      return protocol.buildSnapshot(this.getSnapshot());
    }

    addPlayer(conn) {
      this.players.add(conn);
      this.onPlayers(this.players.size);
      conn.onMessage(() => {}); // lecture seule : tout message d'un joueur est ignoré
      conn.onClose(() => {
        if (this.players.delete(conn)) this.onPlayers(this.players.size);
      });
      conn.send(this.snapshotMessage());
    }

    // Envoie l'état à tous les joueurs ; les appels rapprochés sont regroupés (50 ms)
    broadcast() {
      if (this.pending !== null) return;
      this.pending = this.scheduler.setTimeout(() => {
        this.pending = null;
        const message = this.snapshotMessage();
        this.players.forEach((conn) => conn.send(message));
      }, 50);
    }

    closeHandle() {
      if (this.handle) {
        this.handle.close();
        this.handle = null;
      }
    }

    stop() {
      if (this.pending !== null) {
        this.scheduler.clearTimeout(this.pending);
        this.pending = null;
      }
      this.players.forEach((conn) => conn.send({ type: 'bye' }));
      this.setStatus('offline');
      this.scheduler.setTimeout(() => this.closeHandle(), 200);
    }
  }

  // ---------------------------------------------------------------------------
  // Client (joueur)
  // ---------------------------------------------------------------------------
  class SessionClient {
    constructor(transport, { parse, onSnapshot, onStatus, scheduler, retryMs = 3000, joinTimeoutMs = 10000 } = {}) {
      this.transport = transport;
      this.parse = parse;
      this.onSnapshot = onSnapshot || (() => {});
      this.onStatus = onStatus || (() => {});
      this.scheduler = scheduler || defaultScheduler;
      this.retryMs = retryMs;
      this.joinTimeoutMs = joinTimeoutMs;
      this.status = null;
      this.code = null;
      this.conn = null;
      this.stopped = false;
      this.joined = false;
      this.retryTimer = null;
      this.joinTimer = null;
      this.pendingJoin = null;
    }

    setStatus(status) {
      if (this.status === status) return;
      this.status = status;
      this.onStatus(status);
    }

    join(code) {
      this.code = code;
      this.stopped = false;
      this.joined = false;
      this.setStatus('connecting');
      return new Promise((resolve, reject) => {
        this.pendingJoin = { resolve, reject };
        this.joinTimer = this.scheduler.setTimeout(() => this.failJoin(), this.joinTimeoutMs);
        this.attempt();
      });
    }

    failJoin() {
      const pending = this.pendingJoin;
      this.pendingJoin = null;
      this.leave();
      if (pending) pending.reject(new Error('Aucune session avec ce code.'));
    }

    attempt() {
      if (this.stopped) return;
      this.transport.connect(protocol.peerIdFor(this.code)).then((conn) => {
        if (this.stopped) {
          conn.close();
          return;
        }
        this.conn = conn;
        conn.onMessage((message) => this.handleMessage(conn, message));
        conn.onClose(() => this.handleClose(conn));
      }, () => {
        if (this.stopped) return;
        if (!this.joined) {
          this.failJoin();
          return;
        }
        this.scheduleRetry();
      });
    }

    handleMessage(conn, message) {
      if (conn !== this.conn) return;
      if (message && message.type === 'bye') {
        this.stopped = true;
        this.clearTimers();
        this.setStatus('ended');
        conn.close();
        return;
      }
      const snapshot = this.parse(message);
      if (!snapshot) return;
      const first = !this.joined;
      this.joined = true;
      if (this.joinTimer !== null) {
        this.scheduler.clearTimeout(this.joinTimer);
        this.joinTimer = null;
      }
      this.setStatus('connected');
      this.onSnapshot(snapshot, first);
      if (first && this.pendingJoin) {
        const pending = this.pendingJoin;
        this.pendingJoin = null;
        pending.resolve();
      }
    }

    handleClose(conn) {
      if (conn !== this.conn) return;
      this.conn = null;
      if (this.stopped) return;
      if (!this.joined) {
        this.failJoin();
        return;
      }
      this.setStatus('lost');
      this.scheduleRetry();
    }

    scheduleRetry() {
      if (this.retryTimer !== null) this.scheduler.clearTimeout(this.retryTimer);
      this.retryTimer = this.scheduler.setTimeout(() => {
        this.retryTimer = null;
        this.attempt();
      }, this.retryMs);
    }

    clearTimers() {
      if (this.joinTimer !== null) {
        this.scheduler.clearTimeout(this.joinTimer);
        this.joinTimer = null;
      }
      if (this.retryTimer !== null) {
        this.scheduler.clearTimeout(this.retryTimer);
        this.retryTimer = null;
      }
    }

    leave() {
      this.stopped = true;
      this.clearTimers();
      if (this.conn) {
        const conn = this.conn;
        this.conn = null;
        conn.close();
      }
    }
  }

  return { SessionHost, SessionClient, createLoopbackTransport };
});
```

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS (41 + 15 nouveaux = 56). Si un test de minuteur échoue, relire l'ordre des `await tick()` et des `scheduler.advance()` du test avant de toucher à l'implémentation, puis signaler tout écart entre test et code dans le rapport.

- [ ] **Step 5: Commit**

```bash
git add session.js test/session.test.js
git commit -m "feat: hôte et client de session avec transport en mémoire

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Transports `BroadcastChannel` et PeerJS

**Files:**
- Create: `session-transports.js`, `test/session-transports.test.js`, `vendor/peerjs.min.js`, `vendor/LICENSE-peerjs.txt`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: l'interface de transport de la tâche 2.
- Produces (`require('./session-transports.js')` ou global `ChultTransports`) :
  - `createBroadcastChannelTransport({ channelName = 'chult-explo-session', probeMs = 150, connectMs = 500, BroadcastChannelClass } = {}) -> transport` avec en plus `close()` (ferme les liens et le canal).
  - `createPeerJsTransport(PeerClass, peerOptions?) -> transport`.
  - Le global `Peer` de PeerJS est disponible dans le navigateur via `vendor/peerjs.min.js`.

- [ ] **Step 1: Installer PeerJS et copier la bibliothèque**

Run :

```bash
npm install --save-dev peerjs@1.5.4
mkdir -p vendor
cp node_modules/peerjs/dist/peerjs.min.js vendor/peerjs.min.js
cp node_modules/peerjs/LICENSE vendor/LICENSE-peerjs.txt
npm ls peerjs
ls -la vendor
```

Expected : `peerjs@1.5.4` listé, `vendor/peerjs.min.js` et `vendor/LICENSE-peerjs.txt` présents, le fichier `.min.js` non vide. Si `node_modules/peerjs/LICENSE` ou `dist/peerjs.min.js` n'existe pas à ce chemin, lister `node_modules/peerjs/` et `node_modules/peerjs/dist/`, choisir le fichier minifié UMD équivalent et le dire dans le rapport.

- [ ] **Step 2: Écrire les tests qui échouent**

`test/session-transports.test.js` :

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { createBroadcastChannelTransport, createPeerJsTransport } = require('../session-transports.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- BroadcastChannel -----

function makeBc() {
  const opts = { probeMs: 20, connectMs: 150, channelName: `test-${Math.random().toString(36).slice(2)}` };
  const a = createBroadcastChannelTransport(opts);
  const b = createBroadcastChannelTransport(opts);
  return { a, b, close() { a.close(); b.close(); } };
}

test('BroadcastChannel : un hôte, un client, messages dans les deux sens', async () => {
  const { a, b, close } = makeBc();
  try {
    const handle = await a.host('chult-explo-1111');
    const received = { host: [], client: [] };
    handle.onConnection((conn) => {
      conn.onMessage((m) => received.host.push(m));
      conn.send({ hello: 'client' });
    });
    const conn = await b.connect('chult-explo-1111');
    conn.onMessage((m) => received.client.push(m));
    conn.send({ hello: 'host' });
    await wait(60);
    assert.deepEqual(received.client, [{ hello: 'client' }]);
    assert.deepEqual(received.host, [{ hello: 'host' }]);
  } finally { close(); }
});

test('BroadcastChannel : un identifiant déjà hébergé est refusé', async () => {
  const { a, b, close } = makeBc();
  try {
    await a.host('chult-explo-2222');
    await assert.rejects(b.host('chult-explo-2222'), { code: 'unavailable-id' });
    await assert.rejects(a.host('chult-explo-2222'), { code: 'unavailable-id' });
  } finally { close(); }
});

test('BroadcastChannel : se connecter à un hôte absent échoue', async () => {
  const { b, close } = makeBc();
  try {
    await assert.rejects(b.connect('chult-explo-3333'), { code: 'peer-unavailable' });
  } finally { close(); }
});

test('BroadcastChannel : la fermeture côté client prévient l\'hôte', async () => {
  const { a, b, close } = makeBc();
  try {
    const handle = await a.host('chult-explo-4444');
    let hostClosed = false;
    handle.onConnection((conn) => { conn.onMessage(() => {}); conn.onClose(() => { hostClosed = true; }); });
    const conn = await b.connect('chult-explo-4444');
    conn.close();
    await wait(60);
    assert.equal(hostClosed, true);
  } finally { close(); }
});

test('BroadcastChannel : fermer l\'hôte ferme les connexions des clients', async () => {
  const { a, b, close } = makeBc();
  try {
    const handle = await a.host('chult-explo-5555');
    handle.onConnection((conn) => conn.onMessage(() => {}));
    const conn = await b.connect('chult-explo-5555');
    let clientClosed = false;
    conn.onClose(() => { clientClosed = true; });
    handle.close();
    await wait(60);
    assert.equal(clientClosed, true);
    await assert.rejects(b.connect('chult-explo-5555'), { code: 'peer-unavailable' });
  } finally { close(); }
});

test('BroadcastChannel : un message envoyé dès la connexion n\'est pas perdu', async () => {
  const { a, b, close } = makeBc();
  try {
    const handle = await a.host('chult-explo-6666');
    handle.onConnection((conn) => { conn.onMessage(() => {}); conn.send({ first: true }); });
    const conn = await b.connect('chult-explo-6666');
    await wait(30); // le message arrive avant l'enregistrement du gestionnaire
    const received = [];
    conn.onMessage((m) => received.push(m));
    assert.deepEqual(received, [{ first: true }]);
  } finally { close(); }
});

// ----- PeerJS (avec une fausse classe Peer) -----

class FakeConn {
  constructor() { this.handlers = {}; this.sent = []; this.closed = false; }
  on(ev, cb) { (this.handlers[ev] = this.handlers[ev] || []).push(cb); return this; }
  emit(ev, ...args) { (this.handlers[ev] || []).forEach((cb) => cb(...args)); }
  send(m) { this.sent.push(m); }
  close() { this.closed = true; this.emit('close'); }
}

class FakePeer {
  constructor(id, options) { this.id = id; this.options = options; this.handlers = {}; this.destroyed = false; FakePeer.last = this; }
  on(ev, cb) { (this.handlers[ev] = this.handlers[ev] || []).push(cb); return this; }
  emit(ev, ...args) { (this.handlers[ev] || []).forEach((cb) => cb(...args)); }
  connect(id) { this.connectedTo = id; this.conn = new FakeConn(); return this.conn; }
  destroy() { this.destroyed = true; }
}

test('PeerJS : host résout à l\'ouverture et transmet les options', async () => {
  const transport = createPeerJsTransport(FakePeer, { debug: 0 });
  const p = transport.host('chult-explo-1234');
  assert.equal(FakePeer.last.id, 'chult-explo-1234');
  assert.deepEqual(FakePeer.last.options, { debug: 0 });
  FakePeer.last.emit('open');
  const handle = await p;
  handle.close();
  assert.equal(FakePeer.last.destroyed, true);
});

test('PeerJS : host rejette avec unavailable-id', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('error', { type: 'unavailable-id' });
  await assert.rejects(p, { code: 'unavailable-id' });
  assert.equal(peer.destroyed, true);
});

test('PeerJS : host propage les autres erreurs', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  FakePeer.last.emit('error', { type: 'network' });
  await assert.rejects(p, { type: 'network' });
});

test('PeerJS : une connexion entrante est transmise à l\'ouverture, avec les données déjà reçues', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  const handle = await p;
  const conns = [];
  handle.onConnection((c) => conns.push(c));
  const raw = new FakeConn();
  peer.emit('connection', raw);
  assert.equal(conns.length, 0);   // pas avant l'ouverture
  raw.emit('open');
  assert.equal(conns.length, 1);
  raw.emit('data', { early: true });
  const received = [];
  conns[0].onMessage((m) => received.push(m));
  raw.emit('data', { late: true });
  assert.deepEqual(received, [{ early: true }, { late: true }]);
  conns[0].send({ out: 1 });
  assert.deepEqual(raw.sent, [{ out: 1 }]);
});

test('PeerJS : onDisconnected relaie la déconnexion du service', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  const handle = await p;
  let called = 0;
  handle.onDisconnected(() => { called++; });
  peer.emit('disconnected');
  assert.equal(called, 1);
});

test('PeerJS : connect résout à l\'ouverture de la connexion et la fermeture détruit le pair', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  assert.equal(peer.connectedTo, 'chult-explo-1234');
  peer.conn.emit('open');
  const conn = await p;
  conn.close();
  assert.equal(peer.conn.closed, true);
  assert.equal(peer.destroyed, true);
});

test('PeerJS : connect rejette si le pair est introuvable', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.connect('chult-explo-9999');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.emit('error', { type: 'peer-unavailable' });
  await assert.rejects(p, { type: 'peer-unavailable' });
  assert.equal(peer.destroyed, true);
});
```

- [ ] **Step 3: Lancer les tests pour vérifier qu'ils échouent**

Run: `npm test`
Expected: FAIL (`Cannot find module '../session-transports.js'`).

- [ ] **Step 4: Écrire `session-transports.js`**

```js
/**
 * Transports de la session synchronisée : BroadcastChannel (entre onglets, tests et hors-ligne) et PeerJS.
 * Partagé entre le navigateur (global ChultTransports) et Node (tests).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ChultTransports = api;
  }
})(typeof self !== 'undefined' ? self : this, function (root) {
  // ---------------------------------------------------------------------------
  // BroadcastChannel : un canal partagé par tous les onglets de même origine
  // ---------------------------------------------------------------------------
  function createBroadcastChannelTransport({ channelName = 'chult-explo-session', probeMs = 150, connectMs = 500, BroadcastChannelClass } = {}) {
    const BC = BroadcastChannelClass || (typeof BroadcastChannel !== 'undefined' ? BroadcastChannel : null);
    if (!BC) throw new Error('BroadcastChannel indisponible dans ce navigateur.');

    const instance = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const channel = new BC(channelName);
    const hostEntries = new Map();     // peerId -> { connectionCbs, links }
    const links = new Map();           // linkId -> lien
    const pendingProbes = new Map();   // peerId -> callback « identifiant pris »
    const pendingConnects = new Map(); // linkId -> callback « connexion acceptée »
    let linkCounter = 0;

    function post(message) {
      channel.postMessage({ ...message, from: instance });
    }

    function createLink(id, remote) {
      const link = { id, remote, messageCbs: [], closeCbs: [], closed: false, buffer: [] };
      links.set(id, link);
      link.api = {
        send(message) {
          if (!link.closed) post({ kind: 'data', link: id, to: remote, payload: message });
        },
        onMessage(cb) {
          link.messageCbs.push(cb);
          link.buffer.splice(0).forEach((m) => cb(m));
        },
        onClose(cb) { link.closeCbs.push(cb); },
        close() { closeLink(id, true); }
      };
      return link;
    }

    function closeLink(id, notify) {
      const link = links.get(id);
      if (!link || link.closed) return;
      link.closed = true;
      links.delete(id);
      if (notify) post({ kind: 'close', link: id, to: link.remote });
      link.closeCbs.forEach((cb) => cb());
    }

    function deliver(id, payload) {
      const link = links.get(id);
      if (!link) return;
      if (link.messageCbs.length === 0) link.buffer.push(payload);
      else link.messageCbs.forEach((cb) => cb(payload));
    }

    function handle(m) {
      if (!m || m.from === instance) return;
      switch (m.kind) {
        case 'probe':
          if (hostEntries.has(m.peerId)) post({ kind: 'taken', peerId: m.peerId, to: m.from });
          break;
        case 'taken':
          if (m.to === instance && pendingProbes.has(m.peerId)) pendingProbes.get(m.peerId)();
          break;
        case 'connect': {
          const entry = hostEntries.get(m.peerId);
          if (!entry) break;
          const link = createLink(m.link, m.from);
          entry.links.add(m.link);
          post({ kind: 'accepted', link: m.link, to: m.from });
          entry.connectionCbs.forEach((cb) => cb(link.api));
          break;
        }
        case 'accepted':
          if (m.to === instance && pendingConnects.has(m.link)) pendingConnects.get(m.link)(m.from);
          break;
        case 'data':
          if (m.to === instance) deliver(m.link, m.payload);
          break;
        case 'close':
          if (m.to === instance) closeLink(m.link, false);
          break;
        default:
          break;
      }
    }

    channel.onmessage = (event) => handle(event.data);

    function closeAll() {
      [...links.keys()].forEach((id) => closeLink(id, true));
    }
    // Rechargement ou fermeture de l'onglet : les autres onglets voient la connexion se fermer
    if (typeof root.addEventListener === 'function') root.addEventListener('pagehide', closeAll);

    return {
      host(peerId) {
        return new Promise((resolve, reject) => {
          if (hostEntries.has(peerId)) {
            reject({ code: 'unavailable-id' });
            return;
          }
          let taken = false;
          pendingProbes.set(peerId, () => { taken = true; });
          post({ kind: 'probe', peerId });
          setTimeout(() => {
            pendingProbes.delete(peerId);
            if (taken) {
              reject({ code: 'unavailable-id' });
              return;
            }
            const entry = { connectionCbs: [], links: new Set() };
            hostEntries.set(peerId, entry);
            resolve({
              onConnection(cb) { entry.connectionCbs.push(cb); },
              onDisconnected() {},
              close() {
                hostEntries.delete(peerId);
                entry.links.forEach((id) => closeLink(id, true));
              }
            });
          }, probeMs);
        });
      },
      connect(peerId) {
        return new Promise((resolve, reject) => {
          linkCounter += 1;
          const id = `${instance}-${linkCounter}`;
          const timer = setTimeout(() => {
            pendingConnects.delete(id);
            reject({ code: 'peer-unavailable' });
          }, connectMs);
          pendingConnects.set(id, (remote) => {
            clearTimeout(timer);
            pendingConnects.delete(id);
            resolve(createLink(id, remote).api);
          });
          post({ kind: 'connect', peerId, link: id });
        });
      },
      close() {
        closeAll();
        channel.close();
      }
    };
  }

  // ---------------------------------------------------------------------------
  // PeerJS : adaptateur sur la bibliothèque (classe Peer)
  // ---------------------------------------------------------------------------
  function createPeerJsTransport(PeerClass, peerOptions) {
    // Les données reçues avant l'enregistrement du gestionnaire sont conservées puis rejouées
    function wrapConnection(conn, afterClose) {
      const messageCbs = [];
      const buffer = [];
      conn.on('data', (data) => {
        if (messageCbs.length === 0) buffer.push(data);
        else messageCbs.forEach((cb) => cb(data));
      });
      return {
        send(message) { conn.send(message); },
        onMessage(cb) {
          messageCbs.push(cb);
          buffer.splice(0).forEach((data) => cb(data));
        },
        onClose(cb) { conn.on('close', cb); },
        close() {
          conn.close();
          if (afterClose) afterClose();
        }
      };
    }

    return {
      host(peerId) {
        return new Promise((resolve, reject) => {
          const peer = new PeerClass(peerId, peerOptions);
          const connectionCbs = [];
          const disconnectedCbs = [];
          let opened = false;
          peer.on('open', () => {
            opened = true;
            resolve({
              onConnection(cb) { connectionCbs.push(cb); },
              onDisconnected(cb) { disconnectedCbs.push(cb); },
              close() { peer.destroy(); }
            });
          });
          peer.on('connection', (conn) => {
            conn.on('open', () => {
              const wrapped = wrapConnection(conn);
              connectionCbs.forEach((cb) => cb(wrapped));
            });
          });
          peer.on('disconnected', () => disconnectedCbs.forEach((cb) => cb()));
          peer.on('error', (err) => {
            if (opened) return;
            peer.destroy();
            reject(err && err.type === 'unavailable-id' ? { code: 'unavailable-id' } : err);
          });
        });
      },
      connect(peerId) {
        return new Promise((resolve, reject) => {
          const peer = new PeerClass(undefined, peerOptions);
          let settled = false;
          const fail = (err) => {
            if (settled) return;
            settled = true;
            peer.destroy();
            reject(err);
          };
          peer.on('error', fail);
          peer.on('open', () => {
            const conn = peer.connect(peerId, { reliable: true });
            conn.on('open', () => {
              if (settled) return;
              settled = true;
              resolve(wrapConnection(conn, () => peer.destroy()));
            });
            conn.on('error', fail);
          });
        });
      }
    };
  }

  return { createBroadcastChannelTransport, createPeerJsTransport };
});
```

- [ ] **Step 5: Lancer les tests**

Run: `npm test`
Expected: PASS (56 + 13 nouveaux = 69), et le processus Node se termine sans rester suspendu (les canaux sont fermés par `close()`). Si le processus reste suspendu, vérifier que chaque test BroadcastChannel appelle `close()` dans son `finally`.

- [ ] **Step 6: Commit**

```bash
git add session-transports.js test/session-transports.test.js vendor/peerjs.min.js vendor/LICENSE-peerjs.txt package.json package-lock.json
git commit -m "feat: transports BroadcastChannel et PeerJS (PeerJS 1.5.4 copié dans vendor/)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Accueil, rôles MJ et joueur, pastille de session

**Files:**
- Create: `landing.js`
- Modify: `index.html`, `styles.css`, `app.js`, `README.md`, `Docs/superpowers/specs/2026-10-16-session-synchronisee-design.md` (table « Fichiers »)

**Interfaces:**
- Consumes: `ChultSession.SessionHost`, `ChultSession.SessionClient` (Task 2), `ChultTransports.createBroadcastChannelTransport`, `ChultTransports.createPeerJsTransport` (Task 3), `SessionProtocol.isValidCode`, `SessionProtocol.parseSnapshot` (Task 1), `HexGeometry.isInMap`, `FOG_HEX_KEYS`, la classe globale `ChultMapApp`, global `Peer` (PeerJS).
- Produces (sur `ChultMapApp`) : constructeur `new ChultMapApp({ role })` (`'mj'` par défaut, ou `'player'`), `this.role`, `this.session`, `getSnapshot() -> { revealedHexes: string[], partyHex: "q,r" }`, `applySnapshot(snapshot, isFirst)`, `applyRole()`. `app.js` ne crée plus `window.chultApp` : c'est `landing.js` qui le fait.

- [ ] **Step 1: `index.html` : accueil, pastille, scripts**

1. Après la ligne `<body class="mode-mj">` et avant `<!-- Application Container -->`, ajouter :

```html
  <!-- Écran d'accueil : créer une session MJ ou rejoindre en tant que joueur -->
  <section id="landing" class="landing" aria-label="Choix de la session">
    <div class="landing-card">
      <h1 class="landing-title">Chult Explo</h1>
      <p class="landing-subtitle">Carte interactive de Tomb of Annihilation</p>
      <div id="landing-choices" class="landing-choices">
        <button id="btn-create-session" type="button" class="landing-btn">⚔️ Créer une session MJ</button>
        <button id="btn-join-session" type="button" class="landing-btn landing-btn-secondary">👁️ Rejoindre en tant que joueur</button>
      </div>
      <form id="join-form" class="join-form" hidden>
        <label for="join-code" class="join-label">Code de la session</label>
        <input id="join-code" class="join-input" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="0000" />
        <p id="join-error" class="join-error" role="alert"></p>
        <div class="join-actions">
          <button id="btn-join-back" type="button" class="landing-btn landing-btn-secondary">Retour</button>
          <button id="btn-join-confirm" type="submit" class="landing-btn">Rejoindre</button>
        </div>
      </form>
    </div>
  </section>

```

2. Remplacer `<div id="app">` par `<div id="app" hidden>`.

3. Juste après la balise `<nav id="floating-pill" ...>` ... `</nav>` (après son `</nav>` de fermeture), ajouter la pastille :

```html
      <!-- Pastille de session : code et joueurs (MJ), état de la connexion (joueur) -->
      <div id="session-indicator" class="session-indicator" hidden>
        <span id="session-dot" class="session-dot"></span>
        <span id="session-text" class="session-text"></span>
        <button id="session-copy" type="button" class="session-btn" title="Copier le code" hidden>📋</button>
        <button id="session-retry" type="button" class="session-btn" hidden>Réessayer</button>
      </div>
```

4. Donner des identifiants aux deux sections masquées côté joueur. Remplacer :

```html
        <section class="tool-section">
          <h2 class="section-title">Mode d'Affichage</h2>
```

par :

```html
        <section id="mode-switch-section" class="tool-section">
          <h2 class="section-title">Mode d'Affichage</h2>
```

et remplacer :

```html
        <section class="tool-section">
          <h2 class="section-title">Gestion de la Carte</h2>
```

par :

```html
        <section id="map-management-section" class="tool-section">
          <h2 class="section-title">Gestion de la Carte</h2>
```

5. Remplacer le bloc final de scripts :

```html
  <script src="labels-data.js"></script>
  <script src="app.js"></script>
```

par :

```html
  <script src="labels-data.js"></script>
  <script src="vendor/peerjs.min.js"></script>
  <script src="session-protocol.js"></script>
  <script src="session.js"></script>
  <script src="session-transports.js"></script>
  <script src="app.js"></script>
  <script src="landing.js"></script>
```

- [ ] **Step 2: `styles.css` : accueil, pastille, masquage côté joueur**

À la fin de `styles.css`, ajouter :

```css

/* ==========================================================================
   Session synchronisée : accueil, pastille, rôle joueur
   ========================================================================== */

[hidden] {
  display: none !important;
}

.landing {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--bg-dark);
}

.landing-card {
  width: min(420px, 100%);
  padding: 32px 28px;
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-lg);
  background: var(--bg-panel);
  box-shadow: var(--shadow-lg), var(--shadow-gold);
  text-align: center;
}

.landing-title {
  font-family: var(--font-serif);
  font-size: 2rem;
  color: var(--accent-gold);
}

.landing-subtitle {
  margin: 6px 0 24px;
  font-family: var(--font-body);
  color: var(--text-secondary);
}

.landing-choices,
.join-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.landing-btn {
  padding: 12px 16px;
  border: 1px solid var(--border-gold);
  border-radius: var(--radius-md);
  background: var(--accent-gold);
  color: #1b1405;
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.landing-btn:hover {
  background: var(--accent-gold-hover);
}

.landing-btn-secondary {
  background: transparent;
  color: var(--text-primary);
}

.landing-btn-secondary:hover {
  background: var(--bg-card);
}

.landing-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.join-label {
  font-family: var(--font-body);
  color: var(--text-secondary);
}

.join-input {
  padding: 12px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-md);
  background: var(--bg-card);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: 2rem;
  letter-spacing: 0.5em;
  text-align: center;
}

.join-error {
  min-height: 1.2em;
  color: var(--accent-red-hover);
  font-family: var(--font-body);
}

.join-actions {
  display: flex;
  gap: 12px;
}

.join-actions .landing-btn {
  flex: 1;
}

.session-indicator {
  position: absolute;
  top: 12px;
  left: 50%;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-full);
  background: var(--bg-panel);
  color: var(--text-primary);
  font-family: var(--font-body);
  transform: translateX(-50%);
}

.session-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-muted);
}

.session-indicator[data-state="online"] .session-dot {
  background: var(--accent-green);
}

.session-indicator[data-state="pending"] .session-dot {
  background: var(--accent-gold);
}

.session-indicator[data-state="offline"] .session-dot {
  background: var(--accent-red);
}

.session-btn {
  padding: 2px 8px;
  border: 1px solid var(--border-muted);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
}

.session-btn:hover {
  background: var(--bg-card);
}

/* Page joueur : lecture seule, aucune commande MJ */
.role-player #mode-switch-section,
.role-player #pill-mode-btn,
.role-player #map-management-section {
  display: none !important;
}
```

- [ ] **Step 3: `app.js` : rôles, instantané, démarrage**

1. Constructeur : remplacer

```js
  constructor() {
    this.mode = 'mj'; // 'mj' | 'player'
```

par

```js
  constructor({ role = 'mj' } = {}) {
    this.role = role; // 'mj' | 'player' : la page joueur est en lecture seule, alimentée par la session
    this.session = null; // SessionHost (MJ) ou SessionClient (joueur), posé par landing.js
    this.mode = role === 'player' ? 'player' : 'mj'; // 'mj' | 'player'
```

2. Dans le constructeur, remplacer

```js
    this.initDOM();
    this.initHexGrid();
```

par

```js
    this.initDOM();
    this.applyRole();
    this.initHexGrid();
```

3. `loadState()` : remplacer `const saved = localStorage.getItem(STORAGE_KEY);` par

```js
      const saved = this.role === 'player' ? null : localStorage.getItem(STORAGE_KEY);
```

4. `saveState()` : insérer en première instruction de la méthode, juste après `saveState() {`, la ligne

```js
    if (this.role === 'player') return; // la page joueur n'écrit aucune sauvegarde
```

et remplacer la fin de la méthode

```js
    } catch (err) {
      console.warn('Erreur de sauvegarde localStorage:', err);
    }
  }
```

par

```js
    } catch (err) {
      console.warn('Erreur de sauvegarde localStorage:', err);
    }
    if (this.session) this.session.broadcast(); // MJ : tout changement d'état part aux joueurs
  }
```

5. Juste avant la méthode `syncMaskHoles() {`, ajouter :

```js
  // État partagé avec les joueurs : cases révélées et position du groupe
  getSnapshot() {
    return {
      revealedHexes: Array.from(this.revealedHexSet),
      partyHex: `${this.partyHex.q},${this.partyHex.r}`
    };
  }

  // Page joueur : remplace l'état par l'instantané reçu du MJ (aucune sauvegarde locale)
  applySnapshot(snapshot, isFirst) {
    this.revealedHexSet = new Set(snapshot.revealedHexes);
    this.partyHex = snapshot.partyHex ? this.parsePartyHex(snapshot.partyHex) : this.getPartyStartHex();
    this.renderParty();
    this.syncMaskHoles();
    this.syncPois(isFirst); // le premier instantané est silencieux, les suivants notifient les lieux découverts
  }

```

6. Juste avant `setMode(newMode) {`, ajouter :

```js
  // Classes du <body> : mode d'affichage (MJ / joueur) et rôle de la page (joueur = lecture seule)
  applyRole() {
    document.body.classList.toggle('role-player', this.role === 'player');
    document.body.classList.toggle('mode-player', this.mode === 'player');
    document.body.classList.toggle('mode-mj', this.mode === 'mj');
  }

```

et dans `setMode`, remplacer

```js
  setMode(newMode) {
    this.mode = newMode;
    this.renderHover(null, false);
    document.body.className = `mode-${newMode}`;
```

par

```js
  setMode(newMode) {
    if (this.role === 'player') return; // la page joueur reste en mode projection
    this.mode = newMode;
    this.renderHover(null, false);
    this.applyRole();
```

7. Ajouter `if (this.role === 'player') return;` comme **première instruction** de chacune de ces méthodes : `exportSaveFile`, `handleFileImport`, `resetMap`, `revealAllHexes`, `hideAllHexes`.

8. Supprimer le bloc de démarrage automatique en fin de fichier :

```js
// Démarrage automatique dès que le DOM est prêt
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.chultApp = new ChultMapApp();
  });
} else {
  window.chultApp = new ChultMapApp();
}
```

et le remplacer par le commentaire :

```js
// Démarrage : voir landing.js (écran d'accueil, création de l'application selon le rôle)
```

- [ ] **Step 4: Écrire `landing.js`**

```js
/**
 * Écran d'accueil et démarrage de l'application selon le rôle :
 * - « Créer une session MJ » : application MJ + session hôte (code à 4 chiffres) ;
 * - « Rejoindre en tant que joueur » : connexion avec le code, puis application en lecture seule.
 * Transport : PeerJS par défaut, BroadcastChannel (entre onglets) avec ?transport=local.
 */
(function () {
  const CODE_KEY = 'chult_explo_session_code';
  const { SessionHost, SessionClient } = ChultSession;
  const { createBroadcastChannelTransport, createPeerJsTransport } = ChultTransports;

  const $ = (id) => document.getElementById(id);
  const landing = $('landing');
  const appEl = $('app');
  const choices = $('landing-choices');
  const joinForm = $('join-form');
  const joinInput = $('join-code');
  const joinError = $('join-error');
  const joinConfirm = $('btn-join-confirm');
  const indicator = $('session-indicator');
  const text = $('session-text');
  const copyBtn = $('session-copy');
  const retryBtn = $('session-retry');

  function createTransport() {
    if (new URLSearchParams(location.search).get('transport') === 'local') {
      return createBroadcastChannelTransport();
    }
    if (typeof Peer === 'function') return createPeerJsTransport(Peer);
    const unavailable = () => Promise.reject(new Error('PeerJS indisponible.'));
    return { host: unavailable, connect: unavailable };
  }

  function readStoredCode() {
    try { return localStorage.getItem(CODE_KEY); } catch (err) { return null; }
  }

  function storeCode(code) {
    try { localStorage.setItem(CODE_KEY, code); } catch (err) { /* stockage indisponible */ }
  }

  function setIndicator(state, label, { copy = false, retry = false } = {}) {
    indicator.hidden = false;
    indicator.dataset.state = state; // 'online' | 'pending' | 'offline'
    text.textContent = label;
    copyBtn.hidden = !copy;
    retryBtn.hidden = !retry;
  }

  function showApp() {
    landing.hidden = true;
    appEl.hidden = false;
  }

  // ----- Rôle MJ -----
  function startAsMj() {
    showApp();
    const mjApp = new ChultMapApp({ role: 'mj' });
    window.chultApp = mjApp;

    let players = 0;
    const host = new SessionHost(createTransport(), {
      getSnapshot: () => mjApp.getSnapshot(),
      onPlayers: (n) => { players = n; render(); },
      onStatus: () => render()
    });
    mjApp.session = host;

    function render() {
      if (host.status === 'online' && host.code) {
        setIndicator('online', `Session ${host.code} · ${players} joueur${players > 1 ? 's' : ''}`, { copy: true });
      } else if (host.status === 'connecting') {
        setIndicator('pending', 'Création de la session…');
      } else {
        setIndicator('offline', 'Hors ligne : les joueurs ne peuvent pas rejoindre', { retry: true });
      }
    }

    function startHost() {
      host.start({ preferredCode: host.code || readStoredCode() })
        .then((code) => storeCode(code))
        .catch((err) => console.warn('Session indisponible :', err));
    }

    copyBtn.onclick = () => {
      if (host.code && navigator.clipboard) navigator.clipboard.writeText(host.code).catch(() => {});
    };
    retryBtn.onclick = () => startHost();
    startHost();
  }

  // ----- Rôle joueur -----
  function renderPlayerIndicator(status) {
    if (status === 'connected') setIndicator('online', 'Connecté');
    else if (status === 'lost') setIndicator('pending', 'Connexion perdue… nouvelle tentative');
    else if (status === 'ended') setIndicator('offline', 'Session terminée');
    else setIndicator('pending', 'Connexion…');
  }

  function onJoin(event) {
    event.preventDefault();
    const code = joinInput.value.trim();
    if (!SessionProtocol.isValidCode(code)) {
      joinError.textContent = 'Le code comporte 4 chiffres.';
      return;
    }
    joinError.textContent = '';
    joinConfirm.disabled = true;

    const fogKeys = new Set(FOG_HEX_KEYS);
    let playerApp = null;
    const client = new SessionClient(createTransport(), {
      parse: (message) => SessionProtocol.parseSnapshot(message, { fogKeys, isInMap: HexGeometry.isInMap }),
      onSnapshot: (snapshot, isFirst) => {
        if (!playerApp) {
          showApp();
          playerApp = new ChultMapApp({ role: 'player' });
          playerApp.session = client;
          window.chultApp = playerApp;
        }
        playerApp.applySnapshot(snapshot, isFirst);
        renderPlayerIndicator(client.status);
      },
      onStatus: (status) => { if (playerApp) renderPlayerIndicator(status); }
    });

    client.join(code).catch(() => {
      joinConfirm.disabled = false;
      joinError.textContent = 'Aucune session avec ce code.';
    });
  }

  $('btn-create-session').addEventListener('click', startAsMj);
  $('btn-join-session').addEventListener('click', () => {
    choices.hidden = true;
    joinForm.hidden = false;
    joinInput.focus();
  });
  $('btn-join-back').addEventListener('click', () => {
    joinForm.hidden = true;
    choices.hidden = false;
    joinError.textContent = '';
  });
  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.replace(/[^0-9]/g, '').slice(0, 4);
  });
  joinForm.addEventListener('submit', onJoin);
})();
```

- [ ] **Step 5: Documentation**

Remplacer le contenu de `README.md` (une seule ligne actuellement : `Fait avec IA et amour.`) par :

````markdown
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
````

Dans la table « Fichiers » de la spec `Docs/superpowers/specs/2026-10-16-session-synchronisee-design.md`, ajouter deux lignes :

```
| `session-transports.js`, `test/session-transports.test.js` | créer (transports PeerJS et BroadcastChannel) |
| `landing.js` | créer (accueil, création MJ / joueur, pastille de session) |
```

- [ ] **Step 6: Vérifier dans le navigateur**

Run : `npm test` (69 tests passent), puis `node --check` sur chacun des fichiers `app.js`, `landing.js`, `session.js`, `session-transports.js` et `session-protocol.js` (un appel par fichier : `node --check` n'en accepte qu'un).

Servir le dépôt (`npx --yes http-server . -p 8080 -c-1 --silent` en arrière-plan). Ouvrir **deux onglets** du navigateur intégré (outils `mcp__Claude_Browser__*`, à charger via ToolSearch ; `tabs_create` pour le second) sur `http://localhost:8080/index.html?transport=local`. Mettre les viewports à une taille non nulle (`resize_window`). Dans le premier onglet (A), exécuter `localStorage.clear()` puis recharger.

1. **Accueil** (onglet A) : `document.getElementById('landing').hidden === false`, `document.getElementById('app').hidden === true`, `window.chultApp === undefined`, et `typeof Peer === 'function'` (la bibliothèque PeerJS est chargée).
2. **MJ** (onglet A) : cliquer `#btn-create-session`, attendre ~500 ms. Attendu : `landing.hidden === true`, `app.hidden === false`, `chultApp.role === 'mj'`, `#session-text` contient `Session NNNN · 0 joueur` avec 4 chiffres, `#session-copy` visible, `localStorage.getItem('chult_explo_session_code')` égal au code.
3. **Joueur refusé** (onglet B, nouveau) : cliquer `#btn-join-session`, saisir `0000` (ou un code différent de celui du MJ) puis soumettre : après le délai, `#join-error` vaut `Aucune session avec ce code.` et `#landing` est toujours visible. Saisir `12` puis soumettre : `Le code comporte 4 chiffres.`
4. **Joueur accepté** (onglet B) : saisir le code du MJ, soumettre. Attendu en quelques centaines de ms : `chultApp.role === 'player'`, `document.body.classList.contains('role-player')`, `document.body.classList.contains('mode-player')`, `#session-text` vaut `Connecté`, et dans l'onglet A `#session-text` indique `1 joueur`.
5. **Synchronisation** : dans A, `chultApp.revealHex(44, 34)` ; attendre 300 ms ; dans B, `chultApp.revealedHexSet.has('44,34') === true`. Dans A, `chultApp.moveParty(44, 36)` ; dans B après 300 ms, `chultApp.partyHex` vaut `{q: 44, r: 36}` et la case 44,36 est révélée. Dans A, révéler un lieu encore caché (par exemple la case centrale d'un lieu dans `chultApp.pois`) : dans B, `chultApp.pois[id].revealed === true`.
6. **Lecture seule** (onglet B) : les contrôles du MJ ne sont pas affichés (`getComputedStyle(document.getElementById('mode-switch-section')).display === 'none'`, idem pour `map-management-section` et `pill-mode-btn`) ; `chultApp.setMode('mj')` ne change rien (`chultApp.mode === 'player'`) ; `chultApp.resetMap()` ne change pas `chultApp.revealedHexSet.size` ; la touche `m` ne bascule pas. Écriture : dans B, `localStorage.setItem('chult_explo_save_v1', '{"sentinel":1}'); chultApp.saveState();` puis `localStorage.getItem('chult_explo_save_v1')` vaut toujours `{"sentinel":1}`.
7. **Pas de sauvegarde locale côté joueur** : dans A, avant de rejoindre avec un troisième onglet C, écrire `localStorage.setItem('chult_explo_save_v1', JSON.stringify({ revealedHexes: ['38,40'], partyHex: '44,30' }))` ; C rejoint : `chultApp.revealedHexSet.has('38,40') === false` (l'état vient du MJ, pas du stockage local) ; dans A, `#session-text` indique `2 joueurs`.
8. **Reprise du code** : recharger A, cliquer `#btn-create-session` : le code affiché est le même qu'avant. Dans B, `#session-text` passe par `Connexion perdue…` puis revient à `Connecté` en quelques secondes (tentatives toutes les 3 s), sans action de l'utilisateur.
9. **Hors ligne** : dans un onglet neuf **sans** `?transport=local`, si le service PeerJS est injoignable depuis ce poste, créer la session MJ : `#session-text` finit par indiquer `Hors ligne : les joueurs ne peuvent pas rejoindre`, `#session-retry` est visible et l'application MJ reste utilisable (révéler une case fonctionne). Si le service est joignable, noter le code affiché et que la liaison réelle n'a pas été testée entre deux machines. Dans les deux cas, le dire dans le rapport.

Arrêter le serveur ensuite (tuer le processus qui écoute le port 8080) et remettre les viewports par défaut. Si une vérification est impossible (par exemple un second onglet indisponible), le dire explicitement au lieu d'inventer un résultat.

- [ ] **Step 7: Commit**

```bash
git add landing.js index.html styles.css app.js README.md Docs/superpowers/specs/2026-10-16-session-synchronisee-design.md
git commit -m "feat: accueil MJ / joueur et session synchronisée en direct

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

Document rédigé avec l'aide d'une intelligence artificielle (assistant Claude). À relire et valider avant diffusion.
