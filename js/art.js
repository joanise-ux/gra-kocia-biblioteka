'use strict';
/* =========================================================
   Grafika w miękkim, „wektorowym” stylu – rysowana ścieżkami canvas.
   Postacie rysujemy na żywo, meble i tło trzymamy w cache.
   ========================================================= */

const OL = '#6b4a3a'; // ciepły brązowy kontur
const INK = '#4a3330';
let RES = 2; // rozdzielczość cache (ustawiana według skali ekranu)

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeArt(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  const g = c.getContext('2d');
  g.scale(RES, RES);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  draw(g);
  return { img: c, w, h };
}

function blit(ctx, art, x, y) {
  ctx.drawImage(art.img, Math.round(x), Math.round(y), art.w, art.h);
}

/* ---------- prymitywy ---------- */
function ell(g, x, y, rx, ry, rot = 0) {
  g.beginPath();
  g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}
function fs(g, fill, lw = 2.5) {
  g.fillStyle = fill;
  g.fill();
  g.lineWidth = lw;
  g.strokeStyle = OL;
  g.stroke();
}
// Kształt z łatkami (np. futro kotka): bazowy kolor + plamy przycięte do kształtu
function patched(g, path, base, patches, lw = 2.5) {
  path();
  g.fillStyle = base;
  g.fill();
  g.save();
  path();
  g.clip();
  for (const [x, y, rx, ry, col] of patches) {
    ell(g, x, y, rx, ry);
    g.fillStyle = col;
    g.fill();
  }
  g.restore();
  path();
  g.lineWidth = lw;
  g.strokeStyle = OL;
  g.stroke();
}
function thickCurve(g, pts, color, w) {
  const draw = () => {
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 4) g.bezierCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1], pts[3][0], pts[3][1]);
    else g.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
  };
  draw();
  g.lineWidth = w + 5;
  g.strokeStyle = OL;
  g.stroke();
  draw();
  g.lineWidth = w;
  g.strokeStyle = color;
  g.stroke();
}
function tri(g, a, b, c) {
  g.beginPath();
  g.moveTo(a[0], a[1]);
  g.lineTo(b[0], b[1]);
  g.lineTo(c[0], c[1]);
  g.closePath();
}

/* ---------- ikonki ---------- */
function drawHeart(g, x, y, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.beginPath();
  g.moveTo(0, 5);
  g.bezierCurveTo(-9, -1, -6, -9, 0, -4);
  g.bezierCurveTo(6, -9, 9, -1, 0, 5);
  g.closePath();
  fs(g, '#f27a94', 2);
  ell(g, -3, -3, 1.6, 1.2);
  g.fillStyle = '#ffd0da';
  g.fill();
  g.restore();
}
function drawCoin(g, x, y, r = 7) {
  ell(g, x, y, r, r);
  fs(g, '#f4c542', 2);
  ell(g, x, y, r * 0.55, r * 0.55);
  g.lineWidth = 1.5;
  g.strokeStyle = '#d49a1f';
  g.stroke();
  ell(g, x - r * 0.35, y - r * 0.35, r * 0.2, r * 0.2);
  g.fillStyle = '#fff4b8';
  g.fill();
}
// Ikonka wypożyczenia: niebieskie kółko ze strzałką „wróci”
function drawBorrow(g, x, y, r = 7) {
  ell(g, x, y, r, r);
  fs(g, '#cfe6f7', 2);
  g.beginPath();
  g.arc(x, y, r * 0.5, Math.PI * 0.15, Math.PI * 1.55);
  g.lineWidth = 2;
  g.strokeStyle = '#3f78a8';
  g.stroke();
  const ax = x + Math.cos(Math.PI * 1.55) * r * 0.5, ay = y + Math.sin(Math.PI * 1.55) * r * 0.5;
  tri(g, [ax - 1, ay - 3], [ax + 3.5, ay], [ax - 1, ay + 3]);
  g.fillStyle = '#3f78a8';
  g.fill();
}

function drawClock(g, x, y, r = 7) {
  ell(g, x, y, r, r);
  fs(g, '#e6f1ff', 2);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y - r * 0.6);
  g.moveTo(x, y);
  g.lineTo(x + r * 0.45, y + r * 0.2);
  g.lineWidth = 1.8;
  g.strokeStyle = OL;
  g.stroke();
}
function drawBookIcon(g, x, y, color, s = 1) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  rr(g, -7, -9, 14, 18, 2.5);
  fs(g, color, 2);
  g.fillStyle = '#fff6e8';
  g.fillRect(-4.5, 5, 10, 2.5);
  g.fillStyle = shade(color, 0.4);
  g.fillRect(-6, -8, 2, 13);
  rr(g, -2, -4, 6, 3, 1);
  g.fillStyle = shade(color, 0.6);
  g.fill();
  g.restore();
}

/* =========================================================
   KOTEK TRZYKOLOROWY (biały z rudymi i czarnymi łatkami)
   ========================================================= */
const CAT_W = '#fffaf2';
const CAT_O = '#f0a04b';
const CAT_B = '#3d3434';
const CAT_PINK = '#f6a8b0';

function catEars(g, x, y, side = false) {
  if (side) {
    tri(g, [x - 6, y - 50], [x - 2, y - 66], [x + 6, y - 52]);
    fs(g, CAT_B);
    tri(g, [x + 4, y - 51], [x + 10, y - 66], [x + 17, y - 49]);
    fs(g, CAT_O);
    tri(g, [x + 8, y - 52], [x + 10, y - 61], [x + 14, y - 51]);
    g.fillStyle = CAT_PINK;
    g.fill();
    return;
  }
  tri(g, [x - 18, y - 46], [x - 15, y - 66], [x - 3, y - 55]);
  fs(g, CAT_B);
  tri(g, [x + 18, y - 46], [x + 15, y - 66], [x + 3, y - 55]);
  fs(g, CAT_O);
  tri(g, [x - 14, y - 50], [x - 13, y - 61], [x - 7, y - 55]);
  g.fillStyle = '#7a5a5a';
  g.fill();
  tri(g, [x + 14, y - 50], [x + 13, y - 61], [x + 7, y - 55]);
  g.fillStyle = CAT_PINK;
  g.fill();
}

function catHead(g, x, y) {
  patched(g, () => ell(g, x, y - 40, 21, 17.5), CAT_W, [
    [x - 14, y - 52, 13, 11, CAT_B],
    [x + 15, y - 49, 12, 11, CAT_O],
  ]);
}

function catFace(g, x, y, blink, happy, look) {
  const ey = y - 40 + (look ? look.y : 0);
  const lx = look ? look.x : 0;
  if (blink || happy) {
    g.beginPath();
    g.arc(x - 8, ey + 1, 3, Math.PI * 1.1, Math.PI * 1.9);
    g.moveTo(x + 11, ey);
    g.arc(x + 8, ey + 1, 3, Math.PI * 1.1, Math.PI * 1.9);
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
  } else {
    for (const sx of [-8, 8]) {
      ell(g, x + sx + lx, ey, 3, 3.8);
      g.fillStyle = INK;
      g.fill();
      ell(g, x + sx + lx + 1, ey - 1.4, 1.2, 1.2);
      g.fillStyle = '#fff';
      g.fill();
    }
  }
  // policzki
  g.globalAlpha = 0.7;
  ell(g, x - 13, y - 33, 4, 2.4);
  g.fillStyle = CAT_PINK;
  g.fill();
  ell(g, x + 13, y - 33, 4, 2.4);
  g.fill();
  g.globalAlpha = 1;
  // nosek i pyszczek
  tri(g, [x - 2.2, y - 35], [x + 2.2, y - 35], [x, y - 33]);
  g.fillStyle = '#e88a98';
  g.fill();
  g.beginPath();
  g.arc(x - 2, y - 32.5, 2, 0, Math.PI);
  g.arc(x + 2, y - 32.5, 2, 0, Math.PI);
  g.lineWidth = 1.4;
  g.strokeStyle = INK;
  g.stroke();
  // wąsy
  g.beginPath();
  g.moveTo(x - 11, y - 35);
  g.lineTo(x - 24, y - 37);
  g.moveTo(x - 11, y - 33);
  g.lineTo(x - 24, y - 31);
  g.moveTo(x + 11, y - 35);
  g.lineTo(x + 24, y - 37);
  g.moveTo(x + 11, y - 33);
  g.lineTo(x + 24, y - 31);
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(74,51,48,0.55)';
  g.stroke();
}

function shadow(g, x, y, rx = 20) {
  ell(g, x, y, rx, 5);
  g.fillStyle = 'rgba(107,74,58,0.18)';
  g.fill();
}

function drawCat(g, x, y, o) {
  shadow(g, x, y);
  if (o.pose === 'sleep') return catSleep(g, x, y, o);
  if (o.pose === 'sit') return catSit(g, x, y, o);
  const bob = o.moving ? -Math.abs(Math.sin(o.phase * Math.PI)) * 3 : Math.sin(o.t * 2) * 0.6;
  const step = o.moving ? Math.sin(o.phase * Math.PI) : 0;
  y += bob;
  if (o.dir === 'left' || o.dir === 'right') {
    g.save();
    if (o.dir === 'left') {
      g.translate(x, 0);
      g.scale(-1, 1);
      g.translate(-x, 0);
    }
    catSide(g, x, y, step, o);
    g.restore();
    return;
  }
  if (o.dir === 'up') return catBack(g, x, y, step, o);
  catFront(g, x, y, step, o);
}

function catFront(g, x, y, step, o) {
  thickCurve(g, [[x + 12, y - 12], [x + 34, y - 14], [x + 30, y - 40], [x + 22, y - 40]], CAT_O, 6);
  ell(g, x + 22, y - 40, 3.5, 3.5);
  g.fillStyle = CAT_B;
  g.fill();
  patched(g, () => ell(g, x, y - 17, 19, 15), CAT_W, [
    [x - 15, y - 24, 11, 9, CAT_O],
    [x + 15, y - 10, 9, 8, CAT_B],
  ]);
  ell(g, x - 9, y - 3 - Math.max(0, step) * 4, 7, 5);
  fs(g, CAT_W);
  ell(g, x + 9, y - 3 - Math.max(0, -step) * 4, 7, 5);
  fs(g, CAT_W);
  catEars(g, x, y);
  catHead(g, x, y);
  catFace(g, x, y, o.blink, o.happy);
}

function catBack(g, x, y, step, o) {
  ell(g, x - 9, y - 3 - Math.max(0, step) * 4, 7, 5);
  fs(g, CAT_W);
  ell(g, x + 9, y - 3 - Math.max(0, -step) * 4, 7, 5);
  fs(g, CAT_W);
  patched(g, () => ell(g, x, y - 17, 19, 15), CAT_W, [
    [x - 8, y - 22, 14, 10, CAT_O],
    [x + 14, y - 14, 10, 9, CAT_B],
  ]);
  catEars(g, x, y);
  patched(g, () => ell(g, x, y - 40, 21, 17.5), CAT_W, [
    [x - 12, y - 46, 15, 14, CAT_B],
    [x + 13, y - 44, 13, 14, CAT_O],
  ]);
  // ogonek z przodu (od tyłu kota)
  thickCurve(g, [[x + 2, y - 8], [x + 6, y + 2], [x + 22, y + 2], [x + 24, y - 14]], CAT_O, 6);
  ell(g, x + 24, y - 14, 3.5, 3.5);
  g.fillStyle = CAT_B;
  g.fill();
}

function catSide(g, x, y, step, o) {
  thickCurve(g, [[x - 16, y - 18], [x - 34, y - 20], [x - 32, y - 44], [x - 24, y - 46]], CAT_O, 6);
  ell(g, x - 24, y - 46, 3.5, 3.5);
  g.fillStyle = CAT_B;
  g.fill();
  // nogi dalsze
  ell(g, x - 12 - step * 4, y - 3, 6, 4.5);
  fs(g, shade(CAT_W, -0.08));
  ell(g, x + 9 + step * 4, y - 3, 6, 4.5);
  fs(g, shade(CAT_W, -0.08));
  patched(g, () => ell(g, x - 2, y - 17, 22, 14), CAT_W, [
    [x - 14, y - 24, 13, 10, CAT_O],
    [x + 4, y - 26, 8, 6, CAT_B],
  ]);
  // nogi bliższe
  ell(g, x - 8 + step * 4, y - 3, 6, 4.5);
  fs(g, CAT_W);
  ell(g, x + 13 - step * 4, y - 3, 6, 4.5);
  fs(g, CAT_W);
  const hx = x + 12;
  catEars(g, hx, y, true);
  patched(g, () => ell(g, hx, y - 39, 17, 16), CAT_W, [
    [hx - 9, y - 50, 12, 10, CAT_B],
    [hx + 8, y - 51, 9, 7, CAT_O],
  ]);
  if (o.blink) {
    g.beginPath();
    g.arc(hx + 7, y - 39, 3, Math.PI * 1.1, Math.PI * 1.9);
    g.lineWidth = 2;
    g.strokeStyle = INK;
    g.stroke();
  } else {
    ell(g, hx + 7, y - 40, 2.8, 3.6);
    g.fillStyle = INK;
    g.fill();
    ell(g, hx + 8, y - 41.4, 1.1, 1.1);
    g.fillStyle = '#fff';
    g.fill();
  }
  g.globalAlpha = 0.7;
  ell(g, hx + 6, y - 32, 3.5, 2.2);
  g.fillStyle = CAT_PINK;
  g.fill();
  g.globalAlpha = 1;
  ell(g, hx + 16, y - 35, 2, 1.6);
  g.fillStyle = '#e88a98';
  g.fill();
  g.beginPath();
  g.moveTo(hx + 12, y - 33);
  g.lineTo(hx + 26, y - 35);
  g.moveTo(hx + 12, y - 31);
  g.lineTo(hx + 26, y - 29);
  g.lineWidth = 1;
  g.strokeStyle = 'rgba(74,51,48,0.55)';
  g.stroke();
}

function catSit(g, x, y, o) {
  patched(g, () => ell(g, x, y - 18, 18, 18), CAT_W, [
    [x - 15, y - 26, 11, 10, CAT_O],
    [x + 15, y - 12, 10, 9, CAT_B],
  ]);
  ell(g, x - 7, y - 3, 6.5, 4.5);
  fs(g, CAT_W);
  ell(g, x + 7, y - 3, 6.5, 4.5);
  fs(g, CAT_W);
  thickCurve(g, [[x + 16, y - 6], [x + 10, y + 4], [x - 16, y + 3], [x - 20, y - 4]], CAT_O, 6);
  ell(g, x - 20, y - 4, 3.5, 3.5);
  g.fillStyle = CAT_B;
  g.fill();
  catEars(g, x, y + 2);
  catHead(g, x, y + 2);
  catFace(g, x, y + 2, o.blink || o.purr, o.happy, o.look);
}

function catSleep(g, x, y, o) {
  const br = Math.sin(o.t * 2) * 0.8;
  patched(g, () => ell(g, x, y - 13, 25, 13 + br), CAT_W, [
    [x - 14, y - 19, 14, 10, CAT_O],
    [x + 6, y - 22, 9, 7, CAT_B],
  ]);
  const hx = x + 10, hy = y - 22;
  tri(g, [hx - 13, hy - 6], [hx - 11, hy - 22], [hx - 2, hy - 12]);
  fs(g, CAT_B);
  tri(g, [hx + 13, hy - 6], [hx + 11, hy - 22], [hx + 2, hy - 12]);
  fs(g, CAT_O);
  patched(g, () => ell(g, hx, hy, 16, 13), CAT_W, [
    [hx - 10, hy - 9, 10, 8, CAT_B],
    [hx + 11, hy - 7, 8, 8, CAT_O],
  ]);
  g.beginPath();
  g.arc(hx - 6, hy, 3, Math.PI * 0.1, Math.PI * 0.9);
  g.moveTo(hx + 9, hy);
  g.arc(hx + 6, hy, 3, Math.PI * 0.1, Math.PI * 0.9);
  g.lineWidth = 2;
  g.strokeStyle = INK;
  g.stroke();
  ell(g, hx, hy + 5, 1.6, 1.2);
  g.fillStyle = '#e88a98';
  g.fill();
  thickCurve(g, [[x - 22, y - 8], [x - 22, y + 3], [x + 6, y + 4], [x + 14, y - 2]], CAT_O, 6);
  ell(g, x + 14, y - 2, 3.5, 3.5);
  g.fillStyle = CAT_B;
  g.fill();
}

/* =========================================================
   ZWIERZĄTKA – KLIENCI (widok z przodu)
   ========================================================= */
function drawCritter(g, x, y, species, scarf, o = {}) {
  const sp = SPECIES[species];
  shadow(g, x, y, 19);
  y += o.bob || 0;

  // elementy za ciałem
  if (species === 'fox') {
    g.save();
    ell(g, x + 20, y - 18, 9, 17, -0.6);
    fs(g, sp.b);
    ell(g, x + 27, y - 30, 5, 6, -0.6);
    g.fillStyle = sp.l;
    g.fill();
    g.restore();
  }
  if (species === 'hedgehog') {
    g.beginPath();
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = i % 2 ? 0.78 : 1;
      const px = x + Math.cos(a) * 27 * r, py = y - 32 + Math.sin(a) * 30 * r;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
    fs(g, '#8a6448');
  }
  if (species === 'rabbit') {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 8, y - 66, 6.5, 17, sx * 0.12);
      fs(g, sp.b);
      ell(g, x + sx * 8, y - 64, 3, 12, sx * 0.12);
      g.fillStyle = '#f6b6c4';
      g.fill();
    }
  }
  // puszyste ogony w paski (tanuki, panda ruda)
  if (species === 'tanuki' || species === 'redpanda') {
    const stripe = species === 'tanuki' ? '#54443a' : '#7a2f18';
    const tail = () => ell(g, x + 21, y - 16, 9, 18, -0.6);
    tail();
    g.fillStyle = sp.b;
    g.fill();
    g.save();
    tail();
    g.clip();
    g.translate(x + 21, y - 16);
    g.rotate(-0.6);
    g.fillStyle = stripe;
    g.fillRect(-12, -9, 24, 4.5);
    g.fillRect(-12, 1, 24, 4.5);
    g.fillRect(-12, 11, 24, 6);
    g.restore();
    tail();
    g.lineWidth = 2.5;
    g.strokeStyle = OL;
    g.stroke();
  }
  if (species === 'shiba') {
    thickCurve(g, [[x + 13, y - 14], [x + 32, y - 12], [x + 32, y - 36], [x + 19, y - 32]], sp.b, 7);
    ell(g, x + 21, y - 33, 3.5, 3);
    g.fillStyle = sp.l;
    g.fill();
  }
  if (species === 'crane') {
    // czarne lotki z tyłu
    ell(g, x, y - 10, 23, 9);
    fs(g, sp.d);
  }
  if (species === 'macaque') {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 20, y - 41, 5, 6);
      fs(g, sp.l);
    }
  }
  if (species === 'bear' || species === 'tanuki') {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 15, y - 54, 7.5, 7.5);
      fs(g, species === 'tanuki' ? sp.d : sp.b);
      ell(g, x + sx * 15, y - 54, 4, 4);
      g.fillStyle = sp.l;
      g.fill();
    }
  }
  if (species === 'fox' || species === 'shiba' || species === 'redpanda') {
    const outer = species === 'redpanda' ? sp.l : sp.b;
    const inner = species === 'fox' ? sp.d : species === 'shiba' ? '#f6c9a0' : sp.b;
    for (const sx of [-1, 1]) {
      tri(g, [x + sx * 19, y - 46], [x + sx * 16, y - 66], [x + sx * 4, y - 56]);
      fs(g, outer);
      tri(g, [x + sx * 15, y - 50], [x + sx * 15, y - 61], [x + sx * 8, y - 56]);
      g.fillStyle = inner;
      g.fill();
    }
  }
  if (species === 'owl') {
    for (const sx of [-1, 1]) {
      tri(g, [x + sx * 18, y - 48], [x + sx * 18, y - 64], [x + sx * 8, y - 54]);
      fs(g, sp.d);
    }
  }

  // nóżki
  const step = o.moving ? Math.sin(o.phase * Math.PI) : 0;
  ell(g, x - 8, y - 3 - Math.max(0, step) * 3, 7, 4.5);
  fs(g, sp.d);
  ell(g, x + 8, y - 3 - Math.max(0, -step) * 3, 7, 4.5);
  fs(g, sp.d);
  // ciało
  ell(g, x, y - 18, 18, 16);
  fs(g, sp.b);
  ell(g, x, y - 15, 11, 10);
  g.fillStyle = sp.l;
  g.fill();
  // łapki / skrzydła
  if (species === 'owl' || species === 'crane') {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 16, y - 18, 6, 11, sx * 0.25);
      fs(g, sp.wing || sp.d);
    }
  } else {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 15, y - 19 + (o.wave && sx > 0 ? -8 : 0), 5, 6.5);
      fs(g, sp.b);
    }
  }
  // szalik
  rr(g, x - 16, y - 31, 32, 8, 4);
  fs(g, scarf, 2);
  rr(g, x + 3, y - 27, 7, 14, 3);
  fs(g, scarf, 2);
  // głowa
  ell(g, x, y - 41, 20, 17);
  fs(g, sp.b);
  if (species === 'owl') {
    ell(g, x, y - 38, 15, 12);
    g.fillStyle = sp.l;
    g.fill();
  } else if (species === 'macaque') {
    ell(g, x, y - 38, 14.5, 12);
    g.fillStyle = sp.l;
    g.fill();
  } else if (species === 'crane') {
    // czerwona czapeczka
    ell(g, x, y - 55, 7, 3.6);
    fs(g, '#d9363e', 1.5);
  } else if (species !== 'rabbit') {
    ell(g, x, y - 34, species === 'shiba' || species === 'redpanda' ? 13 : 10, species === 'shiba' || species === 'redpanda' ? 8 : 7);
    g.fillStyle = sp.l;
    g.fill();
  }
  if (species === 'redpanda' || species === 'shiba') {
    // jasne „brwi”
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 8, y - 49, species === 'shiba' ? 2.4 : 4, species === 'shiba' ? 1.8 : 2.6);
      g.fillStyle = sp.l;
      g.fill();
    }
  }
  if (species === 'tanuki') {
    // ciemna maska wokół oczu
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 8, y - 41, 7.5, 5.5, sx * 0.35);
      g.fillStyle = sp.d;
      g.fill();
    }
  }
  // oczy
  const ey = y - 42;
  if (species === 'owl') {
    for (const sx of [-1, 1]) {
      ell(g, x + sx * 7.5, ey, 6, 6);
      fs(g, '#fffdf6', 1.8);
      if (o.happy) {
        g.beginPath();
        g.arc(x + sx * 7.5, ey + 1, 3, Math.PI * 1.1, Math.PI * 1.9);
        g.lineWidth = 2;
        g.strokeStyle = INK;
        g.stroke();
      } else {
        ell(g, x + sx * 7.5, ey, 3, 3.3);
        g.fillStyle = INK;
        g.fill();
      }
    }
    tri(g, [x - 3, y - 36], [x + 3, y - 36], [x, y - 31]);
    fs(g, sp.n, 1.5);
  } else {
    const onDark = species === 'tanuki';
    for (const sx of [-1, 1]) {
      if (o.happy) {
        g.beginPath();
        g.arc(x + sx * 7.5, ey + 1, 3, Math.PI * 1.1, Math.PI * 1.9);
        g.lineWidth = 2;
        g.strokeStyle = onDark ? '#fff6e8' : INK;
        g.stroke();
      } else {
        if (onDark) {
          ell(g, x + sx * 7.5, ey, 3.8, 4.4);
          g.fillStyle = '#fff6e8';
          g.fill();
        }
        ell(g, x + sx * 7.5, ey, 2.7, 3.4);
        g.fillStyle = INK;
        g.fill();
        ell(g, x + sx * 7.5 + 1, ey - 1.2, 1, 1);
        g.fillStyle = '#fff';
        g.fill();
      }
    }
    if (species === 'crane') {
      tri(g, [x - 3.5, y - 37], [x + 3.5, y - 37], [x, y - 24]);
      fs(g, sp.n, 1.5);
    } else {
      ell(g, x, y - 36, 3, 2.2);
      g.fillStyle = sp.n;
      g.fill();
      g.beginPath();
      g.arc(x - 1.8, y - 33, 1.8, 0, Math.PI);
      g.arc(x + 1.8, y - 33, 1.8, 0, Math.PI);
      g.lineWidth = 1.3;
      g.strokeStyle = INK;
      g.stroke();
    }
  }
  g.globalAlpha = 0.6;
  ell(g, x - 13, y - 35, 3.6, 2.2);
  g.fillStyle = '#f6a8b0';
  g.fill();
  ell(g, x + 13, y - 35, 3.6, 2.2);
  g.fill();
  g.globalAlpha = 1;
}

/* =========================================================
   MEBLE (cache)
   ========================================================= */
const BOOKCASE_W = 3 * T;
const BOOKCASE_H = 142;

// shelves: tablica 5 elementów: { cat, count } albo null (pusta półka)
function makeBookcaseArt(shelves, seed) {
  return makeArt(BOOKCASE_W, BOOKCASE_H, (g) => {
    const R = rng(seed);
    rr(g, 3, 8, BOOKCASE_W - 6, BOOKCASE_H - 12, 8);
    fs(g, '#c58552', 3);
    rr(g, 0, 2, BOOKCASE_W, 16, 7);
    fs(g, '#a96a3f', 3);
    g.fillStyle = 'rgba(255,230,190,0.35)';
    g.fillRect(8, 5, BOOKCASE_W - 16, 3);
    rr(g, 11, 22, BOOKCASE_W - 22, 104, 4);
    fs(g, '#7d4a2e', 2);
    const rowH = 104 / SHELVES_PER_CASE;
    for (let i = 0; i < SHELVES_PER_CASE; i++) {
      const top = 22 + i * rowH;
      const bottom = top + rowH - 3;
      const sh = shelves[i];
      if (sh) {
        const col = CATEGORIES[sh.cat].color;
        const visible = Math.round((10 * sh.count) / BOOKS_PER_SHELF);
        let bx = 44;
        for (let b = 0; b < 10; b++) {
          const w = 7 + Math.floor(R() * 3);
          const h = rowH - 6 - Math.floor(R() * 4);
          if (b < visible) {
            const c = R() < 0.15 ? '#f2e6cf' : shade(col, R() * 0.4 - 0.2);
            rr(g, bx, bottom - h, w, h, 1.5);
            fs(g, c, 1.3);
            g.fillStyle = shade(c, 0.45);
            g.fillRect(bx + 1.5, bottom - h + 3, w - 3, 1.5);
          }
          bx += w + 1;
          if (bx > BOOKCASE_W - 20) break;
        }
        // tabliczka z nazwą kategorii
        rr(g, 14, top + 3, 28, rowH - 8, 3);
        fs(g, sh.count ? col : shade(col, 0.5), 1.5);
        g.fillStyle = '#fffaf0';
        g.font = '600 6.4px Fredoka, "Pixelify Sans", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const label = CATEGORIES[sh.cat].name;
        g.fillText(label.length > 8 ? label.slice(0, 7) + '.' : label, 28, top + rowH / 2 - 1.5);
      } else {
        // pusta półka – miejsce na nową kategorię
        g.fillStyle = 'rgba(255,240,220,0.18)';
        g.font = '500 6.5px Fredoka, sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('wolna półka', BOOKCASE_W / 2, top + rowH / 2 - 1.5);
      }
      rr(g, 9, bottom, BOOKCASE_W - 18, 4.5, 2);
      fs(g, '#e0a46c', 1.5);
    }
    rr(g, 10, BOOKCASE_H - 9, 10, 8, 2);
    fs(g, '#8a5434', 2);
    rr(g, BOOKCASE_W - 20, BOOKCASE_H - 9, 10, 8, 2);
    fs(g, '#8a5434', 2);
  });
}

function makePlantArt(seed, big = false) {
  const w = 44, h = big ? 70 : 58;
  return makeArt(w, h, (g) => {
    const R = rng(seed);
    const leaves = big ? 11 : 8;
    for (let i = 0; i < leaves; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6;
      const len = (big ? 30 : 22) + R() * 8;
      const cx = w / 2 + Math.cos(a) * len * 0.55;
      const cy = h - 24 + Math.sin(a) * len * 0.6;
      ell(g, cx, cy, 6.5, 11, a + Math.PI / 2);
      fs(g, ['#6fae5f', '#83c06e', '#5f9d55'][i % 3], 2);
      g.beginPath();
      g.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6);
      g.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6);
      g.lineWidth = 1;
      g.strokeStyle = 'rgba(60,100,50,0.6)';
      g.stroke();
    }
    g.beginPath();
    g.moveTo(10, h - 22);
    g.lineTo(w - 10, h - 22);
    g.lineTo(w - 13, h - 2);
    g.lineTo(13, h - 2);
    g.closePath();
    fs(g, '#e08a5e', 2.5);
    rr(g, 8, h - 25, w - 16, 7, 3);
    fs(g, '#f0a47a', 2.5);
  });
}

function makeBambooArt(seed, big = false) {
  const w = 44, h = big ? 84 : 70;
  return makeArt(w, h, (g) => {
    const R = rng(seed);
    const stalks = [12, 22, 31];
    stalks.forEach((sx, i) => {
      const top = 4 + R() * 14 + (i === 1 ? 0 : 8);
      rr(g, sx - 3, top, 6, h - 22 - top, 3);
      fs(g, ['#8cbf5f', '#7cb356', '#9acb6a'][i], 2);
      for (let yy = top + 12; yy < h - 26; yy += 12) {
        g.beginPath();
        g.moveTo(sx - 3, yy);
        g.lineTo(sx + 3, yy);
        g.lineWidth = 1.5;
        g.strokeStyle = OL;
        g.stroke();
      }
      for (let k = 0; k < 2; k++) {
        const ly = top + 6 + R() * 20, side = (i + k) % 2 ? 1 : -1;
        ell(g, sx + side * 8, ly, 8, 3, side * 0.5);
        fs(g, '#6fae5f', 1.5);
      }
    });
    // niska doniczka
    rr(g, 5, h - 24, w - 10, 20, [3, 3, 8, 8]);
    fs(g, '#3f5f8f', 2.5);
    rr(g, 3, h - 27, w - 6, 6, 3);
    fs(g, '#5677a8', 2.5);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(10, h - 16, w - 20, 2);
  });
}

function makeArmchairArt() {
  return makeArt(60, 62, (g) => {
    rr(g, 8, 2, 44, 38, 14);
    fs(g, '#e07b6c', 3);
    rr(g, 14, 8, 32, 20, 9);
    g.fillStyle = '#ec978a';
    g.fill();
    rr(g, 6, 30, 48, 24, 9);
    fs(g, '#d06a5c', 3);
    rr(g, 12, 30, 36, 13, 6);
    fs(g, '#f3a497', 2);
    rr(g, 0, 22, 14, 32, 7);
    fs(g, '#c95f52', 3);
    rr(g, 46, 22, 14, 32, 7);
    fs(g, '#c95f52', 3);
    rr(g, 9, 53, 7, 8, 2);
    fs(g, '#8a5434', 2);
    rr(g, 44, 53, 7, 8, 2);
    fs(g, '#8a5434', 2);
  });
}

function makeFloorLampArt() {
  return makeArt(36, 100, (g) => {
    g.beginPath();
    g.moveTo(8, 26);
    g.lineTo(28, 26);
    g.lineTo(32, 4);
    g.lineTo(4, 4);
    g.closePath();
    fs(g, '#f7d98a', 3);
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillRect(9, 7, 4, 16);
    rr(g, 16, 26, 4, 64, 2);
    fs(g, '#a87a4a', 2);
    ell(g, 18, 92, 13, 5);
    fs(g, '#8a5a3a', 2.5);
  });
}

function makeSideTableArt() {
  return makeArt(40, 46, (g) => {
    rr(g, 7, 26, 4, 18, 2);
    fs(g, '#8a5434', 2);
    rr(g, 29, 26, 4, 18, 2);
    fs(g, '#8a5434', 2);
    ell(g, 20, 24, 18, 7);
    fs(g, '#c58552', 2.5);
    // kubek kakao
    rr(g, 12, 8, 14, 15, 4);
    fs(g, '#fff6e8', 2);
    ell(g, 28, 15, 4, 4.5);
    g.lineWidth = 2.5;
    g.strokeStyle = OL;
    g.stroke();
    ell(g, 19, 10, 5.5, 1.8);
    g.fillStyle = '#9a5a3a';
    g.fill();
    g.fillStyle = '#f27a94';
    g.fillRect(14, 15, 10, 2.5);
  });
}

function makeReadingTableArt() {
  return makeArt(100, 66, (g) => {
    rr(g, 10, 36, 6, 28, 2);
    fs(g, '#8a5434', 2);
    rr(g, 84, 36, 6, 28, 2);
    fs(g, '#8a5434', 2);
    rr(g, 2, 26, 96, 16, 7);
    fs(g, '#c58552', 3);
    g.fillStyle = 'rgba(255,230,190,0.4)';
    g.fillRect(8, 29, 84, 3);
    // otwarta książka
    g.beginPath();
    g.moveTo(44, 26);
    g.quadraticCurveTo(56, 20, 68, 24);
    g.lineTo(68, 31);
    g.quadraticCurveTo(56, 27, 44, 33);
    g.quadraticCurveTo(32, 27, 20, 31);
    g.lineTo(20, 24);
    g.quadraticCurveTo(32, 20, 44, 26);
    g.closePath();
    fs(g, '#fff6e8', 2);
    g.beginPath();
    g.moveTo(44, 26);
    g.lineTo(44, 33);
    g.stroke();
    // świeczka
    rr(g, 79, 8, 9, 20, 2);
    fs(g, '#fff1d6', 2);
    ell(g, 83.5, 3, 3, 5);
    g.fillStyle = '#ffc94a';
    g.fill();
    ell(g, 83.5, 4.5, 1.4, 2.4);
    g.fillStyle = '#ff8a3a';
    g.fill();
  });
}

function makeCatBedArt() {
  if (theme().lights === 'lanterns') {
    // kwadratowa poduszka zabuton z chwostami
    return makeArt(66, 36, (g) => {
      rr(g, 6, 6, 54, 26, 9);
      fs(g, '#3f5f8f', 3);
      rr(g, 12, 10, 42, 18, 7);
      fs(g, '#5677a8', 2);
      ell(g, 33, 19, 3, 2);
      g.fillStyle = '#f4c542';
      g.fill();
      for (const [x, y] of [[7, 7], [59, 7], [7, 31], [59, 31]]) {
        ell(g, x, y, 3, 3);
        fs(g, '#f4c542', 1.5);
      }
    });
  }
  return makeArt(66, 36, (g) => {
    ell(g, 33, 20, 31, 14);
    fs(g, '#a98bd0', 3);
    ell(g, 33, 21, 23, 9);
    fs(g, '#fbe7c6', 2);
    ell(g, 26, 18, 9, 3);
    g.fillStyle = '#fff4dd';
    g.fill();
  });
}

/* ---------- meble japońskie ---------- */
function drawManekiNeko(g, x, y) {
  ell(g, x, y - 9, 9, 10);
  fs(g, '#fffaf2', 2);
  ell(g, x, y - 22, 9, 8);
  fs(g, '#fffaf2', 2);
  tri(g, [x - 8, y - 25], [x - 7, y - 33], [x - 2, y - 29]);
  fs(g, '#fffaf2', 1.5);
  tri(g, [x + 8, y - 25], [x + 7, y - 33], [x + 2, y - 29]);
  fs(g, '#fffaf2', 1.5);
  ell(g, x + 9, y - 27, 3, 5, 0.3);
  fs(g, '#fffaf2', 1.5);
  g.beginPath();
  g.arc(x - 3.5, y - 22, 1.6, Math.PI * 1.1, Math.PI * 1.9);
  g.moveTo(x + 5.1, y - 22);
  g.arc(x + 3.5, y - 22, 1.6, Math.PI * 1.1, Math.PI * 1.9);
  g.lineWidth = 1.4;
  g.strokeStyle = INK;
  g.stroke();
  rr(g, x - 6, y - 16, 12, 3, 1.5);
  g.fillStyle = '#d9363e';
  g.fill();
  ell(g, x, y - 12, 3, 3);
  fs(g, '#f4c542', 1.2);
  ell(g, x - 4, y - 26, 2.5, 2);
  g.fillStyle = '#f0a04b';
  g.fill();
}

function makeZaisuArt() {
  return makeArt(60, 62, (g) => {
    rr(g, 12, 6, 36, 34, 10);
    fs(g, '#7a4a2e', 3);
    rr(g, 17, 11, 26, 24, 7);
    fs(g, '#c9563f', 2);
    rr(g, 4, 36, 52, 20, 8);
    fs(g, '#6b4029', 3);
    rr(g, 7, 30, 46, 20, 9);
    fs(g, '#d9534f', 2.5);
    rr(g, 13, 34, 34, 12, 6);
    g.fillStyle = '#e8746a';
    g.fill();
    ell(g, 30, 40, 3, 2);
    g.fillStyle = '#f4c542';
    g.fill();
    for (const [x, y] of [[8, 31], [52, 31]]) {
      ell(g, x, y, 3, 3);
      fs(g, '#f4c542', 1.5);
    }
  });
}

function makeAndonArt() {
  return makeArt(36, 100, (g) => {
    rr(g, 7, 80, 4, 18, 1.5);
    fs(g, '#5a3a26', 2);
    rr(g, 25, 80, 4, 18, 1.5);
    fs(g, '#5a3a26', 2);
    rr(g, 5, 12, 26, 70, 4);
    fs(g, '#fff1d0', 3);
    const grd = g.createLinearGradient(0, 14, 0, 80);
    grd.addColorStop(0, 'rgba(255,214,140,0.0)');
    grd.addColorStop(1, 'rgba(255,190,110,0.45)');
    g.fillStyle = grd;
    g.fillRect(7, 14, 22, 66);
    g.fillStyle = '#7a4a2e';
    g.fillRect(17, 12, 2, 70);
    for (const yy of [30, 48, 66]) g.fillRect(5, yy, 26, 2);
    rr(g, 2, 6, 32, 8, 3);
    fs(g, '#5a3a26', 2.5);
    rr(g, 3, 80, 30, 5, 2);
    fs(g, '#5a3a26', 2);
  });
}

function makeTeaTrayArt() {
  return makeArt(40, 46, (g) => {
    rr(g, 3, 30, 34, 10, 4);
    fs(g, '#2f2b2b', 2.5);
    rr(g, 6, 38, 4, 7, 1.5);
    fs(g, '#2f2b2b', 2);
    rr(g, 30, 38, 4, 7, 1.5);
    fs(g, '#2f2b2b', 2);
    // czajniczek
    ell(g, 15, 22, 9, 8);
    fs(g, '#7a5a44', 2.5);
    g.beginPath();
    g.moveTo(23, 20);
    g.lineTo(29, 15);
    g.lineWidth = 3;
    g.strokeStyle = OL;
    g.stroke();
    g.beginPath();
    g.arc(15, 14, 7, Math.PI * 1.1, Math.PI * 1.9);
    g.lineWidth = 2;
    g.stroke();
    ell(g, 15, 14.5, 2.5, 1.5);
    fs(g, '#9a7a60', 1.5);
    // czarka z zieloną herbatą
    rr(g, 26, 22, 9, 8, [1, 1, 4, 4]);
    fs(g, '#e9eef0', 2);
    ell(g, 30.5, 23, 3.5, 1.2);
    g.fillStyle = '#8fbf5a';
    g.fill();
  });
}

function makeChabudaiArt() {
  return makeArt(100, 66, (g) => {
    // poduszki zabuton po bokach
    rr(g, 0, 40, 22, 20, 6);
    fs(g, '#5677a8', 2.5);
    rr(g, 78, 40, 22, 20, 6);
    fs(g, '#5677a8', 2.5);
    rr(g, 20, 44, 6, 14, 2);
    fs(g, '#5a3a26', 2);
    rr(g, 74, 44, 6, 14, 2);
    fs(g, '#5a3a26', 2);
    ell(g, 50, 40, 40, 13);
    fs(g, '#8a5a3a', 3);
    ell(g, 50, 38, 36, 10);
    g.fillStyle = 'rgba(255,220,180,0.25)';
    g.fill();
    // otwarta książka
    g.beginPath();
    g.moveTo(42, 38);
    g.quadraticCurveTo(51, 33, 60, 36);
    g.lineTo(60, 42);
    g.quadraticCurveTo(51, 39, 42, 44);
    g.quadraticCurveTo(33, 39, 24, 42);
    g.lineTo(24, 36);
    g.quadraticCurveTo(33, 33, 42, 38);
    g.closePath();
    fs(g, '#fff6e8', 2);
    // czarka i mała świeczka w lampionie
    rr(g, 66, 30, 9, 8, [1, 1, 4, 4]);
    fs(g, '#e9eef0', 2);
    ell(g, 70.5, 31, 3.5, 1.2);
    g.fillStyle = '#8fbf5a';
    g.fill();
    rr(g, 12, 12, 12, 24, 3);
    fs(g, '#fff1d0', 2);
    ell(g, 18, 26, 2.5, 4);
    g.fillStyle = '#ffc94a';
    g.fill();
    rr(g, 10, 9, 16, 4, 2);
    fs(g, '#5a3a26', 1.5);
  });
}

const COUNTER_W = 8 * T;
const COUNTER_H = 100;
function makeCounterArt() {
  const jp = theme().lights === 'lanterns';
  return makeArt(COUNTER_W, COUNTER_H, (g) => {
    // front
    rr(g, 2, 58, COUNTER_W - 4, 40, 8);
    fs(g, jp ? '#9a6440' : '#d9915a', 3);
    for (let x = 14; x < COUNTER_W - 20; x += 46) {
      rr(g, x, 66, 36, 24, 5);
      fs(g, jp ? '#b57a50' : '#e8a670', 2);
      if (jp) {
        g.fillStyle = 'rgba(70,40,25,0.35)';
        g.fillRect(x + 17, 66, 2, 24);
      }
    }
    // blat
    rr(g, 0, 34, COUNTER_W, 28, 9);
    fs(g, jp ? '#c99868' : '#f0b77f', 3);
    g.fillStyle = 'rgba(255,245,225,0.55)';
    rr(g, 8, 38, COUNTER_W - 16, 5, 3);
    g.fill();
    // kasa
    rr(g, 10, 6, 40, 34, 6);
    fs(g, '#f3d3a0', 2.5);
    rr(g, 16, 12, 28, 10, 3);
    fs(g, '#9fd4c0', 2);
    for (let i = 0; i < 3; i++) {
      rr(g, 16 + i * 10, 27, 7, 5, 1.5);
      fs(g, '#fff6e8', 1.5);
    }
    if (jp) {
      drawManekiNeko(g, 72, 44);
    } else {
    // dzwonek
    ell(g, 70, 42, 10, 3);
    fs(g, '#c9a36a', 2);
    g.beginPath();
    g.arc(70, 40, 7, Math.PI, 0);
    g.closePath();
    fs(g, '#f4c542', 2);
    ell(g, 70, 31, 2, 2);
    fs(g, '#f4c542', 1.5);
    }
    const lx = 6 * T + 22;
    if (jp) {
      // mała papierowa lampka
      rr(g, lx - 9, 40, 18, 4, 2);
      fs(g, '#5a3a26', 2);
      rr(g, lx - 8, 12, 16, 28, 4);
      fs(g, '#fff1d0', 2.5);
      g.fillStyle = 'rgba(120,80,50,0.5)';
      g.fillRect(lx - 0.75, 12, 1.5, 28);
      g.fillRect(lx - 8, 25, 16, 1.5);
      rr(g, lx - 10, 8, 20, 5, 2);
      fs(g, '#5a3a26', 2);
    } else {
    // lampka bankierska
    rr(g, lx - 2, 18, 4, 22, 2);
    fs(g, '#c9a36a', 2);
    ell(g, lx, 41, 10, 3);
    fs(g, '#c9a36a', 2);
    g.beginPath();
    g.moveTo(lx - 15, 22);
    g.quadraticCurveTo(lx, 2, lx + 15, 22);
    g.closePath();
    fs(g, '#6cb98a', 2.5);
    }
    // napisy na froncie
    rr(g, 3.5 * T - 26, 70, 52, 16, 5);
    fs(g, '#fff4e2', 2);
    g.font = '600 10px Fredoka, "Pixelify Sans", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = OL;
    g.fillText('LADA', 3.5 * T, 78.5);
    rr(g, 7.5 * T - 30, 70, 54, 16, 5);
    fs(g, '#d8f0ea', 2);
    g.fillStyle = OL;
    g.fillText('ZWROTY', 7.5 * T - 3, 78.5);
    // kosz zwrotów
    const bx = 7 * T + 4;
    rr(g, bx, 24, 38, 20, 6);
    fs(g, '#d9ab6a', 2.5);
    g.strokeStyle = 'rgba(107,74,58,0.4)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(bx + 3, 29 + i * 4);
      g.lineTo(bx + 35, 29 + i * 4);
      g.stroke();
    }
  });
}
