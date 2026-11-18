'use strict';
/* =========================================================
   Interfejs HTML: HUD, panel, menu kategorii, podsumowanie, mapa świata.
   ========================================================= */

const $ = (id) => document.getElementById(id);

const COZY_LINES = [
  '{kot} zwija się w kłębek na fotelu i mruczy z zadowolenia.',
  'Za oknem zapalają się latarnie, a w bibliotece pachnie kakao.',
  'Ostatnia strona przeczytana, światło zgaszone. Dobranoc, {imie}!',
  'Wszystkie półki ułożone, a na parapecie śpi księżyc.',
];

/* ---------- menu wyboru kategorii przy szafie ---------- */
const Picker = {
  open(bc) {
    const b = branch();
    const full = Cat.bag.length >= Cat.capacity();
    const items = bc.cats.map((c) => ({ type: 'take', cat: c, stock: b.stock[c], max: maxStock(c), ok: b.stock[c] > 0 && !full }));
    // książki z torby (nie zwroty), które można odłożyć do tej szafy
    const seen = {};
    for (const it of Cat.bag) {
      if (it.returned || !bc.cats.includes(it.cat)) continue;
      seen[it.cat] = (seen[it.cat] || 0) + 1;
    }
    for (const c in seen) items.push({ type: 'put', cat: c, count: seen[c], ok: true });
    G.picker = { bc, items, sel: Math.max(0, items.findIndex((i) => i.ok)), full };
    Input.keys.clear();
    Input.vec = null;
    Sound.play('open');
    this.render();
  },
  render() {
    const p = G.picker;
    const el = $('picker');
    $('canvas-wrap').classList.toggle('picker-open', !!p);
    if (!p) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    const cap = Cat.capacity();
    $('picker-title').textContent = cap > 1 ? `Wybierz kategorię · torba ${Cat.bag.length}/${cap}` : 'Wybierz kategorię';
    $('picker-list').innerHTML = p.items
      .map((it, i) => {
        const name = CATEGORIES[it.cat].name;
        const right =
          it.type === 'put' ? `z torby${it.count > 1 ? ` ×${it.count}` : ''}` : !it.stock ? 'pusto' : p.full ? 'torba pełna' : `${it.stock}/${it.max}`;
        return `<li><button type="button" data-i="${i}" class="${i === p.sel ? 'sel' : ''} ${it.type}" ${it.ok ? '' : 'disabled'}>
          <span class="num">${i + 1}</span>
          <span class="chip" style="background:${CATEGORIES[it.cat].color}"></span>
          <span class="pname">${it.type === 'put' ? '↩ Odłóż: ' + name : name}</span>
          <span class="stock">${right}</span></button></li>`;
      })
      .join('');
  },
  move(d) {
    const p = G.picker;
    const n = p.items.length;
    for (let k = 1; k <= n; k++) {
      const i = (((p.sel + d * k) % n) + n) % n;
      if (p.items[i].ok) {
        p.sel = i;
        break;
      }
    }
    this.render();
  },
  choose(i) {
    if (!G.picker || !G.picker.items[i]) return;
    G.picker.sel = i;
    this.confirm();
  },
  confirm() {
    const p = G.picker;
    if (!p) return;
    const it = p.items[p.sel];
    if (it && it.ok) {
      if (it.type === 'take') takeBook(it.cat);
      else putBack(Cat.bag.findIndex((x) => !x.returned && x.cat === it.cat));
    }
    this.close();
  },
  close() {
    G.picker = null;
    this.render();
  },
};

const UI = {
  init() {
    $('cat-name').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ($('btn-continue').hidden ? $('btn-start') : $('btn-continue')).click();
      }
    });
    $('btn-start').addEventListener('click', () => {
      if (readSave() && $('confirm-new').hidden) {
        $('confirm-new').hidden = false;
        return;
      }
      startGame(false);
    });
    $('btn-new-yes').addEventListener('click', () => startGame(false));
    $('btn-new-no').addEventListener('click', () => ($('confirm-new').hidden = true));
    $('btn-continue').addEventListener('click', () => startGame(true));
    $('btn-next').addEventListener('click', () => nextDay());
    $('btn-map').addEventListener('click', () => this.showMap(true));
    $('btn-loyal').addEventListener('click', () => this.showLoyal(true));
    $('btn-loyal-close').addEventListener('click', () => this.showLoyal(false));
    $('btn-map-sum').addEventListener('click', () => this.showMap(true));
    $('btn-map-close').addEventListener('click', () => this.showMap(false));
    $('map-list').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.open) openBranch(b.dataset.open);
      if (b.dataset.go) switchRegion(b.dataset.go);
      this.showMap(false);
      this.showSummary();
    });
    $('picker-list').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) Picker.choose(+b.dataset.i);
    });
    $('picker-close').addEventListener('click', () => Picker.close());

    // windows close with their ✕ or with a tap on the empty space around them
    const closers = {
      'overlay-map': () => this.showMap(false),
      'overlay-loyal': () => this.showLoyal(false),
      'overlay-account': () => AccountUI.close(),
    };
    for (const [id, close] of Object.entries(closers)) {
      const ov = $(id);
      ov.querySelector('.card-close').addEventListener('click', close);
      ov.addEventListener('click', (e) => {
        if (e.target === ov) close();
      });
    }

    // przełączniki dźwięku
    const syncAudioBtns = () => {
      $('btn-sfx').textContent = Sound.sfxOn ? '🔊' : '🔈';
      $('btn-sfx').setAttribute('aria-pressed', Sound.sfxOn);
      $('btn-sfx').title = Sound.sfxOn ? 'Wycisz efekty' : 'Włącz efekty';
      $('btn-music').classList.toggle('off', !Sound.musicOn);
      $('btn-music').setAttribute('aria-pressed', Sound.musicOn);
      $('btn-music').title = Sound.musicOn ? 'Wyłącz muzykę' : 'Włącz muzykę';
    };
    $('btn-sfx').addEventListener('click', () => {
      Sound.unlock();
      Sound.setSfx(!Sound.sfxOn);
      syncAudioBtns();
    });
    $('btn-music').addEventListener('click', () => {
      Sound.unlock();
      Sound.setMusic(!Sound.musicOn);
      syncAudioBtns();
    });
    syncAudioBtns();
    // cichy klik przy przyciskach interfejsu
    document.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.classList.contains('buy') && b.id !== 'btn-sfx') Sound.play('click');
    });

    // kotek na ekranie tytułowym
    const tc = $('title-cat');
    const g = tc.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    tc.width = 120 * dpr;
    tc.height = 110 * dpr;
    g.scale(dpr * 1.45, dpr * 1.45);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    drawCat(g, 41, 72, { dir: 'down', pose: 'sit', t: 0 });
  },

  showTitle(save) {
    $('cat-name').value = (save && save.catName) || '';
    $('overlay-title').hidden = false;
    $('overlay-summary').hidden = true;
    $('confirm-new').hidden = true;
    $('save-slot').hidden = !save;
    if (save) {
      $('slot-name').textContent = `🐱 ${save.catName || 'Kotka'}`;
      $('slot-info').textContent = `☀️ dzień ${save.day || 1} · 🪙 ${save.coins || 0} · 💗 ${save.hearts || 0}`;
    }
    if (save) {
      $('btn-continue').hidden = false;
      $('btn-continue').textContent = `Kontynuuj · dzień ${save.day}`;
      $('btn-start').textContent = 'Nowa gra';
      $('btn-start').classList.add('secondary');
    } else {
      $('btn-continue').hidden = true;
      $('btn-start').textContent = 'Otwórz bibliotekę';
      $('btn-start').classList.remove('secondary');
    }
  },

  hideOverlays() {
    $('overlay-title').hidden = true;
    $('overlay-summary').hidden = true;
    $('overlay-map').hidden = true;
    $('overlay-loyal').hidden = true;
  },

  // Karta stałych klientów bieżącej filii
  showLoyal(show) {
    $('overlay-loyal').hidden = !show;
    if (!show) return;
    const b = branch();
    const all = Object.entries(b.visits || {}).sort((a, z) => z[1].n - a[1].n || a[0].localeCompare(z[0], 'pl'));
    const loyal = all.filter(([, v]) => v.n >= LOYAL_AT).length;
    $('loyal-sub').textContent =
      `${region().emoji} ${region().name}: stałych klientów ${loyal}. Gość dostaje ⭐ po ${LOYAL_AT} obsłużonych wizytach.` +
      (b.reading ? ' Stali klienci mogą wejść do czytelni.' : ' Czytelnię dla nich kupisz w sklepie na koniec dnia.');
    $('loyal-list').innerHTML = all.length
      ? all
          .map(([name, v]) => {
            const star = v.n >= LOYAL_AT;
            const n = Math.min(v.n, LOYAL_AT);
            const pips = `<span class="stars">${'★'.repeat(n)}${'☆'.repeat(LOYAL_AT - n)}</span>`;
            const favs = SPECIES[v.species].fav.map((c) => CATEGORIES[c].name).join(', ');
            return `<li class="region ${star ? 'active' : ''}">
              <div class="r-emoji">${SPECIES[v.species].emoji}</div>
              <div class="r-body"><b>${name}</b>
                <p>${pips} Wizyty: ${v.n}</p>
                <p>Lubi: ${favs}</p>
                ${v.teas ? `<p>☕ Wypite herbatki: ${v.teas}</p>` : ''}</div>
              <span class="r-tag">${star ? '⭐ Stały klient' : `jeszcze ${LOYAL_AT - v.n}`}</span>
            </li>`;
          })
          .join('')
      : '<li class="empty">Jeszcze nikogo tu nie ma. Obsługuj gości, a pojawią się na karcie! 🐾</li>';
  },

  showSummary() {
    const t = G.today;
    $('sum-title').textContent = `Koniec dnia ${G.day}`;
    const tips = t.tips ? `<li><span>💝 Napiwki</span><b>${t.tips}</b></li>` : '';
    $('sum-stats').innerHTML = `
      <li><span>📕 Sprzedane</span><b>${t.sold}</b></li>
      <li><span>📖 Wypożyczone</span><b>${t.lent}</b></li>
      <li><span>📚 Odłożone zwroty</span><b>${t.returned}</b></li>
      ${t.missed ? `<li><span>🌙 Wrócą jutro (zabrakło książek)</span><b>${t.missed}</b></li>` : ''}
      ${tips}
      <li class="total"><span>🪙 Zarobek dzisiaj</span><b>${t.coins}</b></li>`;
    $('sum-line').textContent = withName(COZY_LINES[(G.day - 1) % COZY_LINES.length]);
    $('sum-note').textContent = G.loans.length
      ? `U czytelników: ${G.loans.length} wypożyczonych. Wrócą w kolejnych dniach. Rano przyjdzie dostawa nowych książek.`
      : 'Rano przyjdzie dostawa nowych książek.';
    $('btn-next').textContent = `Dzień ${G.day + 1} →`;
    Shop.render();
    $('overlay-summary').hidden = false;
  },

  showMap(show) {
    $('overlay-map').hidden = !show;
    if (!show) return;
    const between = G.state === 'summary';
    $('map-note').textContent = between
      ? 'Wybierz filię, w której spędzisz następny dzień.'
      : 'Nową filię otworzysz albo zmienisz na koniec dnia (przycisk „Mapa świata” w podsumowaniu).';
    $('map-list').innerHTML = REGIONS.map((r) => {
      const active = r.id === G.region;
      const owned = G.unlocked.includes(r.id);
      let tag = 'Wkrótce', action = '';
      if (active) tag = 'Twoja filia';
      else if (owned) {
        tag = 'Otwarta';
        action = `<button type="button" class="buy" data-go="${r.id}" ${between ? '' : 'disabled'}>Przenieś się</button>`;
      } else if (r.available) {
        const req = requirementProgress(r);
        const ok = requirementMet(r);
        tag = ok ? 'Do otwarcia' : 'Zablokowana';
        const reqLine = req
          ? `<p class="r-req ${ok ? 'done' : ''}">${ok ? '✓' : '🔒'} Wszystkie szafy w filii ${req.name}: ${Math.min(req.have, req.need)}/${req.need}</p>`
          : '';
        action = `${reqLine}<button type="button" class="buy" data-open="${r.id}" ${between && ok && G.coins >= r.price ? '' : 'disabled'}>Otwórz filię · 🪙 ${r.price}</button>`;
      }
      const sp = r.species ? `<p class="r-species">${r.species.map((s) => SPECIES[s].emoji).join(' ')}</p>` : '';
      return `<li class="region ${r.available ? '' : 'locked'} ${active ? 'active' : ''}">
        <div class="r-emoji">${r.emoji}</div>
        <div class="r-body"><b>${r.name}</b><p>${r.desc}</p>${sp}${action}</div>
        <span class="r-tag">${tag}</span>
      </li>`;
    }).join('');
  },

  updateHUD() {
    $('hud-day').textContent = G.day;
    $('hud-coins').textContent = G.coins;
    $('hud-hearts').textContent = G.hearts;
    $('hud-progress').textContent = `${Math.min(G.served, G.goal)}/${G.goal}`;
    $('hud-region').textContent = `${region().emoji} ${region().name}`;
    $('hud-name').textContent = `🐱 ${G.catName || 'Kotka'}`;
  },

  updatePanel() {
    const items = [];
    for (const c of G.customers) {
      if (c.leaving || c.state === 'happy' || c.state === 'sad') continue;
      const emoji = SPECIES[c.species].emoji;
      const star = isLoyal(c.name) ? ' ⭐' : '';
      if (c.kind === 'reader') {
        items.push(`<li class="${c.state === 'reading' ? '' : 'pending'}"><div class="who">${emoji} ${c.name}${star}</div>
          <div class="what">${
          c.state !== 'reading' ? 'idzie do czytelni' : c.tea ? '📖 czyta, pije herbatkę ☕' : c.t > 3 ? '📖 czyta i ma ochotę na herbatkę ☕' : '📖 czyta w czytelni'
        }</div></li>`);
        continue;
      }
      if (c.kind === 'shopper') {
        const r = c.request;
        const g = CATEGORIES[r.cat];
        const arrived = c.state === 'wait';
        items.push(`<li class="${arrived ? '' : 'pending'}">
          <div class="who">${emoji} ${c.name}${star}${arrived ? '' : ' <i>(idzie do lady)</i>'}</div>
          <div class="what"><span class="mode ${r.mode}">${r.mode === 'buy' ? 'KUPNO' : 'WYPOŻYCZENIE'}</span>
          <span class="chip" style="background:${g.color}"></span>${g.name}</div>
          <div class="title">„${r.title}”</div></li>`);
      } else {
        items.push(`<li class="return"><div class="who">${emoji} ${c.name}</div>
          <div class="what">oddaje książkę do kosza zwrotów</div></li>`);
      }
    }
    const waiting = G.customers.filter((c) => c.kind === 'shopper' && c.state === 'wait' && !c.leaving).length;
    $('panel-badge').hidden = !waiting;
    $('panel-badge').textContent = waiting;
    $('requests').innerHTML = items.length ? items.join('') : '<li class="empty">Cisza i spokój… czekamy na gości ☕</li>';
    $('cart-info').textContent = G.cart.length ? `W koszu zwrotów: ${G.cart.length} 📚` : '';

    const cap = Cat.capacity();
    $('carry-title').textContent = cap > 1 ? `W torbie (${Cat.bag.length}/${cap})` : 'W łapkach';
    $('carry').innerHTML = Cat.bag.length
      ? Cat.bag
          .map((it) => {
            const g = CATEGORIES[it.cat];
            return `<span class="bag-item"><span class="chip" style="background:${g.color}"></span>${g.name}${
              it.returned ? ' <i>(zwrot)</i>' : ''
            }</span>`;
          })
          .join('')
      : Cat.tea ? '' : `<i>${cap > 1 ? 'Torba pusta' : 'Nic, łapki wolne'}</i>`;
    if (Cat.tea) $('carry').innerHTML += '<span class="bag-item">☕ Herbatka dla czytelnika</span>';

    const b = branch();
    $('stock').innerHTML = availableCats()
      .map((c) => {
        const s = b.stock[c], m = maxStock(c);
        return `<li class="${s ? '' : 'out'}"><span class="chip" style="background:${CATEGORIES[c].color}"></span>
          <span class="sname">${CATEGORIES[c].name}</span><span class="sbar"><i style="width:${(100 * s) / m}%"></i></span>
          <span class="snum">${s}/${m}</span></li>`;
      })
      .join('');
    $('loans').textContent = G.loans.length ? `U czytelników: ${G.loans.length} wypożyczonych` : '';
  },

  setHint(text) {
    const el = $('hint');
    if (el.textContent !== text) el.textContent = text;
  },
};
