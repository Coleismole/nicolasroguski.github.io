---
name: CSS versioning
description: How cache-busting version strings are managed across the project
---

All `?v=N` cache-busting strings are controlled by `CSS_VERSION` (integer) at the top of `build.js`. Running `npm run build` propagates this to:
- `styles.min.css?v=N` in index.html
- `subpage-styles.min.css?v=N` in myostatin-inhibitors.html  
- `CACHE_VERSION = 'vN'` in sw.js (which also controls CACHE and RUNTIME cache names)

Current version as of last build: **v9**

SW cache name format: `nr-portfolio-vN` and `nr-runtime-vN`. Old caches are deleted on SW activate.

**Why:** Ensures service worker invalidation is in sync with CSS changes. If you update CSS without bumping the version, the SW will serve stale cached files.
