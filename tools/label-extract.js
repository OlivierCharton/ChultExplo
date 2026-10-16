'use strict';

/**
 * Découpe des libellés de lieux sur la carte complète.
 * Un libellé = lettres/symboles sombres entourés d'un halo clair et peu saturé.
 * Toutes les fonctions travaillent sur une région RGB entrelacée (`channels` octets par pixel).
 */

const DEFAULTS = Object.freeze({
  haloMin: 190,        // canal minimum d'un pixel de halo (crème)
  haloSpread: 70,      // écart max-min d'un pixel de halo (peu saturé)
  glyphMax: 85,        // canal maximum d'un pixel de lettre ou de symbole (sombre)
  glyphTouch: 2,       // une forme sombre n'est retenue que si elle touche un halo à ≤ 2 px
  minGlyphArea: 12,    // aire minimale (px) d'une forme sombre retenue
  haloReach: 7,        // le halo ne compte qu'à ≤ 7 px d'une forme retenue
  minTextArea: 900,    // aire minimale (px) d'une composante de texte retenue dans le masque
  closeGap: 2,         // fermeture des petits trous du masque (px)
  patchGrow: 3,        // la rustine déborde du texte de 3 px
  feather: 3,          // rayon du fondu de bord de la rustine (px)
  offsets: [[0, -90], [0, 90], [0, -140], [0, 140], [-120, 0], [120, 0], [0, -200], [0, 200], [-200, 0], [200, 0]]
});

function dilate(mask, w, h, r) {
  if (r <= 0) return Uint8Array.from(mask);
  const tmp = new Uint8Array(w * h);
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (!mask[row + x]) continue;
      const a = Math.max(0, x - r), b = Math.min(w - 1, x + r);
      for (let k = a; k <= b; k++) tmp[row + k] = 1;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!tmp[y * w + x]) continue;
      const a = Math.max(0, y - r), b = Math.min(h - 1, y + r);
      for (let k = a; k <= b; k++) out[k * w + x] = 1;
    }
  }
  return out;
}

function erode(mask, w, h, r) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < w * h; i++) d[i] = d[i] ? 0 : 1;
  return d;
}

function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const sizes = [0];
  const stack = [];
  let next = 0;
  for (let s = 0; s < w * h; s++) {
    if (!mask[s] || labels[s]) continue;
    next++;
    let n = 0;
    labels[s] = next;
    stack.push(s);
    while (stack.length) {
      const p = stack.pop();
      n++;
      const x = p % w, y = (p / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue;
          const q = yy * w + xx;
          if (mask[q] && !labels[q]) { labels[q] = next; stack.push(q); }
        }
      }
    }
    sizes.push(n);
  }
  return { labels, sizes };
}

function boxBlur(mask, w, h, r) {
  const k = 2 * r + 1;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -r; d <= r; d++) { const xx = x + d; if (xx >= 0 && xx < w) s += mask[y * w + xx]; }
      tmp[y * w + x] = s / k;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let s = 0;
      for (let d = -r; d <= r; d++) { const yy = y + d; if (yy >= 0 && yy < h) s += tmp[yy * w + x]; }
      out[y * w + x] = s / k;
    }
  }
  return out;
}

function buildTextMask(rgb, width, height, channels, box, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const n = width * height;
  const halo = new Uint8Array(n);
  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * channels;
    const r = rgb[o], g = rgb[o + 1], b = rgb[o + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mn > p.haloMin && mx - mn < p.haloSpread) halo[i] = 1;
    if (mx < p.glyphMax) dark[i] = 1;
  }

  // Formes sombres retenues : celles qui touchent un halo et ont une aire suffisante
  const haloNear = dilate(halo, width, height, p.glyphTouch);
  const { labels, sizes } = components(dark, width, height);
  const keep = new Uint8Array(sizes.length);
  for (let i = 0; i < n; i++) {
    const l = labels[i];
    if (l && haloNear[i] && sizes[l] >= p.minGlyphArea) keep[l] = 1;
  }
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (labels[i] && keep[labels[i]]) core[i] = 1;

  // Texte = formes retenues + halo situé à portée d'une forme retenue
  const reach = dilate(core, width, height, p.haloReach);
  let text = new Uint8Array(n);
  for (let i = 0; i < n; i++) text[i] = (core[i] || (halo[i] && reach[i])) ? 1 : 0;
  text = erode(dilate(text, width, height, p.closeGap), width, height, p.closeGap);

  // Petites composantes (fragments de terrain, hachures) écartées
  const comp = components(text, width, height);
  for (let i = 0; i < n; i++) if (text[i] && comp.sizes[comp.labels[i]] < p.minTextArea) text[i] = 0;

  // Confiné au rectangle du lieu
  const out = new Uint8Array(n);
  for (let y = box.y; y < box.y + box.h; y++) {
    for (let x = box.x; x < box.x + box.w; x++) out[y * width + x] = text[y * width + x];
  }
  return out;
}

function buildPatch(rgb, mask, width, height, channels, box, params = {}) {
  const p = { ...DEFAULTS, ...params };
  const n = width * height;
  const grown = dilate(mask, width, height, p.patchGrow);

  // Couleur de repli : moyenne des pixels non couverts de la région
  let sr = 0, sg = 0, sb = 0, cnt = 0;
  for (let i = 0; i < n; i++) {
    if (grown[i]) continue;
    sr += rgb[i * channels]; sg += rgb[i * channels + 1]; sb += rgb[i * channels + 2]; cnt++;
  }
  const avg = cnt ? [Math.round(sr / cnt), Math.round(sg / cnt), Math.round(sb / cnt)] : [0, 0, 0];

  const soft = boxBlur(grown, width, height, p.feather);
  const out = Buffer.alloc(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const X = box.x + x, Y = box.y + y, i = Y * width + X;
      const a = grown[i] ? 1 : soft[i];
      if (a <= 0) continue;
      let c = avg;
      for (const [dx, dy] of p.offsets) {
        const sx = X + dx, sy = Y + dy;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const j = sy * width + sx;
        if (grown[j]) continue;
        c = [rgb[j * channels], rgb[j * channels + 1], rgb[j * channels + 2]];
        break;
      }
      const o = (y * box.w + x) * 4;
      out[o] = c[0]; out[o + 1] = c[1]; out[o + 2] = c[2]; out[o + 3] = Math.round(a * 255);
    }
  }
  return out;
}

function buildTextImage(rgb, mask, width, channels, box) {
  const out = Buffer.alloc(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const i = (box.y + y) * width + box.x + x;
      if (!mask[i]) continue;
      const o = (y * box.w + x) * 4;
      out[o] = rgb[i * channels]; out[o + 1] = rgb[i * channels + 1]; out[o + 2] = rgb[i * channels + 2]; out[o + 3] = 255;
    }
  }
  return out;
}

function extractLabel({ rgb, width, height, channels, box, params }) {
  const mask = buildTextMask(rgb, width, height, channels, box, params);
  let count = 0;
  for (let i = 0; i < mask.length; i++) count += mask[i];
  return {
    text: buildTextImage(rgb, mask, width, channels, box),
    patch: buildPatch(rgb, mask, width, height, channels, box, params),
    count
  };
}

module.exports = { DEFAULTS, dilate, erode, components, buildTextMask, buildPatch, buildTextImage, extractLabel };
