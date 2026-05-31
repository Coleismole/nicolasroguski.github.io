# Nicolas Roguski — Personal Portfolio

Personal portfolio website for Nicolas Roguski, a Biomedical Physiology student at Simon Fraser University.

- **Live domain:** https://nicolasroguski.dev
- **Stack:** Node.js + Express 5, vanilla HTML/CSS/JS, GSAP 3 + Lenis animations
- **Run:** `npm start` (port 5000)
- **Build:** `npm run build` (minifies CSS, converts images to WebP/AVIF, inlines critical CSS)

## User preferences

- Keep all domain references pointing to `nicolasroguski.dev` (not the `.replit.app` subdomain)
- Run `npm run build` after any CSS or image change — HTML loads `.min.css` and versioned assets only
- Bump `CSS_VERSION` in `scripts/build.js` whenever cached assets change, then rebuild
