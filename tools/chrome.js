/* Chromium yürütülebilirini bulur.
 * CHROME_PATH verilmişse o kullanılır; yoksa Playwright'ın indirdiği sürüm
 * ya da sistemde kurulu Chrome/Chromium denenir. Hiçbiri yoksa undefined
 * döner ve Playwright kendi varsayılanını kullanır. */
const fs = require('node:fs');
const path = require('node:path');

/** Yalnızca var olan, normal (dizin değil) bir dosyayı kabul eder. */
function firstRegularFile(paths) {
  for (const p of paths) {
    try {
      if (p && fs.statSync(p).isFile()) return p;
    } catch { /* yok / erişilemiyor — sıradakine geç */ }
  }
  return undefined;
}

function playwrightDownloads() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH
    || path.join(process.env.HOME || '', '.cache', 'ms-playwright');
  try {
    return fs.readdirSync(base)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse()
      .map((d) => path.join(base, d, 'chrome-linux', 'chrome'));
  } catch {
    return [];
  }
}

module.exports = function chromePath() {
  // CHROME_PATH verilmişse bile var olan bir dosyayı göstermek zorunda.
  const candidates = process.env.CHROME_PATH ? [process.env.CHROME_PATH] : [
    ...playwrightDownloads(),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  return firstRegularFile(candidates);
};
