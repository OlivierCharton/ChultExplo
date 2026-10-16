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
