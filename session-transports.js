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
  // Exécute tous les rappels même si l'un d'eux lève ; la première erreur est relancée à la fin
  function runAll(cbs) {
    let error = null;
    let failed = false;
    cbs.slice().forEach((cb) => {
      try { cb(); } catch (err) { if (!failed) { failed = true; error = err; } }
    });
    if (failed) throw error;
  }

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
    const cancelers = new Set();       // annulations des sondes et connexions en attente
    let linkCounter = 0;
    let closedTransport = false;

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
      try {
        if (notify && !closedTransport) post({ kind: 'close', link: id, to: link.remote });
      } finally {
        runAll(link.closeCbs);
      }
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
    const hasListener = typeof root.addEventListener === 'function';
    if (hasListener) root.addEventListener('pagehide', closeAll);

    return {
      host(peerId) {
        return new Promise((resolve, reject) => {
          if (closedTransport) {
            reject({ code: 'closed' });
            return;
          }
          if (hostEntries.has(peerId)) {
            reject({ code: 'unavailable-id' });
            return;
          }
          let taken = false;
          pendingProbes.set(peerId, () => { taken = true; });
          post({ kind: 'probe', peerId });
          const cancel = () => {
            clearTimeout(timer);
            pendingProbes.delete(peerId);
            cancelers.delete(cancel);
            reject({ code: 'closed' });
          };
          cancelers.add(cancel);
          const timer = setTimeout(() => {
            cancelers.delete(cancel);
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
          if (closedTransport) {
            reject({ code: 'peer-unavailable' });
            return;
          }
          linkCounter += 1;
          const id = `${instance}-${linkCounter}`;
          const cancel = () => {
            clearTimeout(timer);
            pendingConnects.delete(id);
            cancelers.delete(cancel);
            reject({ code: 'peer-unavailable' });
          };
          cancelers.add(cancel);
          const timer = setTimeout(() => {
            cancelers.delete(cancel);
            pendingConnects.delete(id);
            reject({ code: 'peer-unavailable' });
          }, connectMs);
          pendingConnects.set(id, (remote) => {
            clearTimeout(timer);
            cancelers.delete(cancel);
            pendingConnects.delete(id);
            resolve(createLink(id, remote).api);
          });
          post({ kind: 'connect', peerId, link: id });
        });
      },
      close() {
        if (closedTransport) return;
        // Les liens sont fermés (et l'autre côté prévenu) avant de marquer le transport fermé
        try {
          closeAll();
        } finally {
          closedTransport = true;
          [...cancelers].forEach((cancel) => cancel());
          if (hasListener && typeof root.removeEventListener === 'function') root.removeEventListener('pagehide', closeAll);
          channel.close();
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // PeerJS : adaptateur sur la bibliothèque (classe Peer)
  // ---------------------------------------------------------------------------
  function createPeerJsTransport(PeerClass, peerOptions, { connectTimeoutMs = 8000, hostTimeoutMs = 15000 } = {}) {
    // Les données reçues avant l'enregistrement du gestionnaire sont conservées puis rejouées.
    // Une erreur de connexion est traitée comme une fermeture (rappels appelés une seule fois).
    function wrapConnection(conn, afterClose) {
      const messageCbs = [];
      const closeCbs = [];
      const buffer = [];
      let closed = false;
      let cleaned = false;
      // Libère le pair au plus une fois (fermeture explicite, erreur ou fermeture distante)
      function runAfterClose() {
        if (cleaned) return;
        cleaned = true;
        if (afterClose) afterClose();
      }
      function notifyClosed() {
        if (closed) return false;
        closed = true;
        try {
          runAll(closeCbs);
        } finally {
          runAfterClose();
        }
        return true;
      }
      conn.on('data', (data) => {
        if (messageCbs.length === 0) buffer.push(data);
        else messageCbs.forEach((cb) => cb(data));
      });
      conn.on('close', notifyClosed);
      conn.on('error', () => {
        let first = true;
        try {
          first = notifyClosed();
        } finally {
          if (first) conn.close();
        }
      });
      return {
        send(message) { conn.send(message); },
        onMessage(cb) {
          messageCbs.push(cb);
          buffer.splice(0).forEach((data) => cb(data));
        },
        onClose(cb) { closeCbs.push(cb); },
        close() {
          try {
            conn.close();
          } finally {
            runAfterClose();
          }
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
          let closing = false;
          let timedOut = false;
          // Courtier muet : on abandonne au lieu de rester indéfiniment en attente
          const timer = setTimeout(() => {
            if (opened) return;
            timedOut = true;
            peer.destroy();
            reject({ type: 'timeout' });
          }, hostTimeoutMs);
          peer.on('open', () => {
            if (timedOut) return;
            clearTimeout(timer);
            opened = true;
            resolve({
              onConnection(cb) { connectionCbs.push(cb); },
              onDisconnected(cb) { disconnectedCbs.push(cb); },
              close() {
                closing = true;
                peer.destroy();
              }
            });
          });
          peer.on('connection', (conn) => {
            conn.on('open', () => {
              const wrapped = wrapConnection(conn);
              connectionCbs.forEach((cb) => cb(wrapped));
            });
          });
          peer.on('disconnected', () => {
            if (!closing) disconnectedCbs.forEach((cb) => cb());
          });
          peer.on('error', (err) => {
            if (opened || timedOut) return;
            clearTimeout(timer);
            peer.destroy();
            reject(err && err.type === 'unavailable-id' ? { code: 'unavailable-id' } : err);
          });
        });
      },
      connect(peerId) {
        return new Promise((resolve, reject) => {
          const peer = new PeerClass(undefined, peerOptions);
          let settled = false;
          const timer = setTimeout(() => fail({ type: 'timeout' }), connectTimeoutMs);
          const fail = (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            peer.destroy();
            reject(err);
          };
          peer.on('error', fail);
          peer.on('open', () => {
            const conn = peer.connect(peerId, { reliable: true });
            conn.on('open', () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              resolve(wrapConnection(conn, () => peer.destroy()));
            });
            conn.on('error', fail);
            conn.on('close', () => fail({ type: 'closed' }));
          });
        });
      }
    };
  }

  return { createBroadcastChannelTransport, createPeerJsTransport };
});
