'use strict';
/* =========================================================
   Zabawy kotki z otoczeniem: fotel, lampki na ścianie,
   podlewanie kwiatków, czytanie przy stoliku.
   Kotka zaczyna zabawę akcją (E / 🐾) przy meblu,
   kończy ruchem (wstaje i wraca tam, skąd przyszła).
   ========================================================= */

const READ_THOUGHTS = ['Ojej!', 'Jeszcze jedna strona…', 'mrr, ciekawe!', 'Ale przygoda!', 'Hihi', '📖✨'];
const LIGHT_CATCH = ['Mam! ✨', 'Prawie!', 'Błyszczy się!', 'Hop!'];

const Act = {
  swats: [], // uderzenia w girlandę: { x, t }
  drops: [], // krople z konewki
  watered: new Set(), // kwiatki podlane dziś (klucz: nazwa grafiki)

  reset() {
    this.swats = [];
    this.drops = [];
    this.watered.clear();
  },

  /* ---------- co jest przed kotką ---------- */
  propAt(tx, ty) {
    const p = STATIC_PROPS.find((p) => p.act && p.tiles.some(([x, y]) => x === tx && y === ty));
    if (p) return { type: p.act, prop: p };
    if (tx === 19 && WALL_MAP.rows.includes(ty)) return { type: 'worldmap' };
    // ściana z lampkami za szafami (kotka stoi tuż pod nią)
    if (ty === 1 && ((tx >= 10 && tx <= 18) || (tx >= ROOM_X0 && tx < ROOM_X1))) return { type: 'lights', tx };
    return null;
  },

  hint(what) {
    const jp = theme().lights === 'lanterns';
    switch (what.type) {
      case 'armchair':
        return jp ? 'E: usiądź na poduszce' : 'E: usiądź w fotelu';
      case 'read':
        return 'E: poczytaj książkę przy stoliku';
      case 'plant':
        return this.watered.has(what.prop.art) ? 'E: podlej kwiatek jeszcze raz' : 'E: podlej kwiatek';
      case 'lights':
        return jp ? 'E: pobaw się lampionami' : 'E: spróbuj złapać lampki łapką';
      case 'worldmap':
        return 'E: obejrzyj mapę świata';
      case 'tea':
        return Cat.tea ? 'Masz już herbatkę. Zanieś ją czytelnikowi ☕' : 'E: nalej herbatki dla czytelnika ☕';
      case 'cards':
        return 'E: otwórz kartę stałych klientów ⭐';
    }
    return '';
  },

  activeHint() {
    const a = Cat.activity;
    switch (a.type) {
      case 'armchair':
        return a.t > 7 ? 'E: mrrr… · ruch: obudź się i zejdź' : 'E: mrrr… · ruch: zejdź z fotela';
      case 'read':
        return 'E: przewróć stronę · ruch: wstań od stolika';
      case 'lights':
        return 'E: łap! · ruch: koniec zabawy';
      case 'plant':
        return 'Podlewasz kwiatek… 💧';
    }
    return '';
  },

  /* ---------- start / koniec ---------- */
  start(what) {
    const a = {
      type: what.type,
      prop: what.prop,
      t: 0,
      next: 0,
      n: 0,
      backX: Cat.x,
      backY: Cat.y,
      x: Cat.x,
      y: Cat.y,
      anim: 9, // czas od ostatniego „ruchu” (strona, łapka)
      paw: 1,
    };
    const fx = Cat.x, fy = Cat.y - 90;
    switch (a.type) {
      case 'armchair': {
        const art = ART[a.prop.art];
        a.x = a.prop.x + art.w / 2;
        a.y = a.prop.bottom - 16;
        Sound.play('sit');
        addFloat(theme().lights === 'lanterns' ? 'Mięciutko~' : 'Wygodnie~', a.x, a.y - 80);
        break;
      }
      case 'read': {
        const b = this.book(a.prop);
        a.x = b.x;
        a.y = b.y + 12;
        a.next = 1.6;
        Sound.play('sit');
        const cat = pick(availableCats());
        addFloat(`„${pick(CATEGORIES[cat].titles)}”`, a.x, a.y - 82, shade(CATEGORIES[cat].color, 0.55), 2.2);
        break;
      }
      case 'lights':
        a.next = 0.15;
        break;
      case 'plant': {
        const p = a.prop, art = ART[p.art];
        a.px = p.x + art.w / 2;
        a.py = p.bottom - art.h * 0.55;
        a.dir = Cat.dir;
        if (a.dir === 'up') {
          // kwiatek tuż nad kotką: staje obok, żeby go nie zasłaniać
          const side = a.px < 12 * T ? 1 : -1;
          a.x = a.px + side * 34;
          a.y = Cat.y + 4;
          a.dir = side > 0 ? 'left' : 'right';
        }
        Sound.play('water');
        addFloat('Chlup, chlup 💧', fx, fy, '#bfe6ff');
        break;
      }
    }
    Cat.activity = a;
    Cat.x = a.x;
    Cat.y = a.y;
    G.panelDirty = true;
  },

  stop() {
    const a = Cat.activity;
    if (!a) return;
    Cat.x = a.backX;
    Cat.y = a.backY;
    Cat.activity = null;
    if (a.type === 'armchair' || a.type === 'read') Sound.play('pop');
  },

  // Akcja (E) w trakcie zabawy
  action() {
    const a = Cat.activity;
    if (!a) return;
    switch (a.type) {
      case 'read':
        if (a.anim > 0.5) this.flipPage(a);
        break;
      case 'lights':
        if (a.anim > 0.3) this.swat(a);
        break;
      case 'armchair':
        Cat.happyT = 0.8;
        Sound.purr();
        addFloat(a.t > 7 ? 'mrrr… zzz' : 'mrrr~', a.x + 16, a.y - 70);
        spawnHearts(a.x, a.y - 60, 1);
        break;
    }
  },

  /* ---------- logika ---------- */
  update(dt) {
    const a = Cat.activity;
    a.t += dt;
    a.anim += dt;
    a.next -= dt;
    switch (a.type) {
      case 'read':
        if (a.next <= 0) this.flipPage(a);
        break;
      case 'lights':
        if (a.next <= 0) this.swat(a);
        break;
      case 'armchair':
        if (a.next <= 0) {
          a.next = 3.4;
          if (a.t > 7) addFloat('Zzz…', a.x + 18, a.y - 50, '#fff6e8', 1.8);
          else if (a.t > 2) {
            addFloat('mrr~', a.x + 18, a.y - 70, '#fff6e8', 1.6);
            Sound.purr();
          }
        }
        break;
      case 'plant':
        if (a.t < 1.9 && Math.random() < dt * 22) this.addDrop(a);
        if (a.t > 2.3) this.finishWatering(a);
        break;
    }
  },

  // Uruchamiane co klatkę: wygasanie efektów, także po zabawie
  tick(dt) {
    for (const s of this.swats) s.t += dt;
    this.swats = this.swats.filter((s) => s.t < 2);
    for (const d of this.drops) d.t += dt;
    this.drops = this.drops.filter((d) => d.t < d.life);
    for (const p of STATIC_PROPS) if (p.wig > 0) p.wig = Math.max(0, p.wig - dt);
  },

  flipPage(a) {
    a.anim = 0;
    a.n++;
    a.next = 2.2 + Math.random() * 1.6;
    Sound.play('page');
    if (a.n % 3 === 0) addFloat(pick(READ_THOUGHTS), a.x + 20, a.y - 84, '#fff6e8', 1.6);
  },

  swat(a) {
    a.anim = 0;
    a.paw = -a.paw;
    a.n++;
    a.next = 0.7 + Math.random() * 0.7;
    const x = a.x + a.paw * 20;
    this.swats.push({ x, t: 0 });
    Sound.play('jingle');
    if (a.n % 4 === 0) {
      addFloat(pick(LIGHT_CATCH), x, 60, '#fff3b0', 1.3);
      for (let i = 0; i < 4; i++)
        this.drops.push({ spark: true, sx: x, sy: 26, tx: x + (Math.random() * 40 - 20), ty: 26 + Math.random() * 30, t: 0, life: 0.6 });
    }
  },

  // Przesunięcie lampek/lampionów pod łapką (w pionie)
  wobble(x) {
    let off = 0;
    for (const s of this.swats) {
      const near = Math.max(0, 1 - Math.abs(x - s.x) / 80);
      if (near) off += near * Math.sin(s.t * 16) * 7 * Math.exp(-s.t * 2.6);
    }
    return off;
  },

  addDrop(a) {
    const can = this.canPos(a);
    const tip = { x: can.x + can.m * 20, y: can.y - 6 };
    this.drops.push({
      sx: tip.x,
      sy: tip.y,
      tx: a.px + (Math.random() * 22 - 11),
      ty: a.py + Math.random() * 10,
      t: 0,
      life: 0.42 + Math.random() * 0.12,
    });
  },

  finishWatering(a) {
    const p = a.prop;
    p.wig = 1;
    if (!this.watered.has(p.art)) {
      this.watered.add(p.art);
      // nagroda: serduszko za pierwsze podlanie tego kwiatka danego dnia
      G.hearts++;
      G.today.hearts++;
      addFloat('Kwiatek zakwitł! +1 💗', a.px, a.py - 40, '#ffd0e0', 1.8);
      spawnHearts(a.px, a.py - 20, 2);
      Sound.play('purchase');
      UI.updateHUD();
      save();
    } else {
      addFloat('Już się napił 💧', a.px, a.py - 40, '#bfe6ff', 1.5);
      Sound.play('pop');
    }
    this.stop();
  },

  /* ---------- pomocnicze pozycje ---------- */
  book(prop) {
    const art = ART[prop.art];
    const jp = theme().lights === 'lanterns';
    return { x: prop.x + (jp ? 42 : 44), y: prop.bottom - art.h + (jp ? 38 : 26), pw: jp ? 18 : 24 };
  },

  // Konewka: obok głowy kotki, od strony kwiatka; m = 1 (dziobek w prawo) lub -1
  canPos(a) {
    const dx = a.px - a.x;
    const m = dx < -4 ? -1 : 1;
    if (a.dir === 'up') return { x: a.x + 14, y: a.y - 74, m };
    if (a.dir === 'down') return { x: a.x + 22 * m, y: a.y - 22, m };
    return { x: a.x + 30 * m, y: a.y - 44, m };
  },

  sortY() {
    const a = Cat.activity;
    if (a.type === 'armchair') return a.prop.bottom + 1;
    if (a.type === 'read') return a.prop.bottom - 0.5;
    return Cat.y + 0.1;
  },

  /* ---------- rysowanie ---------- */
  drawCat(g) {
    const a = Cat.activity;
    const o = {
      dir: Cat.dir,
      t: G.time,
      blink: Cat.blinkT < 0,
      happy: Cat.happyT > 0,
      moving: false,
      phase: 0,
    };
    switch (a.type) {
      case 'armchair':
        if (a.t > 7) catSleep(g, a.x, a.y + 2, o);
        else catSit(g, a.x, a.y, o);
        break;
      case 'read': {
        // oczy wędrują po linijkach tekstu
        const line = (a.anim * 0.9) % 1;
        o.look = { x: -3 + line * 6, y: 2 };
        o.blink = o.blink && a.anim > 0.5;
        catSit(g, a.x, a.y, o);
        break;
      }
      case 'lights':
        this.drawReach(g, a, o);
        break;
      case 'plant':
        drawCat(g, a.x, a.y, { ...o, dir: a.dir, pose: 'stand' });
        this.drawCan(g, a);
        break;
    }
  },

  // Kotka na tylnych łapkach, jedna łapka w górze (widok od tyłu)
  drawReach(g, a, o) {
    const x = a.x, y = a.y;
    const k = Math.min(1, a.anim / 0.35);
    const reach = a.anim < 0.35 ? Math.sin(k * Math.PI) : 0.25 + Math.sin(G.time * 5) * 0.08;
    const up = y - 8;
    shadow(g, x, y);
    ell(g, x - 8, y - 3, 7, 5);
    fs(g, CAT_W);
    ell(g, x + 8, y - 3, 7, 5);
    fs(g, CAT_W);
    // ogon merda z emocji
    const sw = Math.sin(G.time * 7) * 8;
    thickCurve(g, [[x + 2, y - 8], [x + 8, y + 2], [x + 20 + sw, y], [x + 22 + sw, y - 16]], CAT_O, 6);
    ell(g, x + 22 + sw, y - 16, 3.5, 3.5);
    g.fillStyle = CAT_B;
    g.fill();
    patched(g, () => ell(g, x, up - 20, 16, 19), CAT_W, [
      [x - 8, up - 26, 12, 10, CAT_O],
      [x + 12, up - 14, 9, 9, CAT_B],
    ]);
    // łapka sięgająca lampek
    const s = a.paw;
    const tipX = x + s * (20 + reach * 4), tipY = up - 62 - reach * 22;
    thickCurve(g, [[x + s * 10, up - 30], [x + s * 22, up - 44], [tipX, tipY]], CAT_W, 9);
    // druga łapka oparta
    ell(g, x - s * 13, up - 30, 6, 5);
    fs(g, CAT_W);
    catEars(g, x, up);
    patched(g, () => ell(g, x, up - 40, 21, 17.5), CAT_W, [
      [x - 12, up - 46, 15, 14, CAT_B],
      [x + 13, up - 44, 13, 14, CAT_O],
    ]);
    ell(g, tipX, tipY, 6, 5.5);
    fs(g, CAT_W);
    for (const d of [-2.5, 0, 2.5]) {
      ell(g, tipX + d, tipY - 3, 1.3, 1.1);
      g.fillStyle = CAT_PINK;
      g.fill();
    }
  },

  drawCan(g, a) {
    const c = this.canPos(a);
    const pour = Math.min(1, a.t / 0.3) * (a.t > 1.9 ? Math.max(0, 1 - (a.t - 1.9) / 0.3) : 1);
    g.save();
    g.translate(c.x, c.y);
    g.scale(c.m, 1);
    g.rotate(0.55 * pour);
    // dziobek
    g.beginPath();
    g.moveTo(6, 2);
    g.lineTo(19, -7);
    g.lineWidth = 6;
    g.strokeStyle = OL;
    g.stroke();
    g.lineWidth = 3;
    g.strokeStyle = '#6fb8d6';
    g.stroke();
    ell(g, 20, -7, 3.5, 4.5, 0.6);
    fs(g, '#8ccbe4', 1.8);
    // uchwyt
    g.beginPath();
    g.arc(-6, -9, 7, Math.PI * 0.9, Math.PI * 2.1);
    g.lineWidth = 5;
    g.strokeStyle = OL;
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeStyle = '#6fb8d6';
    g.stroke();
    // korpus
    rr(g, -12, -8, 20, 16, 4);
    fs(g, '#8ccbe4', 2.2);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(-9, -5, 3, 9);
    // łapka trzymająca
    ell(g, -10, -2, 5, 4.5);
    fs(g, CAT_W, 2);
    g.restore();
  },

  // Rysowane nad meblem (po sortowaniu): kartki książki
  drawOverlay(g) {
    const a = Cat.activity;
    if (!a || a.type !== 'read') return;
    const b = this.book(a.prop);
    // linijki tekstu na otwartych stronach
    g.strokeStyle = 'rgba(107,74,58,0.35)';
    g.lineWidth = 1;
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const y = b.y + 1 + i * 2.2;
        g.beginPath();
        g.moveTo(b.x + side * 4, y);
        g.lineTo(b.x + side * (b.pw - 5), y - 1);
        g.stroke();
      }
    if (a.anim >= 0.5) return;
    // przewracana kartka: od prawej do lewej
    const k = a.anim / 0.5;
    const ex = b.x + b.pw * Math.cos(Math.PI * k);
    const lift = Math.sin(Math.PI * k) * 9;
    g.beginPath();
    g.moveTo(b.x, b.y);
    g.quadraticCurveTo((b.x + ex) / 2, b.y - 3 - lift, ex, b.y - 1 - lift);
    g.lineTo(ex, b.y + 6 - lift);
    g.quadraticCurveTo((b.x + ex) / 2, b.y + 4 - lift, b.x, b.y + 7);
    g.closePath();
    fs(g, '#fffdf6', 1.6);
    // łapka przy rogu kartki
    ell(g, ex, b.y + 4 - lift, 5, 4);
    fs(g, CAT_W, 2);
  },

  // Krople wody i iskierki (nad wszystkim)
  drawEffects(g) {
    for (const d of this.drops) {
      const k = d.t / d.life;
      const x = d.sx + (d.tx - d.sx) * k;
      const y = d.sy + (d.ty - d.sy) * k - Math.sin(Math.PI * k) * (d.spark ? 6 : 8);
      if (d.spark) {
        g.globalAlpha = 1 - k;
        drawSparkle(g, x, y, 4);
        g.globalAlpha = 1;
      } else {
        ell(g, x, y, 2, 2.8);
        g.fillStyle = '#6fbde8';
        g.fill();
        ell(g, x - 0.6, y - 0.8, 0.7, 0.9);
        g.fillStyle = '#e8f7ff';
        g.fill();
      }
    }
  },
};

function drawSparkle(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fillStyle = '#fff3b0';
  g.fill();
}

// Kwiatek: podskakuje po podlaniu, a podlany dziś ma kwiatuszki
function drawPlantProp(g, p) {
  const art = ART[p.art];
  if (p.wig > 0) {
    const s = Math.sin(p.wig * 18) * p.wig;
    g.save();
    g.translate(p.x + art.w / 2, p.bottom);
    g.scale(1 + s * 0.07, 1 - s * 0.07);
    blit(g, art, -art.w / 2, -art.h);
    g.restore();
  } else blit(g, art, p.x, p.bottom - art.h);
  if (!Act.watered.has(p.art)) return;
  const R = rng(p.x);
  const top = p.bottom - art.h;
  const bamboo = theme().plant === 'bamboo';
  for (let i = 0; i < 3; i++) {
    const fx = p.x + art.w * (0.22 + R() * 0.56);
    const fy = top + art.h * (bamboo ? 0.15 + R() * 0.3 : 0.12 + R() * 0.35);
    const col = bamboo ? '#f9cfdb' : ['#f6a8c8', '#ffd36b', '#f9b8a0'][i];
    for (let k = 0; k < 5; k++) {
      const an = (k / 5) * Math.PI * 2;
      ell(g, fx + Math.cos(an) * 3, fy + Math.sin(an) * 3, 2.6, 2.6);
      g.fillStyle = col;
      g.fill();
    }
    ell(g, fx, fy, 1.8, 1.8);
    g.fillStyle = bamboo ? '#f4c542' : '#fff6e8';
    g.fill();
  }
}
