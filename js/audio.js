'use strict';
/* =========================================================
   Dźwięki i muzyka – syntezowane w Web Audio API (bez plików).
   ========================================================= */

const AUDIO_PREFS_KEY = 'kocia-biblioteka-audio';

const Sound = {
  ctx: null,
  master: null,
  sfx: null,
  music: null,
  noiseBuf: null,
  sfxOn: true,
  musicOn: true,
  nextTime: 0,
  step: 0,
  lastStepSound: 0,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem(AUDIO_PREFS_KEY) || '{}');
      if (p.sfxOn === false) this.sfxOn = false;
      if (p.musicOn === false) this.musicOn = false;
    } catch (e) {
      /* brak dostępu do pamięci – zostają domyślne */
    }
  },
  savePrefs() {
    try {
      localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify({ sfxOn: this.sfxOn, musicOn: this.musicOn }));
    } catch (e) {
      /* ignorujemy */
    }
  },

  // Wywoływane po kliknięciu (przeglądarki wymagają interakcji przed dźwiękiem)
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const c = (this.ctx = new AC());
        this.master = c.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(c.destination);
        this.sfx = c.createGain();
        this.sfx.gain.value = this.sfxOn ? 1 : 0;
        this.sfx.connect(this.master);
        this.music = c.createGain();
        this.music.gain.value = 0;
        // delikatne echo dla pozytywki
        const delay = c.createDelay();
        delay.delayTime.value = 0.32;
        const fb = c.createGain();
        fb.gain.value = 0.28;
        const wet = c.createGain();
        wet.gain.value = 0.35;
        this.musicBus = c.createGain();
        this.musicBus.connect(this.music);
        this.musicBus.connect(delay);
        delay.connect(fb);
        fb.connect(delay);
        delay.connect(wet);
        wet.connect(this.music);
        this.music.connect(this.master);
        // bufor szumu (szelest, kroki, mruczenie)
        const len = c.sampleRate;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.nextTime = c.currentTime + 0.3;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.setMusic(this.musicOn);
    } catch (e) {
      this.ctx = null;
    }
  },

  setSfx(on) {
    this.sfxOn = on;
    if (this.sfx) this.sfx.gain.value = on ? 1 : 0;
    this.savePrefs();
  },
  setMusic(on) {
    this.musicOn = on;
    if (this.music) {
      const t = this.ctx.currentTime;
      this.music.gain.cancelScheduledValues(t);
      this.music.gain.setTargetAtTime(on ? this.musicLevel() : 0, t, 0.4);
    }
    this.savePrefs();
  },
  musicLevel() {
    return 0.55 * (1 - 0.35 * (G.light || 0));
  },

  /* ---------- klocki ---------- */
  tone(freq, dur, o = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const c = this.ctx;
    const t = c.currentTime + (o.when || 0);
    const osc = c.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t + dur);
    const g = c.createGain();
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(o.bus || this.sfx);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  noise(dur, o = {}) {
    if (!this.ctx || !this.sfxOn) return;
    const c = this.ctx;
    const t = c.currentTime + (o.when || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.value = o.freq || 2000;
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return g;
  },

  purr() {
    if (!this.ctx || !this.sfxOn) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.25);
    g.gain.linearRampToValueAtTime(0.35, t + 1.1);
    g.gain.linearRampToValueAtTime(0.0001, t + 1.5);
    const am = c.createGain();
    am.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.frequency.value = 26;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain);
    lfoGain.connect(am.gain);
    src.connect(f);
    f.connect(am);
    am.connect(g);
    g.connect(this.sfx);
    src.start(t);
    lfo.start(t);
    src.stop(t + 1.6);
    lfo.stop(t + 1.6);
  },

  /* ---------- efekty ---------- */
  play(name) {
    if (!this.ctx || !this.sfxOn) return;
    switch (name) {
      case 'bell':
        this.tone(1568, 0.9, { vol: 0.09 });
        this.tone(3136, 0.5, { vol: 0.03 });
        this.tone(2093, 1.0, { vol: 0.08, when: 0.12 });
        this.tone(4186, 0.5, { vol: 0.02, when: 0.12 });
        break;
      case 'rustle':
        this.noise(0.12, { freq: 3200, q: 0.8, vol: 0.12 });
        this.noise(0.16, { freq: 2400, q: 0.8, vol: 0.1, when: 0.09 });
        break;
      case 'cash':
        this.tone(2093, 0.6, { vol: 0.1 });
        this.tone(2637, 0.5, { vol: 0.06, when: 0.06 });
        this.play('coin');
        break;
      case 'coin':
        this.tone(1319, 0.12, { type: 'triangle', vol: 0.09, when: 0.1 });
        this.tone(1976, 0.3, { type: 'triangle', vol: 0.08, when: 0.18 });
        break;
      case 'wrong':
        this.tone(262, 0.28, { type: 'triangle', vol: 0.12, slideTo: 208 });
        break;
      case 'pop':
        this.tone(520, 0.12, { vol: 0.14, slideTo: 880 });
        break;
      case 'click':
        this.tone(988, 0.06, { vol: 0.06 });
        break;
      case 'open':
        this.noise(0.1, { freq: 1500, q: 0.7, vol: 0.06 });
        this.tone(660, 0.1, { vol: 0.06, when: 0.04 });
        break;
      case 'step':
        this.noise(0.05, { filter: 'lowpass', freq: 700, vol: 0.05, attack: 0.003 });
        break;
      case 'purchase':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.08, when: i * 0.07 }));
        break;
      case 'dayEnd':
        [784, 659, 523, 587, 523].forEach((f, i) => this.tone(f, 0.6, { vol: 0.09, when: i * 0.22 }));
        break;
      case 'page':
        this.noise(0.16, { freq: 4200, q: 0.6, vol: 0.07 });
        this.noise(0.12, { freq: 2600, q: 0.7, vol: 0.05, when: 0.1 });
        break;
      case 'water':
        for (let i = 0; i < 7; i++)
          this.tone(500 + Math.random() * 600, 0.08, { vol: 0.045, when: i * 0.2 + Math.random() * 0.08, slideTo: 900 + Math.random() * 500 });
        this.noise(1.8, { filter: 'lowpass', freq: 1200, vol: 0.03, attack: 0.2 });
        break;
      case 'jingle': {
        const notes = [1568, 1760, 2093, 2349, 2637];
        for (let i = 0; i < 3; i++) this.tone(notes[Math.floor(Math.random() * notes.length)], 0.35, { type: 'triangle', vol: 0.045, when: i * 0.06 });
        break;
      }
      case 'sit':
        this.noise(0.25, { filter: 'lowpass', freq: 500, vol: 0.08, attack: 0.02 });
        this.tone(392, 0.18, { vol: 0.06, slideTo: 330, when: 0.05 });
        break;
      case 'boing':
        this.tone(330, 0.18, { type: 'triangle', vol: 0.08, slideTo: 620 });
        this.noise(0.06, { freq: 900, vol: 0.05 });
        break;
      case 'thud':
        this.tone(180, 0.1, { vol: 0.07, slideTo: 120 });
        break;
      case 'sad':
        this.tone(440, 0.3, { vol: 0.06, slideTo: 392 });
        break;
    }
  },

  /* ---------- muzyka: pozytywka ---------- */
  // pentatonika C-dur
  SCALE: [0, 2, 4, 7, 9],
  CHORDS: [
    [48, 52, 55], // C
    [45, 48, 52], // a
    [41, 45, 48], // F
    [43, 47, 50], // G
  ],
  melodyIdx: 7,

  midi(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  },

  musicNote(n, when, dur, vol) {
    const c = this.ctx;
    const f = this.midi(n);
    for (const [mult, v, type] of [[1, 1, 'sine'], [2, 0.25, 'triangle'], [4, 0.06, 'sine']]) {
      const osc = c.createOscillator();
      osc.type = type;
      osc.frequency.value = f * mult;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vol * v, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g);
      g.connect(this.musicBus);
      osc.start(when);
      osc.stop(when + dur + 0.05);
    }
  },

  update() {
    if (!this.ctx || !this.musicOn || this.ctx.state !== 'running') return;
    const c = this.ctx;
    this.music.gain.setTargetAtTime(this.musicLevel(), c.currentTime, 1.5);
    const stepDur = 60 / 68 / 2; // ósemki przy 68 BPM
    if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.25) {
      const s = this.step % 32;
      const chord = this.CHORDS[Math.floor(s / 8) % 4];
      const when = this.nextTime;
      if (s % 8 === 0) {
        this.musicNote(chord[0] - 12, when, 2.8, 0.09);
        chord.forEach((n, i) => this.musicNote(n + 12, when + i * 0.09, 2.2, 0.025));
      }
      if (s % 8 === 4) this.musicNote(chord[2] - 12, when, 1.6, 0.05);
      // melodia: spacer po pentatonice
      if (Math.random() < (s % 2 === 0 ? 0.75 : 0.3)) {
        this.melodyIdx += pick([-2, -1, -1, 1, 1, 2, 0]);
        this.melodyIdx = Math.max(3, Math.min(12, this.melodyIdx));
        const oct = Math.floor(this.melodyIdx / 5);
        const n = 72 + oct * 12 + this.SCALE[this.melodyIdx % 5] - 12;
        this.musicNote(n, when, 1.3, 0.07);
      }
      this.step++;
      this.nextTime += stepDur;
    }
  },
};
