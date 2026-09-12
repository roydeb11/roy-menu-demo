/* Zihin motoru — değişmez testleri.
 * Çalıştır:  node zihin/tests/engine.test.mjs   (veya: node --test zihin/tests/)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QuestionEngine, CATEGORIES, scoreFor, __internals, fmt } from '../js/engine.js';

/** tr-TR biçimli sayıyı geri çevirir: "1.234,5" -> 1234.5 */
const parseTR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------------------------------------------------------------- 1 --- */
test('şık bütünlüğü, cevap geçerliliği ve metin sağlığı — 200.000 soru', () => {
  const perLevel = 20000;
  const catCount = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));

  for (let level = 1; level <= 10; level++) {
    const engine = new QuestionEngine({ seed: 1000 + level, level, historySize: 60 });
    for (let i = 0; i < perLevel; i++) {
      const q = engine.next();
      catCount[q.cat]++;

      assert.equal(q.options.length, 4, 'dört şık');
      assert.equal(new Set(q.options).size, 4, 'şıklar benzersiz');
      assert.ok(q.options.includes(q.answer), 'doğru cevap şıklar içinde');
      assert.ok(Number.isFinite(q.answer), 'cevap sonlu');
      assert.ok(q.options.every((o) => Number.isFinite(o)), 'şıklar sonlu');
      assert.equal(q.level, level, 'seviye sabit');

      const blob = `${q.text ?? ''}|${q.expr ?? ''}|${q.hint ?? ''}`;
      assert.doesNotMatch(blob, /undefined|NaN|null|Infinity/, `bozuk metin: ${blob}`);
    }
  }

  const missing = CATEGORIES.filter((c) => catCount[c] === 0);
  assert.deepEqual(missing, [], 'yedi kategorinin hepsi üretildi');
  console.log('    kategori dağılımı:', Object.entries(catCount).map(([k, v]) => `${k}=${v}`).join(' '));
});

/* ---------------------------------------------------------------- 2 --- */
test('aritmetik doğruluk — ifade yeniden hesaplanıyor (100.000 soru)', () => {
  let checked = 0;

  for (let level = 1; level <= 10; level++) {
    const engine = new QuestionEngine({ seed: 777 + level, level, categories: ['add', 'sub', 'mul', 'div'] });
    for (let i = 0; i < 10000; i++) {
      const q = engine.next();
      const m = q.expr.match(/^(.+?) ([+−×÷]) (.+)$/u);
      assert.ok(m, `ifade ayrıştırılabilir: ${q.expr}`);

      const a = parseTR(m[1]);
      const b = parseTR(m[3]);
      const expected = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]];
      assert.equal(q.answer, round2(expected), `${q.expr} yanlış hesaplandı`);

      if (m[2] === '−') assert.ok(q.answer >= 0, 'çıkarma sonucu negatif olmaz');
      if (m[2] === '÷') assert.ok(Number.isInteger(q.answer), 'bölme kalan bırakmaz');
      checked++;
    }
  }
  assert.equal(checked, 100000);
});

/* ---------------------------------------------------------------- 3 --- */
test('görsel soruların cevabı görsel veriyle tutarlı (60.000 soru)', () => {
  const kinds = {};

  for (let level = 1; level <= 10; level++) {
    const engine = new QuestionEngine({ seed: 4242 + level, level, categories: ['visual'] });
    for (let i = 0; i < 6000; i++) {
      const q = engine.next();
      const v = q.visual;
      kinds[v.type] = (kinds[v.type] ?? 0) + 1;

      let expected;
      switch (v.type) {
        case 'dots': expected = v.groups * v.per; break;
        case 'grid': expected = v.rows * v.cols; break;
        case 'bars': expected = Math.abs(v.a - v.b); break;
        case 'pie': expected = v.percent; break;
        case 'numberline': expected = v.start + ((v.end - v.start) / v.ticks) * v.at; break;
        case 'coins': expected = v.items.reduce((s, it) => s + it.value * it.count, 0); break;
        default: throw new Error('bilinmeyen görsel tipi: ' + v.type);
      }
      assert.equal(q.answer, round2(expected), `görsel cevabı tutarsız: ${JSON.stringify(v)}`);
      if (v.type === 'bars') assert.notEqual(q.answer, 0, 'çubuklar eşit olmaz');
    }
  }
  console.log('    görsel tipleri:', Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(' '));
});

/* ---------------------------------------------------------------- 4 --- */
test('yüzde soruları metinden bağımsız doğrulanıyor (40.000 soru)', () => {
  for (let level = 1; level <= 10; level++) {
    const engine = new QuestionEngine({ seed: 909 + level, level, categories: ['pct'] });
    for (let i = 0; i < 4000; i++) {
      const q = engine.next();

      const of = q.text.match(/^(.+?) sayısının %(\d+) kaçtır\?$/);
      const whatPct = q.text.match(/^(.+?), (.+?) sayısının yüzde kaçıdır\?$/);
      const discount = q.text.match(/^(.+?) TL'lik ürüne %(\d+) indirim.*$/);
      const increase = q.text.match(/^(.+?) TL'ye %(\d+) zam.*$/);
      const reverse = q.text.match(/^%(\d+) indirimden sonra fiyat (.+?) TL oldu.*$/);

      if (of) {
        assert.equal(q.answer, round2(parseTR(of[1]) * Number(of[2]) / 100));
      } else if (whatPct) {
        assert.equal(q.answer, round2(parseTR(whatPct[1]) / parseTR(whatPct[2]) * 100));
      } else if (discount) {
        assert.equal(q.answer, round2(parseTR(discount[1]) * (100 - Number(discount[2])) / 100));
      } else if (increase) {
        assert.equal(q.answer, round2(parseTR(increase[1]) * (100 + Number(increase[2])) / 100));
      } else if (reverse) {
        assert.equal(q.answer, round2(parseTR(reverse[2]) / ((100 - Number(reverse[1])) / 100)));
      } else {
        assert.fail('tanınmayan yüzde biçimi: ' + q.text);
      }
    }
  }
});

/* ---------------------------------------------------------------- 5 --- */
test('aynı soru geçmiş penceresi içinde iki kez çıkmıyor (40.000 soru)', () => {
  const engine = new QuestionEngine({ seed: 31337, historySize: 60 });
  const ring = [];
  for (let i = 0; i < 40000; i++) {
    const q = engine.next();
    assert.ok(!ring.includes(q.sig), `tekrar eden soru: ${q.sig}`);
    ring.push(q.sig);
    if (ring.length > 60) ring.shift();
  }
});

test('üç ardışık soru aynı kategoriden gelmiyor (20.000 soru)', () => {
  const engine = new QuestionEngine({ seed: 5150 });
  const last = [];
  for (let i = 0; i < 20000; i++) {
    last.push(engine.next().cat);
    if (last.length > 3) last.shift();
    if (last.length === 3) {
      assert.ok(!(last[0] === last[1] && last[1] === last[2]), `üç ardışık ${last[0]}`);
    }
  }
});

/* ---------------------------------------------------------------- 6 --- */
test('akış kesintisiz — 1.000.000 soru', () => {
  const engine = new QuestionEngine({ seed: 2026 });
  const total = 1000000;
  let produced = 0;
  const t0 = Date.now();

  for (let i = 0; i < total; i++) {
    const q = engine.next();
    if (q.options.length === 4 && Number.isFinite(q.answer)) produced++;
  }

  const dt = Date.now() - t0;
  assert.equal(produced, total);
  console.log(`    süre: ${dt} ms (~${Math.round(total / (dt / 1000)).toLocaleString('tr-TR')} soru/sn)`);
});

/* ---------------------------------------------------------------- 7 --- */
test('uyarlanır zorluk doğru yönde hareket ediyor', () => {
  const up = new QuestionEngine({ seed: 11, level: 1 });
  for (let i = 0; i < 200; i++) { up.next(); up.record(true, 1500); }
  assert.equal(up.level, 10, 'hep doğru + hızlı → seviye 10');

  const down = new QuestionEngine({ seed: 12, level: 10 });
  for (let i = 0; i < 200; i++) { down.next(); down.record(false, 20000); }
  assert.equal(down.level, 1, 'hep yanlış → seviye 1');

  const hold = new QuestionEngine({ seed: 13, level: 5 });
  for (let i = 0; i < 400; i++) { hold.next(); hold.record(i % 3 !== 0, 7000); }
  assert.ok(hold.level >= 1 && hold.level <= 10, 'seviye sınırlar içinde');
});

/* ---------------------------------------------------------------- 8 --- */
test('günlük hayat şablonlarının tamamı üretiliyor', () => {
  const engine = new QuestionEngine({ seed: 8080, categories: ['daily'], historySize: 5 });
  const prefixes = new Set();
  for (let i = 0; i < 60000; i++) prefixes.add(engine.next().sig.split(':')[0]);
  assert.equal(prefixes.size, __internals.DAILY_COUNT, 'her şablon en az bir kez çıktı');
});

/* ---------------------------------------------------------------- 9 --- */
test('kategori filtresi yalnız seçilen konuyu üretiyor', () => {
  for (const c of CATEGORIES) {
    const engine = new QuestionEngine({ seed: 5, categories: [c] });
    for (let i = 0; i < 2000; i++) assert.equal(engine.next().cat, c);
  }
});

test('puanlama formülü', () => {
  assert.equal(scoreFor({ level: 1, ms: 6000, streak: 0 }), 10, 'taban puan');
  assert.equal(scoreFor({ level: 10, ms: 0, streak: 20 }), 240, 'maksimum puan');
  assert.ok(scoreFor({ level: 5, ms: 3000, streak: 5 }) > scoreFor({ level: 5, ms: 5000, streak: 5 }), 'hız ödüllendirilir');
  assert.ok(scoreFor({ level: 5, ms: 3000, streak: 10 }) > scoreFor({ level: 5, ms: 3000, streak: 2 }), 'seri ödüllendirilir');
});

/* --------------------------------------------------------------- 10 --- */
test('Türkçe sayı biçimi', () => {
  assert.equal(fmt(1234567), '1.234.567');
  assert.equal(fmt(1234.5), '1.234,50');
  assert.equal(fmt(0), '0');
});
