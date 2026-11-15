'use strict';
/* =========================================================
   Kotek – ruch, kolizje, animacja, niesienie książki. Klawiatura.
   ========================================================= */

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

const Input = {
  keys: new Set(),
  vec: null, // analogowy kierunek z joysticka
  action: false,
  init() {
    const map = {
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
    };
    window.addEventListener('keydown', (e) => {
      if (G.picker) {
        if (map[e.code] === 'up') Picker.move(-1);
        else if (map[e.code] === 'down') Picker.move(1);
        else if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') Picker.confirm();
        else if (e.code === 'Escape' || e.code === 'KeyQ') Picker.close();
        else if (/^Digit[1-9]$/.test(e.code)) Picker.choose(+e.code.slice(5) - 1);
        if (map[e.code] || ['KeyE', 'Space', 'Enter'].includes(e.code)) e.preventDefault();
        return;
      }
      if (map[e.code]) {
        this.keys.add(map[e.code]);
        if (G.state === 'play') e.preventDefault();
      }
      if ((e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') && !e.repeat && G.state === 'play') {
        this.action = true;
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (map[e.code]) this.keys.delete(map[e.code]);
    });
    window.addEventListener('blur', () => this.keys.clear());
  },
  consumeAction() {
    const a = this.action;
    this.action = false;
    return a;
  },
};

const Cat = {
  x: 0, y: 0,
  dir: 'down',
  moving: false,
  walkT: 0,
  idleT: 0,
  purrT: 0,
  blinkT: 2,
  happyT: 0,
  bag: [], // niesione książki: { cat, returned }
  activity: null, // zabawa z otoczeniem (activities.js)

  reset() {
    this.x = CAT_START.x;
    this.y = CAT_START.y;
    this.dir = 'down';
    this.bag = [];
    this.idleT = 0;
    this.activity = null;
  },

  capacity() {
    return 1 + (G.upgrades.bag || 0);
  },

  speed() {
    return 150 * (1 + 0.2 * (G.upgrades.speed || 0));
  },

  collides(x, y) {
    return (
      isSolidPx(x - 13, y - 12) || isSolidPx(x + 13, y - 12) ||
      isSolidPx(x - 13, y - 1) || isSolidPx(x + 13, y - 1)
    );
  },

  update(dt, keys) {
    let vx = 0, vy = 0;
    if (!G.picker) {
      if (keys.has('left')) vx -= 1;
      if (keys.has('right')) vx += 1;
      if (keys.has('up')) vy -= 1;
      if (keys.has('down')) vy += 1;
    }
    if (!G.picker && keys === Input.keys && Input.vec) {
      vx = Input.vec.x;
      vy = Input.vec.y;
    }
    this.moving = vx !== 0 || vy !== 0;

    // zabawa trwa, dopóki kotka się nie ruszy
    if (this.activity) {
      if (this.moving) Act.stop();
      else if (G.state === 'play') Act.update(dt);
    }

    if (this.moving) {
      const len = Math.hypot(vx, vy);
      if (len > 1) {
        vx /= len;
        vy /= len;
      }
      const ax = Math.abs(vx), ay = Math.abs(vy);
      const horiz = vx < 0 ? 'left' : vx > 0 ? 'right' : null;
      const vert = vy < 0 ? 'up' : vy > 0 ? 'down' : null;
      if (ax > ay * 1.25) this.dir = horiz;
      else if (ay > ax * 1.25) this.dir = vert;
      else if (this.dir !== horiz && this.dir !== vert) this.dir = vert || horiz;

      const sp = this.speed();
      const nx = this.x + vx * sp * dt;
      if (!this.collides(nx, this.y)) this.x = nx;
      const ny = this.y + vy * sp * dt;
      if (!this.collides(this.x, ny)) this.y = ny;
      this.walkT += dt;
      this.idleT = 0;
      const st = Math.floor(this.walkT * 5);
      if (st !== this.lastStep) {
        this.lastStep = st;
        Sound.play('step');
      }
    } else {
      this.walkT = 0;
      this.idleT = this.activity ? 0 : this.idleT + dt;
    }

    this.blinkT -= dt;
    if (this.blinkT < -0.14) this.blinkT = 2 + Math.random() * 3;
    if (this.happyT > 0) this.happyT -= dt;

    if (this.idleT > 4 && !this.bag.length) {
      this.purrT -= dt;
      if (this.purrT <= 0) {
        this.purrT = 3.2;
        addFloat(this.onBed() ? 'Zzz…' : 'mrr~', this.x + 18, this.y - 60, '#fff6e8', 1.8);
        if (G.state === 'play') Sound.purr();
      }
    } else this.purrT = 0.8;
  },

  onBed() {
    return Math.abs(this.x - CAT_BED.x) < 26 && Math.abs(this.y - CAT_BED.y) < 18;
  },

  target() {
    const [dx, dy] = DIRS[this.dir];
    const px = this.x + dx * 28;
    const py = this.y - 8 + dy * 34;
    return { tx: Math.floor(px / T), ty: Math.floor(py / T) };
  },

  pose() {
    if (this.idleT > 4 && !this.bag.length) return this.onBed() ? 'sleep' : 'sit';
    return 'stand';
  },

  draw(ctx) {
    if (this.activity) return Act.drawCat(ctx);
    drawCat(ctx, this.x, this.y, {
      dir: this.dir,
      moving: this.moving,
      phase: this.walkT * 5,
      t: G.time,
      pose: this.pose(),
      blink: this.blinkT < 0,
      happy: this.happyT > 0,
      purr: this.idleT > 6,
    });
  },

  drawCarry(ctx) {
    const n = this.bag.length;
    if (!n || this.activity) return;
    const bob = Math.sin(G.time * 4) * 1.5;
    // książki ułożone w wachlarzyk nad głową
    this.bag.forEach((it, i) => {
      const off = (i - (n - 1) / 2) * 15;
      const lift = Math.abs(i - (n - 1) / 2) * 3;
      const x = this.x + off, y = this.y - 76 + bob + lift;
      drawBookIcon(ctx, x, y, CATEGORIES[it.cat].color, 1.2);
      if (it.returned) drawBorrow(ctx, x + 9, y - 9, 5);
    });
  },
};
