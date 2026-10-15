/**
 * ============================================================================
 * Chult Explo • Tomb of Annihilation Interactive Map
 * Méthode A : Brouillard de guerre hexagonal dynamique (SVG Mask Cutouts)
 * ============================================================================
 */

// 1. Configuration géométrique calibrée de la carte de Chult (6563 x 8925 px)
// La géométrie de la grille vit dans hex-geometry.js (partagée avec tools/compute-fog.mjs).
const MAP_CONFIG = {
  ...HexGeometry.GRID,
  minZoom: 0.12,
  maxZoom: 2.5
};

// 2. Cases sous le voile : FOG_HEX_KEYS ("q,r") est généré par tools/compute-fog.mjs (fog-data.js)

// 4. Clé de stockage LocalStorage
const STORAGE_KEY = 'chult_explo_save_v1';

/**
 * Moteur Géométrique Hexagonal (Flat-Topped)
 */
const HexMath = {
  h: Math.sqrt(3) * MAP_CONFIG.R,

  getCenter(q, r) {
    return HexGeometry.getCenter(q, r);
  },

  getPoints(cx, cy, radius = MAP_CONFIG.R) {
    return HexGeometry.getPoints(cx, cy, radius);
  },

  getPointsString(cx, cy, radius = MAP_CONFIG.R) {
    const pts = this.getPoints(cx, cy, radius);
    return pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  },

  toCube(q, r) {
    const x = q;
    const z = r - Math.floor((q - (q & 1)) / 2);
    const y = -x - z;
    return { x, y, z };
  },

  getDistance(q1, r1, q2, r2) {
    const a = this.toCube(q1, r1);
    const b = this.toCube(q2, r2);
    return Math.floor((Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z)) / 2);
  },

  getNeighborsWithinRadius(q, r, radius) {
    if (radius <= 0) return [{ q, r }];
    const neighbors = [];
    const minQ = q - radius;
    const maxQ = q + radius;
    const minR = r - radius;
    const maxR = r + radius;

    for (let curQ = minQ; curQ <= maxQ; curQ++) {
      for (let curR = minR; curR <= maxR; curR++) {
        if (this.getDistance(q, r, curQ, curR) <= radius) {
          neighbors.push({ q: curQ, r: curR });
        }
      }
    }
    return neighbors;
  }
};

/**
 * Gestionnaire d'État Global de l'Application
 */
class ChultMapApp {
  constructor() {
    this.mode = 'mj'; // 'mj' | 'player'
    this.currentTool = 'reveal'; // 'reveal' | 'hide' | 'toggle'
    this.brushRadius = 0; // 0 = 1 hex, 1 = 7 hexes, 2 = 19 hexes
    this.revealedHexSet = new Set();
    this.allHexMap = new Map(); // cases sous le voile uniquement : key 'q,r' -> { key, q, r, cx, cy, pointsStr }
    this.fogKeys = new Set(FOG_HEX_KEYS);
    this.pois = pointsOfInterest;

    // Options d'affichage
    this.showGrid = true;
    this.showDmGhosts = true;
    this.showPoiLabels = true;

    // Pan & Zoom
    this.zoom = 0.2;
    this.panX = 0;
    this.panY = 0;
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartPanX = 0;
    this.dragStartPanY = 0;
    this.hasDragged = false;
    this.touchPinchDist = null;

    // Hover cache
    this.hoveredHex = null;

    // Initialisation
    this.initDOM();
    this.initHexGrid();
    this.renderPoiPatches();
    this.loadState();
    this.initEvents();
    this.fitToScreen();
    this.updateStats();
    this.renderPoiList();
  }

  initDOM() {
    this.appEl = document.getElementById('app');
    this.viewport = document.getElementById('map-viewport');
    this.stage = document.getElementById('map-stage');
    this.svg = document.getElementById('map-svg');
    this.maskHoles = document.getElementById('mask-holes');
    this.maskVisible = document.getElementById('mask-visible');
    this.gridLinesLayer = document.getElementById('grid-lines-layer');
    this.gridInteractiveLayer = document.getElementById('grid-interactive-layer');
    this.dmGhostLayer = document.getElementById('dm-ghost-layer');
    this.poiLayer = document.getElementById('poi-layer');
    this.poiPatchesLayer = document.getElementById('poi-patches-layer');
    this.poiLabelsLayer = document.getElementById('poi-labels-layer');

    // Toolbar & Panels
    this.toolbar = document.getElementById('toolbar');
    this.btnCollapseSidebar = document.getElementById('btn-collapse-sidebar');
    this.btnToggleSidebar = document.getElementById('pill-toggle-sidebar');
    this.modeMjBtn = document.getElementById('mode-mj-btn');
    this.modePlayerBtn = document.getElementById('mode-player-btn');
    this.pillModeBtn = document.getElementById('pill-mode-btn');

    // Controls
    this.btnZoomIn = document.getElementById('btn-zoom-in');
    this.btnZoomOut = document.getElementById('btn-zoom-out');
    this.btnZoomFit = document.getElementById('btn-zoom-fit');
    this.btnZoom100 = document.getElementById('btn-zoom-100');
    this.btnFullscreen = document.getElementById('pill-fullscreen-btn');

    // HUD
    this.hudCoords = document.getElementById('hud-hex-coords');
    this.hudStatus = document.getElementById('hud-hex-status');
    this.hudPoi = document.getElementById('hud-hex-poi');

    // Stats
    this.statsPct = document.getElementById('stats-pct');
    this.statsBar = document.getElementById('stats-bar');
    this.statsHexCount = document.getElementById('stats-hex-count');
    this.statsPoiCount = document.getElementById('stats-poi-count');

    // POI UI
    this.poiItems = document.getElementById('poi-items');
    this.poiSearchInput = document.getElementById('poi-search-input');
    this.poiSectionToggle = document.getElementById('poi-section-toggle');

    // Saves
    this.btnExport = document.getElementById('btn-export-save');
    this.btnImport = document.getElementById('btn-import-save');
    this.importFileInput = document.getElementById('import-file-input');
    this.btnReset = document.getElementById('btn-reset-map');
    this.btnRevealAll = document.getElementById('btn-reveal-all');
    this.btnHideAll = document.getElementById('btn-hide-all');

    // Modal & Toast
    this.confirmModal = document.getElementById('confirm-modal');
    this.modalTitle = document.getElementById('modal-title');
    this.modalMessage = document.getElementById('modal-message');
    this.modalConfirmBtn = document.getElementById('modal-confirm-btn');
    this.modalCancelBtn = document.getElementById('modal-cancel-btn');
    this.toastContainer = document.getElementById('toast-container');
  }

  initHexGrid() {
    const gridLinesFragment = document.createDocumentFragment();
    const gridInteractiveFragment = document.createDocumentFragment();

    // Seules les cases sous le voile existent : les autres sont visibles et inertes.
    FOG_HEX_KEYS.forEach(key => {
      const [qStr, rStr] = key.split(',');
      const q = parseInt(qStr, 10);
      const r = parseInt(rStr, 10);
      const { cx, cy } = HexMath.getCenter(q, r);
      const pointsStr = HexMath.getPointsString(cx, cy);

      this.allHexMap.set(key, { key, q, r, cx, cy, pointsStr });

      // Trait de grille
      const linePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      linePoly.setAttribute('points', pointsStr);
      linePoly.setAttribute('id', `grid-line-${q}-${r}`);
      gridLinesFragment.appendChild(linePoly);

      // Cellule interactive
      const interactivePoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      interactivePoly.setAttribute('points', pointsStr);
      interactivePoly.setAttribute('id', `hex-cell-${q}-${r}`);
      interactivePoly.setAttribute('class', 'hex-cell');
      interactivePoly.dataset.q = q;
      interactivePoly.dataset.r = r;
      interactivePoly.dataset.key = key;
      gridInteractiveFragment.appendChild(interactivePoly);
    });

    this.gridLinesLayer.appendChild(gridLinesFragment);
    this.gridInteractiveLayer.appendChild(gridInteractiveFragment);

    // Cases de légende : trous permanents dans le masque (carte complète), sans interaction.
    const visibleFragment = document.createDocumentFragment();
    ALWAYS_VISIBLE_HEX_KEYS.forEach(key => {
      const [q, r] = key.split(',').map(n => parseInt(n, 10));
      const { cx, cy } = HexMath.getCenter(q, r);
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', HexMath.getPointsString(cx, cy));
      poly.setAttribute('id', `mask-visible-${q}-${r}`);
      poly.setAttribute('fill', 'black');
      poly.setAttribute('stroke', 'black');
      poly.setAttribute('stroke-width', '2.5');
      visibleFragment.appendChild(poly);
    });
    this.maskVisible.appendChild(visibleFragment);

    const outside = Object.values(this.pois)
      .filter(p => !this.fogKeys.has(`${p.centerHex.q},${p.centerHex.r}`))
      .map(p => p.name);
    if (outside.length > 0) {
      console.info('POI visibles dès le départ (case centrale hors brouillard) :', outside.join(', '));
    }
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
        }
      }
    } catch (err) {
      console.warn('Impossible de charger la sauvegarde:', err);
    }

    this.syncMaskHoles();
    this.syncPois(true);
  }

  saveState() {
    try {
      const saveObj = {
        version: 1,
        date: new Date().toISOString(),
        revealedHexes: Array.from(this.revealedHexSet),
        revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
        stats: {
          revealedCount: this.getExploredCount(),
          totalFogHexes: FOG_HEX_KEYS.length,
          percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
        }
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saveObj));
    } catch (err) {
      console.warn('Erreur de sauvegarde localStorage:', err);
    }
  }

  syncMaskHoles() {
    this.maskHoles.innerHTML = '';
    const fragment = document.createDocumentFragment();

    this.revealedHexSet.forEach(key => {
      const hex = this.allHexMap.get(key);
      if (hex) {
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', hex.pointsStr);
        poly.setAttribute('id', `mask-hole-${hex.q}-${hex.r}`);
        poly.setAttribute('fill', 'black');
        poly.setAttribute('stroke', 'black');
        poly.setAttribute('stroke-width', '2.5');
        fragment.appendChild(poly);
      }
    });

    this.maskHoles.appendChild(fragment);
  }

  addHole(key) {
    const hex = this.allHexMap.get(key);
    if (!hex) return;
    const existing = document.getElementById(`mask-hole-${hex.q}-${hex.r}`);
    if (!existing) {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', hex.pointsStr);
      poly.setAttribute('id', `mask-hole-${hex.q}-${hex.r}`);
      poly.setAttribute('fill', 'black');
      poly.setAttribute('stroke', 'black');
      poly.setAttribute('stroke-width', '2.5');
      this.maskHoles.appendChild(poly);
    }
  }

  removeHole(key) {
    const hex = this.allHexMap.get(key);
    if (!hex) return;
    const existing = document.getElementById(`mask-hole-${hex.q}-${hex.r}`);
    if (existing) {
      existing.remove();
    }
  }

  syncPois(silent = false) {
    let newlyDiscovered = [];

    Object.entries(this.pois).forEach(([id, poi]) => {
      const centerKey = `${poi.centerHex.q},${poi.centerHex.r}`;
      // Case centrale hors brouillard : le lieu est visible dès le départ
      const isRevealed = !this.fogKeys.has(centerKey) || this.revealedHexSet.has(centerKey);

      if (isRevealed && !poi.revealed) {
        poi.revealed = true;
        newlyDiscovered.push(poi);
      } else if (!isRevealed && poi.revealed) {
        poi.revealed = false;
      }
    });

    this.renderPoiMarkers();
    this.renderPoiLabels();
    this.renderDmGhosts();
    this.updateStats();
    this.renderPoiList();

    if (!silent && newlyDiscovered.length > 0) {
      newlyDiscovered.forEach(p => {
        this.showToast(`📍 Lieu découvert : ${p.name} !`);
      });
    }
  }

  makeLabelImage(src, label, id) {
    const img = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    img.setAttribute('id', id);
    img.setAttribute('href', src);
    img.setAttribute('x', label.x);
    img.setAttribute('y', label.y);
    img.setAttribute('width', label.w);
    img.setAttribute('height', label.h);
    img.setAttribute('preserveAspectRatio', 'none');
    return img;
  }

  // Rustines : recouvrent le texte imprimé de chaque lieu sur la carte complète (sous le brouillard)
  renderPoiPatches() {
    const fragment = document.createDocumentFragment();
    Object.keys(this.pois).forEach(id => {
      const label = POI_LABELS[id];
      if (!label) return;
      fragment.appendChild(this.makeLabelImage(`Assets/labels/${id}-patch.png`, label, `poi-patch-${id}`));
    });
    this.poiPatchesLayer.appendChild(fragment);
  }

  // Texte et croix des lieux découverts, au-dessus du brouillard
  renderPoiLabels() {
    this.poiLabelsLayer.innerHTML = '';
    const fragment = document.createDocumentFragment();
    Object.entries(this.pois).forEach(([id, poi]) => {
      const label = POI_LABELS[id];
      if (!poi.revealed || !label) return;
      fragment.appendChild(this.makeLabelImage(`Assets/labels/${id}-text.png`, label, `poi-text-${id}`));
    });
    this.poiLabelsLayer.appendChild(fragment);
  }

  renderPoiMarkers() {
    this.poiLayer.innerHTML = '';
    if (!this.showPoiLabels) return;

    const fragment = document.createDocumentFragment();

    Object.entries(this.pois).forEach(([id, poi]) => {
      if (!poi.revealed) return;

      const { cx, cy } = HexMath.getCenter(poi.centerHex.q, poi.centerHex.r);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'poi-marker');
      g.setAttribute('data-id', id);
      g.setAttribute('transform', `translate(${cx}, ${cy})`);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '-32');
      circle.setAttribute('r', '18');
      circle.setAttribute('class', 'poi-pin-circle');
      g.appendChild(circle);

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', '0');
      icon.setAttribute('y', '-32');
      icon.setAttribute('class', 'poi-pin-icon');
      icon.textContent = poi.icon || '📍';
      g.appendChild(icon);

      const labelText = poi.name;
      const textWidth = Math.max(90, labelText.length * 11 + 24);
      const textHeight = 28;

      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', -textWidth / 2);
      bgRect.setAttribute('y', '6');
      bgRect.setAttribute('width', textWidth);
      bgRect.setAttribute('height', textHeight);
      bgRect.setAttribute('class', 'poi-marker-bg');
      g.appendChild(bgRect);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '20');
      text.setAttribute('class', 'poi-marker-text');
      text.setAttribute('style', `font-size: ${poi.labelSize || '15px'};`);
      text.textContent = labelText;
      g.appendChild(text);

      g.addEventListener('mouseenter', () => {
        this.updateHudHover(poi.centerHex.q, poi.centerHex.r);
      });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.flyTo(cx, cy, 0.9);
      });

      fragment.appendChild(g);
    });

    this.poiLayer.appendChild(fragment);
  }

  renderDmGhosts() {
    this.dmGhostLayer.innerHTML = '';
    if (!this.showDmGhosts || this.mode !== 'mj') return;

    const fragment = document.createDocumentFragment();

    Object.entries(this.pois).forEach(([id, poi]) => {
      if (poi.revealed) return;

      const { cx, cy } = HexMath.getCenter(poi.centerHex.q, poi.centerHex.r);
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('class', 'dm-ghost-marker');
      g.setAttribute('data-id', id);
      g.setAttribute('transform', `translate(${cx}, ${cy})`);
      g.setAttribute('title', `Secret MJ: ${poi.name}`);

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0');
      circle.setAttribute('cy', '0');
      circle.setAttribute('r', '24');
      circle.setAttribute('class', 'ghost-circle');
      g.appendChild(circle);

      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      icon.setAttribute('x', '0');
      icon.setAttribute('y', '1');
      icon.setAttribute('text-anchor', 'middle');
      icon.setAttribute('dominant-baseline', 'central');
      icon.setAttribute('font-size', '16');
      icon.textContent = poi.icon || '🔒';
      g.appendChild(icon);

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', '0');
      label.setAttribute('y', '36');
      label.setAttribute('class', 'ghost-text');
      label.textContent = poi.name;
      g.appendChild(label);

      g.addEventListener('mouseenter', () => {
        this.updateHudHover(poi.centerHex.q, poi.centerHex.r);
      });

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        this.revealHex(poi.centerHex.q, poi.centerHex.r);
      });

      fragment.appendChild(g);
    });

    this.dmGhostLayer.appendChild(fragment);
  }

  applyTool(q, r, explicitConceal = false) {
    if (this.mode !== 'mj') return;

    const targets = HexMath.getNeighborsWithinRadius(q, r, this.brushRadius);
    let stateChanged = false;

    targets.forEach(({ q: tq, r: tr }) => {
      const key = `${tq},${tr}`;
      if (!this.fogKeys.has(key)) return; // case visible au départ : inerte
      const isCurrentlyRevealed = this.revealedHexSet.has(key);

      if (explicitConceal) {
        if (isCurrentlyRevealed) {
          this.revealedHexSet.delete(key);
          this.removeHole(key);
          stateChanged = true;
        }
      } else if (this.currentTool === 'reveal') {
        if (!isCurrentlyRevealed) {
          this.revealedHexSet.add(key);
          this.addHole(key);
          this.flashHex(tq, tr);
          stateChanged = true;
        }
      } else if (this.currentTool === 'hide') {
        if (isCurrentlyRevealed) {
          this.revealedHexSet.delete(key);
          this.removeHole(key);
          stateChanged = true;
        }
      } else if (this.currentTool === 'toggle') {
        if (isCurrentlyRevealed) {
          this.revealedHexSet.delete(key);
          this.removeHole(key);
        } else {
          this.revealedHexSet.add(key);
          this.addHole(key);
          this.flashHex(tq, tr);
        }
        stateChanged = true;
      }
    });

    if (stateChanged) {
      this.syncPois();
      this.saveState();
    }
  }

  revealHex(q, r) {
    const key = `${q},${r}`;
    if (this.fogKeys.has(key) && !this.revealedHexSet.has(key)) {
      this.revealedHexSet.add(key);
      this.addHole(key);
      this.flashHex(q, r);
      this.syncPois();
      this.saveState();
    }
  }

  flashHex(q, r) {
    const cell = document.getElementById(`hex-cell-${q}-${r}`);
    if (cell) {
      cell.classList.remove('hex-flash-reveal');
      void cell.offsetWidth;
      cell.classList.add('hex-flash-reveal');
    }
  }

  updateTransform() {
    this.stage.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
  }

  zoomAt(clientX, clientY, factor) {
    const rect = this.viewport.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const mapX = (mouseX - this.panX) / this.zoom;
    const mapY = (mouseY - this.panY) / this.zoom;

    const newZoom = Math.max(MAP_CONFIG.minZoom, Math.min(MAP_CONFIG.maxZoom, this.zoom * factor));
    this.panX = mouseX - mapX * newZoom;
    this.panY = mouseY - mapY * newZoom;
    this.zoom = newZoom;

    this.updateTransform();
  }

  fitToScreen() {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;

    const scaleX = vw / MAP_CONFIG.width;
    const scaleY = vh / MAP_CONFIG.height;
    this.zoom = Math.max(scaleX, scaleY) * 0.95;

    this.panX = (vw - MAP_CONFIG.width * this.zoom) / 2;
    this.panY = (vh - MAP_CONFIG.height * this.zoom) / 2;
    this.updateTransform();
  }

  flyTo(targetX, targetY, targetZoom = 0.8) {
    const vw = this.viewport.clientWidth;
    const vh = this.viewport.clientHeight;

    const finalZoom = targetZoom;
    const finalPanX = vw / 2 - targetX * finalZoom;
    const finalPanY = vh / 2 - targetY * finalZoom;

    const startZoom = this.zoom;
    const startPanX = this.panX;
    const startPanY = this.panY;
    const startTime = performance.now();
    const duration = 600;

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      this.zoom = startZoom + (finalZoom - startZoom) * ease;
      this.panX = startPanX + (finalPanX - startPanX) * ease;
      this.panY = startPanY + (finalPanY - startPanY) * ease;
      this.updateTransform();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  initEvents() {
    this.viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
      this.zoomAt(e.clientX, e.clientY, factor);
    }, { passive: false });

    this.viewport.addEventListener('mousedown', (e) => {
      if (e.button === 1 || e.button === 0) {
        this.isDragging = true;
        this.hasDragged = false;
        this.dragStartX = e.clientX;
        this.dragStartY = e.clientY;
        this.dragStartPanX = this.panX;
        this.dragStartPanY = this.panY;
        this.viewport.classList.add('is-dragging');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        this.hasDragged = true;
      }
      this.panX = this.dragStartPanX + dx;
      this.panY = this.dragStartPanY + dy;
      this.updateTransform();
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.viewport.classList.remove('is-dragging');
      }
    });

    this.gridInteractiveLayer.addEventListener('click', (e) => {
      if (this.hasDragged) return;
      const target = e.target.closest('.hex-cell');
      if (!target) return;

      const q = parseInt(target.dataset.q, 10);
      const r = parseInt(target.dataset.r, 10);
      const isCtrl = e.ctrlKey || e.metaKey;
      this.applyTool(q, r, isCtrl);
    });

    this.gridInteractiveLayer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const target = e.target.closest('.hex-cell');
      if (!target) return;

      const q = parseInt(target.dataset.q, 10);
      const r = parseInt(target.dataset.r, 10);
      this.applyTool(q, r, true);
    });

    this.gridInteractiveLayer.addEventListener('mouseover', (e) => {
      const target = e.target.closest('.hex-cell');
      if (!target) return;

      const q = parseInt(target.dataset.q, 10);
      const r = parseInt(target.dataset.r, 10);
      this.updateHudHover(q, r);
      this.updateBrushHover(q, r);
    });

    this.gridInteractiveLayer.addEventListener('mouseleave', () => {
      this.clearBrushHover();
      this.hudCoords.textContent = '🧭 Hex: —';
      this.hudStatus.textContent = 'Statut: —';
      this.hudPoi.textContent = 'Lieu: Aucun';
    });

    let touchStartDist = null;
    let touchStartMidX = 0;
    let touchStartMidY = 0;

    this.viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.hasDragged = false;
        this.dragStartX = e.touches[0].clientX;
        this.dragStartY = e.touches[0].clientY;
        this.dragStartPanX = this.panX;
        this.dragStartPanY = this.panY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchStartDist = Math.hypot(dx, dy);
        touchStartMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        touchStartMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: true });

    this.viewport.addEventListener('touchmove', (e) => {
      if (e.touches.length === 1 && this.isDragging) {
        const dx = e.touches[0].clientX - this.dragStartX;
        const dy = e.touches[0].clientY - this.dragStartY;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          this.hasDragged = true;
        }
        this.panX = this.dragStartPanX + dx;
        this.panY = this.dragStartPanY + dy;
        this.updateTransform();
      } else if (e.touches.length === 2 && touchStartDist) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / touchStartDist;
        this.zoomAt(touchStartMidX, touchStartMidY, factor);
        touchStartDist = dist;
      }
    }, { passive: true });

    this.viewport.addEventListener('touchend', () => {
      this.isDragging = false;
      touchStartDist = null;
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === '+' || e.key === '=') this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25);
      if (e.key === '-' || e.key === '_') this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.25);
      if (e.key === '0') this.fitToScreen();
      if (e.key === '1') this.flyTo(MAP_CONFIG.width / 2, MAP_CONFIG.height / 2, 1);
      if (e.key.toLowerCase() === 'f') this.toggleFullscreen();
      if (e.key.toLowerCase() === 'm') this.toggleMode();
    });

    this.btnZoomIn.addEventListener('click', () => this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1.25));
    this.btnZoomOut.addEventListener('click', () => this.zoomAt(window.innerWidth / 2, window.innerHeight / 2, 1 / 1.25));
    this.btnZoomFit.addEventListener('click', () => this.fitToScreen());
    this.btnZoom100.addEventListener('click', () => this.flyTo(MAP_CONFIG.width / 2, MAP_CONFIG.height / 2, 1));
    this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

    this.modeMjBtn.addEventListener('click', () => this.setMode('mj'));
    this.modePlayerBtn.addEventListener('click', () => this.setMode('player'));
    this.pillModeBtn.addEventListener('click', () => this.toggleMode());

    document.querySelectorAll('.action-tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.action-tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentTool = btn.dataset.tool;
      });
    });

    document.querySelectorAll('.brush-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.brush-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.brushRadius = parseInt(btn.dataset.radius, 10);
        const descEl = document.getElementById('brush-desc');
        if (this.brushRadius === 0) descEl.textContent = '1 case';
        else if (this.brushRadius === 1) descEl.textContent = '7 cases';
        else descEl.textContent = '19 cases';
      });
    });

    const chkGrid = document.getElementById('chk-grid-visible');
    chkGrid.addEventListener('change', () => {
      this.showGrid = chkGrid.checked;
      this.gridLinesLayer.classList.toggle('hidden', !this.showGrid);
    });

    const chkGhosts = document.getElementById('chk-dm-ghosts');
    chkGhosts.addEventListener('change', () => {
      this.showDmGhosts = chkGhosts.checked;
      this.renderDmGhosts();
    });

    const chkPoiLabels = document.getElementById('chk-poi-labels');
    chkPoiLabels.addEventListener('change', () => {
      this.showPoiLabels = chkPoiLabels.checked;
      this.renderPoiMarkers();
    });

    this.btnCollapseSidebar.addEventListener('click', () => this.toggleSidebar(false));
    this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());

    this.poiSectionToggle.addEventListener('click', () => {
      const section = this.poiSectionToggle.closest('.collapsible-section');
      section.classList.toggle('collapsed');
    });

    this.poiSearchInput.addEventListener('input', (e) => {
      this.filterPoiList(e.target.value.toLowerCase().trim());
    });

    this.btnExport.addEventListener('click', () => this.exportSaveFile());
    this.btnImport.addEventListener('click', () => this.importFileInput.click());
    this.importFileInput.addEventListener('change', (e) => this.handleFileImport(e));

    this.btnReset.addEventListener('click', () => {
      this.showConfirmModal(
        "Réinitialiser la carte de Chult",
        "Voulez-vous réinitialiser complètement la carte ? Tout le brouillard de guerre sera rétabli et les découvertes seront effacées.",
        () => this.resetMap()
      );
    });

    this.btnRevealAll.addEventListener('click', () => {
      this.showConfirmModal(
        "Révéler toute la carte",
        "Voulez-vous lever tout le brouillard de guerre sur toute l'île de Chult ?",
        () => this.revealAllHexes()
      );
    });

    this.btnHideAll.addEventListener('click', () => {
      this.showConfirmModal(
        "Recouvrir de brouillard",
        "Voulez-vous masquer tous les hexagones inexplorés de la jungle ?",
        () => this.hideAllHexes()
      );
    });
  }

  setMode(newMode) {
    this.mode = newMode;
    document.body.className = `mode-${newMode}`;
    this.modeMjBtn.classList.toggle('active', newMode === 'mj');
    this.modePlayerBtn.classList.toggle('active', newMode === 'player');

    const pillText = this.pillModeBtn.querySelector('.pill-text');
    const pillIcon = this.pillModeBtn.querySelector('.pill-icon');
    if (newMode === 'mj') {
      pillText.textContent = 'Mode MJ';
      pillIcon.textContent = '⚔️';
    } else {
      pillText.textContent = 'Mode Joueur';
      pillIcon.textContent = '👁️';
    }

    this.renderDmGhosts();
    this.renderPoiList();
    this.showToast(newMode === 'mj' ? 'Mode Maître de Jeu activé' : 'Mode Joueur (Projection) activé');
  }

  toggleMode() {
    this.setMode(this.mode === 'mj' ? 'player' : 'mj');
  }

  toggleSidebar(forceState) {
    if (forceState !== undefined) {
      this.toolbar.classList.toggle('collapsed', !forceState);
    } else {
      this.toolbar.classList.toggle('collapsed');
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  updateHudHover(q, r) {
    const key = `${q},${r}`;
    this.hudCoords.textContent = `🧭 Hex: Q=${q}, R=${r}`;
    const isRevealed = !this.fogKeys.has(key) || this.revealedHexSet.has(key);
    this.hudStatus.textContent = isRevealed ? 'Statut: Exploré' : 'Statut: Brouillard';

    let poiFound = null;
    for (const [id, poi] of Object.entries(this.pois)) {
      if (poi.centerHex.q === q && poi.centerHex.r === r) {
        poiFound = poi;
        break;
      }
    }

    if (poiFound) {
      if (poiFound.revealed) {
        this.hudPoi.textContent = `Lieu: ${poiFound.name} (${poiFound.category || ''})`;
      } else if (this.mode === 'mj') {
        this.hudPoi.textContent = `Secret MJ: ${poiFound.name} [Non révélé]`;
      } else {
        this.hudPoi.textContent = 'Lieu: Inconnu';
      }
    } else {
      this.hudPoi.textContent = 'Lieu: Jungle sauvage';
    }
  }

  updateBrushHover(centerQ, centerR) {
    this.clearBrushHover();
    if (this.mode !== 'mj' || this.brushRadius <= 0) return;

    const neighbors = HexMath.getNeighborsWithinRadius(centerQ, centerR, this.brushRadius);
    neighbors.forEach(({ q, r }) => {
      const el = document.getElementById(`hex-cell-${q}-${r}`);
      if (el) el.classList.add('brush-hover');
    });
  }

  clearBrushHover() {
    document.querySelectorAll('.brush-hover').forEach(el => el.classList.remove('brush-hover'));
  }

  getExploredCount() {
    let count = 0;
    this.revealedHexSet.forEach(key => {
      if (this.fogKeys.has(key)) count++;
    });
    return count;
  }

  updateStats() {
    const totalFog = FOG_HEX_KEYS.length;
    const explored = this.getExploredCount();
    const pct = ((explored / totalFog) * 100).toFixed(1);

    this.statsPct.textContent = `${pct}%`;
    this.statsBar.style.width = `${pct}%`;
    this.statsHexCount.textContent = `${explored} / ${totalFog}`;

    const totalPois = Object.keys(this.pois).length;
    const revealedPois = Object.values(this.pois).filter(p => p.revealed).length;
    this.statsPoiCount.textContent = `${revealedPois} / ${totalPois}`;
  }

  renderPoiList() {
    this.poiItems.innerHTML = '';
    const sorted = Object.entries(this.pois).sort((a, b) => {
      if (a[1].revealed !== b[1].revealed) return a[1].revealed ? -1 : 1;
      return a[1].name.localeCompare(b[1].name);
    });

    sorted.forEach(([id, poi]) => {
      if (this.mode === 'player' && !poi.revealed) return;

      const row = document.createElement('div');
      row.className = 'poi-item-row';
      row.dataset.id = id;

      const left = document.createElement('div');
      left.className = 'poi-item-left';

      const icon = document.createElement('span');
      icon.className = 'poi-item-icon';
      icon.textContent = poi.revealed ? (poi.icon || '📍') : '🔒';
      left.appendChild(icon);

      const name = document.createElement('span');
      name.className = 'poi-item-name';
      name.textContent = poi.name;
      left.appendChild(name);

      const status = document.createElement('span');
      status.className = `poi-item-status ${poi.revealed ? 'revealed' : 'hidden'}`;
      status.textContent = poi.revealed ? 'Découvert' : 'Inexploré';

      row.appendChild(left);
      row.appendChild(status);

      row.addEventListener('click', () => {
        const { cx, cy } = HexMath.getCenter(poi.centerHex.q, poi.centerHex.r);
        this.flyTo(cx, cy, 0.95);
      });

      this.poiItems.appendChild(row);
    });
  }

  filterPoiList(query) {
    document.querySelectorAll('.poi-item-row').forEach(row => {
      const name = row.querySelector('.poi-item-name').textContent.toLowerCase();
      row.style.display = name.includes(query) ? 'flex' : 'none';
    });
  }

  exportSaveFile() {
    const saveObj = {
      title: 'Sauvegarde Carte Chult - Tomb of Annihilation',
      version: 1,
      date: new Date().toISOString(),
      revealedHexes: Array.from(this.revealedHexSet),
      revealedPois: Object.entries(this.pois).filter(([_, p]) => p.revealed).map(([k]) => k),
      stats: {
        revealedCount: this.getExploredCount(),
        totalFogHexes: FOG_HEX_KEYS.length,
        percentage: ((this.getExploredCount() / FOG_HEX_KEYS.length) * 100).toFixed(1)
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(saveObj, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'sauvegarde-carte-chult.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    this.showToast('Progression exportée avec succès !');
  }

  handleFileImport(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes.filter(k => this.fogKeys.has(k)));
          this.syncMaskHoles();
          this.syncPois();
          this.saveState();
          this.showToast(`Sauvegarde importée : ${this.getExploredCount()} cases révélées.`);
        } else {
          alert('Format de fichier de sauvegarde invalide.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier JSON : ' + err.message);
      }
      this.importFileInput.value = '';
    };
    reader.readAsText(file);
  }

  resetMap() {
    this.revealedHexSet.clear();
    this.syncMaskHoles();
    this.syncPois();
    this.saveState();
    this.showToast('La carte a été réinitialisée.');
  }

  revealAllHexes() {
    this.allHexMap.forEach((hex, key) => {
      this.revealedHexSet.add(key);
    });
    this.syncMaskHoles();
    this.syncPois();
    this.saveState();
    this.showToast('Tous les hexagones ont été révélés.');
  }

  hideAllHexes() {
    this.revealedHexSet.clear();
    this.syncMaskHoles();
    this.syncPois();
    this.saveState();
    this.showToast('Tout le brouillard de guerre a été rétabli.');
  }

  showConfirmModal(title, message, onConfirm) {
    this.modalTitle.textContent = title;
    this.modalMessage.textContent = message;
    this.confirmModal.style.display = 'flex';

    const handleConfirm = () => {
      cleanup();
      onConfirm();
    };

    const handleCancel = () => {
      cleanup();
    };

    const cleanup = () => {
      this.modalConfirmBtn.removeEventListener('click', handleConfirm);
      this.modalCancelBtn.removeEventListener('click', handleCancel);
      this.confirmModal.style.display = 'none';
    };

    this.modalConfirmBtn.addEventListener('click', handleConfirm);
    this.modalCancelBtn.addEventListener('click', handleCancel);
  }

  showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>⚔️</span><span>${msg}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3500);
  }
}

// Démarrage automatique dès que le DOM est prêt
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.chultApp = new ChultMapApp();
  });
} else {
  window.chultApp = new ChultMapApp();
}
