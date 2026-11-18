/* "Opinia / błąd": the Tally form for testers, opened as a popup over the game.
 *
 * Answers land in Tally (tally.so -> the form -> Submissions). The Tally script is
 * loaded only when a player clicks the button, so nothing is sent to Tally before that.
 *
 * Together with the answers we pass a few technical details as Tally "hidden fields"
 * (they must exist in the form with exactly these names): dzien, filia, stan,
 * urzadzenie, ekran, zainstalowana, konto, bledy. No cat name, no account data.
 * If the Tally script cannot load (e.g. blocked), the form opens in a new tab.
 */
const TALLY_FORM_ID = '5X9QBQ';
const TALLY_SCRIPT = 'https://tally.so/widgets/embed.js';

// Remember the last few game errors: they are the most useful part of a bug report.
const RecentErrors = {
  list: [],
  add(msg) {
    const text = String(msg || '').slice(0, 200);
    if (!text) return;
    this.list.push(text);
    if (this.list.length > 3) this.list.shift();
  },
};
window.addEventListener('error', (e) => {
  const where = e.filename ? ` (${String(e.filename).split('/').pop()}:${e.lineno})` : '';
  RecentErrors.add(`${e.message}${where}`);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  RecentErrors.add(`Promise: ${(r && r.message) || r}`);
});

const Feedback = {
  open_: false,
  loading: null,

  init() {
    const show = (id) => (document.getElementById(id).hidden = false);
    show('btn-feedback');
    show('title-feedback');
    document.getElementById('btn-feedback').addEventListener('click', () => this.open());
    document.getElementById('btn-feedback-title').addEventListener('click', () => this.open());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open_) this.close();
    });
  },

  isOpen() {
    return this.open_;
  },

  close() {
    if (this.open_ && window.Tally) window.Tally.closePopup(TALLY_FORM_ID);
    this.open_ = false;
  },

  // Technical details that help to reproduce a bug. Nothing that identifies the player.
  hiddenFields() {
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const touch = document.body.classList.contains('touch');
    return {
      dzien: String(G.day || 1),
      filia: String(G.region || ''),
      stan: String(G.state || ''),
      urzadzenie: `${touch ? 'dotyk' : 'mysz'} · ${navigator.userAgent.slice(0, 250)}`,
      ekran: `${window.innerWidth}x${window.innerHeight} @${window.devicePixelRatio || 1}x`,
      zainstalowana: standalone ? 'tak' : 'nie',
      konto: typeof Cloud !== 'undefined' && Cloud.user ? 'tak' : 'nie',
      bledy: RecentErrors.list.join(' | ') || 'brak',
    };
  },

  loadTally() {
    if (window.Tally) return Promise.resolve();
    if (!this.loading) {
      this.loading = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = TALLY_SCRIPT;
        s.async = true;
        s.onload = () => (window.Tally ? resolve() : reject(new Error('no Tally')));
        s.onerror = reject;
        document.head.appendChild(s);
        setTimeout(() => reject(new Error('timeout')), 8000);
      }).catch((e) => {
        this.loading = null; // try again next time
        throw e;
      });
    }
    return this.loading;
  },

  // The full page of the form, with the same hidden fields in the address.
  openInNewTab() {
    const params = new URLSearchParams(this.hiddenFields());
    window.open(`https://tally.so/r/${TALLY_FORM_ID}?${params}`, '_blank', 'noopener');
  },

  async open() {
    if (this.open_) return;
    const btns = [document.getElementById('btn-feedback'), document.getElementById('btn-feedback-title')];
    btns.forEach((b) => (b.disabled = true));
    try {
      await this.loadTally();
      Input.keys.clear(); // the cat must not keep walking under the popup
      window.Tally.openPopup(TALLY_FORM_ID, {
        layout: 'modal',
        width: 520,
        emoji: { text: '🐾', animation: 'wave' },
        hiddenFields: this.hiddenFields(),
        onOpen: () => (this.open_ = true),
        onClose: () => (this.open_ = false),
        onSubmit: () => Stats.event('opinia wysłana'),
      });
      this.open_ = true;
    } catch (e) {
      this.openInNewTab();
    } finally {
      btns.forEach((b) => (b.disabled = false));
    }
  },
};
