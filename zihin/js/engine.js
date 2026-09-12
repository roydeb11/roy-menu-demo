/*  Zihin — sonsuz soru motoru / endless question engine
 *  Saf JS, DOM bağımsız. Native Swift sürümü (Engine/QuestionGenerator.swift)
 *  bu dosyanın birebir portudur; ikisi de aynı spesifikasyonu uygular.
 */

/* ---------------------------------------------------------------- RNG --- */
/** mulberry32 — hızlı, tekrarlanabilir 32-bit PRNG. */
export function makeRNG(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    const b = new Uint32Array(1);
    globalThis.crypto.getRandomValues(b);
    return b[0];
  }
  // Kripto yoksa: yüksek çözünürlüklü saat + çağrı sayacı. Güvenlik amaçlı
  // değil, yalnızca oturumdan oturuma farklı soru dizisi üretmek için.
  seedCounter += 1;
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  return ((Date.now() ^ Math.trunc(now * 1000) ^ (seedCounter * 0x9e3779b1)) >>> 0);
}

let seedCounter = 0;

/* ------------------------------------------------------------ helpers --- */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export const CATEGORIES = ['add', 'sub', 'mul', 'div', 'pct', 'daily', 'visual'];

export const CATEGORY_META = {
  add:    { tr: 'Toplama',     symbol: 'plus',            glyph: '+' },
  sub:    { tr: 'Çıkarma',     symbol: 'minus',           glyph: '−' },
  mul:    { tr: 'Çarpma',      symbol: 'multiply',        glyph: '×' },
  div:    { tr: 'Bölme',       symbol: 'divide',          glyph: '÷' },
  pct:    { tr: 'Yüzde',       symbol: 'percent',         glyph: '%' },
  daily:  { tr: 'Günlük Hayat',symbol: 'cart',            glyph: '🛒' },
  visual: { tr: 'Görsel',      symbol: 'eye',             glyph: '👁' },
};

/** Türkçe sayı biçimi: 1.234,5 */
export function fmt(n) {
  const v = round2(n);
  return Number.isInteger(v)
    ? v.toLocaleString('tr-TR')
    : v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

class Rand {
  constructor(rng) { this.rng = rng; }
  /** [lo, hi] dahil tam sayı */
  int(lo, hi) { return lo + Math.floor(this.rng() * (hi - lo + 1)); }
  pick(arr) { return arr[Math.floor(this.rng() * arr.length)]; }
  bool(p = 0.5) { return this.rng() < p; }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Yuvarlak "para gibi" sayı üretir: 5/10/25/50 katları. */
  money(lo, hi, step) {
    const s = step ?? this.pick([5, 10, 25, 50]);
    const a = Math.ceil(lo / s), b = Math.floor(hi / s);
    return (b >= a ? this.int(a, b) : a) * s;
  }
}

/* ------------------------------------------------------- distractors --- */
/**
 * 4 benzersiz şık üretir; doğru cevap her zaman içindedir.
 * `errors` = kategoriye özgü "tipik hata" adayları.
 */
function buildOptions(r, answer, errors, opts = {}) {
  const { integer = true, allowNegative = false } = opts;
  const norm = (v) => (integer ? Math.round(v) : round2(v));
  const seen = new Set([norm(answer)]);
  const out = [];

  const consider = (v) => {
    if (out.length >= 3) return;
    if (!Number.isFinite(v)) return;
    const n = norm(v);
    if (!allowNegative && n < 0) return;
    if (seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };

  for (const e of r.shuffle(errors)) consider(e);

  // Yedek stratejiler — her zaman 4 şıka tamamlar.
  const mag = Math.max(1, Math.abs(answer));
  const deltas = [1, 2, 3, 5, 10, -1, -2, -3, -5, -10];
  for (const d of r.shuffle(deltas)) consider(answer + d);
  const scale = Math.max(1, Math.round(mag * 0.1));
  for (let k = 1; out.length < 3 && k <= 40; k++) {
    consider(answer + (r.bool() ? 1 : -1) * scale * k);
    consider(answer + (r.bool() ? 1 : -1) * k);
  }
  while (out.length < 3) consider(norm(answer) + out.length + 1 + r.int(11, 99));

  return r.shuffle([norm(answer), ...out]);
}

/** Rakam yer değiştirme hatası (ör. 143 → 134) */
function digitSwap(n) {
  const s = String(Math.round(Math.abs(n)));
  if (s.length < 2) return NaN;
  const i = s.length - 2;
  const a = s.split('');
  [a[i], a[i + 1]] = [a[i + 1], a[i]];
  return Number(a.join('')) * Math.sign(n || 1);
}

/* --------------------------------------------------------- generators --- */
/* Her üreteç: (r: Rand, level: 1..10) => Question parçası                  */

function genAdd(r, L) {
  let a, b, decimals = false;
  if (L <= 2)      { a = r.int(2, 20);    b = r.int(2, 20); }
  else if (L <= 4) { a = r.int(12, 99);   b = r.int(12, 99); }
  else if (L <= 6) { a = r.int(120, 899); b = r.int(25, 199); }
  else if (L <= 8) { a = r.int(450, 4999);b = r.int(150, 3999); }
  else             { a = r.int(1500, 9999); b = r.int(1500, 9999); }

  if (L >= 5 && r.bool(0.28)) {           // ondalıklı varyant
    decimals = true;
    a = round2(r.int(15, 480) + r.pick([0.25, 0.5, 0.75, 0.9, 0.05]));
    b = round2(r.int(5, 260) + r.pick([0.25, 0.5, 0.75, 0.1]));
  }
  const answer = round2(a + b);
  const errors = [a + b + 10, a + b - 10, a + b + 1, a + b - 1, a - b, digitSwap(a + b), a + b + 100];
  return {
    cat: 'add', expr: `${fmt(a)} + ${fmt(b)}`, answer,
    options: buildOptions(r, answer, errors, { integer: !decimals }),
    hint: `${fmt(a)} + ${fmt(b)} = ${fmt(answer)}`,
    sig: `add:${a}+${b}`,
  };
}

function genSub(r, L) {
  let a, b, decimals = false;
  if (L <= 2)      { a = r.int(6, 20);     b = r.int(1, a - 1); }
  else if (L <= 4) { a = r.int(30, 99);    b = r.int(5, a - 2); }
  else if (L <= 6) { a = r.int(150, 900);  b = r.int(20, a - 10); }
  else if (L <= 8) { a = r.int(800, 5000); b = r.int(120, a - 50); }
  else             { a = r.int(3000, 9999);b = r.int(900, a - 200); }

  if (L >= 5 && r.bool(0.25)) {
    decimals = true;
    a = round2(r.int(60, 900) + r.pick([0.5, 0.25, 0.75]));
    b = round2(r.int(10, Math.max(11, Math.floor(a) - 10)) + r.pick([0.25, 0.5]));
  }
  const answer = round2(a - b);
  const errors = [b - a, a + b, answer + 10, answer - 10, answer + 1, answer - 1, digitSwap(answer)];
  return {
    cat: 'sub', expr: `${fmt(a)} − ${fmt(b)}`, answer,
    options: buildOptions(r, answer, errors, { integer: !decimals }),
    hint: `${fmt(a)} − ${fmt(b)} = ${fmt(answer)}`,
    sig: `sub:${a}-${b}`,
  };
}

function genMul(r, L) {
  let a, b;
  if (L <= 2)      { a = r.int(2, 6);    b = r.int(2, 9); }
  else if (L <= 4) { a = r.int(3, 12);   b = r.int(3, 12); }
  else if (L <= 6) { a = r.int(11, 29);  b = r.int(3, 12); }
  else if (L <= 8) { a = r.int(12, 49);  b = r.int(11, 29); }
  else             { a = r.int(101, 999);b = r.int(11, 49); }

  const answer = a * b;
  const errors = [
    a * b + a, a * b - a, a * b + b, a * b - b,
    a + b, (a + 1) * b, a * (b + 1), digitSwap(answer),
  ];
  return {
    cat: 'mul', expr: `${fmt(a)} × ${fmt(b)}`, answer,
    options: buildOptions(r, answer, errors),
    hint: `${fmt(a)} × ${fmt(b)} = ${fmt(answer)}`,
    sig: `mul:${a}x${b}`,
  };
}

function genDiv(r, L) {
  // Bölünen, tam bölünecek biçimde kurulur.
  let q, d;
  if (L <= 2)      { d = r.int(2, 5);   q = r.int(2, 9); }
  else if (L <= 4) { d = r.int(2, 9);   q = r.int(3, 12); }
  else if (L <= 6) { d = r.int(3, 12);  q = r.int(4, 25); }
  else if (L <= 8) { d = r.int(4, 19);  q = r.int(6, 49); }
  else             { d = r.int(11, 39); q = r.int(11, 99); }

  const n = d * q;
  const answer = q;
  const errors = [q + 1, q - 1, d, n - d, q * 2, Math.round(q / 2), q + 10, digitSwap(q)];
  return {
    cat: 'div', expr: `${fmt(n)} ÷ ${fmt(d)}`, answer,
    options: buildOptions(r, answer, errors),
    hint: `${fmt(d)} × ${fmt(q)} = ${fmt(n)} olduğundan ${fmt(n)} ÷ ${fmt(d)} = ${fmt(q)}`,
    sig: `div:${n}/${d}`,
  };
}

function genPct(r, L) {
  const easyP = [10, 20, 25, 50, 5, 75];
  const hardP = [12, 15, 18, 30, 35, 40, 45, 60, 65, 80, 90, 3, 8];
  let modes;
  if (L <= 3) modes = ['of'];
  else if (L <= 6) modes = ['of', 'of', 'whatPct', 'discount'];
  else modes = ['of', 'whatPct', 'discount', 'increase', 'reverse'];
  const mode = r.pick(modes);

  if (mode === 'of') {
    const p = L <= 4 ? r.pick(easyP) : r.pick([...easyP, ...hardP]);
    let base;
    if (L <= 3) base = r.money(40, 400, 20);
    else if (L <= 6) base = r.money(80, 1200, 20);
    else base = r.money(200, 9000, 50);
    const answer = round2((base * p) / 100);
    const errors = [base * p / 1000, base * p / 10, base - answer, answer * 2, answer / 2, answer + base * 0.01];
    return {
      cat: 'pct', text: `${fmt(base)} sayısının %${p} kaçtır?`, expr: `%${p} × ${fmt(base)}`,
      answer, options: buildOptions(r, answer, errors, { integer: Number.isInteger(answer) }),
      hint: `${fmt(base)} × ${p} ÷ 100 = ${fmt(answer)}`,
      sig: `pct:of:${base}:${p}`,
    };
  }

  if (mode === 'whatPct') {
    const p = r.pick([...easyP, ...hardP]);
    const base = r.money(50, 800, r.pick([20, 25, 50]));
    const part = round2((base * p) / 100);
    const answer = p;
    const errors = [100 - p, p / 2, p * 2, p + 10, p - 10, Math.round((base / part) * 10) / 10];
    return {
      cat: 'pct', text: `${fmt(part)}, ${fmt(base)} sayısının yüzde kaçıdır?`,
      answer, unit: '%', options: buildOptions(r, answer, errors),
      hint: `${fmt(part)} ÷ ${fmt(base)} × 100 = %${fmt(answer)}`,
      sig: `pct:what:${part}:${base}`,
    };
  }

  if (mode === 'discount') {
    const p = r.pick([10, 15, 20, 25, 30, 40, 50, 60]);
    const base = r.money(200, 6000, 50);
    const answer = round2(base * (100 - p) / 100);
    const errors = [round2(base * p / 100), base - p, round2(base * (100 + p) / 100), answer + base * 0.1, answer - base * 0.1];
    return {
      cat: 'pct', text: `${fmt(base)} TL'lik ürüne %${p} indirim yapıldı. Yeni fiyat kaç TL?`,
      answer, unit: 'TL', options: buildOptions(r, answer, errors, { integer: Number.isInteger(answer) }),
      hint: `${fmt(base)} − (${fmt(base)} × ${p} ÷ 100) = ${fmt(answer)} TL`,
      sig: `pct:disc:${base}:${p}`,
    };
  }

  if (mode === 'increase') {
    const p = r.pick([5, 10, 15, 20, 25, 30, 40, 50]);
    const base = r.money(1000, 60000, 250);
    const answer = round2(base * (100 + p) / 100);
    const errors = [round2(base * p / 100), round2(base * (100 - p) / 100), base + p, answer + base * 0.1];
    return {
      cat: 'pct', text: `${fmt(base)} TL'ye %${p} zam yapıldı. Yeni tutar kaç TL?`,
      answer, unit: 'TL', options: buildOptions(r, answer, errors, { integer: Number.isInteger(answer) }),
      hint: `${fmt(base)} × ${(100 + p) / 100} = ${fmt(answer)} TL`,
      sig: `pct:inc:${base}:${p}`,
    };
  }

  // reverse: indirimli fiyattan orijinali bul
  const p = r.pick([10, 20, 25, 50]);
  const answer = r.money(200, 4000, 100);
  const sale = round2(answer * (100 - p) / 100);
  const errors = [round2(sale * (100 + p) / 100), sale + p, round2(sale / 2), answer + 100, answer - 100];
  return {
    cat: 'pct', text: `%${p} indirimden sonra fiyat ${fmt(sale)} TL oldu. İndirimsiz fiyat kaç TL?`,
    answer, unit: 'TL', options: buildOptions(r, answer, errors, { integer: Number.isInteger(answer) }),
    hint: `${fmt(sale)} ÷ ${(100 - p) / 100} = ${fmt(answer)} TL`,
    sig: `pct:rev:${sale}:${p}`,
  };
}

/* ------------------------------------------- günlük hayat problemleri --- */
const ITEMS = [
  ['ekmek', 'adet'], ['süt', 'litre'], ['yumurta', 'adet'], ['peynir', 'paket'],
  ['kalem', 'adet'], ['defter', 'adet'], ['kitap', 'adet'], ['tişört', 'adet'],
  ['çay', 'paket'], ['kahve', 'paket'], ['elma', 'kilo'], ['domates', 'kilo'],
  ['pil', 'adet'], ['havlu', 'adet'], ['bardak', 'adet'], ['sabun', 'adet'],
];
const NAMES = ['Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Deniz', 'Kerem', 'Selin',
               'Burak', 'Merve', 'Emre', 'Ece', 'Roy', 'Nil', 'Umut', 'Derya'];
const CITIES = ['Ankara', 'İzmir', 'Bursa', 'Antalya', 'Konya', 'Adana', 'Trabzon', 'Eskişehir'];

/** Günlük hayat şablonları. Her biri (r, L) alır ve {text, answer, unit, errors, hint, sig} döner. */
const DAILY = [
  // 1 — market toplamı
  (r) => {
    const [item, u] = r.pick(ITEMS), n = r.int(3, 12), p = r.money(15, 180, 5);
    const answer = n * p;
    return { text: `Markette ${n} ${u} ${item} tanesi ${fmt(p)} TL'den alındı. Toplam kaç TL ödenir?`,
      answer, unit: 'TL', errors: [n + p, answer + p, answer - p, answer * 10, (n - 1) * p],
      hint: `${n} × ${fmt(p)} = ${fmt(answer)} TL`, sig: `d1:${n}:${p}:${item}` };
  },
  // 2 — hesabı bölüşmek
  (r) => {
    const n = r.pick([2, 3, 4, 5, 6, 8]), per = r.money(60, 400, 5), total = n * per;
    return { text: `${n} arkadaş ${fmt(total)} TL'lik hesabı eşit olarak bölüşüyor. Kişi başı kaç TL düşer?`,
      answer: per, unit: 'TL', errors: [total - n, per * 2, Math.round(per / 2), per + 10, total / (n + 1)],
      hint: `${fmt(total)} ÷ ${n} = ${fmt(per)} TL`, sig: `d2:${total}:${n}` };
  },
  // 3 — bahşiş
  (r) => {
    const t = r.pick([5, 10, 15, 20]), bill = r.money(200, 2000, 50);
    const answer = round2(bill * (100 + t) / 100);
    return { text: `Restoran hesabı ${fmt(bill)} TL. %${t} bahşiş bırakırsan toplam kaç TL ödersin?`,
      answer, unit: 'TL', errors: [round2(bill * t / 100), bill + t, round2(bill * (100 - t) / 100), answer + 50],
      hint: `${fmt(bill)} + (${fmt(bill)} × ${t}%) = ${fmt(answer)} TL`, sig: `d3:${bill}:${t}` };
  },
  // 4 — KDV
  (r) => {
    const kdv = r.pick([1, 10, 20]), net = r.money(100, 5000, 50);
    const answer = round2(net * (100 + kdv) / 100);
    return { text: `KDV hariç fiyatı ${fmt(net)} TL olan ürüne %${kdv} KDV eklenirse ödenecek tutar kaç TL?`,
      answer, unit: 'TL', errors: [round2(net * kdv / 100), net + kdv, round2(net * (100 - kdv) / 100), answer + 100],
      hint: `${fmt(net)} × ${(100 + kdv) / 100} = ${fmt(answer)} TL`, sig: `d4:${net}:${kdv}` };
  },
  // 5 — taksit
  (r) => {
    const n = r.pick([3, 4, 6, 9, 12]), per = r.money(150, 2500, 50), total = n * per;
    return { text: `${fmt(total)} TL'lik telefon ${n} eşit taksite bölünüyor. Aylık taksit kaç TL?`,
      answer: per, unit: 'TL', errors: [total - n, per + 100, per * 2, Math.round(total / (n + 1)), per - 50],
      hint: `${fmt(total)} ÷ ${n} = ${fmt(per)} TL`, sig: `d5:${total}:${n}` };
  },
  // 6 — yakıt tüketimi
  (r) => {
    const per100 = r.pick([5, 6, 7, 8, 9, 10, 12]), km = r.pick([100, 200, 300, 400, 500, 600, 800]);
    const answer = round2(per100 * km / 100);
    return { text: `Bir otomobil 100 km'de ${per100} litre yakıyor. ${km} km yolda kaç litre yakar?`,
      answer, unit: 'litre', errors: [per100 * km, round2(km / per100), answer + per100, answer * 10, answer / 2],
      hint: `${per100} × ${km} ÷ 100 = ${fmt(answer)} litre`, sig: `d6:${per100}:${km}` };
  },
  // 7 — hız / yol / zaman
  (r) => {
    const v = r.pick([60, 70, 80, 90, 100, 110, 120]), t = r.pick([2, 3, 4, 5, 6]);
    const answer = v * t;
    return { text: `Saatte ${v} km hızla giden araç ${t} saatte kaç km yol alır?`,
      answer, unit: 'km', errors: [v + t, Math.round(v / t), answer + v, answer - v, answer / 2],
      hint: `${v} × ${t} = ${fmt(answer)} km`, sig: `d7:${v}:${t}` };
  },
  // 8 — maaş zammı
  (r) => {
    const z = r.pick([10, 15, 20, 25, 30, 40, 50]), s = r.money(18000, 90000, 500);
    const answer = round2(s * (100 + z) / 100);
    return { text: `${fmt(s)} TL maaşa %${z} zam yapıldı. Yeni maaş kaç TL?`,
      answer, unit: 'TL', errors: [round2(s * z / 100), s + z * 100, round2(s * (100 - z) / 100), answer + 1000],
      hint: `${fmt(s)} × ${(100 + z) / 100} = ${fmt(answer)} TL`, sig: `d8:${s}:${z}` };
  },
  // 9 — sınav yüzdesi
  (r) => {
    const total = r.pick([20, 25, 40, 50, 80, 100]), pct = r.pick([40, 50, 60, 70, 75, 80, 90]);
    const correct = Math.round(total * pct / 100);
    return { text: `${r.pick(NAMES)} ${total} soruluk sınavda ${correct} soruyu doğru yaptı. Başarı yüzdesi kaçtır?`,
      answer: pct, unit: '%', errors: [100 - pct, correct, total - correct, pct + 10, pct - 10],
      hint: `${correct} ÷ ${total} × 100 = %${pct}`, sig: `d9:${total}:${correct}` };
  },
  // 10 — tarif ölçeklendirme
  (r) => {
    const gramPer4 = r.pick([200, 300, 400, 500, 600, 800]), m = r.pick([2, 6, 8, 10, 12]);
    const answer = gramPer4 * m / 4;
    return { text: `4 kişilik tarifte ${fmt(gramPer4)} gram un var. Aynı tarif ${m} kişi için kaç gram un ister?`,
      answer, unit: 'gram',
      errors: [gramPer4 + m, gramPer4 * m, gramPer4 * m / 8, gramPer4],
      hint: `(${gramPer4} ÷ 4) × ${m} = ${fmt(answer)} gram`, sig: `d10:${gramPer4}:${m}` };
  },
  // 11 — indirim kuponu
  (r) => {
    const cart = r.money(300, 2500, 50), coupon = r.pick([50, 75, 100, 150, 200, 250]);
    const answer = cart - coupon;
    return { text: `${fmt(cart)} TL'lik alışverişte ${fmt(coupon)} TL'lik indirim kuponu kullanıldı. Ödenecek tutar kaç TL?`,
      answer, unit: 'TL', errors: [cart + coupon, coupon, round2(cart * 0.9), answer - 50, answer + 100],
      hint: `${fmt(cart)} − ${fmt(coupon)} = ${fmt(answer)} TL`, sig: `d11:${cart}:${coupon}` };
  },
  // 12 — saatlik ücret
  (r) => {
    const h = r.int(4, 40), rate = r.money(80, 450, 10);
    const answer = h * rate;
    return { text: `Saatlik ücreti ${fmt(rate)} TL olan bir işte ${h} saat çalışıldı. Toplam kazanç kaç TL?`,
      answer, unit: 'TL', errors: [h + rate, answer + rate, answer - rate, answer * 10, Math.round(answer / 2)],
      hint: `${h} × ${fmt(rate)} = ${fmt(answer)} TL`, sig: `d12:${h}:${rate}` };
  },
  // 13 — benzin
  (r) => {
    const lt = r.pick([10, 15, 20, 25, 30, 40, 50]), price = r.pick([42, 44, 46, 48, 50, 52]);
    const answer = lt * price;
    return { text: `Litresi ${fmt(price)} TL olan benzinden ${lt} litre alındı. Kaç TL ödenir?`,
      answer, unit: 'TL', errors: [lt + price, answer + price, Math.round(answer / 2), answer * 10, answer - price],
      hint: `${lt} × ${fmt(price)} = ${fmt(answer)} TL`, sig: `d13:${lt}:${price}` };
  },
  // 14 — sınıf mevcudu yüzdesi
  (r) => {
    const n = r.pick([20, 25, 30, 40, 50, 60]), p = r.pick([20, 25, 30, 40, 50, 60, 70]);
    const answer = Math.round(n * p / 100);
    return { text: `${n} kişilik sınıfın %${p}'i kız öğrenci. Sınıfta kaç kız öğrenci var?`,
      answer, unit: 'kişi', errors: [n - answer, p, n + p, answer * 2, Math.round(answer / 2)],
      hint: `${n} × ${p} ÷ 100 = ${answer} kişi`, sig: `d14:${n}:${p}` };
  },
  // 15 — kalan yüzde
  (r) => {
    const total = r.pick([40, 50, 60, 80, 100, 200]), usedPct = r.pick([15, 20, 25, 30, 40, 60, 75]);
    const answer = 100 - usedPct;
    const used = Math.round(total * usedPct / 100);
    return { text: `${total} litrelik depodan ${used} litre kullanıldı. Deponun yüzde kaçı doludur?`,
      answer, unit: '%', errors: [usedPct, total - used, used, answer + 10, answer - 10],
      hint: `(${total} − ${used}) ÷ ${total} × 100 = %${answer}`, sig: `d15:${total}:${used}` };
  },
  // 16 — iki kalemli alışveriş
  (r) => {
    const [i1] = r.pick(ITEMS), [i2] = r.pick(ITEMS);
    const n1 = r.int(2, 9), p1 = r.money(10, 120, 5), n2 = r.int(2, 9), p2 = r.money(10, 120, 5);
    const answer = n1 * p1 + n2 * p2;
    return { text: `${n1} ${i1} (tanesi ${fmt(p1)} TL) ve ${n2} ${i2} (tanesi ${fmt(p2)} TL) alındı. Toplam kaç TL?`,
      answer, unit: 'TL', errors: [n1 * p1, n2 * p2, answer - p1, answer + p2, (n1 + n2) * (p1 + p2)],
      hint: `(${n1}×${fmt(p1)}) + (${n2}×${fmt(p2)}) = ${fmt(answer)} TL`, sig: `d16:${n1}:${p1}:${n2}:${p2}` };
  },
  // 17 — kaç gün sürer
  (r) => {
    const perDay = r.pick([10, 12, 15, 20, 24, 25, 30]), days = r.int(4, 20);
    const pages = perDay * days;
    return { text: `${fmt(pages)} sayfalık kitabı günde ${perDay} sayfa okuyan biri kaç günde bitirir?`,
      answer: days, unit: 'gün', errors: [days + 1, days - 1, perDay, pages - perDay, days * 2],
      hint: `${fmt(pages)} ÷ ${perDay} = ${days} gün`, sig: `d17:${pages}:${perDay}` };
  },
  // 18 — artış yüzdesi (fatura)
  (r) => {
    const a = r.money(400, 2000, 100), p = r.pick([10, 20, 25, 50, 75, 100]);
    const b = round2(a * (100 + p) / 100);
    return { text: `Elektrik faturası geçen ay ${fmt(a)} TL, bu ay ${fmt(b)} TL. Artış yüzde kaçtır?`,
      answer: p, unit: '%', errors: [100 - p, b - a, p + 10, Math.round(p / 2), p * 2],
      hint: `(${fmt(b)} − ${fmt(a)}) ÷ ${fmt(a)} × 100 = %${p}`, sig: `d18:${a}:${b}` };
  },
  // 19 — metrekare maliyet
  (r) => {
    const m2 = r.int(8, 120), price = r.money(150, 1200, 50);
    const answer = m2 * price;
    return { text: `${m2} m² odanın zemini m² başına ${fmt(price)} TL'ye kaplanacak. Toplam maliyet kaç TL?`,
      answer, unit: 'TL', errors: [m2 + price, answer + price, Math.round(answer / 2), answer * 10, answer - price],
      hint: `${m2} × ${fmt(price)} = ${fmt(answer)} TL`, sig: `d19:${m2}:${price}` };
  },
  // 20 — kumaştan kaç parça
  (r) => {
    const per = r.pick([2, 3, 4, 5]), count = r.int(4, 25), total = per * count;
    return { text: `${total} metre kumaştan, her biri ${per} metre olan kaç elbise dikilir?`,
      answer: count, unit: 'adet', errors: [count + 1, count - 1, total - per, per, count * 2],
      hint: `${total} ÷ ${per} = ${count} adet`, sig: `d20:${total}:${per}` };
  },
  // 21 — basit faiz
  (r) => {
    const p = r.money(10000, 200000, 5000), rate = r.pick([10, 15, 20, 25, 30, 40, 50]);
    const answer = round2(p * (100 + rate) / 100);
    return { text: `Bankaya yatırılan ${fmt(p)} TL, yıllık %${rate} basit faizle 1 yıl sonra kaç TL olur?`,
      answer, unit: 'TL', errors: [round2(p * rate / 100), p + rate, round2(p * (100 - rate) / 100), answer + 5000],
      hint: `${fmt(p)} + (${fmt(p)} × ${rate}%) = ${fmt(answer)} TL`, sig: `d21:${p}:${rate}` };
  },
  // 22 — gidiş dönüş bilet
  (r) => {
    const n = r.int(2, 7), price = r.money(150, 900, 25);
    const answer = n * price * 2;
    return { text: `${r.pick(CITIES)} otobüs bileti ${fmt(price)} TL. ${n} kişi gidiş-dönüş için toplam kaç TL öder?`,
      answer, unit: 'TL', errors: [n * price, answer + price, answer / 2, n + price, answer - price],
      hint: `${n} × ${fmt(price)} × 2 = ${fmt(answer)} TL`, sig: `d22:${n}:${price}` };
  },
  // 23 — su şişesi litreye
  (r) => {
    const ml = r.pick([250, 330, 500, 750, 1000]), n = r.pick([4, 6, 8, 10, 12, 20, 24]);
    const answer = round2(ml * n / 1000);
    return { text: `${ml} ml'lik ${n} şişe suyun toplamı kaç litredir?`,
      answer, unit: 'litre', errors: [ml * n, round2(answer * 10), round2(answer / 10), answer + 1, answer - 1],
      hint: `${ml} × ${n} = ${fmt(ml * n)} ml = ${fmt(answer)} litre`, sig: `d23:${ml}:${n}` };
  },
  // 24 — kâr yüzdesi
  (r) => {
    const cost = r.money(200, 3000, 100), p = r.pick([10, 20, 25, 50, 100]);
    const sell = round2(cost * (100 + p) / 100);
    return { text: `${fmt(cost)} TL'ye alınan ürün ${fmt(sell)} TL'ye satıldı. Kâr yüzdesi kaçtır?`,
      answer: p, unit: '%', errors: [sell - cost, 100 - p, p + 10, p * 2, Math.round(p / 2)],
      hint: `(${fmt(sell)} − ${fmt(cost)}) ÷ ${fmt(cost)} × 100 = %${p}`, sig: `d24:${cost}:${sell}` };
  },
  // 25 — peşinat
  (r) => {
    const price = r.money(5000, 60000, 500), p = r.pick([10, 20, 25, 30, 40, 50]);
    const answer = round2(price * p / 100);
    return { text: `${fmt(price)} TL'lik ürün için %${p} peşinat isteniyor. Peşinat kaç TL?`,
      answer, unit: 'TL', errors: [round2(price - answer), price + p, round2(answer * 2), round2(answer / 2)],
      hint: `${fmt(price)} × ${p} ÷ 100 = ${fmt(answer)} TL`, sig: `d25:${price}:${p}` };
  },
  // 26 — kalan dilim yüzdesi
  (r) => {
    const slices = r.pick([4, 5, 8, 10, 20]), eatenPct = r.pick([20, 25, 40, 50, 60, 75]);
    const eaten = Math.round(slices * eatenPct / 100);
    const answer = 100 - eatenPct;
    return { text: `${slices} dilimlik pizzanın ${eaten} dilimi yendi. Yüzde kaçı kaldı?`,
      answer, unit: '%', errors: [eatenPct, slices - eaten, eaten, answer + 10, answer - 10],
      hint: `(${slices} − ${eaten}) ÷ ${slices} × 100 = %${answer}`, sig: `d26:${slices}:${eaten}` };
  },
  // 27 — koşu temposu
  (r) => {
    const pace = r.pick([4, 5, 6, 7, 8]), km = r.pick([3, 5, 8, 10, 12, 15, 21]);
    const answer = pace * km;
    return { text: `Km'yi ${pace} dakikada koşan biri ${km} km'yi kaç dakikada tamamlar?`,
      answer, unit: 'dakika', errors: [pace + km, Math.round(km / pace), answer + pace, answer - pace, answer * 2],
      hint: `${pace} × ${km} = ${answer} dakika`, sig: `d27:${pace}:${km}` };
  },
  // 28 — kira zammı sonrası yıllık
  (r) => {
    const rent = r.money(8000, 40000, 500), z = r.pick([10, 20, 25]);
    const newRent = round2(rent * (100 + z) / 100);
    const answer = round2(newRent * 12);
    return { text: `${fmt(rent)} TL kiraya %${z} zam yapıldı. Zamlı kira ile 12 aylık toplam kaç TL?`,
      answer, unit: 'TL', errors: [round2(rent * 12), newRent, round2(answer / 2), round2(answer + newRent)],
      hint: `${fmt(rent)} × ${(100 + z) / 100} = ${fmt(newRent)}; ${fmt(newRent)} × 12 = ${fmt(answer)} TL`,
      sig: `d28:${rent}:${z}` };
  },
  // 29 — para üstü
  (r) => {
    const paid = r.pick([100, 200, 500, 1000]), spent = r.money(30, paid - 20, 5);
    const answer = paid - spent;
    return { text: `${fmt(spent)} TL'lik alışveriş için ${fmt(paid)} TL verildi. Para üstü kaç TL?`,
      answer, unit: 'TL', errors: [spent, paid + spent, answer + 10, answer - 10, Math.round(answer / 2)],
      hint: `${fmt(paid)} − ${fmt(spent)} = ${fmt(answer)} TL`, sig: `d29:${paid}:${spent}` };
  },
  // 30 — sağlam yüzdesi
  (r) => {
    const total = r.pick([20, 25, 50, 100, 200]), brokenPct = r.pick([4, 5, 10, 20, 25]);
    const broken = Math.round(total * brokenPct / 100);
    const answer = total - broken;
    return { text: `${total} yumurtanın ${broken} tanesi kırık. Kaç tanesi sağlamdır?`,
      answer, unit: 'adet', errors: [broken, total, 100 - brokenPct, answer - 1, answer + 1],
      hint: `${total} − ${broken} = ${answer} adet`, sig: `d30:${total}:${broken}` };
  },
  // 31 — ortalama
  (r) => {
    const n = r.pick([3, 4, 5]), avg = r.int(40, 95);
    const vals = []; let sum = 0;
    for (let i = 0; i < n - 1; i++) { const v = clamp(avg + r.int(-15, 15), 10, 100); vals.push(v); sum += v; }
    const last = avg * n - sum; vals.push(last);
    if (last < 0 || last > 100) return null;
    return { text: `Notları ${vals.map(fmt).join(', ')} olan öğrencinin not ortalaması kaçtır?`,
      answer: avg, errors: [sum, Math.round(sum / (n + 1)), avg + 5, avg - 5, Math.max(...vals)],
      hint: `(${vals.join(' + ')}) ÷ ${n} = ${avg}`, sig: `d31:${vals.join('-')}` };
  },
  // 32 — kampanya
  (r) => {
    const unit = r.money(20, 200, 5), n = r.pick([3, 4, 6]);
    const answer = (n - 1) * unit;
    return { text: `Tanesi ${fmt(unit)} TL olan üründe "${n} al ${n - 1} öde" kampanyası var. ${n} adet kaç TL?`,
      answer, unit: 'TL', errors: [n * unit, unit, answer + unit, answer - unit, Math.round(answer / 2)],
      hint: `${n - 1} × ${fmt(unit)} = ${fmt(answer)} TL`, sig: `d32:${unit}:${n}` };
  },
];

function genDaily(r, L) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const idx = r.int(0, DAILY.length - 1);
    const q = DAILY[idx](r, L);
    if (!q) continue;
    const integer = Number.isInteger(q.answer);
    return {
      cat: 'daily', text: q.text, answer: q.answer, unit: q.unit,
      options: buildOptions(r, q.answer, q.errors ?? [], { integer }),
      hint: q.hint, sig: q.sig,
    };
  }
  return genPct(r, L);
}

/* ------------------------------------------------------ görsel sorular --- */
/** Seviyeye göre hangi görsel tipleri açık. */
function visualKindsFor(L) {
  if (L <= 2) return ['dots', 'grid', 'bars'];
  if (L <= 5) return ['dots', 'grid', 'bars', 'pie', 'numberline'];
  return ['grid', 'bars', 'pie', 'numberline', 'coins'];
}

const VISUAL_BUILDERS = {

  dots(r, L) {
    const g = r.int(2, L <= 3 ? 4 : 6);
    const per = r.int(2, L <= 3 ? 5 : 9);
    const answer = g * per;
    return {
      cat: 'visual', text: 'Toplam kaç nokta var?',
      visual: { type: 'dots', groups: g, per },
      answer,
      options: buildOptions(r, answer, [g + per, answer + per, answer - per, answer + g, g * (per + 1)]),
      hint: `${g} grup × ${per} nokta = ${answer}`, sig: `v:dots:${g}:${per}`,
    };
  },

  grid(r, L) {
    const rows = r.int(2, L <= 4 ? 6 : 9);
    const cols = r.int(2, L <= 4 ? 6 : 9);
    const answer = rows * cols;
    return {
      cat: 'visual', text: 'Izgaradaki kare sayısı kaçtır?',
      visual: { type: 'grid', rows, cols },
      answer,
      options: buildOptions(r, answer, [rows + cols, 2 * (rows + cols), answer + rows, answer - cols, (rows + 1) * cols]),
      hint: `${rows} satır × ${cols} sütun = ${answer}`, sig: `v:grid:${rows}:${cols}`,
    };
  },

  bars(r) {
    let a = r.int(3, 20);
    let b = r.int(3, 20);
    if (a === b) b = a < 20 ? a + 1 : a - 1;      // eşit çubuk olmaz
    if (a < b) [a, b] = [b, a];
    const answer = a - b;
    return {
      cat: 'visual', text: 'Uzun çubuk kısa çubuktan kaç birim fazla?',
      visual: { type: 'bars', a, b },
      answer,
      options: buildOptions(r, answer, [a + b, a, b, answer + 1, answer - 1, answer * 2]),
      hint: `${a} − ${b} = ${answer}`, sig: `v:bars:${a}:${b}`,
    };
  },

  pie(r) {
    const p = r.pick([10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90]);
    return {
      cat: 'visual', text: 'Dairenin yüzde kaçı dolu?', unit: '%',
      visual: { type: 'pie', percent: p },
      answer: p,
      options: buildOptions(r, p, [100 - p, p + 10, p - 10, Math.round(p / 2), p * 2]),
      hint: `Dolu dilim tüm dairenin %${p}'i kadar.`, sig: `v:pie:${p}`,
    };
  },

  numberline(r) {
    const step = r.pick([1, 2, 5, 10, 25, 50]);
    const start = step * r.int(0, 8);
    const ticks = 10;
    const end = start + step * ticks;
    const at = r.int(1, ticks - 1);
    const answer = start + step * at;
    return {
      cat: 'visual', text: 'Ok hangi sayıyı gösteriyor?',
      visual: { type: 'numberline', start, end, ticks, at },
      answer,
      options: buildOptions(r, answer, [answer + step, answer - step, start, end, answer + step * 2]),
      hint: `Aralık ${step}; başlangıç ${start}. ${at} adım sonra ${answer}.`,
      sig: `v:nl:${start}:${step}:${at}`,
    };
  },

  coins(r) {
    const denominations = [1, 5, 10, 20, 50, 100, 200];
    const stacks = [];
    let answer = 0;
    const stackCount = r.int(2, 4);
    for (let i = 0; i < stackCount; i++) {
      const value = r.pick(denominations);
      const count = r.int(1, 4);
      stacks.push({ value, count });
      answer += value * count;
    }
    const label = stacks.map((x) => `${x.count}×${x.value}`).join(' + ');
    return {
      cat: 'visual', text: 'Görseldeki paraların toplamı kaç TL?', unit: 'TL',
      visual: { type: 'coins', items: stacks },
      answer,
      options: buildOptions(r, answer, [answer + 10, answer - 10, answer + 50, answer - 50, answer * 2, Math.round(answer / 2)]),
      hint: `${label} = ${answer} TL`,
      sig: `v:coins:${stacks.map((x) => x.value + 'x' + x.count).join('_')}`,
    };
  },
};

function genVisual(r, L) {
  return VISUAL_BUILDERS[r.pick(visualKindsFor(L))](r, L);
}

const GENERATORS = { add: genAdd, sub: genSub, mul: genMul, div: genDiv, pct: genPct, daily: genDaily, visual: genVisual };

/* ------------------------------------------------------------- engine --- */
/**
 * Sonsuz soru akışı. Asla bitmez, asla üst üste aynı soruyu vermez.
 * Zorluk, son 8 cevabın doğruluk ve hızına göre kendini ayarlar.
 */
export class QuestionEngine {
  /**
   * @param {{seed?:number, categories?:string[], level?:number, historySize?:number}} cfg
   */
  constructor(cfg = {}) {
    this.seed = cfg.seed ?? randomSeed();
    this.r = new Rand(makeRNG(this.seed));
    this.categories = (cfg.categories?.length ? cfg.categories : CATEGORIES).slice();
    this.level = clamp(cfg.level ?? 1, 1, 10);
    this.historySize = cfg.historySize ?? 60;
    this.recent = [];           // son soru imzaları (tekrar engelleme)
    this.recentCats = [];       // arka arkaya aynı kategoriyi azaltmak için
    this.window = [];           // {correct, ms} — adaptif zorluk penceresi
    this.counter = 0;
  }

  setCategories(cats) {
    this.categories = (cats?.length ? cats : CATEGORIES).slice();
  }

  /** Kategori seçimi: son iki soruyla aynı olmamaya çalışır. */
  _pickCategory() {
    if (this.categories.length === 1) return this.categories[0];
    const last2 = new Set(this.recentCats.slice(-2));
    const fresh = this.categories.filter((c) => !last2.has(c));
    return this.r.pick(fresh.length ? fresh : this.categories);
  }

  /** Bir sonraki soru. Her çağrıda yeni ve farklı. */
  next() {
    let q = null;
    for (let attempt = 0; attempt < 24; attempt++) {
      const cat = this._pickCategory();
      const candidate = GENERATORS[cat](this.r, this.level);
      if (!candidate) continue;
      if (this.recent.includes(candidate.sig)) continue;
      q = candidate;
      break;
    }
    if (!q) q = GENERATORS[this._pickCategory()](this.r, this.level);

    this.recent.push(q.sig);
    if (this.recent.length > this.historySize) this.recent.shift();
    this.recentCats.push(q.cat);
    if (this.recentCats.length > 8) this.recentCats.shift();

    this.counter += 1;
    return {
      id: `${this.seed.toString(36)}-${this.counter}`,
      index: this.counter,
      level: this.level,
      cat: q.cat,
      text: q.text ?? null,
      expr: q.expr ?? null,
      visual: q.visual ?? null,
      unit: q.unit ?? null,
      answer: round2(q.answer),
      options: q.options.map(round2),
      hint: q.hint ?? '',
      sig: q.sig,
    };
  }

  /**
   * Cevabı kaydeder ve zorluğu uyarlar.
   * @returns {{levelChanged:number}} -1, 0 veya +1
   */
  record(correct, ms) {
    this.window.push({ correct, ms });
    if (this.window.length > 8) this.window.shift();
    if (this.window.length < 5) return { levelChanged: 0 };

    const acc = this.window.filter((w) => w.correct).length / this.window.length;
    const avgMs = this.window.reduce((s, w) => s + w.ms, 0) / this.window.length;
    const fastEnough = avgMs < 9000 + this.level * 900;

    const before = this.level;
    if (acc >= 0.85 && fastEnough) this.level = clamp(this.level + 1, 1, 10);
    else if (acc <= 0.5) this.level = clamp(this.level - 1, 1, 10);

    if (this.level !== before) this.window = [];
    return { levelChanged: this.level - before };
  }
}

/* ------------------------------------------------------------- puan --- */
/** Puan: taban × seviye + hız bonusu, seri çarpanıyla. */
export function scoreFor({ level, ms, streak }) {
  const base = 10 * level;
  const speed = Math.max(0, Math.round((6000 - Math.min(ms, 6000)) / 300)); // 0..20
  const mult = 1 + Math.min(streak, 20) * 0.05;                             // 1.00 .. 2.00
  return Math.round((base + speed) * mult);
}

export const __internals = { Rand, buildOptions, round2, DAILY_COUNT: DAILY.length };
