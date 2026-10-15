const { containsPoint } = require('../hex-geometry.js');

/**
 * Part (0..1) des pixels d'un hexagone dont les deux images diffèrent
 * d'au moins `tolerance` sur un canal. `a` et `b` : buffers raw entrelacés.
 */
function diffRatioInHex(a, b, width, height, channels, cx, cy, R, tolerance) {
  const halfH = (Math.sqrt(3) * R) / 2;
  const xMin = Math.max(0, Math.floor(cx - R));
  const xMax = Math.min(width - 1, Math.ceil(cx + R));
  const yMin = Math.max(0, Math.floor(cy - halfH));
  const yMax = Math.min(height - 1, Math.ceil(cy + halfH));

  let total = 0;
  let diff = 0;
  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      if (!containsPoint(cx, cy, x + 0.5, y + 0.5, R)) continue;
      total++;
      const i = (y * width + x) * channels;
      for (let c = 0; c < channels; c++) {
        if (Math.abs(a[i + c] - b[i + c]) > tolerance) {
          diff++;
          break;
        }
      }
    }
  }
  return total === 0 ? 0 : diff / total;
}

module.exports = { diffRatioInHex };
