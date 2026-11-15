'use strict';
/* =========================================================
   Sala biblioteki: układ, kolizje, szafy, meble, tło.
   ========================================================= */

const MAP_W = 20;
const MAP_H = 13;
const WORLD_W = MAP_W * T;
const WORLD_H = MAP_H * T;

// W = ściana, C = lada, R = barierka, . = podłoga
const MAP_ROWS = [
  'WWWWWWWWWWWWWWWWWWWW',
  'WWWWWWWWWWWWWWWWWWWW',
  'W........R.........W',
  'W........R.........W',
  'WCCCCCCCCR.........W',
  'W..................W',
  'W..................W',
  'W..................W',
  'W..................W',
  'W..................W',
  'W..................W',
  'W..................W',
  'WWWWWWWWWWWWWWWWWWWW',
];

const COUNTER_ROW = 4;
const ALL_SLOT_COLS = [3, 4, 5, 6];
const RETURN_COL = 8;
const DOOR_POS = { x: 1.5 * T, y: 2.3 * T };
const AISLE_Y = 2.65 * T;
const SLOT_Y = 4 * T - 2;
const CAT_BED = { x: 16.3 * T, y: 11.6 * T };
const CAT_START = { x: 5.5 * T, y: 6.2 * T };

const WINDOWS = [
  { x: 3 * T + 4, y: 14, w: 2 * T - 8, h: 58 },
  { x: 6 * T + 4, y: 14, w: 2 * T - 8, h: 58 },
];

const SOLID = [];
let STATIC_PROPS = [];
let BOOKCASES = []; // { idx, tx, ty, shelves:[{cat,count}|null], art, dirty }
const LAMPS = [
  { x: 18 * T + 18, y: 9 * T - 44, jy: 9 * T, r: 110 },
  { x: 6 * T + 22 + T, y: 4 * T - 40, r: 90 },
  { x: 4.75 * T, y: 9 * T - 10, r: 70 },
];
let ART = {};

function isSolidTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return SOLID[ty][tx];
}
function isSolidPx(px, py) {
  return isSolidTile(Math.floor(px / T), Math.floor(py / T));
}

function activeSlotCols() {
  return ALL_SLOT_COLS.slice(0, branch().slots);
}

/* ---------- rozkład półek w szafach ---------- */
function freeShelfSlots(b) {
  const used = Object.values(b.shelves).reduce((a, n) => a + n, 0);
  return b.bookcases * SHELVES_PER_CASE - used;
}

function layoutShelves(b) {
  const cases = [];
  for (let i = 0; i < b.bookcases; i++) cases.push([]);
  // podstawowe półki: każda kategoria w swojej szafie
  for (let i = 0; i < b.bookcases; i++) for (const c of BOOKCASE_SETS[i].cats) cases[i].push(c);
  // dodatkowe półki: najpierw do szafy z tą kategorią, potem do pierwszej wolnej
  for (const c of CAT_ORDER) {
    const extra = (b.shelves[c] || 0) - 1;
    for (let k = 0; k < extra; k++) {
      let target = cases.findIndex((cs) => cs.includes(c) && cs.length < SHELVES_PER_CASE);
      if (target < 0) target = cases.findIndex((cs) => cs.length < SHELVES_PER_CASE);
      if (target >= 0) cases[target].push(c);
    }
  }
  // grupujemy takie same kategorie obok siebie
  return cases.map((cs) => cs.sort((a, z) => CAT_ORDER.indexOf(a) - CAT_ORDER.indexOf(z)));
}

function maxStock(cat) {
  return (branch().shelves[cat] || 0) * BOOKS_PER_SHELF;
}

function availableCats() {
  return CAT_ORDER.filter((c) => branch().shelves[c] > 0);
}

// Odświeża zawartość szaf (liczba książek na półkach) – po zmianie zapasu
function refreshBookcases() {
  const b = branch();
  const layout = layoutShelves(b);
  BOOKCASES.forEach((bc, i) => {
    const cats = layout[i];
    // rozdzielamy zapas kategorii po jej półkach (najpierw pełne)
    const remaining = {};
    const shelves = [];
    for (let s = 0; s < SHELVES_PER_CASE; s++) {
      const c = cats[s];
      if (!c) {
        shelves.push(null);
        continue;
      }
      if (remaining[c] === undefined) {
        // ile zapasu przypada na półki tej kategorii w tej szafie
        const before = layout.slice(0, i).flat().filter((x) => x === c).length;
        remaining[c] = Math.max(0, b.stock[c] - before * BOOKS_PER_SHELF);
      }
      const count = Math.min(BOOKS_PER_SHELF, remaining[c]);
      remaining[c] -= count;
      shelves.push({ cat: c, count });
    }
    const key = JSON.stringify(shelves);
    if (key !== bc.key) {
      bc.key = key;
      bc.shelves = shelves;
      bc.cats = [...new Set(cats)];
      bc.art = makeBookcaseArt(shelves, 101 + i * 37);
    }
  });
}

function bookcaseAt(tx, ty) {
  return BOOKCASES.find((bc) => ty === bc.ty && tx >= bc.tx && tx < bc.tx + 3);
}

function bookcaseWithCat(cat) {
  return BOOKCASES.find((bc) => bc.cats.includes(cat));
}

/* ---------- budowa świata ---------- */
function buildArt() {
  const jp = theme().lights === 'lanterns';
  ART = {
    bg: drawBackground(),
    counter: makeCounterArt(),
    catBed: makeCatBedArt(),
    plantA: theme().plant === 'bamboo' ? makeBambooArt(3, true) : makePlantArt(3, true),
    plantB: theme().plant === 'bamboo' ? makeBambooArt(11) : makePlantArt(11),
    plantC: theme().plant === 'bamboo' ? makeBambooArt(23, true) : makePlantArt(23, true),
    armchair: jp ? makeZaisuArt() : makeArmchairArt(),
    lamp: jp ? makeAndonArt() : makeFloorLampArt(),
    sideTable: jp ? makeTeaTrayArt() : makeSideTableArt(),
    readingTable: jp ? makeChabudaiArt() : makeReadingTableArt(),
  };
  for (const bc of BOOKCASES) bc.key = null;
}

function buildWorld() {
  for (let y = 0; y < MAP_H; y++) {
    SOLID[y] = [];
    for (let x = 0; x < MAP_W; x++) SOLID[y][x] = MAP_ROWS[y][x] !== '.';
  }
  const solid = (tiles) => tiles.forEach(([x, y]) => (SOLID[y][x] = true));

  STATIC_PROPS = [
    // act: zabawa kotki przy meblu (activities.js), tiles: kafle, na które kotka patrzy
    { art: 'plantB', x: 10 * T + 2, bottom: 3 * T - 2, act: 'plant', tiles: [[10, 2]] },
    { art: 'plantA', x: 18 * T + 2, bottom: 3 * T - 2, act: 'plant', tiles: [[18, 2]] },
    { art: 'plantC', x: 1 * T + 2, bottom: 12 * T - 2, act: 'plant', tiles: [[1, 11]] },
    { art: 'lamp', x: 18 * T + 6, bottom: 10 * T - 4 },
    { art: 'armchair', x: 17 * T - 6, bottom: 11 * T + 4, act: 'armchair', tiles: [[17, 10]] },
    { art: 'sideTable', x: 18 * T + 6, bottom: 11 * T + 2 },
    { art: 'readingTable', x: 3 * T - 2, bottom: 10 * T, act: 'read', tiles: [[3, 9], [4, 9]] },
  ];
  solid([[10, 2], [18, 2], [1, 11], [18, 9], [17, 10], [18, 10], [3, 9], [4, 9]]);

  const b = branch();
  BOOKCASES = [];
  for (let i = 0; i < b.bookcases; i++) {
    const s = BOOKCASE_SPOTS[i];
    BOOKCASES.push({ idx: i, tx: s.tx, ty: s.ty, key: null, shelves: [], cats: [] });
    solid([[s.tx, s.ty], [s.tx + 1, s.ty], [s.tx + 2, s.ty]]);
  }
  refreshBookcases();
}

/* ---------- tło ---------- */
function drawBackground() {
  return makeArt(WORLD_W, WORLD_H, (g) => {
    const R = rng(7);
    const TH = theme();
    // podłoga
    for (let ty = 2; ty < 12; ty++)
      for (let tx = 1; tx < 19; tx++) {
        const cust = ty < 4 && tx < 9;
        g.fillStyle = (tx + ty) % 2 ? (cust ? TH.custA : TH.floorA) : cust ? TH.custB : TH.floorB;
        g.fillRect(tx * T, ty * T, T, T);
        g.fillStyle = TH.grout;
        g.fillRect(tx * T, ty * T, T, 1.5);
        g.fillRect(tx * T, ty * T, 1.5, T);
      }
    if (TH.tatami) drawTatami(g);

    // dywan przed ladą
    rr(g, 2 * T - 6, 6 * T + 4, 5 * T + 12, 2 * T + 8, 14);
    fs(g, TH.rug[0], 3);
    rr(g, 2 * T + 4, 6 * T + 14, 5 * T - 8, 2 * T - 12, 9);
    fs(g, TH.rug[1], 2);
    for (let x = 2 * T + 30; x < 7 * T - 10; x += 36) {
      g.beginPath();
      const cy = 7 * T + 8;
      g.moveTo(x, cy - 12);
      g.lineTo(x + 10, cy);
      g.lineTo(x, cy + 12);
      g.lineTo(x - 10, cy);
      g.closePath();
      fs(g, TH.rug[2], 2);
    }
    // okrągły dywan w kąciku czytelniczym
    ell(g, 16.4 * T, 10.6 * T, 2.4 * T, 1.25 * T);
    fs(g, TH.round[0], 3);
    ell(g, 16.4 * T, 10.6 * T, 1.75 * T, 0.85 * T);
    fs(g, TH.round[1], 2);
    ell(g, 16.4 * T, 10.6 * T, 1.05 * T, 0.48 * T);
    fs(g, TH.round[0], 2);

    // ściana tylna
    g.fillStyle = TH.wall;
    g.fillRect(0, 0, WORLD_W, 2 * T);
    for (let x = 0; x < WORLD_W; x += 24) {
      g.fillStyle = TH.wallStripe;
      g.fillRect(x, 10, 10, 2 * T - 40);
    }
    if (TH.shoji) {
      // drewniana kratka ścianek shōji
      g.fillStyle = 'rgba(160,110,70,0.55)';
      for (let x = 0; x < WORLD_W; x += 20) g.fillRect(x, 8, 2, 2 * T - 40);
      for (let yy = 8; yy < 2 * T - 32; yy += 15) g.fillRect(0, yy, WORLD_W, 2);
      g.fillStyle = TH.wood;
      for (let x = 0; x < WORLD_W; x += 120) g.fillRect(x, 8, 5, 2 * T - 40);
    }
    g.fillStyle = TH.wood;
    g.fillRect(0, 0, WORLD_W, 8);
    g.fillStyle = TH.wainscot;
    g.fillRect(0, 2 * T - 30, WORLD_W, 30);
    g.fillStyle = TH.wood;
    g.fillRect(0, 2 * T - 32, WORLD_W, 4);
    for (let x = 6; x < WORLD_W; x += 48) {
      rr(g, x, 2 * T - 24, 36, 18, 4);
      g.fillStyle = TH.panel;
      g.fill();
    }
    g.fillStyle = 'rgba(107,74,58,0.18)';
    g.fillRect(T, 2 * T, 18 * T, 6);

    // okna z widokiem na las
    for (const w of WINDOWS) drawWindow(g, w, R);

    // drzwi – otwór (wnętrze widać po otwarciu)
    rr(g, T + 2, 16, T - 4, 2 * T - 16, [20, 20, 0, 0]);
    fs(g, '#fff0c8', 3);
    g.fillStyle = TH.outside;
    g.fillRect(T + 4, 2 * T - 22, T - 8, 21);
    // wycieraczka
    rr(g, T + 4, 2 * T + 6, T - 8, 16, 5);
    fs(g, '#e9a07a', 2);

    // zegar
    ell(g, 10.5 * T, 34, 17, 17);
    fs(g, '#fff6e8', 3);
    g.beginPath();
    g.moveTo(10.5 * T, 34);
    g.lineTo(10.5 * T, 22);
    g.moveTo(10.5 * T, 34);
    g.lineTo(10.5 * T + 9, 38);
    g.lineWidth = 2.5;
    g.strokeStyle = OL;
    g.stroke();
    // obrazek z lasem
    rr(g, 14 * T + 4, 18, 40, 32, 5);
    fs(g, '#e8b878', 3);
    rr(g, 14 * T + 9, 23, 30, 22, 3);
    fs(g, TH.painting === 'fuji' ? '#f7e6d0' : '#bfe3f0', 1.5);
    if (TH.painting === 'fuji') {
      ell(g, 14 * T + 32, 30, 4, 4);
      g.fillStyle = '#e0504a';
      g.fill();
      tri(g, [14 * T + 11, 45], [14 * T + 24, 28], [14 * T + 37, 45]);
      g.fillStyle = '#6f88b0';
      g.fill();
      tri(g, [14 * T + 20, 33], [14 * T + 24, 28], [14 * T + 28, 33]);
      g.fillStyle = '#ffffff';
      g.fill();
    } else {
      tri(g, [14 * T + 14, 45], [14 * T + 21, 30], [14 * T + 28, 45]);
      g.fillStyle = '#6fae5f';
      g.fill();
      tri(g, [14 * T + 22, 45], [14 * T + 30, 27], [14 * T + 38, 45]);
      g.fillStyle = '#5f9d55';
      g.fill();
    }

    // ściany boczne i dolna
    g.fillStyle = TH.wood;
    g.fillRect(0, 0, T - 8, WORLD_H);
    g.fillRect(19 * T + 8, 0, T - 8, WORLD_H);
    g.fillRect(0, 12 * T + 8, WORLD_W, T - 8);
    g.fillStyle = TH.wainscot;
    g.fillRect(T - 8, 2 * T, 8, 10 * T + 8);
    g.fillRect(19 * T, 2 * T, 8, 10 * T + 8);
    g.fillRect(T - 8, 12 * T, 18 * T + 16, 8);
    g.fillStyle = 'rgba(107,74,58,0.25)';
    g.fillRect(T, 2 * T, 4, 10 * T);
    g.fillRect(19 * T - 4, 2 * T, 4, 10 * T);

    // barierka (kolumna 9)
    const rx = 9 * T + 16;
    rr(g, rx, 2 * T - 10, 14, 3 * T + 6, 6);
    fs(g, '#d9915a', 3);
    for (let y = 2 * T; y < 5 * T; y += T) {
      ell(g, rx + 7, y + 8, 10, 10);
      fs(g, '#f0b77f', 2.5);
    }

    // miejsca na przyszłe szafy
    for (let i = 1; i < BOOKCASE_SPOTS.length; i++) {
      const s = BOOKCASE_SPOTS[i];
      g.setLineDash([6, 6]);
      rr(g, s.tx * T + 4, s.ty * T + 4, 3 * T - 8, T - 8, 8);
      g.lineWidth = 2;
      g.strokeStyle = 'rgba(185,120,74,0.45)';
      g.stroke();
      g.setLineDash([]);
    }
  });
}

function drawWindow(g, w, R) {
  rr(g, w.x - 6, w.y - 6, w.w + 12, w.h + 12, 12);
  fs(g, '#fff4e2', 3);
  rr(g, w.x, w.y, w.w, w.h, 7);
  const TH = theme();
  const sakura = TH.window === 'sakura';
  const grd = g.createLinearGradient(0, w.y, 0, w.y + w.h);
  grd.addColorStop(0, sakura ? '#bfe0f2' : '#a9dcf0');
  grd.addColorStop(1, sakura ? '#fde8ee' : '#e2f4f8');
  g.fillStyle = grd;
  g.fill();
  g.save();
  rr(g, w.x, w.y, w.w, w.h, 7);
  g.clip();
  ell(g, w.x + 18, w.y + 14, 10, 5);
  g.fillStyle = '#fff';
  g.fill();
  ell(g, w.x + 26, w.y + 12, 8, 6);
  g.fill();
  if (sakura) {
    // góra Fuji i kwitnące wiśnie
    tri(g, [w.x - 6, w.y + w.h - 10], [w.x + w.w / 2, w.y + 14], [w.x + w.w + 6, w.y + w.h - 10]);
    g.fillStyle = '#7d93ba';
    g.fill();
    tri(g, [w.x + w.w / 2 - 9, w.y + 24], [w.x + w.w / 2, w.y + 14], [w.x + w.w / 2 + 9, w.y + 24]);
    g.fillStyle = '#ffffff';
    g.fill();
    g.fillStyle = '#b9d79a';
    g.fillRect(w.x, w.y + w.h - 12, w.w, 12);
    for (let i = 0; i < 9; i++) {
      ell(g, w.x + (i % 2 ? w.w - 8 : 8) + (R() - 0.5) * 14, w.y + w.h - 18 + (R() - 0.5) * 16, 6 + R() * 3, 5 + R() * 3);
      g.fillStyle = i % 3 ? '#f6b6c8' : '#f9cfdb';
      g.fill();
    }
  } else {
    g.fillStyle = '#9fd08a';
    g.fillRect(w.x, w.y + w.h - 14, w.w, 14);
    for (let i = 0; i < 4; i++) {
      const tx = w.x + 6 + i * 20 + R() * 6;
      const h = 22 + R() * 14;
      tri(g, [tx - 10, w.y + w.h - 8], [tx, w.y + w.h - 8 - h], [tx + 10, w.y + w.h - 8]);
      g.fillStyle = i % 2 ? '#5f9d55' : '#4f8a4a';
      g.fill();
    }
  }
  g.restore();
  rr(g, w.x, w.y, w.w, w.h, 7);
  g.lineWidth = 2.5;
  g.strokeStyle = OL;
  g.stroke();
  g.fillStyle = '#fff4e2';
  g.fillRect(w.x + w.w / 2 - 2.5, w.y, 5, w.h);
  g.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
  // zasłonki
  for (const side of [-1, 1]) {
    const cx = side < 0 ? w.x - 4 : w.x + w.w + 4;
    g.beginPath();
    g.moveTo(cx - 8, w.y - 8);
    g.quadraticCurveTo(cx + side * -2, w.y + w.h / 2, cx - side * 2, w.y + w.h + 8);
    g.lineTo(cx + 8 * side * -1 + (side > 0 ? 16 : 0), w.y + w.h + 8);
    g.lineTo(cx + 8, w.y - 8);
    g.closePath();
    fs(g, TH.curtain, 2.5);
  }
  // parapet
  rr(g, w.x - 10, w.y + w.h + 4, w.w + 20, 8, 4);
  fs(g, '#e8b878', 2.5);
}

// Maty tatami: prostokąty 2×1 z ciemnym obszyciem na dłuższych bokach
function drawTatami(g) {
  g.save();
  g.beginPath();
  g.rect(T, 2 * T, 18 * T, 10 * T);
  g.rect(T, 2 * T, 8 * T, 2 * T); // bez strefy klientów
  g.clip('evenodd');
  for (let ty = 2; ty < 12; ty++) {
    const off = ty % 2 ? T : 0;
    for (let x = T - off; x < 19 * T; x += 2 * T) {
      g.fillStyle = '#e3dca8';
      g.fillRect(x, ty * T, 2 * T, T);
      g.fillStyle = 'rgba(160,150,90,0.25)';
      for (let yy = ty * T + 3; yy < ty * T + T; yy += 4) g.fillRect(x, yy, 2 * T, 1);
      g.fillStyle = '#4f6b45';
      g.fillRect(x, ty * T, 2 * T, 3.5);
      g.fillRect(x, ty * T + T - 3.5, 2 * T, 3.5);
      g.fillStyle = 'rgba(80,90,50,0.45)';
      g.fillRect(x, ty * T, 1.5, T);
    }
  }
  g.restore();
}
