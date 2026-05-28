// Privacy-first analytics - no cookies, no personal data, no tracking pixels
(function() {
  const sessionId = Math.random().toString(36).substring(2, 15);
  let lastSent = Date.now();
  const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes — prevents tab-switching from inflating counts

  function sendAnalytics(event) {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: window.location.href,
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || 'direct',
        sessionId: sessionId,
        timestamp: new Date().toISOString()
      })
    }).catch(() => {}); // Silent fail - analytics should never break the site
  }

  // Track initial page load
  if (document.visibilityState !== 'hidden') {
    sendAnalytics('pageview');
    lastSent = Date.now();
  }

  // Track when user returns to tab — only if away for 30+ minutes (genuine re-engagement)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastSent >= COOLDOWN_MS) {
      sendAnalytics('pageview');
      lastSent = Date.now();
    }
  });
})();
