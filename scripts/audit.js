/**
 * Lighthouse performance audit for the local dev server.
 * Usage:
 *   node audit.js              — audits http://localhost:5000
 *   node audit.js --url <url> — audits a custom URL
 *   node audit.js --save       — also writes audit-report.json
 */

const path  = require('path');
const fs    = require('fs');
const http  = require('http');

const CHROMIUM_PATH = '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium';

const args    = process.argv.slice(2);
const urlIdx  = args.indexOf('--url');
const TARGET  = urlIdx !== -1 ? args[urlIdx + 1] : 'http://localhost:5000';
const SAVE    = args.includes('--save');

// ANSI helpers
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gold:   '\x1b[38;5;214m',
};
const col  = s => s >= 90 ? c.green : s >= 50 ? c.yellow : c.red;
const bar  = (s, w = 20) => col(s) + '█'.repeat(Math.round(s / 100 * w)) + c.dim + '░'.repeat(w - Math.round(s / 100 * w)) + c.reset;
const pct  = s => col(Math.round(s * 100)) + c.bold + String(Math.round(s * 100)).padStart(3) + c.reset;
const fmtMs = v => v == null ? c.dim + 'n/a' + c.reset : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`;

async function waitForServer(url, timeoutMs = 6000) {
  const { hostname, port, pathname } = new URL(url);
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get({ hostname, port: +port || 80, path: pathname, timeout: 1000 }, () => { req.destroy(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`Server not reachable at ${url}`));
        setTimeout(attempt, 300);
      });
    };
    attempt();
  });
}

async function runAudit() {
  console.log(`\n${c.gold}${c.bold}  ◆ Lighthouse Audit${c.reset}`);
  console.log(`${c.dim}  URL: ${TARGET}${c.reset}\n`);

  // Verify server is reachable
  try {
    await waitForServer(TARGET);
  } catch (e) {
    console.error(`${c.red}  ✗ ${e.message}${c.reset}`);
    console.error(`${c.dim}  Make sure the dev server is running (npm start) before auditing.${c.reset}\n`);
    process.exit(1);
  }

  // Use chrome-launcher (bundled with lighthouse) to manage Chrome lifecycle
  const chromeLauncher = require('chrome-launcher');
  const lighthouse     = require('lighthouse');

  process.stdout.write(`  Starting Chromium…`);
  const chrome = await chromeLauncher.launch({
    chromePath: CHROMIUM_PATH,
    chromeFlags: [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-software-rasterizer',
    ],
    logLevel: 'silent',
  });
  console.log(` done (port ${chrome.port})`);

  let lhr;
  try {
    process.stdout.write(`  Running audit…`);
    const result = await lighthouse.default(TARGET, {
      port: chrome.port,
      output: 'json',
      logLevel: 'silent',
      formFactor: 'desktop',
      screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      throttlingMethod: 'simulate',
      throttling: { rttMs: 40, throughputKbps: 10240, cpuSlowdownMultiplier: 1,
                    requestLatencyMs: 0, downloadThroughputKbps: 0, uploadThroughputKbps: 0 },
    });
    lhr = result.lhr;
    console.log(' done\n');
  } finally {
    await chrome.kill();
  }

  // ── Category scores ────────────────────────────────────────────────────────
  const cats = lhr.categories;
  console.log(`  ${c.bold}Category Scores${c.reset}`);
  console.log(`  ${'─'.repeat(50)}`);
  const catOrder  = ['performance', 'accessibility', 'best-practices', 'seo'];
  const catLabels = { performance: 'Performance    ', accessibility: 'Accessibility  ',
                      'best-practices': 'Best Practices ', seo: 'SEO            ' };
  for (const key of catOrder) {
    const cat = cats[key];
    if (!cat) continue;
    const s = Math.round(cat.score * 100);
    console.log(`  ${catLabels[key]}  ${pct(cat.score)}  ${bar(s)}`);
  }

  // ── Core Web Vitals ────────────────────────────────────────────────────────
  const audits = lhr.audits;
  console.log(`\n  ${c.bold}Core Web Vitals & Key Metrics${c.reset}`);
  console.log(`  ${'─'.repeat(50)}`);
  const metrics = [
    { key: 'first-contentful-paint',  label: 'FCP  First Contentful Paint  ' },
    { key: 'largest-contentful-paint',label: 'LCP  Largest Contentful Paint' },
    { key: 'total-blocking-time',     label: 'TBT  Total Blocking Time     ' },
    { key: 'cumulative-layout-shift', label: 'CLS  Cumulative Layout Shift ' },
    { key: 'speed-index',             label: 'SI   Speed Index             ' },
    { key: 'interactive',             label: 'TTI  Time to Interactive     ' },
  ];
  for (const { key, label } of metrics) {
    const a = audits[key];
    if (!a) continue;
    const s   = a.score !== null ? Math.round(a.score * 100) : null;
    const dot = s !== null ? col(s) + (s >= 90 ? '●' : s >= 50 ? '◐' : '○') + c.reset : ' ';
    const val = a.displayValue || fmtMs(a.numericValue);
    console.log(`  ${dot} ${c.dim}${label}${c.reset}  ${c.bold}${val}${c.reset}`);
  }

  // ── Top opportunities ──────────────────────────────────────────────────────
  const opps = Object.values(audits)
    .filter(a => a.details?.type === 'opportunity' && a.score !== null && a.score < 1 && a.details?.overallSavingsMs > 50)
    .sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0));

  if (opps.length > 0) {
    console.log(`\n  ${c.bold}Top Opportunities${c.reset}`);
    console.log(`  ${'─'.repeat(50)}`);
    for (const opp of opps.slice(0, 5)) {
      const ms = opp.details?.overallSavingsMs;
      console.log(`  ${c.yellow}▸${c.reset} ${opp.title}${c.dim}${ms ? `  (~${fmtMs(ms)} saving)` : ''}${c.reset}`);
    }
  }

  // ── Passed audits ──────────────────────────────────────────────────────────
  const passed = Object.values(audits).filter(a => a.score === 1).length;
  const total  = Object.values(audits).filter(a => a.score !== null).length;
  console.log(`\n  ${c.dim}${passed}/${total} audits passed${c.reset}`);

  // ── Save report ────────────────────────────────────────────────────────────
  if (SAVE) {
    fs.writeFileSync('audit-report.json', JSON.stringify(lhr, null, 2));
    console.log(`  ${c.dim}Full report saved → audit-report.json${c.reset}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  const perf = Math.round(cats.performance.score * 100);
  console.log(`\n  ${col(perf)}${c.bold}Performance score: ${perf}/100${c.reset}\n`);

  if (perf < 50) process.exit(1);
}

runAudit().catch(err => {
  console.error(`\n${c.red}  Audit failed: ${err.message}${c.reset}\n`);
  process.exit(1);
});
