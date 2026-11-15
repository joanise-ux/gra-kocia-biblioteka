'use strict';
/* =========================================================
   Klienci – zwierzątka, które kupują, wypożyczają i oddają książki.
   ========================================================= */

const GREETINGS = ['Dzień dobry, {imie}!', 'Witaj, {imie}!', 'Hej, {imie}!', 'Dobry dzień!'];
const THANKS = ['Dziękuję, {imie}!', 'Cudownie!', 'Właśnie tej szukałam!', 'Ależ pachnie papierem!', 'Dzięki, {imie}!'];
const WRONG = ['Hmm… to nie ta.', 'Oj, inny gatunek…', 'Szukam czegoś innego.'];
const RETURN_LINES = ['Oddaję, była piękna!', 'Przeczytana!', 'Dziękuję za lekturę, {imie}!'];
const SOLD_OUT = ['Wszystkie wyszły? Wrócę jutro!', 'Nic nie szkodzi, wpadnę jutro!'];

const READER_LINES = ['Cudowna cisza…', 'Jeszcze jeden rozdział!', 'Ach, jak tu miło.', 'Mrr… znaczy, hmm.'];
const READER_BYE = ['Dziękuję za czytelnię, {imie}!', 'Wrócę jutro poczytać!', 'Najlepsze miejsce w lesie!'];
const LOYAL_AT = 5; // tylu obsłużonych wizyt trzeba, żeby zostać stałym klientem

let _custId = 0;

/* ---------------- STALI KLIENCI ---------------- */
function visitsOf(name) {
  const b = branch();
  return (b.visits && b.visits[name]) || null;
}
function isLoyal(name) {
  const v = visitsOf(name);
  return !!v && v.n >= LOYAL_AT;
}
// Zapisuje wizytę; zwraca true, gdy klient właśnie został stałym klientem
function countVisit(c) {
  const b = branch();
  b.visits = b.visits || {};
  const v = (b.visits[c.name] = b.visits[c.name] || { n: 0, species: c.species, scarf: c.scarf });
  v.n++;
  return v.n === LOYAL_AT;
}
function loyalCount() {
  const b = branch();
  return Object.values(b.visits || {}).filter((v) => v.n >= LOYAL_AT).length;
}

/* ---------------- CZYTELNIA ---------------- */
function freeSeat() {
  const taken = G.customers.filter((c) => c.kind === 'reader').map((c) => c.seat);
  const free = READ_SEATS.map((s, i) => i).filter((i) => !taken.includes(i));
  return free.length ? pick(free) : -1;
}
// Od furtki do fotela
function roomPath(seat) {
  const s = READ_SEATS[seat];
  const doorY = (ROOM_DOOR_ROWS[0] + 0.6) * T;
  const p = [
    { x: GATE.x, y: GATE.y },
    { x: 10.5 * T, y: 3.6 * T },
    { x: 10.5 * T, y: doorY },
    { x: 19.5 * T, y: doorY },
  ];
  if (s.ty < ROOM_DOOR_ROWS[0]) p.push({ x: s.sx, y: doorY }, { x: s.sx, y: s.sy });
  else p.push({ x: 20.3 * T, y: doorY }, { x: 20.3 * T, y: 10.55 * T }, { x: s.sx, y: 10.55 * T }, { x: s.sx, y: s.sy });
  return p;
}
function sendToRoom(c, seat, from) {
  c.kind = 'reader';
  c.seat = seat;
  c.col = -1;
  c.state = 'toRoom';
  c.speed = 125;
  c.path = [...from, ...roomPath(seat)];
  c.readFor = 18 + Math.random() * 12;
  c.petted = false;
  c.tea = false;
  G.panelDirty = true;
}
function leaveRoom(c) {
  const back = roomPath(c.seat).reverse().slice(1);
  c.state = 'fromRoom';
  c.leaving = true;
  c.path = [...back, { x: 8.5 * T, y: GATE.y }, { x: DOOR_POS.x, y: AISLE_Y }, { x: DOOR_POS.x, y: DOOR_POS.y }];
  G.panelDirty = true;
}
// Stały klient przychodzi tylko poczytać
function spawnReader() {
  const b = branch();
  const seat = freeSeat();
  if (seat < 0) return false;
  const here = G.customers.map((c) => c.name);
  const names = Object.keys(b.visits || {}).filter((n) => b.visits[n].n >= LOYAL_AT && !here.includes(n));
  if (!names.length) return false;
  const name = pick(names);
  const v = b.visits[name];
  const c = makeCustomer('reader', -1, { species: v.species, name, scarf: v.scarf });
  sendToRoom(c, seat, [{ x: DOOR_POS.x, y: AISLE_Y }, { x: 8.5 * T, y: GATE.y }]);
  G.customers.push(c);
  Sound.play('bell');
  return true;
}
function readerTip(c) {
  const b = branch();
  const n = 4 + b.cozy * 2 + (c.tea ? 6 : 0);
  G.today.tips += n;
  addCoins(n, c.x, c.y - 100);
  G.hearts++;
  G.today.hearts++;
  spawnHearts(c.x, c.y - 70, 2);
  UI.updateHUD();
  save();
}

function slotPath(col) {
  const x = (col + 0.5) * T;
  return [{ x: DOOR_POS.x, y: AISLE_Y }, { x, y: AISLE_Y }, { x, y: SLOT_Y }];
}
function exitPath(col) {
  const x = (col + 0.5) * T;
  return [{ x, y: AISLE_Y }, { x: DOOR_POS.x, y: AISLE_Y }, { x: DOOR_POS.x, y: DOOR_POS.y }];
}

function slotTaken(col) {
  return G.customers.some((c) => c.col === col && !c.leaving);
}

function makeCustomer(kind, col, data) {
  return {
    id: ++_custId,
    kind,
    col,
    species: data.species,
    name: data.name,
    scarf: data.scarf,
    x: DOOR_POS.x,
    y: DOOR_POS.y,
    alpha: 0,
    path: slotPath(col),
    state: 'enter',
    leaving: false,
    t: 0,
    walkT: 0,
    say: null,
    shake: 0,
    checkT: 0,
    request: data.request || null,
    book: data.book || null,
  };
}

function hasSource(cat) {
  return branch().stock[cat] > 0 || Cat.bag.some((it) => it.cat === cat) || G.cart.some((b) => b.cat === cat);
}

function spawnShopper() {
  const free = activeSlotCols().filter((c) => !slotTaken(c));
  if (!free.length) return false;
  const col = pick(free);
  const species = pick(region().species);
  const sp = SPECIES[species];
  const avail = availableCats();
  const favs = sp.fav.filter((c) => avail.includes(c));
  const cat = favs.length && Math.random() < 0.6 ? pick(favs) : pick(avail);
  const mode = Math.random() < 0.55 ? 'buy' : 'borrow';
  const shelvesBonus = (branch().shelves[cat] || 1) - 1;
  const request = {
    cat,
    title: pick(CATEGORIES[cat].titles),
    mode,
    price: mode === 'buy' ? 12 + Math.floor(Math.random() * 8) + shelvesBonus : 6 + shelvesBonus,
  };
  G.customers.push(makeCustomer('shopper', col, { species, name: pick(sp.names), scarf: pick(SCARVES), request }));
  Sound.play('bell');
  G.spawned++;
  G.panelDirty = true;
  return true;
}

function spawnReturner(loan) {
  if (slotTaken(RETURN_COL)) return false;
  G.customers.push(
    makeCustomer('returner', RETURN_COL, {
      species: loan.species,
      name: loan.name,
      scarf: loan.scarf,
      book: { cat: loan.cat, title: loan.title },
    })
  );
  Sound.play('bell');
  G.panelDirty = true;
  return true;
}

function startLeaving(c) {
  c.leaving = true;
  c.state = 'leave';
  c.path = exitPath(c.col);
  G.panelDirty = true;
}

function moveAlong(c, dt) {
  const target = c.path[0];
  if (!target) return true;
  const dx = target.x - c.x, dy = target.y - c.y;
  const dist = Math.hypot(dx, dy);
  const step = (c.speed || 95) * dt;
  c.walkT += dt;
  if (dist <= step) {
    c.x = target.x;
    c.y = target.y;
    c.path.shift();
    return c.path.length === 0;
  }
  c.x += (dx / dist) * step;
  c.y += (dy / dist) * step;
  return false;
}

function updateCustomers(dt) {
  G.spawnTimer -= dt;
  const shoppersIn = G.customers.filter((c) => c.kind === 'shopper').length;
  if (G.spawnTimer <= 0 && G.spawned < G.goal) {
    if (spawnShopper()) G.spawnTimer = shoppersIn === 0 ? 3 + Math.random() * 2 : 5 + Math.random() * 5;
    else G.spawnTimer = 1;
  }
  if (shoppersIn === 0 && G.spawnTimer > 2.5 && G.spawned < G.goal) G.spawnTimer = 2.5;

  // stali klienci wpadają czasem tylko do czytelni
  if (branch().reading) {
    G.readerTimer -= dt;
    if (G.readerTimer <= 0) G.readerTimer = spawnReader() ? 22 + Math.random() * 18 : 6;
  }

  for (const loan of G.loans) loan.t -= dt;
  const due = G.loans.find((l) => l.t <= 0);
  if (due && spawnReturner(due)) G.loans.splice(G.loans.indexOf(due), 1);

  for (const c of G.customers) {
    c.t += dt;
    if (c.shake > 0) c.shake -= dt;
    if (c.happyT > 0) c.happyT -= dt;
    if (c.say) {
      c.say.t -= dt;
      if (c.say.t <= 0) c.say = null;
    }
    switch (c.state) {
      case 'enter':
        c.alpha = Math.min(1, c.alpha + dt * 3);
        if (moveAlong(c, dt)) {
          c.state = c.kind === 'shopper' ? 'wait' : 'drop';
          c.t = 0;
          c.walkT = 0;
          if (c.kind === 'shopper') c.say = { text: pick(GREETINGS), t: 1.4 };
          G.panelDirty = true;
        }
        break;
      case 'wait':
        c.checkT -= dt;
        if (c.checkT <= 0 && c.t > 7) {
          c.checkT = 1.5;
          if (!hasSource(c.request.cat)) {
            c.say = { text: pick(SOLD_OUT), t: 2.2 };
            c.state = 'sad';
            Sound.play('sad');
            c.t = 0;
            G.served++;
            G.today.missed++;
            UI.updateHUD();
            G.panelDirty = true;
          }
        }
        break;
      case 'sad':
        if (c.t > 2) startLeaving(c);
        break;
      case 'drop':
        if (c.t > 0.7) {
          G.cart.push({ cat: c.book.cat, title: c.book.title });
          Sound.play('pop');
          c.say = { text: pick(RETURN_LINES), t: 1.6 };
          spawnHearts(c.x, c.y - 70, 1);
          addFloat('Zwrot!', (RETURN_COL + 0.5) * T, 3.4 * T, '#7fd0c8');
          save();
          startLeaving(c);
        }
        break;
      case 'happy':
        if (c.t > 1.3) {
          const seat = c.toRead ? freeSeat() : -1;
          if (seat >= 0) {
            const x = (c.col + 0.5) * T;
            sendToRoom(c, seat, [{ x, y: GATE.y }]);
            c.say = { text: 'Idę do czytelni! ⭐', t: 1.6 };
          } else startLeaving(c);
        }
        break;
      case 'toRoom':
        c.alpha = Math.min(1, c.alpha + dt * 3);
        if (moveAlong(c, dt)) {
          c.state = 'reading';
          c.t = 0;
          c.walkT = 0;
          G.panelDirty = true;
        }
        break;
      case 'reading':
        if (!c.say && Math.random() < dt * 0.06) c.say = { text: pick(READER_LINES), t: 1.8 };
        if (c.t > c.readFor) {
          c.say = { text: pick(READER_BYE), t: 1.8 };
          readerTip(c);
          leaveRoom(c);
        }
        break;
      case 'fromRoom':
        if (moveAlong(c, dt)) c.state = 'exit';
        break;
      case 'leave':
        if (moveAlong(c, dt)) c.state = 'exit';
        break;
      case 'exit':
        c.alpha -= dt * 3;
        break;
    }
  }
  const before = G.customers.length;
  G.customers = G.customers.filter((c) => !(c.state === 'exit' && c.alpha <= 0));
  if (G.customers.length !== before) G.panelDirty = true;
}

function customerAtSlot(col) {
  return G.customers.find((c) => c.kind === 'shopper' && c.col === col && c.state === 'wait');
}

/* ---------------- RYSOWANIE ---------------- */
function drawCustomer(ctx, c) {
  const moving = ['enter', 'leave', 'toRoom', 'fromRoom'].includes(c.state);
  let bob = 0;
  if (moving) bob = -Math.abs(Math.sin(c.walkT * 9)) * 3;
  if (c.state === 'wait') bob = Math.sin(c.t * 2.5) * 0.8;
  if (c.state === 'happy') bob = -Math.abs(Math.sin(c.t * 10)) * 5;
  if (c.state === 'reading') bob = Math.sin(c.t * 1.6) * 0.6 - (c.happyT > 0 ? Math.abs(Math.sin(c.happyT * 12)) * 4 : 0);
  const sx = c.shake > 0 ? Math.sin(c.t * 40) * 2.5 : 0;
  ctx.globalAlpha = Math.max(0, c.alpha);
  drawCritter(ctx, c.x + sx, c.y, c.species, c.scarf, {
    bob,
    moving,
    phase: c.walkT * 5,
    happy: c.state === 'happy',
    wave: c.state === 'wait' && c.t < 1.2,
  });
  if (c.state === 'reading') {
    drawReaderBook(ctx, c.x, c.y - 26 + bob, c.t);
    if (c.tea) drawTeaCup(ctx, c.x + 24, c.y - 22, 0.8);
  }
  if (isLoyal(c.name)) drawStar(ctx, c.x - 20, c.y - 62 + bob, 6.5);
  if (c.kind === 'returner' && (c.state === 'enter' || c.state === 'drop')) {
    drawBookIcon(ctx, c.x + 15, c.y - 20 + bob, CATEGORIES[c.book.cat].color, 1);
  }
  ctx.globalAlpha = 1;
}

// Otwarta książka trzymana przez czytelnika; co jakiś czas przewraca się kartka
function drawReaderBook(g, x, y, t) {
  const pw = 13;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x - 7, y - 4, x - pw, y - 2);
  g.lineTo(x - pw, y + 7);
  g.quadraticCurveTo(x - 7, y + 5, x, y + 9);
  g.quadraticCurveTo(x + 7, y + 5, x + pw, y + 7);
  g.lineTo(x + pw, y - 2);
  g.quadraticCurveTo(x + 7, y - 4, x, y);
  g.closePath();
  fs(g, '#fff6e8', 2);
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x, y + 9);
  g.lineWidth = 1.5;
  g.stroke();
  const k = (t % 4) / 0.5;
  if (k < 1) {
    const ex = x + pw * Math.cos(Math.PI * k);
    const lift = Math.sin(Math.PI * k) * 6;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(ex, y - 2 - lift);
    g.lineTo(ex, y + 6 - lift);
    g.lineTo(x, y + 9);
    g.closePath();
    fs(g, '#fffdf6', 1.4);
  }
}

function drawStar(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr_ = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr_, y + Math.sin(a) * rr_);
  }
  g.closePath();
  fs(g, '#ffd75e', 1.8);
}

function bubbleBox(ctx, x, y, w, h, tailX) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 9);
  ctx.moveTo(tailX - 6, y + h);
  ctx.lineTo(tailX, y + h + 8);
  ctx.lineTo(tailX + 6, y + h);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = OL;
  ctx.stroke();
  // zakrywamy kreskę w miejscu dzióbka
  ctx.fillStyle = '#fffaf0';
  ctx.fillRect(tailX - 4.5, y + h - 2.5, 9, 3.5);
}

function drawCustomerBubble(ctx, c) {
  if (c.alpha < 0.5) return;
  const cx = c.x;
  const lift = c.col % 2 ? 0 : 14;
  const bottom = c.y - 78 - lift;
  if (c.say) {
    drawSpeech(ctx, c.say.text, cx, bottom);
    return;
  }
  if (c.state === 'reading' && !c.tea && c.t > 3) {
    // dymek: czytelnik ma ochotę na herbatkę
    const w = 30, h = 28;
    const by = c.y - 108 + Math.sin(G.time * 2 + c.id) * 1.5;
    bubbleBox(ctx, cx - w / 2, by, w, h, cx);
    drawTeaCup(ctx, cx - 1, by + 16, 0.85, false);
    return;
  }
  if (c.state !== 'wait') return;
  const r = c.request;
  const w = 54, h = 40;
  const by = bottom - h + Math.sin(G.time * 2 + c.id) * 1.5;
  bubbleBox(ctx, cx - w / 2, by, w, h, cx);
  drawBookIcon(ctx, cx - 12, by + 15, CATEGORIES[r.cat].color, 1.05);
  if (r.mode === 'buy') drawCoin(ctx, cx + 12, by + 15, 8);
  else drawBorrow(ctx, cx + 12, by + 15, 8);
  // podpis, żeby ikonka nie myliła się z upływem czasu
  ctx.font = '600 9px Fredoka, "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = r.mode === 'buy' ? '#b07a12' : '#3f78a8';
  ctx.fillText(r.mode === 'buy' ? 'kup' : 'pożycz', cx, by + 32);
}

function drawSpeech(ctx, text, cx, bottom) {
  text = withName(text);
  ctx.font = '600 12px Fredoka, "Pixelify Sans", sans-serif';
  const tw = Math.ceil(ctx.measureText(text).width);
  const w = tw + 18, h = 24;
  let bx = cx - w / 2;
  bx = Math.max(Camera.x + 4, Math.min(Camera.x + VIEW_W - w - 4, bx));
  const by = bottom - h;
  bubbleBox(ctx, bx, by, w, h, cx);
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + 9, by + h / 2 + 0.5);
}
