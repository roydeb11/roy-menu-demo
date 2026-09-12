/* Zihin PWA — gerçek tarayıcıda uçtan uca kanıt.
 * iPhone 15 Pro görünümünde açar, oynar, ekran görüntüsü alır,
 * üç-ton palet kuralını denetler. */
const { chromium, devices } = require('playwright');
const fs = require('fs'), path = require('path');

const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots');
const BASE = process.env.BASE || 'http://127.0.0.1:8099';
const EXEC = process.env.CHROME_PATH || undefined;  // boşsa Playwright'in kendi Chromium'u

let pass = 0, fail = 0; const problems = [];
const ok = (c, m, extra) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; problems.push(m + (extra ? ' :: ' + extra : '')); console.log('  ✗ ' + m + (extra ? ' :: ' + extra : '')); } };

/** rgb(a) dizesini üç-ton kuralına göre sınıflandırır. */
function classify(css) {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return 'other';
  const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x));
  if (parseFloat(a) === 0) return 'transparent';
  if (r === g && g === b) return 'achromatic';                    // siyah↔beyaz ekseni
  // Apple systemBlue: #0A84FF (koyu) ve #007AFF (açık) + alfa varyasyonları
  if (Math.abs(r - 10) <= 10 && Math.abs(g - 132) <= 8 && b >= 245) return 'blue';
  if (Math.abs(r - 0) <= 6 && Math.abs(g - 122) <= 8 && b >= 245) return 'blue';
  return 'other:' + css;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: EXEC, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ...devices['iPhone 15 Pro'], colorScheme: 'dark', locale: 'tr-TR' });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

  console.log('\n— 1) Açılış');
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  ok(await page.locator('#screen-home.is-active').isVisible(), 'giriş ekranı göründü');
  ok((await page.title()).includes('Zihin'), 'başlık doğru: ' + (await page.title()));
  ok(await page.locator('#btn-endless').isVisible(), 'Sonsuz Antrenman düğmesi var');
  ok((await page.locator('.chip[data-cat]').count()) === 7, '7 konu etiketi var');
  await page.screenshot({ path: path.join(SHOTS, '01-giris.png') });

  console.log('\n— 2) Üç ton palet denetimi (giriş)');
  const audit = async (label) => {
    const colors = await page.evaluate(() => {
      const out = new Set();
      for (const el of document.querySelectorAll('*')) {
        const cs = getComputedStyle(el);
        for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'fill', 'stroke']) {
          const v = cs[prop];
          if (v && v !== 'none') out.add(v);
        }
      }
      return [...out];
    });
    const offenders = colors.map(classify).filter((c) => c.startsWith('other'));
    ok(offenders.length === 0, `${label}: palet yalnızca siyah/beyaz/Apple mavisi (${colors.length} farklı değer tarandı)`,
       offenders.slice(0, 5).join(' | '));
  };
  await audit('giriş');

  console.log('\n— 3) Sonsuz mod: 250 soru kesintisiz');
  await page.locator('#btn-endless').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#screen-play.is-active').isVisible(), 'oyun ekranı açıldı');
  ok((await page.locator('#answers .ans').count()) === 4, '4 cevap düğmesi var');
  await page.screenshot({ path: path.join(SHOTS, '02-oyun.png') });

  // hep doğru cevapla — seviye yükselmeli, puan artmalı, akış hiç durmamalı
  const seen = new Set();
  let lastScore = 0, maxLevel = 1, kinds = new Set();
  for (let i = 0; i < 250; i++) {
    const info = await page.evaluate(() => {
      const q = window.__zihin.sess.q;
      const btns = [...document.querySelectorAll('#answers .ans')];
      const idx = btns.findIndex((b) => Number(b.dataset.value) === q.answer);
      return { sig: q.sig, cat: q.cat, idx, score: window.__zihin.sess.score, level: window.__zihin.sess.engine.level };
    });
    if (info.idx < 0) { ok(false, 'doğru cevap şıklarda bulunamadı (soru ' + i + ')'); break; }
    seen.add(info.sig); kinds.add(info.cat);
    maxLevel = Math.max(maxLevel, info.level);
    await page.locator('#answers .ans').nth(info.idx).click();
    await page.waitForTimeout(35);
    // bir sonraki soruyu bekle
    await page.waitForFunction((prev) => window.__zihin.sess?.q?.sig !== prev, info.sig, { timeout: 4000 });
    lastScore = info.score;
  }
  ok(seen.size >= 240, `250 soruda ${seen.size} benzersiz soru geldi (tekrar neredeyse yok)`);
  ok(kinds.size === 7, `7 kategorinin hepsi oyun içinde göründü (${[...kinds].join(',')})`);
  const after = await page.evaluate(() => ({ score: window.__zihin.sess.score, level: window.__zihin.sess.engine.level, streak: window.__zihin.sess.streak }));
  ok(after.score > 2000, `puan birikti: ${after.score}`);
  ok(after.level === 10, `zorluk tavana çıktı: seviye ${after.level}`);
  ok(after.streak >= 250, `seri kesintisiz: ${after.streak}`);
  ok(await page.locator('#screen-play.is-active').isVisible(), 'oyun 250 sorudan sonra hâlâ devam ediyor — akış bitmedi');
  await page.screenshot({ path: path.join(SHOTS, '03-seri.png') });

  console.log('\n— 4) Yanlış cevapta ipucu ve doğru şık gösterimi');
  const wrongInfo = await page.evaluate(() => {
    const q = window.__zihin.sess.q;
    const btns = [...document.querySelectorAll('#answers .ans')];
    return { idx: btns.findIndex((b) => Number(b.dataset.value) !== q.answer), hint: q.hint };
  });
  await page.locator('#answers .ans').nth(wrongInfo.idx).click();
  await page.waitForTimeout(260);
  ok((await page.locator('#answers .ans.is-wrong').count()) === 1, 'yanlış şık işaretlendi');
  ok((await page.locator('#answers .ans.is-correct').count()) === 1, 'doğru şık gösterildi');
  const fb = await page.locator('#feedback').textContent();
  ok(fb.trim().length > 0, 'ipucu metni göründü: ' + fb.slice(0, 60));
  ok((await page.evaluate(() => window.__zihin.sess.streak)) === 0, 'yanlışta seri sıfırlandı');
  await page.screenshot({ path: path.join(SHOTS, '04-yanlis.png') });
  await audit('oyun');

  console.log('\n— 5) Görsel soru ekran görüntüsü');
  let gotVisual = false;
  for (let i = 0; i < 60 && !gotVisual; i++) {
    await page.waitForTimeout(120);
    const cat = await page.evaluate(() => window.__zihin.sess?.q?.cat);
    if (cat === 'visual') {
      gotVisual = true;
      await page.waitForTimeout(900);   // giriş + SVG animasyonları bitsin
      ok(await page.locator('#qvisual svg').isVisible(), 'görsel soru SVG ile çizildi');
      ok(await page.evaluate(() => getComputedStyle(document.querySelector('#qcard')).opacity) === '1', 'kart tam görünür');
      await page.screenshot({ path: path.join(SHOTS, '05-gorsel.png') });
    } else {
      await page.evaluate(() => window.__zihin.nextQuestion());
    }
  }
  ok(gotVisual, 'görsel soru tipi oyunda görüldü');

  console.log('\n— 6) Günlük hayat sorusu ekran görüntüsü');
  let gotDaily = false;
  for (let i = 0; i < 60 && !gotDaily; i++) {
    const cat = await page.evaluate(() => window.__zihin.sess?.q?.cat);
    if (cat === 'daily') {
      gotDaily = true;
      await page.waitForTimeout(900);
      const t = await page.locator('#qtext').textContent();
      ok(t.length > 20, 'günlük hayat problemi metni: ' + t.slice(0, 70) + '…');
      ok(await page.evaluate(() => getComputedStyle(document.querySelector('#qcard')).opacity) === '1', 'kart tam görünür');
      await page.screenshot({ path: path.join(SHOTS, '06-gunluk.png') });
    } else {
      await page.evaluate(() => window.__zihin.nextQuestion());
      await page.waitForTimeout(60);
    }
  }
  ok(gotDaily, 'günlük hayat sorusu oyunda görüldü');

  console.log('\n— 7) İstatistikler');
  await page.locator('[data-back]').click();
  await page.waitForTimeout(400);
  await page.locator('#btn-stats').click();
  await page.waitForTimeout(600);
  ok(await page.locator('#screen-stats.is-active').isVisible(), 'istatistik ekranı açıldı');
  const asked = await page.locator('#st-asked').textContent();
  ok(parseInt(asked.replace(/\./g, ''), 10) >= 250, `çözülen soru sayısı kaydedildi: ${asked}`);
  ok((await page.locator('#stat-list .stat-row').count()) === 7, '7 konunun başarısı listelendi');
  await page.screenshot({ path: path.join(SHOTS, '07-istatistik.png') });
  await audit('istatistik');

  console.log('\n— 8) 60 saniye modu');
  await page.locator('#btn-stats-back').click();
  await page.waitForTimeout(300);
  await page.locator('#btn-timed').click();
  await page.waitForTimeout(400);
  ok(await page.locator('#hud-time').isVisible(), 'süre göstergesi göründü');
  const t0 = await page.locator('#hud-time-v').textContent();
  ok(t0 === '60', 'sayaç 60 saniyeden başladı');
  await page.evaluate(() => { window.__zihin.sess.timeLeft = 2; });
  await page.waitForTimeout(2600);
  ok(await page.locator('#screen-summary.is-active').isVisible(), 'süre bitince özet ekranı açıldı');
  await page.screenshot({ path: path.join(SHOTS, '08-ozet.png') });

  console.log('\n— 9) Açık görünüm (light mode)');
  await ctx.close();
  const ctx2 = await browser.newContext({ ...devices['iPhone 15 Pro'], colorScheme: 'light', locale: 'tr-TR' });
  const page2 = await ctx2.newPage();
  await page2.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
  await page2.waitForTimeout(600);
  const bg = await page2.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(255, 255, 255)', 'açık görünümde zemin beyaz: ' + bg);
  await page2.screenshot({ path: path.join(SHOTS, '09-acik-gorunum.png') });

  console.log('\n— 10) PWA / çevrimdışı');
  const man = await page2.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  ok(man.display === 'standalone', 'manifest standalone');
  ok(man.icons.length === 3, 'manifest 3 ikon tanımlıyor');
  const sw = await page2.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r));
  ok(sw, 'service worker kaydedildi (çevrimdışı çalışır)');

  ok(consoleErrors.length === 0, 'konsolda hata yok', consoleErrors.slice(0, 3).join(' | '));

  await browser.close();
  console.log('\n' + '='.repeat(58));
  console.log(`TARAYICI KANITI: ${pass} geçti, ${fail} kaldı`);
  if (problems.length) { console.log('\nSORUNLAR:'); problems.forEach((p) => console.log(' ✗ ' + p)); }
  console.log('Ekran görüntüleri: docs/screenshots/');
  console.log('='.repeat(58));
  process.exit(fail === 0 ? 0 : 1);
})();
