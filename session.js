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
      this.stopped = false;
      this.startPromise = null;
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

    // Un seul démarrage à la fois : un appel concurrent reçoit la même promesse
    start(options) {
      if (this.startPromise) return this.startPromise;
      this.startPromise = this.doStart(options || {}).finally(() => { this.startPromise = null; });
      return this.startPromise;
    }

    clearPlayers() {
      if (this.players.size === 0) return;
      this.players.clear();
      this.onPlayers(0);
    }

    async doStart({ preferredCode } = {}) {
      this.stopped = false;
      this.closeHandle();
      this.clearPlayers();
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
      const handle = result.handle;
      this.handle = handle;
      this.code = result.code;
      handle.onConnection((conn) => this.addPlayer(conn));
      handle.onDisconnected(() => { if (this.handle === handle) this.setStatus('offline'); });
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
      if (this.stopped) {
        conn.close();
        return;
      }
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
      if (this.stopped || this.pending !== null) return;
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
      this.stopped = true;
      this.players.forEach((conn) => conn.send({ type: 'bye' }));
      this.clearPlayers();
      this.setStatus('offline');
      // Le handle est capturé : un start() ultérieur ne doit pas voir son nouveau handle fermé
      const handle = this.handle;
      this.handle = null;
      this.scheduler.setTimeout(() => { if (handle) handle.close(); }, 200);
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
      this.generation = 0;
    }

    setStatus(status) {
      if (this.status === status) return;
      this.status = status;
      this.onStatus(status);
    }

    join(code) {
      this.leave();
      this.generation++;
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
      const gen = this.generation;
      this.transport.connect(protocol.peerIdFor(this.code)).then((conn) => {
        if (gen !== this.generation || this.stopped) {
          conn.close();
          return;
        }
        this.conn = conn;
        conn.onMessage((message) => this.handleMessage(conn, message));
        conn.onClose(() => this.handleClose(conn));
      }, () => {
        if (gen !== this.generation || this.stopped) return;
        if (!this.joined) {
          this.failJoin();
          return;
        }
        this.scheduleRetry();
      });
    }

    handleMessage(conn, message) {
      if (conn !== this.conn) return;
      if (this.stopped) return;
      if (message && message.type === 'bye') {
        this.stopped = true;
        this.clearTimers();
        this.setStatus('ended');
        const pending = this.pendingJoin;
        this.pendingJoin = null;
        conn.close();
        this.conn = null;
        if (pending) pending.reject(new Error('Session terminée.'));
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
      this.generation++;
      this.clearTimers();
      const pending = this.pendingJoin;
      this.pendingJoin = null;
      if (pending) pending.reject(new Error('Connexion annulée.'));
      if (this.conn) {
        const conn = this.conn;
        this.conn = null;
        conn.close();
      }
    }
  }

  return { SessionHost, SessionClient, createLoopbackTransport };
});
