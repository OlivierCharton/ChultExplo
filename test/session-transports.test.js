const test = require('node:test');
const assert = require('node:assert/strict');
const { createBroadcastChannelTransport, createPeerJsTransport } = require('../session-transports.js');

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ----- BroadcastChannel -----

function makeBc() {
  const opts = { probeMs: 50, connectMs: 150, channelName: `test-${Math.random().toString(36).slice(2)}` };
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
    await wait(150);
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
    await wait(150);
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
    await wait(150);
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
    await wait(100); // le message arrive avant l'enregistrement du gestionnaire
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

test('BroadcastChannel : après close(), connect rejette sans lever et host rejette', async () => {
  const { a, close } = makeBc();
  try {
    a.close();
    await assert.rejects(a.connect('chult-explo-1234'), { code: 'peer-unavailable' });
    await assert.rejects(a.host('chult-explo-1234'), { code: 'closed' });
  } finally { close(); }
});

test('BroadcastChannel : un rappel onClose qui lève n\'empêche pas les suivants', async () => {
  const { a, b, close } = makeBc();
  try {
    const handle = await a.host('chult-explo-7777');
    handle.onConnection((conn) => conn.onMessage(() => {}));
    const conn = await b.connect('chult-explo-7777');
    let second = false;
    conn.onClose(() => { throw new Error('boum'); });
    conn.onClose(() => { second = true; });
    assert.throws(() => conn.close(), /boum/);
    assert.equal(second, true);
  } finally { close(); }
});

test('PeerJS : un close distant de la connexion client détruit le pair, onClose appelé une fois', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.conn.emit('open');
  const conn = await p;
  let closed = 0;
  conn.onClose(() => { closed++; });
  peer.conn.emit('close');
  assert.equal(peer.destroyed, true);
  assert.equal(closed, 1);
});

test('PeerJS : error puis close détruisent le pair une seule fois', async () => {
  let destroys = 0;
  class CountingPeer extends FakePeer { destroy() { destroys++; super.destroy(); } }
  const transport = createPeerJsTransport(CountingPeer);
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.conn.emit('open');
  const conn = await p;
  let closed = 0;
  conn.onClose(() => { closed++; });
  peer.conn.emit('error', new Error('x'));
  peer.conn.emit('close');
  conn.close();
  assert.equal(destroys, 1);
  assert.equal(closed, 1);
});

test('PeerJS : un rappel onClose qui lève n\'empêche pas la destruction du pair', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.conn.emit('open');
  const conn = await p;
  conn.onClose(() => { throw new Error('boum'); });
  assert.throws(() => peer.conn.emit('close'), /boum/);
  assert.equal(peer.destroyed, true);
});

test('PeerJS : après handle.close(), disconnected n\'est plus relayé', async () => {
  const transport = createPeerJsTransport(FakePeer);
  const p = transport.host('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  const handle = await p;
  let called = 0;
  handle.onDisconnected(() => { called++; });
  handle.close();
  peer.emit('disconnected');
  assert.equal(called, 0);
});

test('PeerJS : connect rejette avec timeout si la connexion n\'ouvre jamais', async () => {
  const transport = createPeerJsTransport(FakePeer, undefined, { connectTimeoutMs: 30 });
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  await assert.rejects(p, { type: 'timeout' });
  assert.equal(peer.destroyed, true);
});

test('PeerJS : connect rejette avec closed si la connexion se ferme avant l\'ouverture', async () => {
  const transport = createPeerJsTransport(FakePeer, undefined, { connectTimeoutMs: 1000 });
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.conn.emit('close');
  await assert.rejects(p, { type: 'closed' });
  assert.equal(peer.destroyed, true);
});

test('PeerJS : une connexion ouverte à temps ne déclenche pas le délai', async () => {
  const transport = createPeerJsTransport(FakePeer, undefined, { connectTimeoutMs: 30 });
  const p = transport.connect('chult-explo-1234');
  const peer = FakePeer.last;
  peer.emit('open');
  peer.conn.emit('open');
  const conn = await p;
  await wait(80);
  assert.equal(peer.destroyed, false);
  assert.ok(conn);
});
