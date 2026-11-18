'use strict';
/* =========================================================
   Phone / tablet mode: the game fills the screen like an app.
   - floating joystick: touch anywhere on the left half and drag
   - paw button on the right
   - side drawer with guests, bag and stock (📋)
   - full screen without the browser bar, "rotate the phone" prompt
   ========================================================= */

const Touch = {
  active: false,
  pointerId: null,
  pickerDir: 0,

  enable() {
    if (this.active) return;
    this.active = true;
    document.body.classList.add('touch');
    // the hint lies on the game, under its windows
    document.getElementById('canvas-wrap').appendChild(document.getElementById('hint'));
    this.syncFullscreenBtn();
    if (typeof resize === 'function' && canvas) resize();
  },

  /* ---------- full screen ---------- */
  standalone() {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches) ||
      window.navigator.standalone === true
    );
  },
  fsElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  },
  fsSupported() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  },
  enterFullscreen() {
    if (!this.active || this.standalone() || this.fsElement() || !this.fsSupported()) return;
    const el = document.documentElement;
    const req = el.requestFullscreen
      ? el.requestFullscreen({ navigationUI: 'hide' })
      : el.webkitRequestFullscreen && el.webkitRequestFullscreen();
    Promise.resolve(req)
      .then(() => {
        if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape');
      })
      .catch(() => {
        /* not allowed here (e.g. iPhone): the game still works in the browser */
      });
  },
  exitFullscreen() {
    const ex = document.exitFullscreen || document.webkitExitFullscreen;
    if (ex && this.fsElement()) Promise.resolve(ex.call(document)).catch(() => {});
  },
  syncFullscreenBtn() {
    const btn = document.getElementById('btn-fs');
    btn.hidden = !this.active || this.standalone() || !this.fsSupported();
    btn.classList.toggle('on', !!this.fsElement());
  },

  /* ---------- side drawer ---------- */
  setPanel(open) {
    document.body.classList.toggle('panel-open', open);
    document.getElementById('panel-backdrop').hidden = !open;
    document.getElementById('btn-panel').setAttribute('aria-expanded', String(open));
    if (open) {
      Input.vec = null;
      this.resetJoy();
    }
  },

  resetJoy() {
    const joy = document.getElementById('joy');
    joy.classList.remove('on');
    joy.style.left = joy.style.top = '';
    document.getElementById('joy-knob').style.transform = 'translate(0px, 0px)';
  },

  init() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.enable();
    window.addEventListener('touchstart', () => this.enable(), { passive: true, once: true });

    // iPhone has no full-screen API: suggest adding the game to the home screen
    const ios = /iP(hone|od)/.test(navigator.userAgent);
    document.getElementById('ios-tip').hidden = !(ios && !this.standalone());

    const zone = document.getElementById('joy-zone');
    const joy = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    let cx = 0, cy = 0, R = 50;

    const move = (e) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const mag = Math.min(1, len / R);
      // small dead zone, then full speed from about half the way out
      const speed = mag < 0.15 ? 0 : Math.min(1, (mag - 0.15) / 0.4);
      Input.vec = speed > 0 ? { x: (dx / (len || 1)) * speed, y: (dy / (len || 1)) * speed } : null;

      // in the category menu the stick moves the selection (once per tilt)
      if (G.picker) {
        const vy = dy / R;
        const dir = vy < -0.6 ? -1 : vy > 0.6 ? 1 : 0;
        if (dir && dir !== this.pickerDir) Picker.move(dir);
        this.pickerDir = dir;
      }
    };
    const end = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.pickerDir = 0;
      Input.vec = null;
      this.resetJoy();
    };
    const start = (e, floating) => {
      e.preventDefault();
      this.enable();
      if (this.pointerId != null) return;
      this.pointerId = e.pointerId;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        /* some browsers refuse; the stick still works */
      }
      const r = joy.getBoundingClientRect();
      R = r.width * 0.42;
      // the stick jumps under the finger (or stays put when touched directly)
      cx = floating ? e.clientX : r.left + r.width / 2;
      cy = floating ? e.clientY : r.top + r.height / 2;
      const wrap = (joy.offsetParent || document.body).getBoundingClientRect();
      joy.style.left = cx - wrap.left - r.width / 2 + 'px';
      joy.style.top = cy - wrap.top - r.height / 2 + 'px';
      joy.classList.add('on');
      move(e);
    };
    for (const [el, floating] of [[zone, true], [joy, false]]) {
      el.addEventListener('pointerdown', (e) => start(e, floating));
      el.addEventListener('pointermove', (e) => {
        if (e.pointerId === this.pointerId) move(e);
      });
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    }

    const act = document.getElementById('btn-act');
    act.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      act.classList.add('on');
      if (G.picker) Picker.confirm();
      else if (G.state === 'play') Input.action = true;
    });
    const off = () => act.classList.remove('on');
    act.addEventListener('pointerup', off);
    act.addEventListener('pointercancel', off);
    act.addEventListener('pointerleave', off);

    // full screen when the game starts (needs a tap), and the ⛶ toggle
    for (const id of ['btn-start', 'btn-continue', 'btn-new-yes', 'btn-next']) {
      document.getElementById(id).addEventListener('click', () => this.enterFullscreen());
    }
    document.getElementById('btn-fs').addEventListener('click', () =>
      this.fsElement() ? this.exitFullscreen() : this.enterFullscreen()
    );
    document.addEventListener('fullscreenchange', () => this.syncFullscreenBtn());
    document.addEventListener('webkitfullscreenchange', () => this.syncFullscreenBtn());

    document.getElementById('btn-panel').addEventListener('click', () =>
      this.setPanel(!document.body.classList.contains('panel-open'))
    );
    document.getElementById('panel-backdrop').addEventListener('click', () => this.setPanel(false));
    document.getElementById('btn-portrait-ok').addEventListener('click', () => {
      document.body.classList.add('portrait-ok');
      if (typeof resize === 'function') resize();
    });
  },
};
