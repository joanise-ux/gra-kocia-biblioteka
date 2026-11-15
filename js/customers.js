'use strict';
/* =========================================================
   Klienci – zwierzątka, które kupują, wypożyczają i oddają książki.
   ========================================================= */

const GREETINGS = ['Dzień dobry, {imie}!', 'Witaj, {imie}!', 'Hej, {imie}!', 'Dobry dzień!'];
const THANKS = ['Dziękuję, {imie}!', 'Cudownie!', 'Właśnie tej szukałam!', 'Ależ pachnie papierem!', 'Dzięki, {imie}!'];
const WRONG = ['Hmm… to nie ta.', 'Oj, inny gatunek…', 'Szukam czegoś innego.'];
const RETURN_LINES = ['Oddaję, była piękna!', 'Przeczytana!', 'Dziękuję za lekturę, {imie}!'];
const SOLD_OUT = ['Wszystkie wyszły? Wrócę jutro!', 'Nic nie szkodzi, wpadnę jutro!'];

let _custId = 0;

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
  const step = 95 * dt;
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

  for (const loan of G.loans) loan.t -= dt;
  const due = G.loans.find((l) => l.t <= 0);
  if (due && spawnReturner(due)) G.loans.splice(G.loans.indexOf(due), 1);

  for (const c of G.customers) {
    c.t += dt;
    if (c.shake > 0) c.shake -= dt;
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
        if (c.t > 1.3) startLeaving(c);
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
  const moving = c.state === 'enter' || c.state === 'leave';
  let bob = 0;
  if (moving) bob = -Math.abs(Math.sin(c.walkT * 9)) * 3;
  if (c.state === 'wait') bob = Math.sin(c.t * 2.5) * 0.8;
  if (c.state === 'happy') bob = -Math.abs(Math.sin(c.t * 10)) * 5;
  const sx = c.shake > 0 ? Math.sin(c.t * 40) * 2.5 : 0;
  ctx.globalAlpha = Math.max(0, c.alpha);
  drawCritter(ctx, c.x + sx, c.y, c.species, c.scarf, {
    bob,
    moving,
    phase: c.walkT * 5,
    happy: c.state === 'happy',
    wave: c.state === 'wait' && c.t < 1.2,
  });
  if (c.kind === 'returner' && (c.state === 'enter' || c.state === 'drop')) {
    drawBookIcon(ctx, c.x + 15, c.y - 20 + bob, CATEGORIES[c.book.cat].color, 1);
  }
  ctx.globalAlpha = 1;
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
