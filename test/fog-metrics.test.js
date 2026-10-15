const test = require('node:test');
const assert = require('node:assert/strict');
const { diffRatioInHex } = require('../tools/fog-metrics.js');

const W = 60, H = 60, C = 3;
const blank = () => Buffer.alloc(W * H * C, 0);

function fillRect(buf, x0, y0, x1, y1, value) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * C;
      buf[i] = buf[i + 1] = buf[i + 2] = value;
    }
  }
}

const hex = { cx: 30, cy: 30, R: 10 };
const ratio = (a, b, tol = 40) => diffRatioInHex(a, b, W, H, C, hex.cx, hex.cy, hex.R, tol);

test('images identiques : ratio 0', () => {
  assert.equal(ratio(blank(), blank()), 0);
});

test('hexagone entièrement différent : ratio 1', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 255);
  assert.equal(ratio(blank(), b), 1);
});

test('différence hors de l\'hexagone : ratio 0', () => {
  const b = blank();
  fillRect(b, 0, 0, 10, 10, 255);
  assert.equal(ratio(blank(), b), 0);
});

test('bruit sous la tolérance ignoré', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 10);
  assert.equal(ratio(blank(), b, 40), 0);
});

test('moitié gauche différente : ratio proche de 0.5', () => {
  const b = blank();
  fillRect(b, 0, 0, 30, H, 255);
  const r = ratio(blank(), b);
  assert.ok(r > 0.4 && r < 0.6, `ratio=${r}`);
});

test('hexagone coupé par le bord de l\'image ne plante pas', () => {
  const b = blank();
  fillRect(b, 0, 0, W, H, 255);
  const r = diffRatioInHex(blank(), b, W, H, C, 2, 2, 10, 40);
  assert.equal(r, 1);
});
