// Privacy-first analytics - no cookies, no personal data, no tracking pixels
(function() {
  const sessionId = Math.random().toString(36).substring(2, 15);
  let lastSent = Date.now();
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes — prevents tab-switching from inflating counts

  // Small buffer to batch events if needed in future
  const pending = [];

  function payload() {
    return {
      url: window.location.href,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || 'direct',
      sessionId: sessionId,
      timestamp: new Date().toISOString()
    };
  }

  async function sendViaFetch(data) {
    try {
      await fetch('/api/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      });
    } catch (e) {
      // ignore
    }
  }

  function sendAnalytics() {
    const data = payload();
    // Prefer sendBeacon for unload/visibility events
    if (navigator.sendBeacon) {
      try {
        const ok = navigator.sendBeacon('/api/analytics', JSON.stringify(data));
        if (ok) return;
      } catch (e) {
        // fallthrough to fetch
      }
    }
    // Last-resort async fetch with keepalive
    sendViaFetch(data);
  }

  // Track initial page load
  if (document.visibilityState !== 'hidden') {
    sendAnalytics();
    lastSent = Date.now();
  }

  // Track when user returns to tab — only if away for 30+ minutes (genuine re-engagement)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSent >= COOLDOWN_MS) {
      sendAnalytics();
      lastSent = Date.now();
    }
  });

  // Also send a beacon on pagehide (covers unload in modern browsers)
  window.addEventListener('pagehide', () => {
    try { navigator.sendBeacon && navigator.sendBeacon('/api/analytics', JSON.stringify(payload())); }
    catch (e) {}
  }, { capture: true });
})();
