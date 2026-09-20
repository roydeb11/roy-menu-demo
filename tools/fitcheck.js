/* Oyun ekranı her soru tipinde ekrana tam sığıyor mu? */
const { chromium, devices } = require('playwright');
const EXEC = require('./chrome')();
let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✓ ' + msg); return; }
  fail++;
  console.log('  ✗ ' + msg + (extra ? ' :: ' + extra : ''));
}

/** Bir soru tipi için kaç varyasyon denenecek. */
function attemptsFor(category) {
  return category === 'visual' ? 30 : 6;
}

/** Oyun ekranının görünen alana sığıp sığmadığını ölçer. */
async function measure(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight;
    const fb = document.querySelector('#feedback').getBoundingClientRect();
    const ans = document.querySelector('#answers').getBoundingClientRect();
    const doc = document.documentElement;
    return {
      vh, fbBottom: Math.round(fb.bottom), ansBottom: Math.round(ans.bottom),
      pageScroll: doc.scrollHeight - doc.clientHeight,
      cat: window.__zihin.sess.q.cat, vis: window.__zihin.sess.q.visual?.type ?? null,
    };
  });
}

/** Taşma var mı? */
function overflows(fit) {
  return fit.fbBottom > fit.vh + 1 || fit.ansBottom > fit.vh + 1 || fit.pageScroll > 1;
}

/** Tek bir cihazda bütün soru tiplerini dener; taşma varsa false döner. */
async function checkDevice(browser, deviceName) {
  const ctx = await browser.newContext({ ...devices[deviceName], colorScheme: 'dark', locale: 'tr-TR' });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8099/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.locator('#btn-endless').click();
  await page.waitForTimeout(400);

  let deviceOk = true;
  for (const cat of ['add', 'sub', 'mul', 'div', 'pct', 'daily', 'visual']) {
    for (let i = 0; i < attemptsFor(cat) && deviceOk; i++) {
      await page.evaluate(([c, lvl]) => {
        const s = window.__zihin.sess;
        s.engine.setCategories([c]);
        s.engine.level = lvl;
        s.locked = false;
        window.__zihin.nextQuestion();
      }, [cat, 1 + (i % 10)]);
      await page.waitForTimeout(80);

      const fit = await measure(page);
      if (overflows(fit)) {
        ok(false, `${deviceName} · ${cat}${fit.vis ? '/' + fit.vis : ''}: taşma`, JSON.stringify(fit));
        deviceOk = false;
      }
    }
  }

  if (deviceOk) ok(true, `${deviceName}: tüm soru tipleri ekrana tam sığdı (kaydırma yok)`);
  await ctx.close();
  return deviceOk;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  // küçük (SE) ve büyük (Pro Max) uçlar dahil üç boyut
  for (const dev of ['iPhone SE', 'iPhone 15 Pro', 'iPhone 15 Pro Max']) {
    await checkDevice(browser, dev);
  }
  await browser.close();

  console.log(`\nYERLEŞİM KANITI: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
