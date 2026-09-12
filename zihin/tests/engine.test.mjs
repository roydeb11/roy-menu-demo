/* Zihin motoru — invariant testleri.
 * Çalıştır:  node zihin/tests/engine.test.mjs
 */
import { QuestionEngine, CATEGORIES, scoreFor, __internals, fmt } from '../js/engine.js';

let pass = 0, fail = 0;
const failures = [];
function ok(cond, msg, extra) {
  if (cond) { pass++; return true; }
  fail++;
  if (failures.length < 25) failures.push(msg + (extra ? ' :: ' + JSON.stringify(extra) : ''));
  return false;
}
function section(t) { console.log('\n— ' + t); }

/** tr-TR biçimli sayıyı geri çevirir: "1.234,5" -> 1234.5 */
const parseTR = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/* ---------------------------------------------------------------- 1 --- */
section('1) Şık bütünlüğü, cevap geçerliliği, metin sağlığı — 200.000 soru');
{
  const N = 200000;
  const catCount = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const levelCount = {};
  let badOptions = 0, badAnswer = 0, badText = 0, notIncluded = 0, dup = 0;

  for (let level = 1; level <= 10; level++) {
    const eng = new QuestionEngine({ seed: 1000 + level, level, historySize: 60 });
    for (let i = 0; i < N / 10; i++) {
      const q = eng.next();
      catCount[q.cat]++;
      levelCount[q.level] = (levelCount[q.level] ?? 0) + 1;

      if (q.options.length !== 4) badOptions++;
      if (new Set(q.options).size !== 4) dup++;
      if (!q.options.includes(q.answer)) notIncluded++;
      if (!Number.isFinite(q.answer)) badAnswer++;
      if (q.options.some((o) => !Number.isFinite(o))) badOptions++;

      const blob = `${q.text ?? ''}|${q.expr ?? ''}|${q.hint ?? ''}`;
      if (/undefined|NaN|null|Infinity/.test(blob)) { badText++; if (badText < 3) console.log('  metin:', blob); }
      // seviye kilitli motorda zorluk sabit kalmalı (record çağrılmadı)
      if (q.level !== level) badAnswer++;
    }
  }
  ok(badOptions === 0, `her soruda 4 sonlu şık (hata: ${badOptions})`);
  ok(dup === 0, `şıklar benzersiz (tekrar: ${dup})`);
  ok(notIncluded === 0, `doğru cevap şıklar içinde (eksik: ${notIncluded})`);
  ok(badAnswer === 0, `cevap sonlu ve seviye sabit (hata: ${badAnswer})`);
  ok(badText === 0, `metinlerde undefined/NaN yok (hata: ${badText})`);
  const missing = CATEGORIES.filter((c) => catCount[c] === 0);
  ok(missing.length === 0, `7 kategorinin hepsi üretildi (eksik: ${missing.join(',') || 'yok'})`);
  console.log('  kategori dağılımı:', Object.entries(catCount).map(([k, v]) => `${k}=${v}`).join(' '));
}

/* ---------------------------------------------------------------- 2 --- */
section('2) Aritmetik doğruluk — ifade yeniden hesaplanıyor (100.000 soru)');
{
  let checked = 0, wrong = 0;
  for (let level = 1; level <= 10; level++) {
    const eng = new QuestionEngine({ seed: 777 + level, level, categories: ['add', 'sub', 'mul', 'div'] });
    for (let i = 0; i < 10000; i++) {
      const q = eng.next();
      const m = q.expr.match(/^(.+?) ([+−×÷]) (.+)$/u);
      if (!m) { wrong++; continue; }
      const a = parseTR(m[1]), b = parseTR(m[3]);
      const expect = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]];
      checked++;
      if (round2(expect) !== q.answer) {
        wrong++;
        if (wrong < 4) console.log('  ', q.expr, '=>', q.answer, 'beklenen', round2(expect));
      }
      if (m[2] === '−' && q.answer < 0) wrong++;             // çıkarma negatif olmamalı
      if (m[2] === '÷' && !Number.isInteger(q.answer)) wrong++; // bölme tam olmalı
    }
  }
  ok(wrong === 0, `${checked} aritmetik ifadenin hepsi doğru (hata: ${wrong})`);
}

/* ---------------------------------------------------------------- 3 --- */
section('3) Görsel soruların cevabı görsel veriyle tutarlı (60.000 soru)');
{
  let wrong = 0, kinds = {};
  for (let level = 1; level <= 10; level++) {
    const eng = new QuestionEngine({ seed: 4242 + level, level, categories: ['visual'] });
    for (let i = 0; i < 6000; i++) {
      const q = eng.next();
      const v = q.visual;
      kinds[v.type] = (kinds[v.type] ?? 0) + 1;
      let expect;
      switch (v.type) {
        case 'dots': expect = v.groups * v.per; break;
        case 'grid': expect = v.rows * v.cols; break;
        case 'bars': expect = Math.abs(v.a - v.b); break;
        case 'pie': expect = v.percent; break;
        case 'numberline': expect = v.start + ((v.end - v.start) / v.ticks) * v.at; break;
        case 'coins': expect = v.items.reduce((s, it) => s + it.value * it.count, 0); break;
        default: expect = NaN;
      }
      if (round2(expect) !== q.answer) { wrong++; if (wrong < 4) console.log('  ', v, q.answer, expect); }
      if (v.type === 'bars' && q.answer === 0) wrong++;   // eşit çubuk olmamalı
    }
  }
  ok(wrong === 0, `görsel cevaplar görselle birebir tutarlı (hata: ${wrong})`);
  console.log('  görsel tipleri:', Object.entries(kinds).map(([k, v]) => `${k}=${v}`).join(' '));
}

/* ---------------------------------------------------------------- 4 --- */
section('4) Yüzde soruları — cevap metinden bağımsız doğrulanıyor (40.000 soru)');
{
  let wrong = 0, forms = 0;
  for (let level = 1; level <= 10; level++) {
    const eng = new QuestionEngine({ seed: 909 + level, level, categories: ['pct'] });
    for (let i = 0; i < 4000; i++) {
      const q = eng.next();
      forms++;
      let m;
      if ((m = q.text.match(/^(.+?) sayısının %(\d+) kaçtır\?$/))) {
        if (round2(parseTR(m[1]) * Number(m[2]) / 100) !== q.answer) wrong++;
      } else if ((m = q.text.match(/^(.+?), (.+?) sayısının yüzde kaçıdır\?$/))) {
        if (round2(parseTR(m[1]) / parseTR(m[2]) * 100) !== q.answer) wrong++;
      } else if ((m = q.text.match(/^(.+?) TL'lik ürüne %(\d+) indirim.*$/))) {
        if (round2(parseTR(m[1]) * (100 - Number(m[2])) / 100) !== q.answer) wrong++;
      } else if ((m = q.text.match(/^(.+?) TL'ye %(\d+) zam.*$/))) {
        if (round2(parseTR(m[1]) * (100 + Number(m[2])) / 100) !== q.answer) wrong++;
      } else if ((m = q.text.match(/^%(\d+) indirimden sonra fiyat (.+?) TL oldu.*$/))) {
        if (round2(parseTR(m[2]) / ((100 - Number(m[1])) / 100)) !== q.answer) wrong++;
      } else { wrong++; console.log('  tanınmayan yüzde biçimi:', q.text); }
    }
  }
  ok(wrong === 0, `${forms} yüzde sorusunun hepsi doğrulandı (hata: ${wrong})`);
}

/* ---------------------------------------------------------------- 5 --- */
section('5) Tekrar yok — pencere içinde aynı soru iki kez çıkmıyor');
{
  const eng = new QuestionEngine({ seed: 31337, historySize: 60 });
  const ring = [];
  let repeats = 0;
  for (let i = 0; i < 40000; i++) {
    const q = eng.next();
    if (ring.includes(q.sig)) repeats++;
    ring.push(q.sig);
    if (ring.length > 60) ring.shift();
  }
  ok(repeats === 0, `40.000 soruda 60'lık pencerede tekrar yok (tekrar: ${repeats})`);

  // üç ardışık soru aynı kategoriden olmamalı
  const eng2 = new QuestionEngine({ seed: 5150 });
  let triple = 0, prev = [];
  for (let i = 0; i < 20000; i++) {
    const c = eng2.next().cat;
    prev.push(c); if (prev.length > 3) prev.shift();
    if (prev.length === 3 && prev[0] === prev[1] && prev[1] === prev[2]) triple++;
  }
  ok(triple === 0, `üç ardışık soru hiç aynı kategoriden olmadı (ihlal: ${triple})`);
}

/* ---------------------------------------------------------------- 6 --- */
section('6) Sonsuzluk — 1.000.000 soru kesintisiz üretiliyor');
{
  const eng = new QuestionEngine({ seed: 2026 });
  let n = 0;
  const t0 = Date.now();
  for (let i = 0; i < 1000000; i++) {
    const q = eng.next();
    if (q && q.options.length === 4 && Number.isFinite(q.answer)) n++;
  }
  const dt = Date.now() - t0;
  ok(n === 1000000, `1.000.000 geçerli soru üretildi (${n})`);
  console.log(`  süre: ${dt} ms  (~${Math.round(1000000 / (dt / 1000)).toLocaleString('tr-TR')} soru/sn)`);
}

/* ---------------------------------------------------------------- 7 --- */
section('7) Uyarlanır zorluk');
{
  const up = new QuestionEngine({ seed: 11, level: 1 });
  for (let i = 0; i < 200; i++) { up.next(); up.record(true, 1500); }
  ok(up.level === 10, `hep doğru + hızlı → seviye 10'a çıktı (${up.level})`);

  const down = new QuestionEngine({ seed: 12, level: 10 });
  for (let i = 0; i < 200; i++) { down.next(); down.record(false, 20000); }
  ok(down.level === 1, `hep yanlış → seviye 1'e indi (${down.level})`);

  const hold = new QuestionEngine({ seed: 13, level: 5 });
  for (let i = 0; i < 400; i++) { hold.next(); hold.record(i % 3 !== 0, 7000); }
  ok(hold.level >= 1 && hold.level <= 10, `karışık performansta seviye sınırlar içinde (${hold.level})`);
}

/* ---------------------------------------------------------------- 8 --- */
section('8) Günlük hayat şablonlarının tamamı kapsanıyor');
{
  const eng = new QuestionEngine({ seed: 8080, categories: ['daily'], historySize: 5 });
  const prefixes = new Set();
  for (let i = 0; i < 60000; i++) prefixes.add(eng.next().sig.split(':')[0]);
  const expected = __internals.DAILY_COUNT;
  ok(prefixes.size === expected, `${expected} günlük hayat şablonunun hepsi üretildi (${prefixes.size})`);
}

/* ---------------------------------------------------------------- 9 --- */
section('9) Kategori filtresi ve puanlama');
{
  for (const c of CATEGORIES) {
    const eng = new QuestionEngine({ seed: 5, categories: [c] });
    let okAll = true;
    for (let i = 0; i < 2000; i++) if (eng.next().cat !== c) okAll = false;
    ok(okAll, `sadece "${c}" seçilince yalnız o kategori geldi`);
  }
  ok(scoreFor({ level: 1, ms: 6000, streak: 0 }) === 10, 'taban puan doğru');
  ok(scoreFor({ level: 10, ms: 0, streak: 20 }) === 240, 'maksimum puan doğru (240)');
  ok(scoreFor({ level: 5, ms: 3000, streak: 5 }) > scoreFor({ level: 5, ms: 5000, streak: 5 }), 'hızlı cevap daha çok puan');
  ok(scoreFor({ level: 5, ms: 3000, streak: 10 }) > scoreFor({ level: 5, ms: 3000, streak: 2 }), 'uzun seri daha çok puan');
}

/* --------------------------------------------------------------- 10 --- */
section('10) Türkçe sayı biçimi');
{
  ok(fmt(1234567) === '1.234.567', 'binlik ayırıcı nokta: ' + fmt(1234567));
  ok(fmt(1234.5) === '1.234,50', 'ondalık ayırıcı virgül: ' + fmt(1234.5));
  ok(fmt(0) === '0', 'sıfır: ' + fmt(0));
}

/* --------------------------------------------------------------- son --- */
console.log('\n' + '='.repeat(58));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
if (failures.length) { console.log('\nBAŞARISIZ:'); failures.forEach((f) => console.log(' ✗ ' + f)); }
console.log('='.repeat(58));
process.exit(fail === 0 ? 0 : 1);
