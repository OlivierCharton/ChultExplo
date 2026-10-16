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
