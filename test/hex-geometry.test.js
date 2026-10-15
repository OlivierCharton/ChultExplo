const test = require('node:test');
const assert = require('node:assert/strict');
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes } = require('../hex-geometry.js');

const near = (a, b, eps = 0.1) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('getCenter reproduit les centres calibrés connus', () => {
  const c = getCenter(20, 49);
  near(c.cx, 1726.9);
  near(c.cy, 4742.7);
  near(getCenter(20, 51).cy, 4935.6);
});

test('getCenter décale les colonnes impaires de dy/2', () => {
  const even = getCenter(20, 49);
  const odd = getCenter(21, 49);
  near(odd.cy - even.cy, GRID.dy / 2);
  near(odd.cx - even.cx, GRID.dx);
});

test('getPoints renvoie 6 sommets flat-topped', () => {
  const pts = getPoints(100, 100, 10);
  assert.equal(pts.length, 6);
  near(pts[2].x, 110); // pointe droite
  near(pts[5].x, 90);  // pointe gauche
  near(pts[0].y, 100 - (Math.sqrt(3) * 10) / 2);
});

test('containsPoint accepte l\'intérieur et refuse l\'extérieur', () => {
  const R = 10;
  const h = Math.sqrt(3) * R;
  assert.equal(containsPoint(100, 100, 100, 100, R), true);
  assert.equal(containsPoint(100, 100, 100 + R - 1, 100, R), true);
  assert.equal(containsPoint(100, 100, 100 + R + 1, 100, R), false);
  assert.equal(containsPoint(100, 100, 100, 100 + h / 2 - 1, R), true);
  assert.equal(containsPoint(100, 100, 100, 100 + h / 2 + 1, R), false);
  // coin : dans le rectangle englobant mais hors de l'hexagone
  assert.equal(containsPoint(100, 100, 100 + R - 1, 100 + h / 2 - 1, R), false);
});

test('enumerateHexes couvre toute l\'image sans doublon', () => {
  const hexes = enumerateHexes();
  assert.ok(hexes.length > 7000 && hexes.length < 7600, `count=${hexes.length}`);
  const keys = new Set(hexes.map(h => `${h.q},${h.r}`));
  assert.equal(keys.size, hexes.length);
  assert.ok(keys.has('20,49'));
  for (const h of hexes) {
    assert.ok(h.cx >= 0 && h.cx <= GRID.width, `cx ${h.cx}`);
    assert.ok(h.cy >= 0 && h.cy <= GRID.height, `cy ${h.cy}`);
  }
});
