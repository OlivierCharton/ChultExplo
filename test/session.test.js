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
