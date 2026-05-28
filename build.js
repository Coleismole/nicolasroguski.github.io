const sharp = require('sharp');
const CleanCSS = require('clean-css');
const fs = require('fs');
const path = require('path');

async function optimizeImage() {
  const outFile = 'nicolas-photo.webp';
  await sharp('nicolas-photo.jpg')
    .resize(900, null, { withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toFile(outFile);
  const orig = fs.statSync('nicolas-photo.jpg').size;
  const opt  = fs.statSync(outFile).size;
  console.log(`✓ Image → ${outFile}  (${(orig/1024).toFixed(0)} KB → ${(opt/1024).toFixed(0)} KB, ${((1-opt/orig)*100).toFixed(1)}% smaller)`);
}

function minifyCSS() {
  const cleanCSS = new CleanCSS({ level: 2, returnPromise: false });
  const files = ['styles.css', 'subpage-styles.css'];
  for (const file of files) {
    const input = fs.readFileSync(file, 'utf8');
    const result = cleanCSS.minify(input);
    if (result.errors.length) { console.error(`CSS errors in ${file}:`, result.errors); continue; }
    const outFile = file.replace('.css', '.min.css');
    fs.writeFileSync(outFile, result.styles);
    const savings = ((1 - result.styles.length / input.length) * 100).toFixed(1);
    console.log(`✓ CSS  → ${outFile}  (${(input.length/1024).toFixed(0)} KB → ${(result.styles.length/1024).toFixed(0)} KB, ${savings}% smaller)`);
  }
}

(async () => {
  try {
    await optimizeImage();
    minifyCSS();
    console.log('\nBuild complete.');
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
