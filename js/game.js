'use strict';
/* =========================================================
   Główna pętla gry, kamera, interakcje, zapis, rysowanie świata.
   ========================================================= */

const SAVE_KEY = 'kocia-biblioteka-v2';
let VIEW_W = 600; // widoczny fragment świata (jednostki świata)
let VIEW_H = 375;

const G = {
  state: 'title', // title | play | summary
  day: 1,
  coins: 0,
  hearts: 0,
  totals: { sold: 0, lent: 0, returned: 0 },
  today: null,
  upgrades: { speed: 0 },
  region: 'forest',
  branches: {},
  unlocked: ['forest'],
  goal: 6,
  spawned: 0,
  served: 0,
  customers: [],
  loans: [],
  cart: [],
  floaters: [],
  particles: [],
  picker: null,
  spawnTimer: 1.5,
  time: 0,
  light: 0,
  doorOpen: 0,
  endTimer: -1,
  panelDirty: true,
};

const Camera = { x: 0, y: 0 };

function region() {
  return REGIONS.find((r) => r.id === G.region);
}
function branch() {
  if (!G.branches[G.region]) G.branches[G.region] = newBranch();
  return G.branches[G.region];
}

function dayGoal() {
  const b = branch();
  return Math.min(5 + Math.floor(G.day * 1.5) + (b.bookcases - 1) * 2 + (b.slots - 3) * 2, 26);
}
function freshToday() {
  return { sold: 0, lent: 0, returned: 0, coins: 0, hearts: 0, tips: 0, missed: 0 };
}

/* ---------------- ZAPIS ---------------- */
function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function save(over = {}) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        v: 2,
        catName: G.catName,
        day: G.day,
        coins: G.coins,
        hearts: G.hearts,
        totals: G.totals,
        today: G.today,
        served: G.served,
        upgrades: G.upgrades,
        region: G.region,
        branches: G.branches,
        unlocked: G.unlocked,
        loans: G.loans,
        cart: G.cart,
        ...over,
      })
    );
  } catch (e) {
    /* zapis niedostępny – gra działa dalej */
  }
}

function restock() {
  const b = branch();
  for (const c of availableCats()) b.stock[c] = maxStock(c);
}

function beginDay() {
  G.goal = dayGoal();
  G.spawned = G.served;
  G.customers = [];
  G.floaters = [];
  G.particles = [];
  G.picker = null;
  G.spawnTimer = 1.2;
  G.light = G.served / G.goal;
  G.endTimer = -1;
  G.readerTimer = 10;
  G.gateOpen = 0;
  Cat.reset();
  Act.reset();
  Yarn.reset();
  Camera.x = Camera.y = null;
  G.state = 'play';
  buildWorld();
  save();
  UI.hideOverlays();
  UI.updateHUD();
  Picker.render();
  G.panelDirty = true;
}

function startGame(continueSave) {
  const s = continueSave ? readSave() : null;
  const typed = cleanName(document.getElementById('cat-name').value);
  G.catName = typed || (s && s.catName) || '';
  G.day = s?.day || 1;
  G.coins = s?.coins || 0;
  G.hearts = s?.hearts || 0;
  G.totals = s?.totals || { sold: 0, lent: 0, returned: 0 };
  G.today = s?.today || freshToday();
  G.served = s?.served || 0;
  G.upgrades = s?.upgrades || { speed: 0 };
  G.region = s?.region || 'forest';
  G.branches = s?.branches || {};
  G.unlocked = s?.unlocked || ['forest'];
  G.loans = s?.loans || [];
  G.cart = s?.cart || [];
  if (!s) restock();
  Sound.unlock();
  Stats.event('start gry', { rodzaj: s ? 'kontynuacja' : 'nowa', dzien: G.day });
  beginDay();
}

function endDay() {
  G.state = 'summary';
  G.picker = null;
  Picker.render();
  // zapisujemy już początek kolejnego dnia (z dostawą), żeby odświeżenie nie cofało gry
  save({ day: G.day + 1, served: 0, today: freshToday() });
  Sound.play('dayEnd');
  Stats.event('koniec dnia', { dzien: G.day });
  UI.showSummary();
}

// Zapis w trakcie podsumowania: już jako początek kolejnego dnia
function saveBetweenDays() {
  save({ day: G.day + 1, served: 0, today: freshToday() });
}

// Warunek otwarcia filii: wszystkie szafy w poprzedniej filii
function requirementProgress(r) {
  if (!r.requires) return null;
  const b = G.branches[r.requires.region];
  const have = b ? b.bookcases : 0;
  return { have, need: r.requires.bookcases, name: REGIONS.find((x) => x.id === r.requires.region).name };
}
function requirementMet(r) {
  const p = requirementProgress(r);
  return !p || p.have >= p.need;
}

// Przeprowadzka do innej filii (tylko między dniami). Wypożyczenia i kosz zwrotów należą do filii.
function switchRegion(id) {
  if (id === G.region || !G.unlocked.includes(id)) return;
  const old = branch();
  old.loans = G.loans;
  old.cart = G.cart;
  G.region = id;
  const b = branch();
  G.loans = b.loans || [];
  G.cart = b.cart || [];
  delete b.loans;
  delete b.cart;
  buildArt();
  buildWorld();
  Camera.x = Camera.y = null;
  UI.updateHUD();
  G.panelDirty = true;
  saveBetweenDays();
}

function openBranch(id) {
  const r = REGIONS.find((x) => x.id === id);
  if (!r || !r.available || G.unlocked.includes(id) || G.coins < r.price || !requirementMet(r)) return;
  G.coins -= r.price;
  G.unlocked.push(id);
  G.branches[id] = newBranch();
  Sound.play('purchase');
  switchRegion(id);
}

function nextDay() {
  G.day++;
  G.today = freshToday();
  G.served = 0;
  restock();
  beginDay();
}

/* ---------------- EFEKTY ---------------- */
function addFloat(text, x, y, color = '#fff6e8', life = 1.4) {
  G.floaters.push({ text, x, y, color, t: 0, life });
}

function spawnHearts(x, y, n) {
  for (let i = 0; i < n; i++) {
    G.particles.push({
      x: x + (Math.random() * 24 - 12),
      y,
      vx: Math.random() * 24 - 12,
      vy: -34 - Math.random() * 20,
      t: -i * 0.15,
      life: 1.4,
    });
  }
}

function addCoins(n, x, y) {
  G.coins += n;
  G.today.coins += n;
  Sound.play('coin');
  addFloat(`+${n} 🪙`, x, y, '#ffd75e');
  UI.updateHUD();
}

/* ---------------- INTERAKCJE ---------------- */
function whatIsAt(tx, ty) {
  const yarn = Yarn.facing();
  if (yarn) return yarn;
  const reader = readerFacing();
  if (reader) return { type: 'reader', customer: reader };
  const bc = bookcaseAt(tx, ty);
  if (bc) return { type: 'bookcase', bc };
  if (ty === COUNTER_ROW && activeSlotCols().includes(tx)) return { type: 'slot', col: tx, customer: customerAtSlot(tx) };
  if (ty === COUNTER_ROW && tx === RETURN_COL) return { type: 'cart' };
  return Act.propAt(tx, ty);
}

// Herbatka dla czytelnika: czyta dłużej i zostawia większy napiwek
function serveTea(c) {
  Cat.tea = false;
  c.tea = true;
  c.readFor += 10;
  c.say = { text: pick(['Herbatka! Dziękuję, {imie}!', 'Mmm, z miodem!', 'Jak w domu ☕']), t: 1.8 };
  const v = visitsOf(c.name);
  if (v) v.teas = (v.teas || 0) + 1;
  G.hearts++;
  G.today.hearts++;
  spawnHearts(c.x, c.y - 80, 2);
  Sound.play('cash');
  UI.updateHUD();
  G.panelDirty = true;
  save();
}

// Czytelnik w fotelu tuż przed kotką
function readerFacing() {
  if (Cat.activity) return null;
  const [dx, dy] = DIRS[Cat.dir];
  const px = Cat.x + dx * 30, py = Cat.y - 20 + dy * 30;
  return G.customers.find((c) => c.state === 'reading' && Math.hypot(c.x - px, c.y - 30 - py) < 34) || null;
}

function bagFull() {
  return Cat.bag.length >= Cat.capacity();
}
function bagNames() {
  return Cat.bag.map((it) => CATEGORIES[it.cat].name + (it.returned ? ' (zwrot)' : '')).join(', ');
}

function takeBook(cat) {
  const b = branch();
  if (bagFull() || b.stock[cat] <= 0) return;
  b.stock[cat]--;
  Cat.bag.push({ cat, returned: false });
  Sound.play('rustle');
  addFloat(CATEGORIES[cat].name, Cat.x, Cat.y - 90 - Cat.bag.length * 4, shade(CATEGORIES[cat].color, 0.5));
  refreshBookcases();
  G.panelDirty = true;
}

// Odkłada książkę z torby (indeks i) z powrotem na półkę
function putBack(i) {
  const item = Cat.bag[i];
  if (!item) return;
  const b = branch();
  const cat = item.cat;
  b.stock[cat] = Math.min(maxStock(cat), b.stock[cat] + 1);
  Sound.play('pop');
  if (item.returned) {
    G.totals.returned++;
    G.today.returned++;
    addCoins(3, Cat.x + (Math.random() * 30 - 15), Cat.y - 90 - Math.random() * 16);
    spawnHearts(Cat.x, Cat.y - 60, 1);
  } else addFloat('Odłożone', Cat.x, Cat.y - 90);
  Cat.bag.splice(i, 1);
  refreshBookcases();
  save();
  G.panelDirty = true;
}

// Wszystkie zwroty z torby, które pasują do tej szafy, trafiają na półki
function shelveReturns(bc) {
  let n = 0;
  for (let i = Cat.bag.length - 1; i >= 0; i--) {
    if (Cat.bag[i].returned && bc.cats.includes(Cat.bag[i].cat)) {
      putBack(i);
      n++;
    }
  }
  return n;
}

function interact() {
  const { tx, ty } = Cat.target();
  const what = whatIsAt(tx, ty);
  const fx = Cat.x, fy = Cat.y - 90;
  if (!what) return;

  if (what.type === 'yarn') return Yarn.bat();
  if (what.type === 'reader') {
    const c = what.customer;
    c.happyT = 0.6;
    if (Cat.tea && !c.tea) return serveTea(c);
    if (!c.petted) {
      c.petted = true;
      c.say = { text: 'Mrr, miło cię widzieć, {imie}!', t: 1.8 };
      G.hearts++;
      G.today.hearts++;
      spawnHearts(c.x, c.y - 80, 2);
      Sound.play('coin');
      UI.updateHUD();
    } else {
      c.say = { text: 'Ćśś, czytam 📖', t: 1.4 };
      Sound.play('click');
    }
    return;
  }
  if (what.type === 'tea') {
    if (Cat.tea) return addFloat('Łapki zajęte herbatką ☕', fx, fy, '#ffe2c0');
    Cat.tea = true;
    Sound.play('pour');
    addFloat('Herbatka ☕', fx, fy, '#ffe2c0');
    G.panelDirty = true;
    return;
  }
  if (what.type === 'cards') {
    Sound.play('open');
    return UI.showLoyal(true);
  }
  if (what.type === 'worldmap') {
    Sound.play('open');
    return UI.showMap(true);
  }
  if (['armchair', 'read', 'plant', 'lights'].includes(what.type)) return Act.start(what);

  if (what.type === 'bookcase') {
    if (shelveReturns(what.bc)) return;
    const canPut = Cat.bag.some((it) => what.bc.cats.includes(it.cat));
    if (!bagFull() || canPut) Picker.open(what.bc);
    else {
      addFloat('Torba pełna!', fx, fy, '#ffd0c0');
      Sound.play('wrong');
    }
    return;
  }

  if (what.type === 'slot') {
    const c = what.customer;
    if (!c) return;
    if (!Cat.bag.length) {
      c.say = { text: `„${c.request.title}”`, t: 2 };
      return;
    }
    const i = Cat.bag.findIndex((it) => it.cat === c.request.cat);
    if (i >= 0) serve(c, i);
    else {
      c.shake = 0.45;
      Sound.play('wrong');
      c.say = { text: pick(WRONG), t: 1.6 };
    }
    return;
  }

  if (what.type === 'cart') {
    if (bagFull()) addFloat(Cat.capacity() > 1 ? 'Torba pełna!' : 'Łapki zajęte!', fx, fy, '#ffd0c0');
    else if (G.cart.length) {
      const bk = G.cart.pop();
      Cat.bag.push({ cat: bk.cat, returned: true });
      Sound.play('rustle');
      addFloat(`Zwrot: ${CATEGORIES[bk.cat].name}`, fx, fy, '#9fe0d6');
      save();
      G.panelDirty = true;
    } else addFloat('Kosz jest pusty', fx, fy);
  }
}

function serve(c, i) {
  const r = c.request;
  Sound.play('cash');
  addCoins(r.price, c.x, c.y - 100);
  const tip = branch().cozy * 2;
  if (tip) {
    G.coins += tip;
    G.today.coins += tip;
    G.today.tips += tip;
  }
  G.hearts++;
  G.today.hearts++;
  if (r.mode === 'buy') {
    G.totals.sold++;
    G.today.sold++;
  } else {
    G.totals.lent++;
    G.today.lent++;
    G.loans.push({ species: c.species, name: c.name, scarf: c.scarf, cat: r.cat, title: r.title, t: 35 + Math.random() * 40 });
  }
  Cat.bag.splice(i, 1);
  Cat.happyT = 1;
  c.state = 'happy';
  c.t = 0;
  c.say = { text: pick(THANKS), t: 1.3 };
  if (countVisit(c)) {
    c.say = { text: 'Zostaję stałym klientem! ⭐', t: 1.8 };
    addFloat(`⭐ ${c.name}: stały klient!`, c.x, c.y - 120, '#ffe08a', 2.2);
    Sound.play('purchase');
  }
  // stały klient po zakupie czasem zostaje poczytać
  c.toRead = branch().reading && isLoyal(c.name) && Math.random() < 0.6;
  spawnHearts(c.x, c.y - 70, 3);
  G.served++;
  UI.updateHUD();
  G.panelDirty = true;
  save();
}

// Okienko (mapa świata albo karta stałych klientów) otwarte w trakcie dnia
function overlayIsOpen() {
  return !document.getElementById('overlay-map').hidden || !document.getElementById('overlay-loyal').hidden;
}
function closeOverlays() {
  UI.showMap(false);
  UI.showLoyal(false);
}

function hintText() {
  if (G.state !== 'play') return '';
  if (overlayIsOpen()) return 'E albo Esc: zamknij';
  if (G.picker) return 'Wybierz kategorię: strzałki + E, cyfra albo kliknięcie. Esc zamyka.';
  if (Cat.activity) return Act.activeHint();
  const { tx, ty } = Cat.target();
  const what = whatIsAt(tx, ty);
  if (what && what.type === 'reader' && Cat.tea && !what.customer.tea) return `E: podaj herbatkę (${what.customer.name}) ☕`;
  if (what && what.type === 'reader' && what.customer.petted && !what.customer.tea)
    return `${what.customer.name} chętnie napije się herbatki. Weź ją z wózka ☕`;
  if (what && what.type === 'reader')
    return what.customer.petted ? `${what.customer.name} czyta w spokoju 📖` : `E: przywitaj się z gościem (${what.customer.name}) 💗`;
  if (what && what.type === 'yarn') return 'E: pacnij kłębek łapką (albo popchnij go, idąc)';
  if (what && Act.hint(what)) return Act.hint(what);
  const bag = Cat.bag;
  const cap = Cat.capacity();
  const bagInfo = cap > 1 ? ` (w torbie ${bag.length}/${cap})` : '';
  if (what && what.type === 'bookcase') {
    if (bag.some((it) => it.returned && what.bc.cats.includes(it.cat))) return 'E: odłóż zwroty na półki (+3 🪙 za każdy)';
    const canPut = bag.some((it) => what.bc.cats.includes(it.cat));
    if (bagFull() && !canPut) return 'Torba pełna. Zanieś książki gościom albo do innej szafy.';
    return `E: otwórz szafę i wybierz kategorię${bagInfo}`;
  }
  if (what && what.type === 'slot') {
    const c = what.customer;
    if (!c) return 'Tu nikt jeszcze nie czeka';
    const g = CATEGORIES[c.request.cat];
    if (bag.some((it) => it.cat === c.request.cat)) return `E: podaj książkę (${c.name})`;
    return `${c.name} chce „${c.request.title}” (${g.name}). Przynieś ją z szafy!`;
  }
  if (what && what.type === 'cart') {
    if (!G.cart.length) return 'Kosz zwrotów jest pusty';
    if (bagFull()) return 'Najpierw odłóż albo podaj to, co niesiesz';
    return `E: weź zwróconą książkę (${G.cart.length} w koszu)`;
  }
  if (bag.length) return `Niesiesz: ${bagNames()}. Podejdź do lady od dołu albo do szafy.`;
  return 'Podejdź do szafy lub lady, zwróć się w jej stronę i naciśnij E';
}

/* ---------------- PĘTLA ---------------- */
let canvas, ctx;
let S = 1.6, DPR = 1;
let lastTs = 0;

function resize() {
  const wide = window.innerWidth >= 1150;
  const narrow = window.innerWidth < 760;
  // na telefonie pokazujemy mniejszy fragment sali, więc postacie są większe
  const phoneLandscape = Touch.active && window.innerWidth > window.innerHeight && window.innerHeight < 520;
  VIEW_W = phoneLandscape ? 540 : narrow ? 420 : 600;
  VIEW_H = phoneLandscape ? 270 : narrow ? 300 : 375;
  const availW = window.innerWidth - 32 - (wide ? 300 : 0);
  const hudH = document.getElementById('hud').offsetHeight || 40;
  const availH = Touch.active ? window.innerHeight - hudH - 30 : window.innerHeight - (wide ? 130 : 170);
  S = Math.max(0.5, Math.min(availW / VIEW_W, availH / VIEW_H, 2.4));
  DPR = window.devicePixelRatio || 1;
  canvas.style.width = Math.round(VIEW_W * S) + 'px';
  canvas.style.height = Math.round(VIEW_H * S) + 'px';
  canvas.width = Math.round(VIEW_W * S * DPR);
  canvas.height = Math.round(VIEW_H * S * DPR);
  document.documentElement.style.setProperty('--game-w', Math.round(VIEW_W * S) + 'px');
  const need = Math.min(3, Math.max(2, Math.ceil(S * DPR)));
  if (need !== RES) {
    RES = need;
    buildArt();
    refreshBookcases();
  }
}

function updateCamera(dt) {
  let tx = Cat.x - VIEW_W / 2;
  let ty = Cat.y - 40 - VIEW_H / 2;
  if (G.state === 'title') {
    tx = 4.6 * T - VIEW_W / 2;
    ty = 4.2 * T - VIEW_H / 2;
  }
  tx = Math.max(0, Math.min(WORLD_W - VIEW_W, tx));
  ty = Math.max(0, Math.min(WORLD_H - VIEW_H, ty));
  if (Camera.x == null) {
    Camera.x = tx;
    Camera.y = ty;
  }
  const k = Math.min(1, dt * 6);
  Camera.x += (tx - Camera.x) * k;
  Camera.y += (ty - Camera.y) * k;
}

function update(dt) {
  G.time += dt;
  const ovOpen = overlayIsOpen();
  if (G.state === 'play') {
    Cat.update(dt, ovOpen ? new Set() : Input.keys);
    if (ovOpen) {
      if (Input.consumeAction()) closeOverlays();
    } else if (Input.consumeAction() && !G.picker) {
      if (Cat.activity) Act.action();
      else interact();
    }
    updateCustomers(dt);
    if (G.spawned >= G.goal && G.customers.every((c) => c.kind !== 'shopper')) {
      if (G.endTimer < 0) G.endTimer = 1.6;
      G.endTimer -= dt;
      if (G.endTimer <= 0) endDay();
    }
  } else {
    Cat.update(dt, new Set());
  }
  Act.tick(dt);
  if (G.state === 'play') Yarn.update(dt);
  updateCamera(dt);
  Sound.update();

  const targetLight = G.goal ? Math.min(1, G.served / G.goal) : 0;
  G.light += (targetLight - G.light) * Math.min(1, dt * 0.8);
  const nearDoor = G.customers.some((c) => Math.hypot(c.x - DOOR_POS.x, c.y - DOOR_POS.y) < 50);
  G.doorOpen += ((nearDoor ? 1 : 0) - G.doorOpen) * Math.min(1, dt * 8);
  const nearGate = G.customers.some((c) => c.kind === 'reader' && Math.hypot(c.x - GATE.x, c.y - GATE.y) < 46);
  G.gateOpen = (G.gateOpen || 0) + ((nearGate ? 1 : 0) - (G.gateOpen || 0)) * Math.min(1, dt * 8);

  for (const f of G.floaters) f.t += dt;
  G.floaters = G.floaters.filter((f) => f.t < f.life);
  for (const p of G.particles) {
    p.t += dt;
    if (p.t > 0) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  G.particles = G.particles.filter((p) => p.t < p.life);

  if (G.panelDirty) {
    G.panelDirty = false;
    UI.updatePanel();
  }
  let hint = hintText();
  if (Touch.active) hint = hint.replace(/^E:/, '🐾:').replace('naciśnij E', 'dotknij 🐾').replace(/^Wybierz kategorię:.*/, 'Dotknij kategorii, żeby ją wziąć. ✕ zamyka.');
  UI.setHint(hint);
}

function frame(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
  lastTs = ts;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

/* ---------------- RYSOWANIE ---------------- */
function render() {
  const k = S * DPR;
  ctx.setTransform(k, 0, 0, k, -Math.round(Camera.x * k), -Math.round(Camera.y * k));
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  blit(ctx, ART.bg, 0, 0);

  drawWindowsSky();
  drawSunbeams();
  drawDoor();
  drawGate();
  drawRoomEntrance();
  blit(ctx, ART.catBed, CAT_BED.x - 33, CAT_BED.y - 26);
  for (const col of activeSlotCols()) {
    ell(ctx, (col + 0.5) * T, SLOT_Y - 3, 18, 6);
    ctx.fillStyle = 'rgba(233,139,122,0.28)';
    ctx.fill();
  }
  Yarn.drawTrail(ctx);
  drawTargetHighlight();

  const list = [];
  for (const p of STATIC_PROPS) {
    const a = ART[p.art];
    const draw = p.act === 'plant' ? () => drawPlantProp(ctx, p) : () => blit(ctx, a, p.x, p.bottom - a.h);
    list.push({ sortY: p.bottom, draw });
  }
  for (const bc of BOOKCASES) {
    const bottom = (bc.ty + 1) * T;
    list.push({ sortY: bottom, draw: () => blit(ctx, bc.art, bc.tx * T, bottom - BOOKCASE_H) });
  }
  list.push({ sortY: 5 * T, draw: drawCounter });
  for (const c of G.customers)
    list.push({ sortY: c.state === 'reading' ? READ_SEATS[c.seat].bottom + 1 : c.y, draw: () => drawCustomer(ctx, c) });
  list.push({ sortY: Yarn.y, draw: () => Yarn.draw(ctx) });
  list.push({ sortY: Cat.activity ? Act.sortY() : Cat.y + 0.1, draw: () => Cat.draw(ctx) });
  if (Cat.activity && Cat.activity.type === 'read') list.push({ sortY: Cat.activity.prop.bottom + 0.5, draw: () => Act.drawOverlay(ctx) });
  list.sort((a, b) => a.sortY - b.sortY);
  for (const o of list) o.draw();

  drawLighting();
  for (const c of G.customers) drawCustomerBubble(ctx, c);
  Cat.drawCarry(ctx);
  Act.drawEffects(ctx);
  drawParticles();
  drawFloaters();
}

function drawCounter() {
  blit(ctx, ART.counter, T, 5 * T - COUNTER_H);
  const n = Math.min(G.cart.length, 4);
  for (let i = 0; i < n; i++) {
    const b = G.cart[G.cart.length - n + i];
    const x = RETURN_COL * T + 10 + (i % 2) * 6;
    const y = 5 * T - COUNTER_H + 22 - i * 7;
    rr(ctx, x, y, 28, 8, 2);
    fs(ctx, CATEGORIES[b.cat].color, 2);
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(x + 22, y + 2, 4, 4);
  }
}

function drawDoor() {
  const open = G.doorOpen;
  const w = (T - 4) * (1 - 0.8 * open);
  rr(ctx, T + 2, 16, w, 2 * T - 16, [20, open > 0.5 ? 6 : 20, 0, 0]);
  fs(ctx, '#c97d4c', 3);
  if (w > 24) {
    rr(ctx, T + 10, 28, w - 16, 22, 8);
    fs(ctx, '#cdeaf6', 2);
    ell(ctx, T + w - 8, 66, 3, 3);
    fs(ctx, '#f4c542', 1.5);
  }
  const swing = Math.sin(G.time * 16) * 3 * open;
  ctx.save();
  ctx.translate(T + T / 2, 8);
  ctx.rotate(swing * 0.08);
  g_bell(ctx);
  ctx.restore();
}
// Furtka w barierce: otwiera się tylko przed stałymi klientami
function drawGate() {
  const top = 2 * T + 40, len = T + 2;
  const x = GATE.x;
  const a = (G.gateOpen || 0) * Math.PI * 0.45;
  ctx.save();
  ctx.translate(x, top);
  ctx.rotate(-a);
  rr(ctx, -5, 0, 10, len, 4);
  fs(ctx, '#e8a46a', 2.5);
  ell(ctx, 0, len / 2, 7.5, 7.5);
  fs(ctx, '#fff4e2', 2);
  drawStar(ctx, 0, len / 2, 5);
  ctx.restore();
  ell(ctx, x, top, 6, 6);
  fs(ctx, '#f0b77f', 2);
  ell(ctx, x, top + len, 6, 6);
  fs(ctx, '#f0b77f', 2);
}

// Przejście do czytelni: przed zakupem zamknięte drzwi i puste miejsca na meble
function drawRoomEntrance() {
  const y0 = ROOM_DOOR_ROWS[0] * T, h = ROOM_DOOR_ROWS.length * T;
  // tabliczka nad przejściem
  const sy = y0 - 46;
  ctx.beginPath();
  ctx.moveTo(19 * T + 4, sy - 10);
  ctx.lineTo(19 * T - 8, sy + 2);
  ctx.moveTo(20 * T - 4, sy - 10);
  ctx.lineTo(20 * T + 8, sy + 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = OL;
  ctx.stroke();
  rr(ctx, 19 * T - 22, sy, T + 44, 24, 8);
  fs(ctx, '#fff4e2', 2.5);
  ctx.font = '700 11px Fredoka, "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = OL;
  ctx.fillText('Czytelnia', 19.5 * T - 6, sy + 12.5);
  drawStar(ctx, 19.5 * T + 31, sy + 12, 5.5);
  if (branch().reading) return;
  rr(ctx, 19 * T + 4, y0 - 2, T - 8, h + 2, 6);
  fs(ctx, '#c97d4c', 3);
  for (const yy of [y0 + 10, y0 + h / 2 + 4]) {
    rr(ctx, 19 * T + 11, yy, T - 22, h / 2 - 18, 4);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(107,74,58,0.5)';
    ctx.stroke();
  }
  ell(ctx, 19 * T + 12, y0 + h / 2, 3.5, 3.5);
  fs(ctx, '#f4c542', 1.5);
  // tabliczka
  rr(ctx, 19 * T - 6, y0 + h / 2 - 12, T + 12, 22, 6);
  fs(ctx, '#fff4e2', 2);
  ctx.font = '700 10px Fredoka, "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = OL;
  ctx.fillText('wkrótce ⭐', 19.5 * T, y0 + h / 2 - 0.5);
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(185,120,74,0.45)';
  for (const s of READ_SEATS) {
    rr(ctx, s.x + 4, s.bottom - 58, 52, 52, 10);
    ctx.stroke();
  }
  rr(ctx, 21 * T + 4, 2 * T + 4, 3 * T - 8, T - 8, 8);
  ctx.stroke();
  ctx.setLineDash([]);
}

function g_bell(g) {
  g.beginPath();
  g.arc(0, 8, 6, Math.PI, 0);
  g.lineTo(7, 10);
  g.lineTo(-7, 10);
  g.closePath();
  fs(g, '#f4c542', 2);
}

function drawWindowsSky() {
  const p = G.light;
  for (const w of WINDOWS) {
    ctx.save();
    rr(ctx, w.x, w.y, w.w, w.h, 7);
    ctx.clip();
    ctx.fillStyle = `rgba(255,140,80,${0.4 * Math.min(1, p * 1.4)})`;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    if (p > 0.55) {
      const n = (p - 0.55) / 0.45;
      ctx.fillStyle = `rgba(50,40,110,${0.7 * n})`;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = `rgba(255,250,210,${n})`;
      ell(ctx, w.x + w.w - 18, w.y + 14, 6, 6);
      ctx.fill();
      ctx.fillRect(w.x + 12, w.y + 10, 2, 2);
      ctx.fillRect(w.x + 30, w.y + 20, 2, 2);
    }
    ctx.restore();
    ctx.fillStyle = '#fff4e2';
    ctx.fillRect(w.x + w.w / 2 - 2.5, w.y, 5, w.h);
    ctx.fillRect(w.x, w.y + w.h / 2 - 2, w.w, 4);
  }
}

function drawSunbeams() {
  const a = 0.16 * (1 - Math.min(1, G.light * 1.3));
  if (a <= 0.005) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(T, 2 * T, 18 * T, 10 * T);
  ctx.rect(ROOM_X0 * T, 2 * T, (ROOM_X1 - ROOM_X0) * T, 10 * T);
  ctx.clip();
  ctx.fillStyle = `rgba(255,240,190,${a})`;
  for (const w of WINDOWS) {
    ctx.beginPath();
    ctx.moveTo(w.x, w.y + w.h + 10);
    ctx.lineTo(w.x + w.w, w.y + w.h + 10);
    ctx.lineTo(w.x + w.w + 90, w.y + w.h + 210);
    ctx.lineTo(w.x + 70, w.y + w.h + 210);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawTargetHighlight() {
  if (G.state !== 'play' || G.picker) return;
  const { tx, ty } = Cat.target();
  const what = whatIsAt(tx, ty);
  if (!what) return;
  let x, y, w, h;
  if (what.type === 'reader') {
    const c = what.customer;
    const a = 0.55 + Math.sin(G.time * 6) * 0.3;
    ell(ctx, c.x, c.y - 34, 30, 40);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,250,215,${a})`;
    ctx.stroke();
    return;
  }
  if (what.type === 'yarn') {
    const a = 0.55 + Math.sin(G.time * 6) * 0.3;
    ell(ctx, Yarn.x, Yarn.y - YARN_R, YARN_R + 6, YARN_R + 6);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,250,215,${a})`;
    ctx.stroke();
    return;
  }
  if (what.type === 'bookcase') {
    x = what.bc.tx * T - 3;
    y = (what.bc.ty + 1) * T - BOOKCASE_H - 3;
    w = 3 * T + 6;
    h = BOOKCASE_H + 6;
  } else if (what.prop) {
    const a = ART[what.prop.art];
    x = what.prop.x - 4;
    y = what.prop.bottom - a.h - 4;
    w = a.w + 8;
    h = a.h + 8;
  } else if (what.type === 'worldmap') {
    x = WALL_MAP.x - 4;
    y = WALL_MAP.y - 16;
    w = WALL_MAP.w + 8;
    h = WALL_MAP.h + 20;
  } else if (what.type === 'lights') {
    x = what.tx * T - 6;
    y = 4;
    w = T + 12;
    h = theme().lights === 'lanterns' ? 50 : 34;
  } else {
    x = tx * T + 2;
    y = 5 * T - COUNTER_H + 32;
    w = T - 4;
    h = 32;
  }
  const a = 0.55 + Math.sin(G.time * 6) * 0.3;
  rr(ctx, x, y, w, h, 10);
  ctx.lineWidth = 4;
  ctx.strokeStyle = `rgba(255,250,215,${a})`;
  ctx.stroke();
}

function drawLighting() {
  const p = G.light;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (p > 0.01) {
    ctx.fillStyle = `rgba(255,150,70,${0.1 * p})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgba(55,30,85,${0.26 * p})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
  const glow = Math.max(0, (p - 0.3) / 0.7);
  if (glow > 0) {
    ctx.globalCompositeOperation = 'lighter';
    const jp = theme().lights === 'lanterns';
    for (const lamp of LAMPS) {
      const l = { x: lamp.x, y: jp && lamp.jy ? lamp.jy : lamp.y, r: lamp.r };
      const r = l.r * (1 + Math.sin(G.time * 3 + l.x) * 0.03);
      const grd = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, r);
      grd.addColorStop(0, `rgba(255,200,120,${0.3 * glow})`);
      grd.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(l.x - r, l.y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (theme().lights === 'lanterns') return drawLanterns(glow);
  // girlanda lampek
  const colors = ['#ffd36b', '#ff9e8a', '#9fe0c0', '#a8c8ff'];
  ctx.beginPath();
  for (let x = 2.2 * T; x < 25.6 * T; x += 4) ctx.lineTo(x, 13 + Math.sin(x * 0.045) * 4 + 4 + Act.wobble(x) * 0.6);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(107,74,58,0.6)';
  ctx.stroke();
  for (let i = 0, x = 2.4 * T; x < 25.5 * T; x += 26, i++) {
    const y = 13 + Math.sin(x * 0.045) * 4 + 9 + Act.wobble(x);
    const on = (glow > 0 && Math.sin(G.time * 2 + i) > -0.6) || Math.abs(Act.wobble(x)) > 1.5;
    if (on) {
      ell(ctx, x, y, 8, 8);
      ctx.fillStyle = `rgba(255,230,160,${0.3 * glow})`;
      ctx.fill();
    }
    ell(ctx, x, y, 3.5, 4.5);
    fs(ctx, on ? colors[i % 4] : shade(colors[i % 4], -0.2), 1.5);
  }
}

// Papierowe lampiony (Japonia)
function drawLanterns(glow) {
  const xs = [2.6, 5.5, 8.6, 14.1, 18.3, 22.4, 25.2];
  ctx.beginPath();
  ctx.moveTo(1.5 * T, 9);
  ctx.lineTo(25.8 * T, 9);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(107,74,58,0.6)';
  ctx.stroke();
  xs.forEach((tx, i) => {
    const x = tx * T, sway = Math.sin(G.time * 1.2 + i) * 1.5 + Act.wobble(x) * 1.4;
    const y = 30;
    ctx.beginPath();
    ctx.moveTo(x, 9);
    ctx.lineTo(x + sway, y - 12);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = OL;
    ctx.stroke();
    if (glow > 0) {
      ell(ctx, x + sway, y, 22, 22);
      ctx.fillStyle = `rgba(255,170,110,${0.28 * glow})`;
      ctx.fill();
    }
    rr(ctx, x + sway - 6, y - 15, 12, 4, 1.5);
    fs(ctx, '#3e2a24', 1.5);
    ell(ctx, x + sway, y, 10, 12);
    fs(ctx, glow > 0 ? '#ff7a5c' : '#e0504a', 2);
    ctx.strokeStyle = 'rgba(107,40,30,0.45)';
    ctx.lineWidth = 1;
    for (const k of [-5, 0, 5]) {
      ctx.beginPath();
      ctx.moveTo(x + sway - 9.5, y + k);
      ctx.lineTo(x + sway + 9.5, y + k);
      ctx.stroke();
    }
    rr(ctx, x + sway - 6, y + 11, 12, 4, 1.5);
    fs(ctx, '#3e2a24', 1.5);
  });
}

function drawParticles() {
  for (const p of G.particles) {
    if (p.t < 0) continue;
    ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
    drawHeart(ctx, p.x, p.y, 1.1);
  }
  ctx.globalAlpha = 1;
}

function drawFloaters() {
  ctx.font = '700 14px Fredoka, "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of G.floaters) {
    const k = f.t / f.life;
    const y = f.y - k * 26;
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    ctx.lineWidth = 4;
    ctx.strokeStyle = OL;
    ctx.strokeText(f.text, f.x, y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, y);
  }
  ctx.globalAlpha = 1;
}

/* ---------------- START ---------------- */
function init() {
  canvas = document.getElementById('game');
  ctx = canvas.getContext('2d');
  G.today = freshToday();
  branch();
  restock();
  RES = 0;
  canvas.style.width = '1px';
  BOOKCASES = [];
  buildWorld();
  resize();
  buildWorld();
  Cat.reset();
  Input.init();
  Sound.loadPrefs();
  Touch.init();
  Shop.init();
  UI.init();
  window.addEventListener('resize', resize);
  UI.updateHUD();
  UI.showTitle(readSave());
  // po załadowaniu fontu przerysuj napisy w cache
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      buildArt();
      refreshBookcases();
    });
  }
  requestAnimationFrame((ts) => {
    lastTs = ts;
    requestAnimationFrame(frame);
  });
}

window.addEventListener('DOMContentLoaded', init);
