/* Player accounts and cloud saves (Supabase).
 *
 * Login is passwordless: the player types an e-mail, gets a code, types the code.
 * The save lives in localStorage as before; when logged in it is also copied to
 * the `saves` table, so the same game continues on a phone and on a laptop.
 *
 * To turn it on, fill in the two values below (Supabase: Project Settings -> API Keys, the publishable key).
 * The anon key is public by design; the data is protected by RLS (supabase/schema.sql).
 * While they are empty, the game works exactly as before, without accounts.
 */
const SUPABASE_URL = 'https://nxwnksubnmgygegfcfuf.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_7iCN0b0wQm_y6rQjRBCsKA_W45Ag21U'; // publishable key

const CLOUD_LINK_KEY = 'kocia-biblioteka-cloud-user'; // which account the local save is synced with
const CLOUD_PUSH_DELAY_MS = 2000;
const CLOUD_START_TIMEOUT_MS = 6000;

const Cloud = {
  client: null,
  clientReady: null,
  user: null,
  ready: false, // first sync finished (or skipped), the title buttons may be used
  reachable: false, // the first connection to Supabase worked

  // No internet (or Supabase unreachable): play locally, do not offer an account.
  offline() {
    return !this.client || !this.reachable || navigator.onLine === false;
  },
  pushTimer: null,
  pushing: null,

  configured() {
    return !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  },

  async init() {
    if (!this.configured()) {
      this.ready = true;
      return;
    }
    AccountUI.render();
    // Never block the game for long: offline or slow network = play locally.
    const giveUp = new Promise((resolve) => setTimeout(resolve, CLOUD_START_TIMEOUT_MS));
    // a slow start may still finish after the timeout: then the account appears on its own
    const started = this.start().then(() => {
      this.reachable = true;
      if (this.ready) AccountUI.render();
    });
    await Promise.race([started, giveUp]).catch(() => {});
    this.ready = true;
    AccountUI.render();
    // Connection lost or back: update the title screen, and upload what waited meanwhile.
    window.addEventListener('offline', () => AccountUI.render());
    window.addEventListener('online', () => {
      this.reachable = true;
      AccountUI.render();
      this.flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.flush();
      else this.checkNewer().catch(() => {});
    });
  },

  // Back to this tab: if the game was played on another device meanwhile,
  // load that progress instead of overwriting it with this older copy.
  async checkNewer() {
    if (!this.user || this.pushTimer) return;
    const cloud = await this.fetchCloud();
    const local = readSave();
    if (!cloud || (local && (cloud.savedAt || 0) <= (local.savedAt || 0))) return;
    if (G.state === 'title') this.useCloud(cloud);
    else {
      writeSave(cloud);
      location.reload();
    }
  },

  // The Supabase library is loaded once, on first use (accounts or the feedback form).
  getClient() {
    if (!this.clientReady) {
      this.clientReady = loadScript('js/vendor/supabase-2.118.0.js').then(() => {
        this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        });
        return this.client;
      });
      this.clientReady.catch(() => (this.clientReady = null)); // offline: try again next time
    }
    return this.clientReady;
  },

  async start() {
    await this.getClient();
    const { data } = await this.client.auth.getSession();
    this.user = data.session ? data.session.user : null;
    if (this.user) await this.sync();
  },

  /* ---------- logging in ---------- */
  async sendCode(email) {
    const { error } = await this.client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  },

  async verifyCode(email, code) {
    const { data, error } = await this.client.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw error;
    this.user = data.user;
    await this.sync();
  },

  async signOut() {
    await this.flush();
    await this.client.auth.signOut({ scope: 'local' });
    this.user = null;
    forget(CLOUD_LINK_KEY);
  },

  async deleteAccount() {
    const { error } = await this.client.rpc('delete_my_account');
    if (error) throw error;
    await this.client.auth.signOut({ scope: 'local' }).catch(() => {});
    this.user = null;
    forget(CLOUD_LINK_KEY);
  },

  /* ---------- saves ---------- */
  async fetchCloud() {
    const { data, error } = await this.client
      .from('saves')
      .select('data')
      .eq('user_id', this.user.id)
      .maybeSingle();
    if (error) throw error;
    return data ? data.data : null;
  },

  async push() {
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    const local = readSave();
    if (!this.user || !local) return;
    const { error } = await this.client
      .from('saves')
      .upsert({ user_id: this.user.id, data: local, updated_at: new Date().toISOString() });
    if (error) throw error;
    remember(CLOUD_LINK_KEY, this.user.id);
  },

  // Called after every local save; groups quick saves into one upload.
  schedulePush() {
    if (!this.user) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.flush(), CLOUD_PUSH_DELAY_MS);
  },

  // Upload now if something is waiting. Errors (e.g. offline) are retried on the next save.
  async flush() {
    if (!this.user || !this.pushTimer) return;
    this.pushing = this.push().catch(() => {
      this.pushTimer = this.pushTimer || -1; // keep it pending
    });
    await this.pushing;
  },

  // Decide which game wins after logging in or opening the game.
  async sync() {
    const local = readSave();
    const cloud = await this.fetchCloud();
    const linked = recall(CLOUD_LINK_KEY) === this.user.id;
    if (!cloud) {
      if (local) await this.push();
      else remember(CLOUD_LINK_KEY, this.user.id);
      return;
    }
    if (!local || (local.savedAt || 0) === (cloud.savedAt || 0)) {
      this.useCloud(cloud);
      return;
    }
    if (linked) {
      // this device already belongs to the account: the newer game wins
      if ((cloud.savedAt || 0) > (local.savedAt || 0)) this.useCloud(cloud);
      else await this.push();
      return;
    }
    // first login on a device that already has a different game: let the player choose
    AccountUI.askWhichGame(local, cloud);
  },

  useCloud(cloud) {
    writeSave(cloud);
    remember(CLOUD_LINK_KEY, this.user.id);
    if (G.state === 'title') UI.showTitle(readSave());
  },

  async keepLocal() {
    await this.push();
  },
};

/* ---------- small helpers ---------- */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    /* storage unavailable */
  }
}
function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}
function forget(key) {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    /* storage unavailable */
  }
}

/* ---------- account window ---------- */
const AccountUI = {
  email: '',

  el(id) {
    return document.getElementById(id);
  },

  init() {
    if (!Cloud.configured()) return;
    this.el('account-box').hidden = false;
    this.el('btn-account').addEventListener('click', () => this.open());
    this.el('btn-acc-close').addEventListener('click', () => this.close());
    this.el('acc-step-email').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendCode();
    });
    this.el('acc-step-code').addEventListener('submit', (e) => {
      e.preventDefault();
      this.verify();
    });
    this.el('btn-acc-back').addEventListener('click', () => this.step('email'));
    this.el('btn-acc-logout').addEventListener('click', () => this.run(() => Cloud.signOut(), 'email'));
    this.el('btn-acc-delete').addEventListener('click', () => (this.el('acc-confirm-delete').hidden = false));
    this.el('btn-acc-delete-no').addEventListener('click', () => (this.el('acc-confirm-delete').hidden = true));
    this.el('btn-acc-delete-yes').addEventListener('click', () => this.run(() => Cloud.deleteAccount(), 'email'));
    this.el('btn-acc-keep-local').addEventListener('click', () => this.run(() => Cloud.keepLocal(), 'done'));
    this.el('btn-acc-keep-cloud').addEventListener('click', () => {
      Cloud.useCloud(this.pendingCloud);
      this.step('done');
    });
  },

  // Title screen: account status line and whether the start buttons can be used yet.
  render() {
    if (!Cloud.configured()) return;
    const status = this.el('account-status');
    const btn = this.el('btn-account');
    if (!Cloud.ready) {
      status.textContent = '☁️ Sprawdzam zapis na koncie…';
      btn.hidden = true;
    } else if (Cloud.offline()) {
      status.textContent = Cloud.user
        ? '☁️ Brak internetu. Postęp zapisuje się na tym urządzeniu i trafi na konto, gdy wróci połączenie.'
        : '☁️ Brak internetu. Grasz na tym urządzeniu, postęp zapisuje się lokalnie.';
      btn.hidden = true;
    } else if (Cloud.user) {
      status.textContent = `☁️ Zalogowano: ${Cloud.user.email}. Postęp zapisuje się na koncie.`;
      btn.textContent = 'Konto';
      btn.hidden = false;
    } else {
      status.textContent = 'Chcesz grać na telefonie i komputerze? Załóż konto, a postęp się nie zgubi.';
      btn.textContent = '☁️ Zaloguj się';
      btn.hidden = false;
    }
    this.el('btn-start').disabled = !Cloud.ready;
    this.el('btn-continue').disabled = !Cloud.ready;
  },

  open() {
    this.el('overlay-account').hidden = false;
    this.step(Cloud.user ? 'done' : 'email');
  },

  close() {
    this.el('overlay-account').hidden = true;
    this.render();
    if (G.state === 'title') UI.showTitle(readSave());
  },

  step(name) {
    for (const s of ['email', 'code', 'done', 'choose']) this.el(`acc-step-${s}`).hidden = s !== name;
    this.el('acc-error').textContent = '';
    this.el('acc-confirm-delete').hidden = true;
    if (name === 'email') this.el('acc-email').focus();
    if (name === 'code') {
      this.el('acc-code-to').textContent = this.email;
      this.el('acc-code').value = '';
      this.el('acc-code').focus();
    }
    if (name === 'done' && Cloud.user) this.el('acc-who').textContent = Cloud.user.email;
    this.render();
  },

  async run(fn, nextStep) {
    const buttons = this.el('overlay-account').querySelectorAll('button');
    buttons.forEach((b) => (b.disabled = true));
    this.el('acc-error').textContent = '';
    try {
      await fn();
      if (nextStep) this.step(nextStep);
    } catch (e) {
      this.el('acc-error').textContent = this.message(e);
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  },

  sendCode() {
    const email = this.el('acc-email').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.el('acc-error').textContent = 'To nie wygląda na adres e-mail.';
      return;
    }
    this.email = email;
    this.run(() => Cloud.sendCode(email), 'code');
  },

  verify() {
    const code = this.el('acc-code').value.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(code)) {
      this.el('acc-error').textContent = 'Kod to same cyfry z maila.';
      return;
    }
    this.run(async () => {
      await Cloud.verifyCode(this.email, code);
      if (this.el('acc-step-choose').hidden) this.step('done');
    });
  },

  askWhichGame(local, cloud) {
    this.pendingCloud = cloud;
    const describe = (s) => `${s.catName || 'Kotka'}, dzień ${s.day || 1}, 🪙 ${s.coins || 0}`;
    this.el('acc-local-desc').textContent = describe(local);
    this.el('acc-cloud-desc').textContent = describe(cloud);
    this.el('overlay-account').hidden = false;
    this.step('choose');
  },

  message(e) {
    const m = String((e && e.message) || '').toLowerCase();
    if (m.includes('expired') || m.includes('invalid') || m.includes('token'))
      return 'Kod jest nieprawidłowy albo wygasł. Wyślij nowy.';
    if (m.includes('rate') || m.includes('seconds') || (e && e.status === 429))
      return 'Za dużo prób. Odczekaj chwilę i spróbuj ponownie.';
    if (m.includes('fetch') || m.includes('network')) return 'Brak połączenia z internetem.';
    return 'Coś poszło nie tak. Spróbuj ponownie za chwilę.';
  },
};
