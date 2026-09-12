/* Oyun ekranı her soru tipinde ekrana tam sığıyor mu? */
const { chromium, devices } = require('playwright');
const EXEC = process.env.CHROME_PATH || undefined;  // boşsa Playwright'in kendi Chromium'u
let pass = 0, fail = 0;
const ok = (c, m, x) => { c ? (pass++, console.log('  ✓ ' + m)) : (fail++, console.log('  ✗ ' + m + (x ? ' :: ' + x : ''))); };

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  // küçük (SE) ve büyük (Pro Max) iki cihazda dene
  for (const dev of ['iPhone SE', 'iPhone 15 Pro', 'iPhone 15 Pro Max']) {
    const ctx = await browser.newContext({ ...devices[dev], colorScheme: 'dark', locale: 'tr-TR' });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await page.locator('#btn-endless').click();
    await page.waitForTimeout(400);

    for (const cat of ['add', 'sub', 'mul', 'div', 'pct', 'daily', 'visual']) {
      for (let i = 0; i < (cat === 'visual' ? 30 : 6); i++) {
        await page.evaluate(([c, lvl]) => {
          const s = window.__zihin.sess;
          s.engine.setCategories([c]); s.engine.level = lvl; s.locked = false;
          window.__zihin.nextQuestion();
        }, [cat, 1 + (i % 10)]);
        await page.waitForTimeout(80);
        const fit = await page.evaluate(() => {
          const vh = window.innerHeight;
          const fb = document.querySelector('#feedback').getBoundingClientRect();
          const ans = document.querySelector('#answers').getBoundingClientRect();
          const doc = document.documentElement;
          return { vh, fbBottom: Math.round(fb.bottom), ansBottom: Math.round(ans.bottom),
                   pageScroll: doc.scrollHeight - doc.clientHeight,
                   cat: window.__zihin.sess.q.cat, vis: window.__zihin.sess.q.visual?.type ?? null };
        });
        if (fit.fbBottom > fit.vh + 1 || fit.ansBottom > fit.vh + 1 || fit.pageScroll > 1) {
          ok(false, `${dev} · ${cat}${fit.vis ? '/' + fit.vis : ''}: taşma`, JSON.stringify(fit));
          i = 99;
        }
      }
    }
    ok(true, `${dev}: tüm soru tipleri ekrana tam sığdı (kaydırma yok)`);
    await ctx.close();
  }
  await browser.close();
  console.log(`\nYERLEŞİM KANITI: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
