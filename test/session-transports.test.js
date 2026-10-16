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

test('PeerJS : une erreur de connexion est relayée comme une fermeture, une seule fois', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  const handle = await p;
  const conns = [];
  handle.onConnection((c) => conns.push(c));
  const raw = new FakeConn();
  peer.emit('connection', raw);
  raw.emit('open');
  let closed = 0;
  conns[0].onClose(() => { closed++; });
  raw.emit('error', new Error('x'));
  raw.emit('close');
  assert.equal(closed, 1);
  assert.equal(raw.closed, true);
});
