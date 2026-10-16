/**
 * Géométrie de la grille hexagonale de la carte de Chult (flat-topped).
 * Partagé entre le navigateur (global HexGeometry) et Node (tools/compute-fog.mjs, tests).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.HexGeometry = api;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  // Calibrage de la carte de Chult (6563 x 8925 px)
  const GRID = Object.freeze({
    width: 6563,
    height: 8925,
    dx: 83.51082968693343,
    dy: 96.43,
    x0: 56.7053015834631,
    y0: 17.64,
    R: 55.67388645795562
  });

  function getCenter(q, r) {
    const cx = GRID.x0 + q * GRID.dx;
    const shift = (Math.abs(q) % 2 === 1) ? (GRID.dy / 2) : 0;
    const cy = GRID.y0 + r * GRID.dy + shift;
    return { cx, cy };
  }

  function getPoints(cx, cy, radius = GRID.R) {
    const h = Math.sqrt(3) * radius;
    return [
      { x: cx - radius / 2, y: cy - h / 2 },
      { x: cx + radius / 2, y: cy - h / 2 },
      { x: cx + radius,     y: cy },
      { x: cx + radius / 2, y: cy + h / 2 },
      { x: cx - radius / 2, y: cy + h / 2 },
      { x: cx - radius,     y: cy }
    ];
  }

  function containsPoint(cx, cy, x, y, radius = GRID.R) {
    const dx = Math.abs(x - cx);
    const dy = Math.abs(y - cy);
    const halfH = (Math.sqrt(3) * radius) / 2;
    if (dx > radius || dy > halfH) return false;
    return dy <= Math.sqrt(3) * (radius - dx);
  }

  // Case dont le centre est le plus proche du point (x, y), en coordonnées carte
  function hexAt(x, y) {
    const q0 = Math.round((x - GRID.x0) / GRID.dx);
    let best = null;
    let bestD = Infinity;
    for (let q = q0 - 1; q <= q0 + 1; q++) {
      const shift = (Math.abs(q) % 2 === 1) ? GRID.dy / 2 : 0;
      const r0 = Math.round((y - GRID.y0 - shift) / GRID.dy);
      for (let r = r0 - 1; r <= r0 + 1; r++) {
        const { cx, cy } = getCenter(q, r);
        const d = (cx - x) ** 2 + (cy - y) ** 2;
        if (d < bestD) { bestD = d; best = { q, r }; }
      }
    }
    return best;
  }

  // La case figure-t-elle sur la carte (centre dans l'image) ?
  function isInMap(q, r) {
    const { cx, cy } = getCenter(q, r);
    return cx >= 0 && cx <= GRID.width && cy >= 0 && cy <= GRID.height;
  }

  function enumerateHexes() {
    const hexes = [];
    for (let q = 0; ; q++) {
      const { cx } = getCenter(q, 0);
      if (cx > GRID.width) break;
      for (let r = 0; ; r++) {
        const { cy } = getCenter(q, r);
        if (cy > GRID.height) break;
        hexes.push({ q, r, cx, cy: getCenter(q, r).cy });
      }
    }
    return hexes;
  }

  return { GRID, getCenter, getPoints, containsPoint, hexAt, isInMap, enumerateHexes };
});
