---
name: Font self-hosting
description: How fonts are served and how to regenerate them
---

Fonts (Cormorant Garamond, DM Mono, Jost) are self-hosted in `/fonts/` as woff2 files with unicode-range subsets. `fonts/fonts.css` contains all @font-face declarations.

Referenced via `<link rel="stylesheet" href="/fonts/fonts.css">` in index.html and myostatin-inhibitors.html (replaces Google Fonts links).

CSP in server.js was updated: `font-src 'self'` (no longer includes fonts.gstatic.com).

**To regenerate fonts** (e.g. if weights/families change): run `node download-fonts.js` from project root (the script was deleted after use but the pattern is: fetch CSS from Google Fonts with a Chrome UA to get woff2 URLs, download each file with a unique index-based filename to avoid unicode-range collisions, write fonts/fonts.css with unicode-range preserved).

**Why unique indexed filenames:** Google Fonts returns multiple unicode-range subsets per variant (e.g. latin, latin-ext, cyrillic-ext). Each needs a separate woff2 file.
