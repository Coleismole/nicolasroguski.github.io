---
name: Build pipeline
description: What npm run build does and what to update when making changes
---

`npm run build` (runs `build.js`) does these steps in order:
1. Generates `nicolas-photo.webp` and `nicolas-photo.avif` from the source JPG via sharp
2. Minifies `styles.css`, `subpage-styles.css`, `critical.css` → `.min.css` via CleanCSS
3. Runs PurgeCSS on the minified CSS against all HTML files (safe-lists dark/open/active/visible/loaded/scrolled/show/cursor-hover classes)
4. Inlines `critical.min.css` content between `<!-- critical-css-start -->` / `<!-- critical-css-end -->` markers in `index.html`
5. Bumps `CSS_VERSION` (integer) in all `?v=N` query strings in index.html, myostatin-inhibitors.html, and sw.js

**Why:** Single source of truth for versioning; avoids manually hunting for cache-busting strings across files.

**How to apply:** To release a new CSS version, increment `CSS_VERSION` at the top of `build.js`, then run `npm run build`. Do NOT manually edit version strings in HTML/SW — build.js overwrites them.

Dependencies in package.json: `sharp`, `clean-css`, `purgecss` (dev).
