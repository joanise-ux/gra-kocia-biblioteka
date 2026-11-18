/* "Opinia / błąd": a short form for testers.
 *
 * Reports go to the `feedback` table in the same Supabase project as the accounts
 * (supabase/schema.sql). Players can only add reports, never read them; you read them
 * in the Supabase dashboard: Table Editor -> feedback.
 *
 * Besides the text we attach a little technical context (day, branch, device, screen,
 * recent game errors) so a bug can be reproduced. No cat name, no account data.
 * While Supabase is not configured, the buttons stay hidden.
 */
const FEEDBACK_MAX = 2000;
const FEEDBACK_COOLDOWN_MS = 20 * 1000;
const FEEDBACK_DRAFT_KEY = 'kocia-biblioteka-feedback-draft';

// Remember the last few game errors: they are the most useful part of a bug report.
const RecentErrors = {
  list: [],
  add(msg) {
    const text = String(msg || '').slice(0, 300);
    if (!text) return;
    this.list.push({ msg: text, at: Math.round(performance.now() / 1000) });
    if (this.list.length > 5) this.list.shift();
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
  lastSentAt: 0,
  sending: false,

  el(id) {
    return document.getElementById(id);
  },

  init() {
    if (!Cloud.configured()) return;
    this.el('btn-feedback').hidden = false;
    this.el('title-feedback').hidden = false;
    this.el('btn-feedback').addEventListener('click', () => this.open());
    this.el('btn-feedback-title').addEventListener('click', () => this.open());
    this.el('btn-fb-cancel').addEventListener('click', () => this.close());
    this.el('btn-fb-close').addEventListener('click', () => this.close());
    this.el('fb-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.send();
    });
    this.el('fb-form').addEventListener('change', (e) => {
      if (e.target.name === 'fb-kind') this.renderKind();
    });
    // keep an unfinished message if the window is closed by accident
    this.el('fb-message').addEventListener('input', () => {
      this.el('fb-error').textContent = '';
      remember(FEEDBACK_DRAFT_KEY, this.el('fb-message').value);
    });
    const ov = this.el('overlay-feedback');
    ov.querySelector('.card-close').addEventListener('click', () => this.close());
    ov.addEventListener('click', (e) => {
      if (e.target === ov) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        e.preventDefault();
        this.close();
      }
    });
  },

  isOpen() {
    return !this.el('overlay-feedback').hidden;
  },

  open() {
    this.el('fb-form').hidden = false;
    this.el('fb-done').hidden = true;
    this.el('fb-error').textContent = '';
    this.el('fb-message').value = recall(FEEDBACK_DRAFT_KEY) || '';
    this.renderKind();
    this.el('overlay-feedback').hidden = false;
    // on phones the keyboard would cover half the window right away: let the player tap first
    if (!document.body.classList.contains('touch')) this.el('fb-message').focus();
    Cloud.getClient().catch(() => {}); // warm up the connection while the player writes
  },

  close() {
    this.el('overlay-feedback').hidden = true;
    if (document.activeElement && this.el('overlay-feedback').contains(document.activeElement)) {
      document.activeElement.blur();
    }
  },

  kind() {
    const checked = this.el('fb-form').querySelector('input[name="fb-kind"]:checked');
    return checked ? checked.value : 'opinia';
  },

  renderKind() {
    const texts = {
      opinia: ['Twoja opinia', 'Co Ci się podoba? Co było nudne albo trudne?'],
      blad: ['Co się stało?', 'Co robiłaś/robiłeś, co się stało, a co powinno się stać?'],
      pomysl: ['Twój pomysł', 'Czego brakuje w grze? Co warto dodać?'],
    };
    const [label, placeholder] = texts[this.kind()];
    this.el('fb-message-lbl').textContent = label;
    this.el('fb-message').placeholder = placeholder;
  },

  // Technical details that help to reproduce a bug. Nothing that identifies the player.
  context() {
    const standalone =
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    return {
      state: G.state,
      day: G.day,
      region: G.region,
      branches: (G.unlocked || []).length,
      ua: navigator.userAgent.slice(0, 300),
      lang: navigator.language,
      screen: `${screen.width}x${screen.height}`,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio || 1,
      touch: document.body.classList.contains('touch'),
      standalone,
      online: navigator.onLine,
      account: !!Cloud.user,
      playedSeconds: Math.round(G.time || 0),
      errors: RecentErrors.list,
    };
  },

  async send() {
    if (this.sending) return;
    const message = this.el('fb-message').value.trim();
    const contact = this.el('fb-contact').value.trim();
    const ratingInput = this.el('fb-form').querySelector('input[name="fb-rating"]:checked');
    const error = this.el('fb-error');

    if (message.length < 3) {
      error.textContent = 'Napisz choć kilka słów.';
      this.el('fb-message').focus();
      return;
    }
    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
      error.textContent = 'To nie wygląda na adres e-mail. Możesz też zostawić to pole puste.';
      return;
    }
    if (Date.now() - this.lastSentAt < FEEDBACK_COOLDOWN_MS) {
      error.textContent = 'Odczekaj chwilę przed wysłaniem kolejnego zgłoszenia.';
      return;
    }
    if (navigator.onLine === false) {
      error.textContent = 'Brak internetu. Twoja wiadomość poczeka tutaj, wyślij ją, gdy wróci połączenie.';
      return;
    }

    this.sending = true;
    const btn = this.el('btn-fb-send');
    btn.disabled = true;
    btn.textContent = 'Wysyłam…';
    error.textContent = '';
    try {
      const client = await Cloud.getClient();
      const { error: dbError } = await client.from('feedback').insert({
        kind: this.kind(),
        rating: ratingInput ? +ratingInput.value : null,
        message: message.slice(0, FEEDBACK_MAX),
        contact: contact || null,
        context: this.context(),
      });
      if (dbError) throw dbError;
      this.lastSentAt = Date.now();
      Stats.event('opinia wysłana', { rodzaj: this.kind() });
      // clear the form for the next report
      this.el('fb-message').value = '';
      forget(FEEDBACK_DRAFT_KEY);
      if (ratingInput) ratingInput.checked = false;
      this.el('fb-form').hidden = true;
      this.el('fb-done').hidden = false;
      this.el('btn-fb-close').focus();
    } catch (e) {
      const m = String((e && e.message) || '').toLowerCase();
      error.textContent =
        m.includes('za dużo') || m.includes('too many')
          ? 'Dużo zgłoszeń naraz. Spróbuj ponownie za kilka minut.'
          : 'Nie udało się wysłać. Sprawdź internet i spróbuj ponownie. Twoja wiadomość czeka w okienku.';
    } finally {
      this.sending = false;
      btn.disabled = false;
      btn.textContent = 'Wyślij';
    }
  },
};
