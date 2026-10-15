/**
 * Points d'intérêt de Chult : identifiant -> nom, case centrale (q, r), icône, catégorie.
 * Partagé entre le navigateur (global pointsOfInterest) et Node (tools/).
 */
const pointsOfInterest = {
  "port-nyanzaru": {
    "name": "Port Nyanzaru",
    "centerHex": {
      "q": 43,
      "r": 23
    },
    "labelSize": "18px",
    "revealed": false,
    "icon": "🏰",
    "category": "Cité Portuaire"
  },
  "fort-beluarian": {
    "name": "Fort Beluarian",
    "centerHex": {
      "q": 47,
      "r": 18
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
      "q": 33,
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
      "q": 35,
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
      "q": 31,
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
      "q": 29,
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
      "r": 36
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🏛️",
    "category": "Ziggourat de Saja N'baza"
  },
  "firefinger": {
    "name": "Firefinger",
    "centerHex": {
      "q": 44,
      "r": 33
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
      "r": 37
    },
    "labelSize": "15px",
    "revealed": false,
    "icon": "🐸",
    "category": "Cité des Grungs du Roi Groak"
  },
  "mezro": {
    "name": "Mezro",
    "centerHex": {
      "q": 49,
      "r": 32
    },
    "labelSize": "16px",
    "revealed": false,
    "icon": "✨",
    "category": "Ancienne Cité Sainte d'Ubtao"
  },
  "port-castigliar": {
    "name": "Port Castigliar",
    "centerHex": {
      "q": 51,
      "r": 30
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⚓",
    "category": "Port Abandonné"
  },
  "ataaz-muhahah": {
    "name": "Ataaz Muhahah",
    "centerHex": {
      "q": 48,
      "r": 35
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌉",
    "category": "Gorge Rieuse & Pont de Singe"
  },
  "heart-of-ubtao": {
    "name": "Heart of Ubtao",
    "centerHex": {
      "q": 38,
      "r": 44
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
      "r": 44
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
      "q": 50,
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
      "q": 28,
      "r": 49
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "⛵",
    "category": "Épave du Vaisseau Céleste"
  },
  "ataaz-kahakla": {
    "name": "Ataaz Kahakla",
    "centerHex": {
      "q": 26,
      "r": 43
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🌉",
    "category": "Gorge & Repaire de Gargouilles"
  },
  "ataaz-yklwazi": {
    "name": "Ataaz Yklwazi",
    "centerHex": {
      "q": 25,
      "r": 53
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
      "q": 14,
      "r": 44
    },
    "labelSize": "14px",
    "revealed": false,
    "icon": "🏴‍☠️",
    "category": "Repaire des Pirates"
  },
  "hrakhamar": {
    "name": "Hrakhamar",
    "centerHex": {
      "q": 18,
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
      "q": 19,
      "r": 56
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

if (typeof module === "object" && module.exports) {
  module.exports = { pointsOfInterest };
}
