# Nicolas Roguski — Personal Portfolio

This is a small, dependency-light portfolio site for **Nicolas Roguski**. It uses plain HTML/CSS/JS and is served by a minimal Node.js + Express backend. No frontend framework required — static assets are served directly.

## Project Structure
- `assets/`: Publicly accessible static assets (css/, img/, js/, pdf/, fonts/).
- `scripts/`: Build and audit scripts.
- Root (`/`): HTML entry points, PWA files (sw.js, manifest.json), and configuration files.

## Commands
- `npm run build`: Minifies CSS, optimizes images, and updates version hashes (points to `scripts/build.js`).
- `npm start`: Starts the local development server.

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
| `npm start` | Start the Express server on port 5000 |
| `npm run build` | Convert hero image to WebP + minify all CSS files |

Run `npm run build` after editing `styles.css` or `subpage-styles.css`. The HTML references the `.min.css` files.

---

## Environment variables & local admin note

The server supports a few environment variables:

| Variable | Required | Description |
|---|---|---|
| `ADMIN_TOKEN` | Recommended in production | Protects `/admin` and `/api/analytics/stats`. If unset, those admin routes are public.
| `ALLOWED_ORIGIN` | Optional | Restricts API CORS to a specific origin (e.g. `https://yoursite.com`).
| `NODE_ENV` | Optional | Set to `production` to suppress stack traces in error responses.

Important: For local testing this repository currently hardcodes a development admin token in `server.js` (`8208`). Do NOT use that value in production — instead set `ADMIN_TOKEN` as an environment variable or secret in your host (e.g., Replit Secrets, GitHub Actions, or your server environment).

Example to run with a production token locally (recommended):

```bash
export ADMIN_TOKEN=your-secret-here
npm start
```

On Windows (PowerShell):

```powershell
$env:ADMIN_TOKEN = 'your-secret-here'
npm start
```

---

## Server routes

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
- `analytics.json` is created at runtime and ignored by Git, so local/deployed page-view data does not get committed.
 
Client-side analytics prefers `navigator.sendBeacon` and sends beacons as an `application/json` `Blob`, with `keepalive` fetch as a fallback. The server also accepts legacy `text/plain` beacon payloads, so cached clients do not fail if they send the older beacon format.

The initial page load is counted once, and re-engagement events are throttled to one view per 30 minutes per open tab. Normal page exits are no longer counted as a second page view.

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
- **Motion fallback** — The main page reveals immediately and falls back to static behavior if GSAP, ScrollTrigger, ScrollToPlugin, or Lenis fail to load
 - **Motion libraries** — The site now ships GSAP, ScrollTrigger, ScrollToPlugin, and Lenis under `vendor/` to avoid runtime CDN dependency; the static fallback remains if any library fails to initialise

---

## Security Features

- **Content Security Policy** — `script-src` is restricted to the site itself; motion libraries are served locally from `vendor/` and a graceful CDN fallback is still present for emergency scenarios
- **Rate limiting** — Analytics API: 30 req/min; stats/admin API: 20 req/min
- **Blocked paths** — `analytics.json` and zip files return 403
- **Security headers** — `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`
- **Port-forward previews** — `X-Frame-Options` is skipped for localhost, `127.0.0.1`, `*.github.dev`, and `*.replit.dev` hosts so IDE/Codespaces/Replit previews can render the site instead of showing a blank iframe
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

---

## Changelog

- 2026-05-29 — Fix: restored explicit contact form "Send message" button,
  prevented it being hidden by reveal animations, and ensured accessible
  submit handling via `form.submit`/`requestSubmit()`.
| `sw.js` | Service worker — update `PRECACHE` when adding pages/assets |

## Notes

- `.gitignore` now excludes common local artifacts such as `lh-report.*`, `.cache/`, and possible local Chromium folders so generated audit reports and local caches won't be committed.
- Consider adding SRI hashes for CDN scripts (`gsap`, `lenis`) if you want stricter integrity checks.
