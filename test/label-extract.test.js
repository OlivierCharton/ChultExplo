const test = require('node:test');
const assert = require('node:assert/strict');
const {
  dilate, components, buildTextMask, buildPatch, buildTextImage, extractLabel
} = require('../tools/label-extract.js');

const W = 320, H = 240, C = 3;
const BOX = { x: 120, y: 80, w: 60, h: 70 };

// Fond de jungle à deux verts sombres en damier
function bg(x, y) { return (((x >> 3) + (y >> 3)) % 2) ? [60, 110, 60] : [70, 120, 70]; }

function makeRegion() {
  const rgb = Buffer.alloc(W * H * C);
  const set = (x, y, c) => { const o = (y * W + x) * C; rgb[o] = c[0]; rgb[o + 1] = c[1]; rgb[o + 2] = c[2]; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(x, y, bg(x, y));
  for (let y = 94; y <= 135; y++) for (let x = 134; x <= 165; x++) set(x, y, [245, 235, 225]); // halo crème
  for (let y = 100; y <= 129; y++) for (let x = 140; x <= 159; x++) set(x, y, [20, 20, 20]);   // symbole sombre
  for (let x = 10; x < 300; x++) set(x, 145, [250, 250, 250]);                                     // ligne claire fine, éloignée
  set(125, 85, [10, 10, 10]);                                                                      // pixel sombre isolé
  return rgb;
}

const px = (buf, x, y, w, c) => Array.from(buf.subarray((y * w + x) * c, (y * w + x) * c + c));

test('dilate agrandit une forme d\'un rayon carré', () => {
  const m = new Uint8Array(9 * 9);
  m[4 * 9 + 4] = 1;
  const d = dilate(m, 9, 9, 2);
  assert.equal(d[4 * 9 + 6], 1);
  assert.equal(d[2 * 9 + 2], 1);
  assert.equal(d[4 * 9 + 7], 0);
});

test('components compte les formes 8-connexes et leur aire', () => {
  const w = 6, h = 4;
  const m = new Uint8Array(w * h);
  [[0, 0], [1, 1], [4, 3], [5, 3]].forEach(([x, y]) => { m[y * w + x] = 1; });
  const { labels, sizes } = components(m, w, h);
  assert.equal(labels[0], labels[1 * w + 1]);          // diagonale : même forme
  assert.notEqual(labels[0], labels[3 * w + 4]);
  assert.equal(sizes[labels[0]], 2);
  assert.equal(sizes[labels[3 * w + 4]], 2);
});

test('le masque couvre le symbole sombre et son halo', () => {
  const m = buildTextMask(makeRegion(), W, H, C, BOX);
  assert.equal(m[115 * W + 150], 1); // intérieur du symbole
  assert.equal(m[115 * W + 136], 1); // halo
});

test('le masque ignore une ligne claire éloignée et un pixel sombre isolé', () => {
  const m = buildTextMask(makeRegion(), W, H, C, BOX);
  assert.equal(m[145 * W + 130], 0);
  assert.equal(m[85 * W + 125], 0);
});

test('le masque reste dans le rectangle du lieu', () => {
  const small = { x: 140, y: 100, w: 20, h: 30 };
  const m = buildTextMask(makeRegion(), W, H, C, small);
  assert.equal(m[115 * W + 136], 0);   // halo hors rectangle
  assert.equal(m[115 * W + 150], 1);
});

test('la rustine reprend la texture voisine et déborde en fondu', () => {
  const rgb = makeRegion();
  const mask = buildTextMask(rgb, W, H, C, BOX);
  const patch = buildPatch(rgb, mask, W, H, C, BOX);
  const at = (x, y) => px(patch, x - BOX.x, y - BOX.y, BOX.w, 4);

  const inside = at(150, 100);                 // source : (150, 10), décalage (0, -90)
  assert.deepEqual(inside.slice(0, 3), bg(150, 10));
  assert.equal(inside[3], 255);
  assert.equal(at(121, 81)[3], 0);             // loin du texte
  const edge = at(129, 115)[3];                // 2 px au-delà du bord élargi
  assert.ok(edge > 0 && edge < 255, `alpha=${edge}`);
});

test('l\'image de texte garde les pixels du masque et rend le reste transparent', () => {
  const rgb = makeRegion();
  const mask = buildTextMask(rgb, W, H, C, BOX);
  const t = buildTextImage(rgb, mask, W, C, BOX);
  assert.deepEqual(px(t, 150 - BOX.x, 115 - BOX.y, BOX.w, 4), [20, 20, 20, 255]);
  assert.deepEqual(px(t, 136 - BOX.x, 115 - BOX.y, BOX.w, 4), [245, 235, 225, 255]);
  assert.equal(px(t, 1, 1, BOX.w, 4)[3], 0);
});

test('extractLabel renvoie les deux images à la taille du rectangle', () => {
  const { text, patch, count } = extractLabel({ rgb: makeRegion(), width: W, height: H, channels: C, box: BOX });
  assert.equal(text.length, BOX.w * BOX.h * 4);
  assert.equal(patch.length, BOX.w * BOX.h * 4);
  assert.ok(count > 600, `count=${count}`);
});
