'use strict';
/* =========================================================
   Sklep ulepszeń (otwierany na koniec dnia).
   ========================================================= */

const Shop = {
  items() {
    const b = branch();
    const list = [];
    const sp = G.upgrades.speed || 0;
    list.push({
      id: 'speed', icon: UPGRADES.speed.icon, name: UPGRADES.speed.name, desc: UPGRADES.speed.desc,
      level: `Poziom ${sp}/${UPGRADES.speed.prices.length}`,
      price: UPGRADES.speed.prices[sp] ?? null,
    });
    const bg = G.upgrades.bag || 0;
    list.push({
      id: 'bag', icon: UPGRADES.bag.icon, name: UPGRADES.bag.name, desc: UPGRADES.bag.desc,
      level: `Książek naraz: ${1 + bg}`,
      price: UPGRADES.bag.prices[bg] ?? null,
    });
    if (b.bookcases < BOOKCASE_SETS.length) {
      const set = BOOKCASE_SETS[b.bookcases];
      list.push({
        id: 'bookcase', icon: '📚', name: 'Nowa szafa',
        desc: `Nowe kategorie: ${set.cats.map((c) => CATEGORIES[c].name).join(' i ')}. Ma też 3 wolne półki.`,
        level: `Szafy ${b.bookcases}/${BOOKCASE_SETS.length}`,
        price: set.price,
      });
    } else {
      list.push({ id: 'bookcase', icon: '📚', name: 'Nowa szafa', desc: 'Wszystkie szafy już stoją.', level: `Szafy ${b.bookcases}/${BOOKCASE_SETS.length}`, price: null });
    }
    const cl = b.slots - 3;
    list.push({
      id: 'counter', icon: UPGRADES.counter.icon, name: UPGRADES.counter.name, desc: UPGRADES.counter.desc,
      level: `Miejsca przy ladzie: ${b.slots}`,
      price: UPGRADES.counter.prices[cl] ?? null,
    });
    list.push({
      id: 'cozy', icon: UPGRADES.cozy.icon, name: UPGRADES.cozy.name, desc: UPGRADES.cozy.desc,
      level: `Poziom ${b.cozy}/${UPGRADES.cozy.prices.length}`,
      price: UPGRADES.cozy.prices[b.cozy] ?? null,
    });
    return list;
  },

  buy(id, cat) {
    const b = branch();
    let price = null;
    if (id === 'shelf') {
      const n = b.shelves[cat];
      if (n >= MAX_SHELVES_PER_CAT || freeShelfSlots(b) <= 0) return;
      price = shelfPrice(n);
    } else {
      const item = this.items().find((i) => i.id === id);
      price = item && item.price;
    }
    if (price == null || G.coins < price) return;
    G.coins -= price;
    Sound.play('purchase');

    if (id === 'speed') G.upgrades.speed = (G.upgrades.speed || 0) + 1;
    if (id === 'bag') G.upgrades.bag = (G.upgrades.bag || 0) + 1;
    if (id === 'counter') b.slots++;
    if (id === 'cozy') b.cozy++;
    if (id === 'bookcase') {
      const set = BOOKCASE_SETS[b.bookcases];
      b.bookcases++;
      for (const c of set.cats) {
        b.shelves[c] = 1;
        b.stock[c] = BOOKS_PER_SHELF;
      }
      buildWorld();
    }
    if (id === 'shelf') {
      b.shelves[cat]++;
      b.stock[cat] = maxStock(cat);
      refreshBookcases();
    }
    save();
    UI.updateHUD();
    this.render();
    G.panelDirty = true;
  },

  render() {
    const el = document.getElementById('shop');
    document.getElementById('shop-coins').textContent = G.coins;
    const b = branch();
    const coins = G.coins;
    const card = (i) => {
      const max = i.price == null;
      const can = !max && coins >= i.price;
      return `<div class="shop-card">
        <div class="shop-icon">${i.icon}</div>
        <div class="shop-body"><b>${i.name}</b><span class="lvl">${i.level}</span><p>${withName(i.desc)}</p></div>
        <button class="buy" data-id="${i.id}" ${can ? '' : 'disabled'}>${max ? 'Maks.' : `🪙 ${i.price}`}</button>
      </div>`;
    };
    const free = freeShelfSlots(b);
    const shelfRows = availableCats()
      .map((c) => {
        const n = b.shelves[c];
        const max = n >= MAX_SHELVES_PER_CAT;
        const price = shelfPrice(n);
        const can = !max && free > 0 && coins >= price;
        return `<li><span class="chip" style="background:${CATEGORIES[c].color}"></span>
          <span class="sname">${CATEGORIES[c].name}</span>
          <span class="pips">${'●'.repeat(n)}${'○'.repeat(MAX_SHELVES_PER_CAT - n)}</span>
          <button class="buy small" data-id="shelf" data-cat="${c}" ${can ? '' : 'disabled'}>${max ? 'Maks.' : `🪙 ${price}`}</button></li>`;
      })
      .join('');
    el.innerHTML = `
      <div class="shop-grid">${this.items().map(card).join('')}</div>
      <div class="shop-card shelves">
        <div class="shop-icon">🗄️</div>
        <div class="shop-body"><b>Dodatkowa półka</b>
          <p>Więcej książek danej kategorii (+4 na półkę) i +1 🪙 za każdą. Wolne półki w szafach: <b>${free}</b>${
            free ? '' : '. Kup nową szafę, żeby zrobić miejsce.'
          }</p>
          <ul class="shelf-list">${shelfRows}</ul>
        </div>
      </div>`;
  },

  init() {
    document.getElementById('shop').addEventListener('click', (e) => {
      const btn = e.target.closest('button.buy');
      if (!btn || btn.disabled) return;
      this.buy(btn.dataset.id, btn.dataset.cat);
    });
  },
};
