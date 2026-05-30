const sharp = require('sharp');
const CleanCSS = require('clean-css');
const { PurgeCSS } = require('purgecss');
const fs = require('fs');
const path = require('path');

const CSS_VERSION = 10;
const SW_CACHE_VERSION = `v${CSS_VERSION}`;

async function optimizeImage() {
  const src = 'assets/img/nicolas-photo.jpg';
  if (!fs.existsSync(src)) {
    console.log(`Skipping image optimization: ${src} not found`);
    return;
  }
  const orig = fs.statSync(src).size;

  // WebP
  const webpFile = 'assets/img/nicolas-photo.webp';
  await sharp(src).resize(900, null, { withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 }).toFile(webpFile);
  const webpSize = fs.statSync(webpFile).size;
  console.log(`✓ Image → ${webpFile}  (${(orig/1024).toFixed(0)} KB → ${(webpSize/1024).toFixed(0)} KB, ${((1-webpSize/orig)*100).toFixed(1)}% smaller)`);

  // AVIF
  const avifFile = 'assets/img/nicolas-photo.avif';
  await sharp(src).resize(900, null, { withoutEnlargement: true })
    .avif({ quality: 62, effort: 6 }).toFile(avifFile);
  const avifSize = fs.statSync(avifFile).size;
  console.log(`✓ Image → ${avifFile}  (${(orig/1024).toFixed(0)} KB → ${(avifSize/1024).toFixed(0)} KB, ${((1-avifSize/orig)*100).toFixed(1)}% smaller)`);
}

function minifyCSS() {
  const cleanCSS = new CleanCSS({ level: 2, returnPromise: false });
  const files = ['assets/css/styles.css', 'assets/css/subpage-styles.css', 'assets/css/critical.css'];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const input = fs.readFileSync(file, 'utf8');
    const result = cleanCSS.minify(input);
    if (result.errors.length) { console.error(`CSS errors in ${file}:`, result.errors); continue; }
    const outFile = file.replace('.css', '.min.css');
    fs.writeFileSync(outFile, result.styles);
    const savings = ((1 - result.styles.length / input.length) * 100).toFixed(1);
    console.log(`✓ CSS  → ${outFile}  (${(input.length/1024).toFixed(0)} KB → ${(result.styles.length/1024).toFixed(0)} KB, ${savings}% smaller)`);
  }
}

async function runPurgeCSS() {
  const htmlFiles = ['index.html', 'myostatin-inhibitors.html', '404.html', 'offline.html'];
  const cssFiles = ['assets/css/styles.min.css', 'assets/css/subpage-styles.min.css'];

  // Only purge against files that exist
  const existingHTML = htmlFiles.filter(f => fs.existsSync(f));
  const existingCSS = cssFiles.filter(f => fs.existsSync(f));

  if (existingCSS.length === 0) return;

  const result = await new PurgeCSS().purge({
    content: existingHTML,
    css: existingCSS,
    safelist: {
      standard: ['dark', 'open', 'active', 'visible', 'loaded', 'scrolled', 'show', 'cursor-hover'],
      greedy: [/^dark$/, /^html\.dark/, /\.dark\s/, /\.loaded/, /\.open/, /\.active/, /\.visible/, /\.scrolled/, /\.show/, /cursor-hover/]
    }
  });

  for (const item of result) {
    const before = fs.statSync(item.file).size;
    fs.writeFileSync(item.file, item.css);
    const after = Buffer.byteLength(item.css);
    console.log(`✓ PurgeCSS → ${item.file}  (${(before/1024).toFixed(0)} KB → ${(after/1024).toFixed(0)} KB, ${((1-after/before)*100).toFixed(1)}% smaller)`);
  }
}

function inlineCriticalCSS() {
  const criticalPath = 'assets/css/critical.min.css';
  if (!fs.existsSync(criticalPath)) return;
  const critical = fs.readFileSync(criticalPath, 'utf8');
  const htmlFiles = ['index.html'];

  for (const file of htmlFiles) {
    if (!fs.existsSync(file)) continue;
    let html = fs.readFileSync(file, 'utf8');
    // Replace content between markers
    html = html.replace(
      /<!-- critical-css-start -->[\s\S]*?<!-- critical-css-end -->/,
      `<!-- critical-css-start -->\n<style>${critical}</style>\n<!-- critical-css-end -->`
    );
    fs.writeFileSync(file, html);
    console.log(`✓ Inlined critical CSS → ${file}`);
  }
}

function bumpVersions() {
  // Update CSS version refs in index.html
  if (fs.existsSync('index.html')) {
    let html = fs.readFileSync('index.html', 'utf8');
    html = html.replace(/assets\/css\/styles\.min\.css\?v=\d+/g, `assets/css/styles.min.css?v=${CSS_VERSION}`);
    html = html.replace(/assets\/fonts\/fonts\.css\?v=\d+/g, `assets/fonts/fonts.css?v=${CSS_VERSION}`);
    fs.writeFileSync('index.html', html);
  }

  // Update subpage version refs
  const subpages = fs.readdirSync('.').filter(f => f.endsWith('.html') && f !== 'index.html');
  for (const file of subpages) {
    let html = fs.readFileSync(file, 'utf8');
    html = html.replace(/assets\/css\/subpage-styles\.min\.css\?v=\d+/g, `assets/css/subpage-styles.min.css?v=${CSS_VERSION}`);
    html = html.replace(/assets\/fonts\/fonts\.css\?v=\d+/g, `assets/fonts/fonts.css?v=${CSS_VERSION}`);
    fs.writeFileSync(file, html);
  }

  // Update SW cache version
  if (fs.existsSync('sw.js')) {
    let sw = fs.readFileSync('sw.js', 'utf8');
    sw = sw.replace(/const CACHE_VERSION = '[^']+';/, `const CACHE_VERSION = '${SW_CACHE_VERSION}';`);
    sw = sw.replace(/\/assets\/css\/styles\.min\.css\?v=\d+/g, `/assets/css/styles.min.css?v=${CSS_VERSION}`);
    sw = sw.replace(/\/assets\/css\/subpage-styles\.min\.css\?v=\d+/g, `/assets/css/subpage-styles.min.css?v=${CSS_VERSION}`);
    sw = sw.replace(/\/assets\/fonts\/fonts\.css(\?v=\d+)?/g, `/assets/fonts/fonts.css?v=${CSS_VERSION}`);
    fs.writeFileSync('sw.js', sw);
  }

  console.log(`✓ Version bumped → CSS v${CSS_VERSION}, SW cache ${SW_CACHE_VERSION}`);
}

async function runAudit() {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const proc = spawn(process.execPath, [require('path').join(__dirname, 'audit.js')], {
      stdio: 'inherit',
      env: process.env
    });
    proc.on('close', code => {
      if (code !== 0 && code !== null) {
        console.warn(`\n⚠  Audit exited with code ${code} (performance score may be low).`);
      }
      resolve();
    });
    proc.on('error', reject);
  });
}

(async () => {
  const withAudit = process.argv.includes('--audit');
  try {
    await optimizeImage();
    minifyCSS();
    await runPurgeCSS();
    inlineCriticalCSS();
    bumpVersions();
    console.log('\nBuild complete.');
    if (withAudit) {
      console.log('\nRunning Lighthouse audit against http://localhost:5000 …');
      await runAudit();
    } else {
      console.log(`${'\x1b[2m'}Tip: run "npm run build:audit" to also run a Lighthouse performance audit.${'\x1b[0m'}`);
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
