const express = require('express');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const fs = require('fs').promises;
const path = require('path');

const app = express();
app.set('trust proxy', 1);
const PORT = 5000;
const DATA_FILE = path.join(__dirname, 'analytics.json');

// ── Request logger ────────────────────────────────────────────────────────────
morgan.token('status-colored', (req, res) => {
  const s = res.statusCode;
  if (s >= 500) return `\x1b[31m${s}\x1b[0m`;
  if (s >= 400) return `\x1b[33m${s}\x1b[0m`;
  if (s >= 300) return `\x1b[36m${s}\x1b[0m`;
  return `\x1b[32m${s}\x1b[0m`;
});

morgan.token('slow', (req) => {
  const ms = Date.now() - req._startTime;
  return ms > 500 ? ' \x1b[35m⚠ SLOW\x1b[0m' : '';
});

app.use(morgan(
  ':method :url :status-colored :response-time ms :res[content-length]b:slow',
  { skip: (req) => req.path === '/favicon.ico' }
));

// ── Compression (before all other middleware) ─────────────────────────────────
app.use(compression());

// ── Body parsing with size limit ──────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use('/api/analytics', express.text({ type: 'text/plain', limit: '10kb' }));

// ── CORS — restrict API access to same origin ─────────────────────────────────
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || null;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED_ORIGIN || origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// ── Security headers ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const isPortForwardPreview = /(^localhost(?::|$)|^127\.0\.0\.1(?::|$)|\.github\.dev$|\.replit\.dev$)/.test(host);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!isPortForwardPreview) {
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  }
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://formspree.io",
    "form-action 'self' https://formspree.io",
    "frame-src 'self' blob:",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'"
  ].join('; '));
  next();
});

// ── Rate limiters ─────────────────────────────────────────────────────────────
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

const statsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

// ── Block sensitive files ─────────────────────────────────────────────────────
const BLOCKED_PATHS = new Set(['/analytics.json', '/zipfile.zip', '/ZipFile.zip', '/zipFile.zip']);

app.use((req, res, next) => {
  if (BLOCKED_PATHS.has(req.path)) return res.status(403).end();
  next();
});

// ── HTTP/2 early hints for the main page ──────────────────────────────────────
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') {
    res.setHeader('Link', [
      '</assets/css/styles.min.css?v=9>; rel=preload; as=style',
      '</assets/img/nicolas-photo.webp>; rel=preload; as=image; type="image/webp"'
    ].join(', '));
  }
  next();
});

// ── Static assets ─────────────────────────────────────────────────────────────
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html')) {
      // Always revalidate HTML
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filepath.endsWith('.min.css') || filepath.endsWith('.min.js')) {
      // Versioned/hashed minified assets — cache forever
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filepath.endsWith('.css') || filepath.endsWith('.js')) {
      // Unversioned source files — 1 hour with revalidation
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    } else if (/\.(webp|jpg|jpeg|png|gif|svg|ico)$/.test(filepath)) {
      // Images — 30 days
      res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    } else if (/\.(woff2?|ttf|otf|eot)$/.test(filepath)) {
      // Fonts — 1 year
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filepath.endsWith('.pdf')) {
      // PDFs — 1 day
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }
}));

// ── Admin auth middleware ──────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

const LOGIN_PAGE = (error = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin Login</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: system-ui, sans-serif;
    background: #f7f4ef;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .card {
    background: white;
    padding: 2.5rem 2.8rem;
    width: 100%;
    max-width: 380px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.07);
  }
  .logo {
    font-family: Georgia, serif;
    font-size: 1.05rem;
    color: #1c2a4a;
    font-weight: 400;
    letter-spacing: 0.04em;
    margin-bottom: 0.3rem;
  }
  h1 {
    font-size: 1.35rem;
    font-weight: 600;
    color: #1a1a18;
    margin-bottom: 1.8rem;
  }
  label {
    display: block;
    font-size: 0.72rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #6b6b60;
    margin-bottom: 0.45rem;
  }
  input[type="password"] {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid #ddd;
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
    margin-bottom: 1.2rem;
  }
  input[type="password"]:focus { border-color: #1c2a4a; }
  button {
    width: 100%;
    padding: 0.8rem;
    background: #1c2a4a;
    color: #f7f4ef;
    border: none;
    font-size: 0.8rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition: background 0.2s;
  }
  button:hover { background: #2d3f63; }
  .error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    padding: 0.65rem 0.9rem;
    font-size: 0.82rem;
    margin-bottom: 1.2rem;
  }
</style>
</head>
<body>
  <div class="card">
    <p class="logo">N. Roguski</p>
    <h1>Analytics Dashboard</h1>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="GET" action="/admin">
      <label for="token">Password</label>
      <input type="password" id="token" name="token" placeholder="Enter your admin password" autofocus required>
      <button type="submit">Sign in →</button>
    </form>
  </div>
</body>
</html>`;

// For HTML routes — show login form instead of 401
function requireAdminHtml(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const provided = req.query.token || req.headers['x-admin-token'];
  if (provided !== ADMIN_TOKEN) {
    const error = provided ? 'Incorrect password. Please try again.' : '';
    return res.status(provided ? 401 : 200).send(LOGIN_PAGE(error));
  }
  next();
}

// For API routes — return 401 JSON
function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next();
  const provided = req.query.token || req.headers['x-admin-token'];
  if (provided !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Input validation middleware ───────────────────────────────────────────────
function normalizeAnalyticsPayload(req, res, next) {
  if (typeof req.body === 'string') {
    try {
      req.body = JSON.parse(req.body);
    } catch {
      return res.status(400).json({ error: 'Invalid analytics JSON' });
    }
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    req.body = {};
  }

  next();
}

function validateAnalyticsPayload(req, res, next) {
  const { path: pth, url, sessionId, referrer } = req.body || {};

  if (pth !== undefined && (typeof pth !== 'string' || pth.length > 500)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (url !== undefined && (typeof url !== 'string' || url.length > 2000)) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (sessionId !== undefined && (typeof sessionId !== 'string' || sessionId.length > 64)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }
  if (referrer !== undefined && (typeof referrer !== 'string' || referrer.length > 2000)) {
    return res.status(400).json({ error: 'Invalid referrer' });
  }
  next();
}

// ── In-memory write-behind cache ──────────────────────────────────────────────
let analyticsCache = null;
let dirty = false;

async function loadAnalytics() {
  if (analyticsCache) return analyticsCache;
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    analyticsCache = JSON.parse(data);
  } catch {
    analyticsCache = { pageViews: [], createdAt: new Date().toISOString() };
  }
  return analyticsCache;
}

setInterval(async () => {
  if (dirty && analyticsCache) {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(analyticsCache));
      dirty = false;
    } catch (err) {
      console.error('Failed to flush analytics to disk:', err);
    }
  }
}, 5000);

async function flushOnExit() {
  if (dirty && analyticsCache) {
    try {
      await fs.writeFile(DATA_FILE, JSON.stringify(analyticsCache));
    } catch (err) {
      console.error('Exit flush failed:', err);
    }
  }
  process.exit(0);
}
process.on('SIGTERM', flushOnExit);
process.on('SIGINT', flushOnExit);

// ── Stats computation with single-pass + TTL cache ────────────────────────────
let statsCache = { data: null, expiresAt: 0 };
const STATS_TTL_MS = 30_000;

function computeStats(views) {
  const now = Date.now();
  const dayAgoMs = now - 24 * 60 * 60 * 1000;
  const weekAgoMs = now - 7 * 24 * 60 * 60 * 1000;

  let todayViews = 0;
  let weekViews = 0;
  const topPages = {};
  const topReferrers = {};
  const sessions = new Set();

  views.forEach(v => {
    const ts = new Date(v.timestamp).getTime();
    if (ts > dayAgoMs) todayViews++;
    if (ts > weekAgoMs) weekViews++;

    topPages[v.path] = (topPages[v.path] || 0) + 1;

    const ref = v.referrer === 'direct' || !v.referrer
      ? 'Direct'
      : v.referrer.includes('://')
        ? (new URL(v.referrer).hostname || v.referrer)
        : v.referrer;
    topReferrers[ref] = (topReferrers[ref] || 0) + 1;

    sessions.add(v.sessionId);
  });

  return {
    totalViews: views.length,
    todayViews,
    weekViews,
    uniqueSessions: sessions.size,
    topPages,
    topReferrers,
    recentViews: views.slice(-20).reverse()
  };
}

function getCachedStats(views) {
  const now = Date.now();
  if (statsCache.data && now < statsCache.expiresAt) {
    return statsCache.data;
  }
  const data = computeStats(views);
  statsCache = { data, expiresAt: now + STATS_TTL_MS };
  return data;
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/api/analytics', analyticsLimiter, normalizeAnalyticsPayload, validateAnalyticsPayload, async (req, res) => {
  try {
    const analytics = await loadAnalytics();
    const payload = req.body;

    const view = {
      url: payload.url || req.headers.referer || 'unknown',
      path: payload.path || '/',
      referrer: payload.referrer || req.headers.referer || 'direct',
      userAgent: req.headers['user-agent']?.split(' ')[0] || 'unknown',
      timestamp: new Date().toISOString(),
      sessionId: payload.sessionId || 'anon'
    };

    analytics.pageViews.push(view);

    if (analytics.pageViews.length > 10000) {
      analytics.pageViews = analytics.pageViews.slice(-10000);
    }

    statsCache = { data: null, expiresAt: 0 };
    dirty = true;

    res.status(204).end();
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ error: 'Failed to record' });
  }
});

app.get('/api/analytics/stats', statsLimiter, requireAdmin, async (req, res) => {
  try {
    const analytics = await loadAnalytics();
    const stats = getCachedStats(analytics.pageViews);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read stats' });
  }
});

app.get('/admin', statsLimiter, requireAdminHtml, async (req, res) => {
  try {
    const analytics = await loadAnalytics();
    const stats = getCachedStats(analytics.pageViews);

    const { totalViews, todayViews, weekViews, uniqueSessions, topPages, topReferrers, recentViews } = stats;

    const topPagesList = Object.entries(topPages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => `<tr><td>${page}</td><td>${count}</td></tr>`)
      .join('');

    const topReferrersList = Object.entries(topReferrers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ref, count]) => `<tr><td>${ref}</td><td>${count}</td></tr>`)
      .join('');

    const recentList = recentViews.map(v =>
      `<tr><td>${new Date(v.timestamp).toLocaleString()}</td><td>${v.path}</td><td>${v.referrer || 'Direct'}</td></tr>`
    ).join('');

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Analytics Dashboard</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #f7f4ef; color: #15151a; padding: 2rem; max-width: 1000px; margin: 0 auto; }
      h1 { color: #1c2a4a; border-bottom: 2px solid #c4782a; padding-bottom: 0.5rem; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 2rem 0; }
      .stat-card { background: white; padding: 1.5rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
      .stat-value { font-size: 2rem; font-weight: 600; color: #1c2a4a; }
      .stat-label { font-size: 0.85rem; color: #6b6b60; margin-top: 0.3rem; }
      table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin: 1rem 0; }
      th { background: #1c2a4a; color: #f7f4ef; padding: 0.8rem 1rem; text-align: left; font-weight: 500; }
      td { padding: 0.6rem 1rem; border-bottom: 1px solid #eee; }
      tr:hover { background: #f9f7f2; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
      @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } }
      .badge { display: inline-block; background: #1c2a4a; color: #f7f4ef; padding: 0.15rem 0.6rem; border-radius: 4px; font-size: 0.75rem; margin-bottom: 1rem; }
    </style></head><body>
    <h1>Analytics Dashboard</h1>
    <span class="badge">Privacy-First • No Cookies • No Personal Data</span>
    <div class="stats">
      <div class="stat-card"><div class="stat-value">${totalViews}</div><div class="stat-label">Total Page Views</div></div>
      <div class="stat-card"><div class="stat-value">${todayViews}</div><div class="stat-label">Last 24 Hours</div></div>
      <div class="stat-card"><div class="stat-value">${weekViews}</div><div class="stat-label">Last 7 Days</div></div>
      <div class="stat-card"><div class="stat-value">${uniqueSessions}</div><div class="stat-label">Unique Sessions</div></div>
    </div>
    <div class="grid">
      <div>
        <h3>Top Pages</h3>
        <table><thead><tr><th>Page</th><th>Views</th></tr></thead><tbody>${topPagesList}</tbody></table>
      </div>
      <div>
        <h3>Top Referrers</h3>
        <table><thead><tr><th>Source</th><th>Views</th></tr></thead><tbody>${topReferrersList}</tbody></table>
      </div>
    </div>
    <h3>Recent Activity</h3>
    <table><thead><tr><th>Time</th><th>Page</th><th>Referrer</th></tr></thead><tbody>${recentList}</tbody></table>
    <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid #eee;">
      <a href="/api/analytics/export?token=${req.query.token || ''}" style="display:inline-block;padding:0.6rem 1.4rem;background:#1c2a4a;color:#f7f4ef;text-decoration:none;font-size:0.8rem;letter-spacing:0.08em;">↓ Download CSV</a>
    </div>
    </body></html>`);
  } catch (err) {
    res.status(500).send('Error loading dashboard');
  }
});

const SERVER_START = Date.now();

app.get('/health', (req, res) => {
  const mem = process.memoryUsage();
  const uptimeMs = Date.now() - SERVER_START;

  const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
  const fmtUptime = (ms) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    const d = Math.floor(h / 24);
    if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
    if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  res.json({
    status: 'ok',
    uptime: fmtUptime(uptimeMs),
    uptimeMs,
    memory: {
      rss: toMB(mem.rss),
      heapUsed: toMB(mem.heapUsed),
      heapTotal: toMB(mem.heapTotal),
      external: toMB(mem.external)
    },
    cache: {
      analyticsLoaded: analyticsCache !== null,
      analyticsEntries: analyticsCache ? analyticsCache.pageViews.length : 0,
      pendingFlush: dirty,
      statsCached: statsCache.data !== null,
      statsCacheExpiresIn: statsCache.expiresAt
        ? Math.max(0, Math.round((statsCache.expiresAt - Date.now()) / 1000)) + 's'
        : 'n/a'
    },
    timestamp: new Date().toISOString()
  });
});

// ── Analytics CSV export ──────────────────────────────────────────────────────
app.get('/api/analytics/export', statsLimiter, requireAdmin, async (req, res) => {
  try {
    const analytics = await loadAnalytics();
    const rows = [['timestamp', 'path', 'url', 'referrer', 'userAgent', 'sessionId']];
    for (const v of analytics.pageViews) {
      rows.push([
        v.timestamp,
        v.path,
        v.url,
        v.referrer || 'direct',
        v.userAgent,
        v.sessionId
      ].map(field => `"${String(field).replace(/"/g, '""')}"`));
    }
    const csv = rows.map(r => r.join(',')).join('\n');
    const filename = `analytics-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ── Sitemap ───────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const now = new Date().toISOString().split('T')[0];
  const pages = [
    { loc: '/', priority: '1.0', changefreq: 'monthly' },
    { loc: '/myostatin-inhibitors.html', priority: '0.8', changefreq: 'monthly' }
  ];
  const urls = pages.map(p => `
  <url>
    <loc>${base}${p.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('');
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`);
});

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  const acceptsHtml = req.headers.accept && req.headers.accept.includes('text/html');
  if (acceptsHtml) {
    return res.status(404).sendFile(path.join(__dirname, '404.html'));
  }
  res.status(404).json({ error: 'Not found', path: req.path });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';
  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${err.message}`);
  if (!isProd) console.error(err.stack);
  res.status(status).json({
    error: isProd && status === 500 ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack })
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  process.exit(1);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  if (!ADMIN_TOKEN) {
    console.warn('[SECURITY] ADMIN_TOKEN env var not set — /admin and /api/analytics/stats are unprotected');
  }
  loadAnalytics();
});
