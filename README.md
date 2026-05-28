# Nicolas Roguski — Personal Portfolio

A personal portfolio website for **Nicolas Roguski**, a Biomedical Physiology student at Simon Fraser University. Built with vanilla HTML/CSS/JS served by a Node.js + Express backend. No frontend build framework — assets are served directly.

---

## Quick Start

```bash
npm install        # install dependencies
npm run build      # generate WebP image + minified CSS (required before first run)
npm start          # start server on port 5000
```

Visit `http://localhost:5000` in your browser.

---

## Project Structure

```
.
├── index.html                  # Main portfolio page (single-page)
├── myostatin-inhibitors.html   # Research subpage — Myostatin Inhibition paper
├── styles.css                  # Source CSS (edit this, then run npm run build)
├── styles.min.css              # Minified CSS — auto-generated, do not edit directly
├── subpage-styles.css          # Source CSS for research subpages
├── subpage-styles.min.css      # Minified subpage CSS — auto-generated
├── analytics.js                # Client-side privacy-first analytics script
├── analytics.json              # Server-side page view storage (auto-created)
├── server.js                   # Express server — API, analytics, admin, static serving
├── build.js                    # Build script: image → WebP, CSS → minified
├── sw.js                       # Service worker — offline support + asset caching
├── offline.html                # Offline fallback page
├── 404.html                    # Styled 404 page
├── favicon.svg                 # SVG favicon (navy "NR" monogram)
├── nicolas-photo.jpg           # Original hero image (3 MB, source only)
├── nicolas-photo.webp          # Optimised hero image (160 KB) — auto-generated
├── nicolas-roguski-cv.pdf      # Downloadable CV
├── robots.txt                  # Crawler rules + sitemap reference
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Server | Express 5 |
| Animations | GSAP 3 + ScrollTrigger + Lenis |
| CSS | Vanilla CSS with custom properties |
| JS | Vanilla JS (no framework) |
| Fonts | Google Fonts (Cormorant Garamond, DM Mono, Jost) |
| Contact form | Formspree (`/f/xzdwyynv`) |
| Analytics | Custom privacy-first (no cookies, JSON file storage) |
| Image build | sharp |
| CSS build | clean-css |

---

## NPM Scripts

| Command | What it does |
|---|---|
| `npm start` | Start Express server on port 5000 |
| `npm run build` | Convert hero image to WebP + minify all CSS files |

Run `npm run build` any time you edit `styles.css` or `subpage-styles.css`. The server serves the `.min.css` files, not the source CSS.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | Recommended | Password protecting `/admin` and `/api/analytics/stats`. If unset, those routes are public. |
| `ALLOWED_ORIGIN` | Optional | Restricts CORS on API routes to a specific origin (e.g. `https://yoursite.com`). Defaults to permissive. |
| `NODE_ENV` | Optional | Set to `production` to suppress stack traces in error responses. |

Set these as Replit Secrets (environment variables) — never hardcode them.

---

## Server Routes

### Public
| Method | Path | Description |
|---|---|---|
| `GET` | `/` | Main portfolio page |
| `GET` | `/myostatin-inhibitors.html` | Research subpage |
| `GET` | `/sitemap.xml` | Auto-generated XML sitemap |
| `GET` | `/robots.txt` | Crawler rules |
| `GET` | `/health` | Server health check + memory/cache stats |
| `POST` | `/api/analytics` | Record a page view (rate-limited: 30/min) |

### Admin (protected by `ADMIN_TOKEN`)
| Method | Path | Description |
|---|---|---|
| `GET` | `/admin?token=SECRET` | Analytics dashboard (HTML) |
| `GET` | `/api/analytics/stats?token=SECRET` | Analytics stats (JSON, rate-limited: 20/min) |
| `GET` | `/api/analytics/export?token=SECRET` | Download all data as CSV |

---

## Analytics System

- **No cookies, no personal data** — only path, referrer, a session ID, and timestamp are stored.
- Data is written to `analytics.json` via a write-behind cache (flushes every 5 seconds).
- Maximum 10,000 entries stored; older entries are pruned automatically.
- Stats are cached in memory for 30 seconds to avoid recomputing on every request.
- Access the dashboard at `/admin?token=YOUR_TOKEN` (set `ADMIN_TOKEN` env var first).
 
Client-side analytics now prefers `navigator.sendBeacon` and uses `keepalive` fetch as a fallback, reducing the chance of lost events during unload. Analytics remains privacy-first (no cookies, no personal identifiers).

---

## CSS Workflow

1. Edit `styles.css` (source) or `subpage-styles.css`
2. Run `npm run build`
3. This generates `styles.min.css` and `subpage-styles.min.css`
4. The server and HTML files reference only the `.min.css` versions

Both `.min.css` files are committed to the repo so the server can start without a build step on Replit.

---

## Image Workflow

The build script converts `nicolas-photo.jpg` (3 MB, 3024×4032) to `nicolas-photo.webp` (160 KB, 900px wide, quality 82). The HTML uses a `<picture>` element with WebP as the primary source and JPEG as fallback for older browsers.

Run `npm run build` to regenerate `nicolas-photo.webp` if the source image changes.

---

## Performance Features

- **WebP hero image** — 94.7% smaller than the original JPEG
- **Minified CSS** — ~20% smaller than source
- **HTTP/2 Link headers** — Early hints for CSS and hero image on every page load
- **Smart cache headers** — `immutable` for versioned assets, `no-cache` for HTML, 30-day for images
- **Asset preloading** — `<link rel="preload">` for hero image and CSS in `<head>`
- **Service worker** — Pre-caches key assets; cache-first for static files, network-first for HTML; offline fallback page
- **PWA manifest** — `manifest.json` is included and linked in `index.html` for basic installability and theme color support
- **Service worker improvements** — runtime cache with stale-while-revalidate behavior and automatic trimming of old runtime entries

---

## Security Features

- **Content Security Policy** — Whitelists GSAP CDN, jsDelivr, Google Fonts, and Formspree; blocks everything else
- **Rate limiting** — Analytics API: 30 req/min; stats/admin API: 20 req/min
- **Blocked paths** — `analytics.json` and zip files return 403
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`
- **Admin auth** — Token-based, checked on all admin routes

---

## SEO

- **Open Graph + Twitter Card** tags on all pages
- **JSON-LD structured data** (`Person` schema) on the main page
- **Canonical URL** tags on all pages — update domain after deploying to production
- **Sitemap** at `/sitemap.xml` — dynamically generated using current host
- **robots.txt** references the sitemap URL

> After deploying, update the canonical URL (`<link rel="canonical">`) and `og:url` in `index.html` and `myostatin-inhibitors.html` to match your production domain.

---

## Adding a New Research Page

1. Copy `myostatin-inhibitors.html` as a template
2. Update the `<title>`, `<link rel="canonical">`, and page content
3. Add the new page to the sitemap pages array in `server.js` (search for `PRECACHE` and the `/sitemap.xml` route)
4. Add the new URL to the service worker `PRECACHE` array in `sw.js`
5. Add a new project card to the `#projects` section in `index.html`

---

## Deployment

The project is configured for Replit autoscale deployment:

- **Run command:** `node server.js`
- **Port:** 5000
- **No build step required at deploy time** — `.min.css` and `.webp` files are committed

After deploying:
1. Set `ADMIN_TOKEN` as a production secret
2. Update canonical URLs in HTML files to the production domain
3. Update the `Sitemap:` line in `robots.txt` to the production URL

---

## Key Files for AI Agents

| File | Purpose |
|---|---|
| `server.js` | All backend logic — read this first |
| `index.html` | Full page markup + all inline JS (~950 lines) |
| `styles.css` | All styling — edit this, not `.min.css` |
| `build.js` | Asset pipeline — image conversion + CSS minification |
| `sw.js` | Service worker — update `PRECACHE` when adding pages/assets |

## Notes

- `.gitignore` now excludes common local artifacts such as `lh-report.*`, `.cache/`, and possible local Chromium folders so generated audit reports and local caches won't be committed.
- Consider adding SRI hashes for CDN scripts (`gsap`, `lenis`) if you want stricter integrity checks.
