/* Her kategori için temiz ekran görüntüsü + kartın gerçekten dolu olduğunun kanıtı. */
const { chromium, devices } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots');
const EXEC = require('./chrome')();
const BASE = 'http://127.0.0.1:8099';

let pass = 0, fail = 0;
function ok(cond, msg, extra) {
  if (cond) { pass++; console.log('  ✓ ' + msg); return; }
  fail++;
  console.log('  ✗ ' + msg + (extra ? ' :: ' + extra : ''));
}

/** Soru kartı gerçekten dolu mu? */
function cardIsFilled(info) {
  if (info.hasExpr && info.exprText.length > 0) return true;
  if (info.hasText && info.bodyText.length > 0) return true;
  return info.hasVisual && info.svgCount > 0;
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], colorScheme: 'dark', locale: 'tr-TR' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('#btn-endless').click();
  await page.waitForTimeout(500);

  const cats = [
    ['add', '10-toplama'], ['sub', '11-cikarma'], ['mul', '12-carpma'], ['div', '13-bolme'],
    ['pct', '14-yuzde'], ['daily', '15-gunluk'], ['visual', '16-gorsel'],
  ];

  for (const [cat, name] of cats) {
    // yalnızca bu kategoriyi üret, temiz bir soru çiz, animasyon bitene kadar bekle
    await page.evaluate((c) => {
      const s = window.__zihin.sess;
      s.engine.setCategories([c]);
      s.locked = false;
      window.__zihin.nextQuestion();
    }, cat);
    await page.waitForTimeout(900);   // 0.5s giriş animasyonu + SVG animasyonları

    const info = await page.evaluate(() => {
      const card = document.querySelector('#qcard');
      const visible = (sel) => { const e = document.querySelector(sel); return e && !e.classList.contains('hidden'); };
      const cs = getComputedStyle(card);
      return {
        cat: window.__zihin.sess.q.cat,
        opacity: cs.opacity,
        hasExpr: visible('#qexpr'), hasText: visible('#qtext'), hasVisual: visible('#qvisual'),
        exprText: document.querySelector('#qexpr').textContent,
        bodyText: document.querySelector('#qtext').textContent,
        svgCount: document.querySelectorAll('#qvisual svg').length,
        optionCount: document.querySelectorAll('#answers .ans').length,
        optionLabels: [...document.querySelectorAll('#answers .ans')].map((b) => b.textContent.trim()),
      };
    });

    ok(info.cat === cat, `${cat}: doğru kategori çizildi`);
    ok(info.opacity === '1', `${cat}: kart tam görünür (opacity ${info.opacity})`);
    ok(cardIsFilled(info), `${cat}: soru kartı dolu`, JSON.stringify(info));
    ok(info.optionCount === 4 && info.optionLabels.every((l) => l.length > 0), `${cat}: 4 şık yazıldı — ${info.optionLabels.join(' / ')}`);

    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  }

  // görsel alt tipleri: hepsini tek tek çiz ve yakala
  const visualKinds = ['dots', 'grid', 'bars', 'pie', 'numberline', 'coins'];
  const found = new Set();
  // pie / numberline / coins 3. ve 6. seviyeden sonra açılır — hepsini görmek için seviyeyi yükselt
  for (const lvl of [3, 7]) {
    await page.evaluate((l) => { window.__zihin.sess.engine.setCategories(['visual']); window.__zihin.sess.engine.level = l; }, lvl);
    for (let i = 0; i < 200 && found.size < visualKinds.length; i++) {
      await page.evaluate(() => { window.__zihin.sess.locked = false; window.__zihin.nextQuestion(); });
      const t = await page.evaluate(() => window.__zihin.sess.q.visual.type);
      if (!found.has(t)) { found.add(t); await page.waitForTimeout(850); await page.screenshot({ path: path.join(SHOTS, `17-gorsel-${t}.png`) }); }
    }
  }
  await page.evaluate(() => { window.__zihin.sess.engine.setCategories(['visual']); });
  for (let i = 0; i < 400 && found.size < visualKinds.length; i++) {
    await page.evaluate(() => { window.__zihin.sess.locked = false; window.__zihin.nextQuestion(); });
    const t = await page.evaluate(() => window.__zihin.sess.q.visual.type);
    if (!found.has(t)) {
      found.add(t);
      await page.waitForTimeout(850);
      await page.screenshot({ path: path.join(SHOTS, `17-gorsel-${t}.png`) });
    }
  }
  ok(found.size === visualKinds.length, `6 görsel tipinin hepsi çizildi: ${[...found].join(', ')}`);

  await browser.close();
  console.log(`\nEKRAN GÖRÜNTÜSÜ KANITI: ${pass} geçti, ${fail} kaldı`);
  process.exit(fail ? 1 : 0);
})();
