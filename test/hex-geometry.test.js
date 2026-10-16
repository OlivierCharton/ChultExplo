const test = require('node:test');
const assert = require('node:assert/strict');
const { GRID, getCenter, getPoints, containsPoint, enumerateHexes, hexAt } = require('../hex-geometry.js');

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

test('hexAt renvoie la case dont le centre est touché', () => {
  for (const [q, r] of [[0, 0], [1, 0], [20, 49], [21, 49], [54, 50], [77, 92]]) {
    const { cx, cy } = getCenter(q, r);
    assert.deepEqual(hexAt(cx, cy), { q, r });
  }
});

test('hexAt est cohérent avec containsPoint près des bords et des coins', () => {
  const { cx, cy } = getCenter(21, 49);
  const R = GRID.R, h = Math.sqrt(3) * R;
  const inside = [[0.9 * R, 0], [-0.9 * R, 0], [0, 0.45 * h], [0, -0.45 * h], [0.4 * R, 0.4 * h], [-0.4 * R, -0.4 * h]];
  for (const [dx, dy] of inside) {
    assert.equal(containsPoint(cx, cy, cx + dx, cy + dy), true);
    assert.deepEqual(hexAt(cx + dx, cy + dy), { q: 21, r: 49 }, `dx=${dx} dy=${dy}`);
  }
});

test('hexAt change de case de part et d\'autre d\'une arête', () => {
  const a = getCenter(20, 49), b = getCenter(20, 50);
  const midY = (a.cy + b.cy) / 2;
  assert.deepEqual(hexAt(a.cx, midY - 1), { q: 20, r: 49 });
  assert.deepEqual(hexAt(a.cx, midY + 1), { q: 20, r: 50 });
});

test('hexAt place chaque point d\'une grille d\'essai dans l\'hexagone de la case renvoyée', () => {
  for (let x = 100; x < GRID.width - 100; x += 397) {
    for (let y = 100; y < GRID.height - 100; y += 389) {
      const { q, r } = hexAt(x, y);
      const { cx, cy } = getCenter(q, r);
      assert.equal(containsPoint(cx, cy, x, y), true, `(${x},${y}) -> ${q},${r}`);
    }
  }
});
