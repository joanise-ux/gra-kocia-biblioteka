'use strict';
/* =========================================================
   Sterowanie dotykowe: joystick (lewy dół) i przycisk łapki (prawy dół).
   ========================================================= */

const Touch = {
  active: false,
  pointerId: null,
  pickerDir: 0,

  enable() {
    if (this.active) return;
    this.active = true;
    document.body.classList.add('touch');
    if (typeof resize === 'function' && canvas) resize();
  },

  init() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) this.enable();
    window.addEventListener('touchstart', () => this.enable(), { passive: true, once: true });

    const joy = document.getElementById('joy');
    const knob = document.getElementById('joy-knob');
    const R = 42;

    const move = (e) => {
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2);
      let dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > R) {
        dx = (dx / len) * R;
        dy = (dy / len) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const vx = dx / R, vy = dy / R;
      const mag = Math.hypot(vx, vy);
      Input.vec = mag > 0.22 ? { x: vx, y: vy } : null;

      // w menu kategorii joystick przesuwa wybór (raz na wychylenie)
      if (G.picker) {
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
      knob.style.transform = 'translate(0px, 0px)';
      joy.classList.remove('on');
    };

    joy.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.enable();
      this.pointerId = e.pointerId;
      try {
        joy.setPointerCapture(e.pointerId);
      } catch (err) {
        /* niektóre przeglądarki odmawiają – joystick działa dalej */
      }
      joy.classList.add('on');
      move(e);
    });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) move(e);
    });
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);

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
  },
};
