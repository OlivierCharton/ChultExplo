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

// 2. Coordonnées des 917 hexagones du brouillard de guerre initial (jungle inexplorée)
const BLANK_HEX_COORDINATES = [[20, 49], [20, 50], [20, 51], [21, 35], [21, 36], [21, 37], [21, 40], [21, 48], [21, 49], [21, 50], [21, 51], [22, 36], [22, 37], [22, 38], [22, 40], [22, 41], [22, 48], [22, 49], [22, 50], [22, 51], [22, 52], [23, 33], [23, 35], [23, 36], [23, 37], [23, 38], [23, 39], [23, 40], [23, 41], [23, 47], [23, 48], [23, 49], [23, 50], [23, 51], [23, 52], [24, 34], [24, 35], [24, 36], [24, 37], [24, 38], [24, 39], [24, 40], [24, 41], [24, 47], [24, 48], [24, 49], [24, 50], [24, 51], [24, 52], [25, 33], [25, 34], [25, 35], [25, 36], [25, 37], [25, 38], [25, 39], [25, 40], [25, 46], [25, 47], [25, 48], [25, 49], [25, 50], [25, 51], [25, 54], [25, 59], [25, 60], [26, 32], [26, 33], [26, 34], [26, 35], [26, 36], [26, 37], [26, 38], [26, 39], [26, 40], [26, 45], [26, 46], [26, 47], [26, 48], [26, 49], [26, 50], [26, 51], [26, 55], [26, 60], [26, 61], [26, 62], [26, 63], [27, 31], [27, 32], [27, 33], [27, 34], [27, 35], [27, 36], [27, 37], [27, 38], [27, 39], [27, 40], [27, 44], [27, 45], [27, 46], [27, 47], [27, 48], [27, 49], [27, 50], [27, 51], [27, 54], [27, 59], [27, 60], [27, 61], [27, 62], [28, 31], [28, 32], [28, 33], [28, 35], [28, 36], [28, 37], [28, 38], [28, 39], [28, 40], [28, 41], [28, 43], [28, 44], [28, 45], [28, 46], [28, 47], [28, 48], [28, 49], [28, 50], [28, 51], [28, 52], [28, 53], [28, 54], [28, 55], [28, 59], [28, 60], [28, 61], [28, 62], [29, 30], [29, 31], [29, 32], [29, 34], [29, 35], [29, 37], [29, 38], [29, 39], [29, 40], [29, 41], [29, 43], [29, 44], [29, 45], [29, 46], [29, 47], [29, 48], [29, 49], [29, 50], [29, 51], [29, 52], [29, 53], [29, 54], [29, 55], [29, 57], [29, 58], [29, 59], [29, 60], [29, 61], [29, 62], [30, 30], [30, 31], [30, 32], [30, 33], [30, 35], [30, 36], [30, 38], [30, 39], [30, 40], [30, 41], [30, 42], [30, 43], [30, 44], [30, 45], [30, 46], [30, 47], [30, 48], [30, 49], [30, 50], [30, 51], [30, 52], [30, 53], [30, 54], [30, 55], [30, 56], [30, 57], [30, 58], [30, 59], [30, 60], [30, 61], [30, 62], [31, 29], [31, 30], [31, 31], [31, 32], [31, 36], [31, 38], [31, 39], [31, 40], [31, 41], [31, 42], [31, 43], [31, 44], [31, 45], [31, 46], [31, 47], [31, 48], [31, 49], [31, 50], [31, 51], [31, 52], [31, 53], [31, 54], [31, 55], [31, 56], [31, 57], [31, 58], [31, 59], [31, 60], [31, 61], [32, 29], [32, 30], [32, 31], [32, 32], [32, 33], [32, 36], [32, 37], [32, 38], [32, 39], [32, 40], [32, 41], [32, 42], [32, 43], [32, 44], [32, 45], [32, 46], [32, 47], [32, 48], [32, 49], [32, 50], [32, 51], [32, 52], [32, 53], [32, 54], [32, 55], [32, 56], [32, 57], [32, 58], [32, 59], [32, 60], [32, 61], [33, 28], [33, 29], [33, 30], [33, 31], [33, 36], [33, 37], [33, 38], [33, 39], [33, 40], [33, 41], [33, 42], [33, 43], [33, 44], [33, 45], [33, 46], [33, 47], [33, 48], [33, 49], [33, 50], [33, 51], [33, 52], [33, 53], [33, 54], [33, 55], [33, 56], [33, 57], [33, 58], [33, 59], [33, 60], [34, 28], [34, 29], [34, 30], [34, 31], [34, 36], [34, 37], [34, 38], [34, 39], [34, 40], [34, 41], [34, 42], [34, 43], [34, 44], [34, 45], [34, 46], [34, 47], [34, 48], [34, 49], [34, 50], [34, 51], [34, 52], [34, 53], [34, 54], [34, 59], [34, 60], [34, 61], [34, 63], [35, 28], [35, 29], [35, 30], [35, 35], [35, 36], [35, 37], [35, 38], [35, 39], [35, 40], [35, 41], [35, 42], [35, 43], [35, 44], [35, 45], [35, 46], [35, 47], [35, 48], [35, 49], [35, 50], [35, 51], [35, 52], [35, 53], [35, 54], [35, 59], [35, 60], [35, 61], [36, 27], [36, 29], [36, 30], [36, 35], [36, 36], [36, 37], [36, 38], [36, 39], [36, 40], [36, 41], [36, 42], [36, 43], [36, 44], [36, 45], [36, 46], [36, 47], [36, 48], [36, 49], [36, 50], [36, 51], [36, 52], [36, 53], [36, 54], [36, 55], [36, 60], [36, 61], [37, 26], [37, 27], [37, 28], [37, 29], [37, 34], [37, 35], [37, 36], [37, 37], [37, 38], [37, 39], [37, 40], [37, 41], [37, 42], [37, 43], [37, 44], [37, 45], [37, 46], [37, 47], [37, 48], [37, 49], [37, 50], [37, 51], [37, 52], [37, 53], [37, 54], [37, 60], [38, 27], [38, 28], [38, 29], [38, 35], [38, 36], [38, 37], [38, 38], [38, 39], [38, 40], [38, 41], [38, 42], [38, 43], [38, 44], [38, 45], [38, 46], [38, 47], [38, 48], [38, 49], [38, 50], [38, 51], [38, 52], [38, 53], [38, 54], [38, 60], [38, 61], [39, 33], [39, 34], [39, 35], [39, 36], [39, 37], [39, 38], [39, 39], [39, 40], [39, 41], [39, 42], [39, 43], [39, 44], [39, 45], [39, 46], [39, 47], [39, 48], [39, 49], [39, 50], [39, 51], [39, 52], [39, 53], [39, 60], [40, 33], [40, 34], [40, 35], [40, 36], [40, 37], [40, 38], [40, 39], [40, 40], [40, 41], [40, 42], [40, 43], [40, 44], [40, 45], [40, 46], [40, 47], [40, 48], [40, 49], [40, 50], [40, 51], [40, 52], [40, 53], [40, 63], [41, 33], [41, 34], [41, 35], [41, 36], [41, 37], [41, 38], [41, 39], [41, 40], [41, 41], [41, 42], [41, 43], [41, 44], [41, 45], [41, 46], [41, 47], [41, 48], [41, 49], [41, 50], [41, 51], [41, 52], [41, 53], [41, 54], [41, 55], [42, 37], [42, 38], [42, 39], [42, 40], [42, 41], [42, 42], [42, 43], [42, 44], [42, 45], [42, 46], [42, 47], [42, 48], [42, 49], [42, 50], [42, 51], [42, 52], [42, 53], [42, 54], [42, 55], [42, 60], [42, 61], [42, 62], [43, 37], [43, 38], [43, 39], [43, 40], [43, 41], [43, 42], [43, 43], [43, 44], [43, 45], [43, 46], [43, 47], [43, 48], [43, 49], [43, 50], [43, 51], [43, 52], [43, 53], [43, 54], [43, 59], [43, 60], [43, 61], [44, 34], [44, 35], [44, 36], [44, 37], [44, 38], [44, 39], [44, 40], [44, 41], [44, 42], [44, 43], [44, 44], [44, 45], [44, 46], [44, 47], [44, 48], [44, 49], [44, 50], [44, 51], [44, 52], [44, 53], [44, 54], [44, 59], [44, 60], [44, 61], [44, 62], [44, 63], [44, 64], [45, 32], [45, 33], [45, 34], [45, 35], [45, 36], [45, 37], [45, 38], [45, 42], [45, 43], [45, 44], [45, 45], [45, 46], [45, 47], [45, 48], [45, 49], [45, 50], [45, 51], [45, 52], [45, 53], [45, 54], [45, 56], [45, 59], [45, 60], [45, 61], [45, 62], [45, 63], [46, 32], [46, 33], [46, 34], [46, 35], [46, 36], [46, 37], [46, 38], [46, 43], [46, 44], [46, 45], [46, 46], [46, 47], [46, 48], [46, 49], [46, 50], [46, 51], [46, 52], [46, 53], [46, 54], [46, 55], [46, 56], [46, 59], [46, 60], [46, 61], [46, 62], [47, 43], [47, 44], [47, 45], [47, 46], [47, 47], [47, 48], [47, 49], [47, 50], [47, 51], [47, 52], [47, 53], [47, 54], [47, 55], [47, 56], [47, 59], [47, 60], [47, 61], [47, 62], [48, 40], [48, 41], [48, 42], [48, 43], [48, 44], [48, 45], [48, 46], [48, 47], [48, 48], [48, 49], [48, 50], [48, 51], [48, 52], [48, 53], [48, 54], [48, 55], [48, 56], [48, 57], [48, 59], [48, 60], [48, 61], [48, 62], [49, 39], [49, 40], [49, 42], [49, 43], [49, 44], [49, 45], [49, 46], [49, 47], [49, 48], [49, 49], [49, 50], [49, 51], [49, 52], [49, 53], [49, 54], [49, 55], [49, 56], [49, 57], [49, 58], [49, 59], [49, 60], [49, 61], [50, 36], [50, 37], [50, 38], [50, 39], [50, 40], [50, 41], [50, 43], [50, 44], [50, 45], [50, 46], [50, 47], [50, 48], [50, 49], [50, 50], [50, 51], [50, 52], [50, 53], [50, 54], [50, 55], [50, 56], [50, 57], [50, 58], [50, 59], [50, 60], [50, 61], [50, 62], [51, 36], [51, 37], [51, 38], [51, 39], [51, 40], [51, 42], [51, 43], [51, 44], [51, 45], [51, 46], [51, 47], [51, 48], [51, 49], [51, 50], [51, 51], [51, 52], [51, 53], [51, 54], [51, 55], [51, 56], [51, 57], [51, 58], [51, 59], [51, 60], [51, 61], [51, 62], [51, 63], [52, 37], [52, 38], [52, 41], [52, 48], [52, 49], [52, 50], [52, 51], [52, 52], [52, 53], [52, 56], [52, 57], [52, 58], [52, 59], [52, 60], [52, 61], [52, 62], [52, 63], [52, 64], [53, 49], [53, 50], [53, 51], [53, 52], [53, 55], [53, 56], [53, 57], [53, 58], [53, 59], [53, 60], [53, 61], [53, 62], [53, 63], [54, 50], [54, 56], [54, 57], [54, 58], [54, 59], [54, 60], [54, 61], [54, 62], [54, 63], [54, 64], [55, 49], [55, 56], [55, 57], [55, 58], [55, 59], [55, 60], [55, 61], [55, 62], [55, 63], [56, 49], [56, 50], [56, 51], [56, 52], [56, 53], [56, 57], [56, 58], [56, 59], [56, 60], [56, 61], [56, 62], [56, 63], [57, 48], [57, 49], [57, 50], [57, 51], [57, 52], [57, 57], [57, 58], [57, 59], [57, 60], [57, 61], [57, 62], [57, 63], [58, 48], [58, 49], [58, 50], [58, 51], [58, 52], [58, 59], [58, 60], [58, 61], [58, 62], [58, 63], [58, 64], [58, 65], [58, 66], [58, 67], [59, 48], [59, 49], [59, 50], [59, 51], [59, 52], [59, 53], [59, 59], [59, 60], [59, 61], [59, 62], [59, 63], [59, 64], [59, 65], [59, 66], [59, 67], [59, 68], [60, 49], [60, 50], [60, 51], [60, 52], [60, 53], [60, 54], [60, 57], [60, 58], [60, 59], [60, 60], [60, 61], [60, 62], [60, 63], [60, 64], [60, 65], [60, 66], [60, 67], [60, 68], [60, 69], [61, 49], [61, 50], [61, 51], [61, 52], [61, 53], [61, 56], [61, 57], [61, 58], [61, 59], [61, 60], [61, 61], [61, 63], [61, 64], [61, 65], [61, 66], [61, 67], [61, 68], [62, 50], [62, 51], [62, 52], [62, 57], [62, 58], [62, 59], [62, 60], [62, 61], [62, 62], [62, 64], [62, 65], [62, 66], [62, 67], [62, 68], [63, 51], [63, 52], [63, 57], [63, 58], [63, 59], [63, 60], [63, 61], [63, 66], [64, 52], [64, 53], [64, 58], [64, 61], [64, 62], [65, 53], [65, 58], [65, 60], [65, 61], [66, 57], [66, 58], [66, 59], [66, 61], [67, 57], [67, 58], [67, 59], [67, 63], [67, 64], [68, 57], [68, 58], [68, 59], [68, 61], [68, 63], [68, 64], [68, 65], [69, 56], [69, 57], [69, 58], [69, 59], [69, 61], [69, 62], [70, 57], [70, 58], [70, 59], [70, 60], [70, 62]];

// 3. Dictionnaire des Points d'Intérêt majeurs de Chult (Méthode A)
const pointsOfInterest = {
  "port-nyanzaru": {
    "name": "Port Nyanzaru",
    "centerHex": {
      "q": 42,
      "r": 24
    },
    "labelSize": "18px",
    "revealed": false,
    "icon": "🏰",
    "category": "Cité Portuaire"
  },
  "fort-beluarian": {
    "name": "Fort Beluarian",
    "centerHex": {
      "q": 49,
      "r": 17
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🛡️",
    "category": "Avant-poste Flamming Fist"
  },
  "camp-righteous": {
    "name": "Camp Righteous",
    "centerHex": {
      "q": 36,
      "r": 32
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🏕️",
    "category": "Camp de l'Ordre du Gantelet"
  },
  "camp-vengeance": {
    "name": "Camp Vengeance",
    "centerHex": {
      "q": 34,
      "r": 34
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🏕️",
    "category": "Fort de l'Ordre du Gantelet"
  },
  "yellyark": {
    "name": "Yellyark",
    "centerHex": {
      "q": 36,
      "r": 30
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🛖",
    "category": "Village Gobelin Batiri"
  },
  "vorn": {
    "name": "Vorn",
    "centerHex": {
      "q": 32,
      "r": 31
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🤖",
    "category": "Gardien Bouclier Ancestral"
  },
  "mbala": {
    "name": "Mbala",
    "centerHex": {
      "q": 30,
      "r": 36
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "⛰️",
    "category": "Plateau & Antre de Mémé Pu'pu"
  },
  "orolunga": {
    "name": "Orolunga",
    "centerHex": {
      "q": 23,
      "r": 35
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🏛️",
    "category": "Ziggourat de Saja N'baza"
  },
  "firefinger": {
    "name": "Firefinger",
    "centerHex": {
      "q": 43,
      "r": 31
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🗼",
    "category": "Flèche des Ptérafolks"
  },
  "dungrunglung": {
    "name": "Dungrunglung",
    "centerHex": {
      "q": 42,
      "r": 34
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🐸",
    "category": "Cité des Grungs du Roi Groak"
  },
  "mezro": {
    "name": "Mezro",
    "centerHex": {
      "q": 47,
      "r": 30
    },
    "labelSize": "16px",
    "revealed": false,
    "icon": "✨",
    "category": "Ancienne Cité Sainte d'Ubtao"
  },
  "port-castigliar": {
    "name": "Port Castigliar",
    "centerHex": {
      "q": 49,
      "r": 29
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⚓",
    "category": "Port Abandonné"
  },
  "ataaz-muhahah": {
    "name": "Ataaz Muhahah",
    "centerHex": {
      "q": 47,
      "r": 32
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌉",
    "category": "Gorge Rieuse & Pont de Singe"
  },
  "heart-of-ubtao": {
    "name": "Heart of Ubtao",
    "centerHex": {
      "q": 41,
      "r": 37
    },
    "labelSize": "16px",
    "revealed": false,
    "icon": "🪨",
    "category": "Motte Terrestre Flottante"
  },
  "nangalore": {
    "name": "Nangalore",
    "centerHex": {
      "q": 45,
      "r": 43
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🌿",
    "category": "Jardins Suspendus de Zalkoré"
  },
  "kir-sabal": {
    "name": "Kir Sabal",
    "centerHex": {
      "q": 48,
      "r": 41
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🦅",
    "category": "Monastère des Aarakocras"
  },
  "needles-bones": {
    "name": "Needle's Bones",
    "centerHex": {
      "q": 48,
      "r": 40
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🐉",
    "category": "Squelette de Dragon Vert"
  },
  "wreck-star-goddess": {
    "name": "Wreck of the Star Goddess",
    "centerHex": {
      "q": 27,
      "r": 43
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⛵",
    "category": "Épave du Vaisseau Céleste"
  },
  "ataaz-kahakla": {
    "name": "Ataaz Kahakla",
    "centerHex": {
      "q": 25,
      "r": 40
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌉",
    "category": "Gorge & Repaire de Gargouilles"
  },
  "ataaz-yklwazi": {
    "name": "Ataaz Yklwazi",
    "centerHex": {
      "q": 24,
      "r": 46
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌉",
    "category": "Gorge du Javelot Brisé"
  },
  "omu": {
    "name": "Omu",
    "centerHex": {
      "q": 31,
      "r": 56
    },
    "labelSize": "18px",
    "revealed": false,
    "icon": "👑",
    "category": "La Cité Interdite des Neuf Dieux"
  },
  "jahaka-anchorage": {
    "name": "Jahaka Anchorage",
    "centerHex": {
      "q": 17,
      "r": 42
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🏴‍☠️",
    "category": "Repaire des Pirates"
  },
  "hrakhamar": {
    "name": "Hrakhamar",
    "centerHex": {
      "q": 21,
      "r": 53
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⛏️",
    "category": "Forge Naine Ancestrale"
  },
  "wyrmheart-mine": {
    "name": "Wyrmheart Mine",
    "centerHex": {
      "q": 20,
      "r": 57
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⛏️",
    "category": "Mine & Repaire de Tinder"
  },
  "hisari": {
    "name": "Hisari",
    "centerHex": {
      "q": 54,
      "r": 50
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🐍",
    "category": "Ruine Yuan-ti Abandonnée"
  },
  "ishau": {
    "name": "Ishau",
    "centerHex": {
      "q": 55,
      "r": 46
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌊",
    "category": "Cité Engloutie sous les Eaux"
  }
};

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
    this.allHexMap = new Map(); // key 'q,r' -> { q, r, cx, cy, pointsStr, isInitialFog }
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
    this.gridLinesLayer = document.getElementById('grid-lines-layer');
    this.gridInteractiveLayer = document.getElementById('grid-interactive-layer');
    this.dmGhostLayer = document.getElementById('dm-ghost-layer');
    this.poiLayer = document.getElementById('poi-layer');

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
    const blankCoordSet = new Set();
    BLANK_HEX_COORDINATES.forEach(([q, r]) => {
      blankCoordSet.add(`${q},${r}`);
    });

    const hexKeysToCreate = new Set(blankCoordSet);
    Object.values(this.pois).forEach(p => {
      hexKeysToCreate.add(`${p.centerHex.q},${p.centerHex.r}`);
    });

    const gridLinesFragment = document.createDocumentFragment();
    const gridInteractiveFragment = document.createDocumentFragment();

    hexKeysToCreate.forEach(key => {
      const [qStr, rStr] = key.split(',');
      const q = parseInt(qStr, 10);
      const r = parseInt(rStr, 10);
      const { cx, cy } = HexMath.getCenter(q, r);
      const pointsStr = HexMath.getPointsString(cx, cy);
      const isInitialFog = blankCoordSet.has(key);

      const hexData = {
        key,
        q,
        r,
        cx,
        cy,
        pointsStr,
        isInitialFog
      };
      this.allHexMap.set(key, hexData);

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
  }

  loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (Array.isArray(data.revealedHexes)) {
          this.revealedHexSet = new Set(data.revealedHexes);
        }
      }
    } catch (err) {
      console.warn('Impossible de charger la sauvegarde:', err);
    }

    // Si aucune sauvegarde : Port Nyanzaru et les côtes hors brouillard sont révélés
    if (this.revealedHexSet.size === 0) {
      this.allHexMap.forEach((hex, key) => {
        if (!hex.isInitialFog) {
          this.revealedHexSet.add(key);
        }
      });
    }

    this.syncMaskHoles();
    this.syncPois();
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
          totalFogHexes: BLANK_HEX_COORDINATES.length,
          percentage: ((this.getExploredCount() / BLANK_HEX_COORDINATES.length) * 100).toFixed(1)
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

  syncPois() {
    let newlyDiscovered = [];

    Object.entries(this.pois).forEach(([id, poi]) => {
      const centerKey = `${poi.centerHex.q},${poi.centerHex.r}`;
      const isRevealed = this.revealedHexSet.has(centerKey);

      if (isRevealed && !poi.revealed) {
        poi.revealed = true;
        newlyDiscovered.push(poi);
      } else if (!isRevealed && poi.revealed) {
        poi.revealed = false;
      }
    });

    this.renderPoiMarkers();
    this.renderDmGhosts();
    this.updateStats();
    this.renderPoiList();

    if (newlyDiscovered.length > 0) {
      newlyDiscovered.forEach(p => {
        this.showToast(`📍 Lieu découvert : ${p.name} !`);
      });
    }
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
    if (!this.revealedHexSet.has(key)) {
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
    const isRevealed = this.revealedHexSet.has(key);
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
    BLANK_HEX_COORDINATES.forEach(([q, r]) => {
      if (this.revealedHexSet.has(`${q},${r}`)) {
        count++;
      }
    });
    return count;
  }

  updateStats() {
    const totalFog = BLANK_HEX_COORDINATES.length;
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
        totalFogHexes: BLANK_HEX_COORDINATES.length,
        percentage: ((this.getExploredCount() / BLANK_HEX_COORDINATES.length) * 100).toFixed(1)
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
          this.revealedHexSet = new Set(data.revealedHexes);
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
    this.allHexMap.forEach((hex, key) => {
      if (!hex.isInitialFog) {
        this.revealedHexSet.add(key);
      }
    });

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
