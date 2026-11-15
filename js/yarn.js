'use strict';
/* =========================================================
   Kłębek wełny: leży na podłodze, kotka go pacha łapką (E)
   albo popycha, gdy w niego wejdzie. Kłębek toczy się,
   odbija od ścian i mebli i zostawia za sobą nitkę.
   ========================================================= */

const YARN_R = 9;
const YARN_START = { x: 9.6 * T, y: 7.4 * T };

const Yarn = {
  x: 0, y: 0, // punkt styku z podłogą
  vx: 0, vy: 0,
  rot: 0,
  trail: [], // nitka: { x, y, t }
  dist: 0,
  hitT: 0,

  reset() {
    this.x = YARN_START.x;
    this.y = YARN_START.y;
    this.vx = this.vy = 0;
    this.rot = 0;
    this.trail = [];
  },

  solidAt(x, y) {
    const r = YARN_R;
    return isSolidPx(x - r, y - 2) || isSolidPx(x + r, y - 2) || isSolidPx(x - r, y - 14) || isSolidPx(x + r, y - 14);
  },

  // Kłębek tuż przed kotką?
  facing() {
    if (Cat.activity) return null;
    const [dx, dy] = DIRS[Cat.dir];
    const px = Cat.x + dx * 26, py = Cat.y - 6 + dy * 22;
    return Math.hypot(this.x - px, this.y - YARN_R - py) < 26 ? { type: 'yarn' } : null;
  },

  bat() {
    const [dx, dy] = DIRS[Cat.dir];
    const sp = 230 + Math.random() * 70;
    const side = (Math.random() - 0.5) * 0.5;
    this.vx = (dx + dy * side) * sp;
    this.vy = (dy - dx * side) * sp;
    Cat.happyT = 0.6;
    Sound.play('boing');
    if (Math.random() < 0.35) addFloat(pick(['Hop!', 'Łap!', 'Turlu, turlu~', 'mrrau!']), Cat.x, Cat.y - 90, '#ffd0e0', 1.2);
  },

  update(dt) {
    this.hitT -= dt;
    // kotka wchodzi w kłębek: popycha go
    if (Cat.moving && !Cat.activity) {
      const ddx = this.x - Cat.x, ddy = this.y - Cat.y;
      const d = Math.hypot(ddx, ddy);
      if (d < 24 && d > 0.01) {
        const sp = Math.max(Math.hypot(this.vx, this.vy), Cat.speed() * 1.35);
        this.vx = (ddx / d) * sp;
        this.vy = (ddy / d) * sp;
      }
    }
    const speed = Math.hypot(this.vx, this.vy);
    if (speed < 4) {
      this.vx = this.vy = 0;
    } else {
      // kilka małych kroków, żeby nie przelecieć przez ścianę
      const steps = Math.ceil((speed * dt) / 4);
      const sdt = dt / steps;
      for (let i = 0; i < steps; i++) {
        const nx = this.x + this.vx * sdt;
        if (this.solidAt(nx, this.y)) this.bounce('x');
        else this.x = nx;
        const ny = this.y + this.vy * sdt;
        if (this.solidAt(this.x, ny)) this.bounce('y');
        else this.y = ny;
      }
      const f = Math.exp(-1.5 * dt);
      this.vx *= f;
      this.vy *= f;
      this.rot += ((Math.abs(this.vx) > Math.abs(this.vy) ? Math.sign(this.vx) : 1) * speed * dt) / YARN_R;
      this.dist += speed * dt;
      if (this.dist > 7) {
        this.dist = 0;
        this.trail.push({ x: this.x, y: this.y - 2, t: 0 });
        if (this.trail.length > 70) this.trail.shift();
      }
    }
    for (const p of this.trail) p.t += dt;
    this.trail = this.trail.filter((p) => p.t < 5);
  },

  bounce(axis) {
    const v = axis === 'x' ? this.vx : this.vy;
    if (axis === 'x') this.vx = -this.vx * 0.6;
    else this.vy = -this.vy * 0.6;
    if (Math.abs(v) > 60 && this.hitT <= 0) {
      this.hitT = 0.15;
      Sound.play('thud');
    }
  },

  /* ---------- rysowanie ---------- */
  // Nitka na podłodze (pod wszystkim)
  drawTrail(g) {
    const pts = this.trail;
    if (pts.length < 2) return;
    g.lineWidth = 1.8;
    for (let i = 1; i < pts.length; i++) {
      const a = Math.max(0, 1 - pts[i].t / 5);
      g.strokeStyle = `rgba(232,106,138,${0.75 * a})`;
      g.beginPath();
      g.moveTo(pts[i - 1].x, pts[i - 1].y);
      g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
    }
    // nitka od ostatniego punktu do kłębka
    const last = pts[pts.length - 1];
    g.strokeStyle = 'rgba(232,106,138,0.75)';
    g.beginPath();
    g.moveTo(last.x, last.y);
    g.lineTo(this.x, this.y - 2);
    g.stroke();
  },

  draw(g) {
    const x = this.x, cy = this.y - YARN_R;
    shadow(g, x, this.y, 11);
    ell(g, x, cy, YARN_R, YARN_R);
    fs(g, '#f08aa4', 2.2);
    g.save();
    ell(g, x, cy, YARN_R, YARN_R);
    g.clip();
    g.strokeStyle = '#c95a7a';
    g.lineWidth = 1.3;
    for (let i = 0; i < 4; i++) {
      const an = this.rot + (i * Math.PI) / 4;
      g.beginPath();
      g.ellipse(x, cy, YARN_R * 1.05, YARN_R * 0.35, an, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
    ell(g, x - 3, cy - 3.5, 2.5, 1.6);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fill();
    // luźny koniec, gdy kłębek leży
    if (!this.trail.length) {
      g.beginPath();
      g.moveTo(x + 6, cy + 5);
      g.quadraticCurveTo(x + 16, this.y + 2, x + 22, this.y - 1);
      g.lineWidth = 1.8;
      g.strokeStyle = '#e86a8a';
      g.stroke();
    }
  },
};
