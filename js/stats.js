/* Anonymous visit statistics (Umami Cloud: no cookies, no personal data).
 *
 * To turn it on, paste the "Website ID" from cloud.umami.is below.
 * While it is empty, nothing is sent anywhere.
 */
const UMAMI_WEBSITE_ID = 'e3b6c550-74e9-4d42-bbbc-3b1f52a9358f';

const Stats = {
  // How often an open, visible game tab says "still here". Umami measures
  // visit duration from the first to the last event, so without this a
  // single-page game would always show ~0 s.
  HEARTBEAT_MS: 60 * 1000,

  enabled() {
    const local = /^(localhost|127\.0\.0\.1|\[::1\]|)$/.test(location.hostname);
    return !!UMAMI_WEBSITE_ID && !local;
  },

  init() {
    if (!this.enabled()) return;
    const s = document.createElement('script');
    s.defer = true;
    s.src = 'https://cloud.umami.is/script.js';
    s.dataset.websiteId = UMAMI_WEBSITE_ID;
    document.head.appendChild(s);

    setInterval(() => {
      if (document.visibilityState === 'visible') this.event('gra trwa');
    }, this.HEARTBEAT_MS);
    // one last ping when the player switches tabs or closes the game
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.event('gra trwa');
    });
  },

  event(name, data) {
    if (!this.enabled() || !window.umami) return;
    try {
      window.umami.track(name, data);
    } catch (e) {
      /* statistics must never break the game */
    }
  },
};

Stats.init();
