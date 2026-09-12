/* Zihin — uygulama katmanı */
import { QuestionEngine, CATEGORIES, CATEGORY_META, scoreFor, fmt } from './engine.js';
import { renderVisual } from './visuals.js';
import { Haptics } from './haptics.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

/** CSS animasyonunu baştan oynatır (reflow hilesi yerine Web Animations API). */
function restartAnimation(el, className) {
  if (!el) return;
  el.classList.remove(className);
  for (const a of el.getAnimations?.() ?? []) a.cancel();
  el.classList.add(className);
}

/** Verilen etiketle bir eleman üretir. */
function make(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

/** Bir elemanın içeriğini temizler. */
function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

const STORE_KEY = 'zihin.state.v1';
const haptics = new Haptics();

/* ------------------------------------------------------------- durum --- */
const defaultState = () => ({
  best: { endless: 0, timed: 0 },
  totals: { asked: 0, correct: 0, bestStreak: 0, seconds: 0 },
  perCat: Object.fromEntries(CATEGORIES.map((c) => [c, { asked: 0, correct: 0 }])),
  level: 1,
  cats: CATEGORIES.slice(),
  haptics: true,
});

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = { ...defaultState(), ...JSON.parse(raw) };
    s.perCat = { ...defaultState().perCat, ...s.perCat };
    s.cats = (s.cats ?? []).filter((c) => CATEGORIES.includes(c));
    if (!s.cats.length) s.cats = CATEGORIES.slice();
    return s;
  } catch { return defaultState(); }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch { /* kota */ } }

const state = load();
haptics.setEnabled(state.haptics !== false);

/* ------------------------------------------------------------ oturum --- */
let sess = null;

function newSession(mode) {
  sess = {
    mode,                                  // 'endless' | 'timed'
    engine: new QuestionEngine({ level: state.level, categories: state.cats }),
    score: 0, streak: 0, bestStreak: 0, asked: 0, correct: 0,
    startedAt: Date.now(), askedAt: 0, locked: false,
    q: null, timeLeft: mode === 'timed' ? 60 : null, timer: null,
  };
}

/* ------------------------------------------------------------ ekranlar --- */
function show(id) {
  $$('.screen').forEach((s) => s.classList.toggle('is-active', s.id === id));
  window.scrollTo(0, 0);
}

/* ----------------------------------------------------------- giriş --- */
function renderHome() {
  $('#best-endless').textContent = fmt(state.best.endless);
  $('#best-timed').textContent = fmt(state.best.timed);
  const acc = state.totals.asked ? Math.round((state.totals.correct / state.totals.asked) * 100) : 0;
  $('#home-acc').textContent = acc + '%';
  $('#home-asked').textContent = fmt(state.totals.asked);
  $('#home-level').textContent = state.level;
  $$('.chip[data-cat]').forEach((c) => c.setAttribute('aria-pressed', String(state.cats.includes(c.dataset.cat))));
  $('#haptic-toggle').setAttribute('aria-pressed', String(haptics.enabled));
  $('#haptic-toggle').textContent = haptics.enabled ? 'Haptik: Açık' : 'Haptik: Kapalı';
}

/* ------------------------------------------------------------- oyun --- */
function startGame(mode) {
  haptics.play('medium');
  const fill = $('#level-fill');
  if (fill) fill.style.width = (state.level / 10) * 100 + '%';
  newSession(mode);
  $('#hud-time').classList.toggle('hidden', mode !== 'timed');
  show('screen-play');
  if (mode === 'timed') {
    sess.timeLeft = 60;
    sess.timer = setInterval(tick, 1000);
  }
  nextQuestion();
  updateHUD();
}

function tick() {
  if (sess?.mode !== 'timed') return;
  sess.timeLeft -= 1;
  updateHUD();
  if (sess.timeLeft <= 5 && sess.timeLeft > 0) haptics.play('selection');
  if (sess.timeLeft <= 0) endGame();
}

function endGame() {
  if (sess?.timer) clearInterval(sess.timer);
  commitSession();
  haptics.play('levelUp');
  $('#sum-score').textContent = fmt(sess.score);
  $('#sum-correct').textContent = `${sess.correct}/${sess.asked}`;
  $('#sum-streak').textContent = fmt(sess.bestStreak);
  $('#sum-level').textContent = sess.engine.level;
  $('#sum-best').textContent = fmt(state.best[sess.mode] ?? 0);
  show('screen-summary');
}

function commitSession() {
  if (!sess) return;
  state.level = sess.engine.level;
  state.totals.asked += sess.asked;
  state.totals.correct += sess.correct;
  state.totals.bestStreak = Math.max(state.totals.bestStreak, sess.bestStreak);
  state.totals.seconds += Math.round((Date.now() - sess.startedAt) / 1000);
  state.best[sess.mode] = Math.max(state.best[sess.mode] ?? 0, sess.score);
  save();
}

function updateHUD() {
  if (!sess) return;
  const fill = $('#level-fill');
  if (fill) fill.style.width = (sess.engine.level / 10) * 100 + '%';
  $('#hud-score').textContent = fmt(sess.score);
  $('#hud-streak').textContent = sess.streak;
  $('#hud-level').textContent = sess.engine.level;
  if (sess.mode === 'timed') $('#hud-time-v').textContent = Math.max(0, sess.timeLeft);
}

/** Şık üzerinde görünecek metin. Yüzde sorularında başa % gelir. */
function optionLabel(value, unit) {
  return unit === '%' ? '%' + fmt(value) : fmt(value);
}

/**
 * SVG kaynağını güvenli biçimde düğüme çevirir.
 * innerHTML yerine DOMParser kullanılır: içerik HTML ayrıştırıcısına hiç
 * girmez ve betik çalıştırılmaz.
 */
function svgNode(markup) {
  if (!markup) return null;
  const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) return null;
  return document.importNode(doc.documentElement, true);
}

/** Sonsuz akış: her çağrı yeni ve farklı bir soru getirir. */
function nextQuestion() {
  const q = sess.engine.next();
  sess.q = q;
  sess.askedAt = performance.now();
  sess.locked = false;

  restartAnimation($('#qcard'), 'q-enter');

  $('#cat-badge').textContent = CATEGORY_META[q.cat].tr;

  const exprEl = $('#qexpr'), textEl = $('#qtext'), visEl = $('#qvisual');
  exprEl.classList.toggle('hidden', !q.expr);
  if (q.expr) exprEl.textContent = q.expr;

  const bodyText = q.text ?? '';
  textEl.classList.toggle('hidden', !bodyText);
  if (bodyText) {
    textEl.textContent = bodyText;
    textEl.classList.toggle('small', bodyText.length > 92);
  }

  visEl.classList.toggle('hidden', !q.visual);
  clear(visEl);
  if (q.visual) {
    const node = svgNode(renderVisual(q.visual));
    if (node) visEl.appendChild(node);
  }

  $$('#answers .ans').forEach((btn, i) => {
    const value = q.options[i];
    btn.className = 'ans glass--interactive';
    btn.disabled = false;
    btn.dataset.value = String(value);
    clear(btn);
    const wrap = make('span');
    wrap.appendChild(make('span', null, optionLabel(value, q.unit)));
    if (q.unit && q.unit !== '%') wrap.appendChild(make('span', 'unit', q.unit));
    btn.appendChild(wrap);
    btn.setAttribute('aria-label', `${optionLabel(value, q.unit)}${q.unit && q.unit !== '%' ? ' ' + q.unit : ''}`);
    btn.style.animationDelay = (i * 0.045) + 's';
  });

  $('#feedback').classList.remove('show');
  $('#feedback').textContent = '';
}

function answer(btn) {
  if (!sess?.q || sess.locked) return;
  sess.locked = true;

  const q = sess.q;
  const picked = Number(btn.dataset.value);
  const ms = performance.now() - sess.askedAt;
  const right = picked === q.answer;

  sess.asked += 1;
  state.perCat[q.cat].asked += 1;

  const buttons = $$('#answers .ans');
  buttons.forEach((b) => { b.disabled = true; });

  if (right) {
    sess.correct += 1;
    state.perCat[q.cat].correct += 1;
    sess.streak += 1;
    sess.bestStreak = Math.max(sess.bestStreak, sess.streak);
    const pts = scoreFor({ level: sess.engine.level, ms, streak: sess.streak - 1 });
    sess.score += pts;

    btn.classList.add('is-correct');
    buttons.forEach((b) => { if (b !== btn) b.classList.add('is-dim'); });
    haptics.play(sess.streak > 0 && sess.streak % 5 === 0 ? 'streak' : 'success');
    if (sess.streak > 0 && sess.streak % 5 === 0) flare();

    const streakNote = sess.streak >= 3 ? ` · ${sess.streak} seri 🔥` : '';
    feedback(`+${pts} puan${streakNote}`);
  } else {
    sess.streak = 0;
    btn.classList.add('is-wrong');
    buttons.forEach((b) => {
      if (Number(b.dataset.value) === q.answer) b.classList.add('is-correct');
      else if (b !== btn) b.classList.add('is-dim');
    });
    haptics.play('error');
    feedback(q.hint || `Doğrusu: ${fmt(q.answer)}`);
  }

  const res = sess.engine.record(right, ms);
  if (res.levelChanged > 0) { haptics.play('levelUp'); feedback(`Seviye ${sess.engine.level} ↑`); }

  updateHUD();
  save();

  // Sonsuz mod asla bitmez — her zaman yeni soru gelir.
  setTimeout(() => { if (sess) nextQuestion(); }, right ? 620 : 1750);
}

function feedback(msg) {
  const el = $('#feedback');
  if (!el) return;
  el.textContent = msg;
  restartAnimation(el, 'show');
}

function flare() {
  restartAnimation($('#flare'), 'go');
}

function quit() {
  if (sess?.timer) clearInterval(sess.timer);
  commitSession();
  sess = null;
  haptics.play('light');
  renderHome();
  show('screen-home');
}

/* ------------------------------------------------------ istatistikler --- */
function renderStats() {
  const t = state.totals;
  $('#st-asked').textContent = fmt(t.asked);
  $('#st-acc').textContent = (t.asked ? Math.round((t.correct / t.asked) * 100) : 0) + '%';
  $('#st-streak').textContent = fmt(t.bestStreak);
  $('#st-time').textContent = Math.round(t.seconds / 60) + ' dk';

  const list = $('#stat-list');
  clear(list);
  for (const c of CATEGORIES) {
    const stat = state.perCat[c];
    const pct = stat.asked ? Math.round((stat.correct / stat.asked) * 100) : 0;

    const row = make('div', 'stat-row');
    row.appendChild(make('span', 'name dim', CATEGORY_META[c].tr));

    const bar = make('span', 'bar');
    const fill = make('i');
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    row.appendChild(bar);

    row.appendChild(make('span', 'val', stat.asked ? pct + '%' : '—'));
    list.appendChild(row);
  }
}

/* --------------------------------------------------------------- olay --- */
function wire() {
  $('#btn-endless').addEventListener('click', () => startGame('endless'));
  $('#btn-timed').addEventListener('click', () => startGame('timed'));
  $('#btn-stats').addEventListener('click', () => { haptics.play('light'); renderStats(); show('screen-stats'); });
  $$('[data-back]').forEach((b) => b.addEventListener('click', quit));
  $('#btn-stats-back').addEventListener('click', () => { haptics.play('light'); renderHome(); show('screen-home'); });
  $('#btn-again').addEventListener('click', () => startGame(sess?.mode ?? 'endless'));
  $('#btn-summary-home').addEventListener('click', quit);

  $$('#answers .ans').forEach((b) => b.addEventListener('click', () => answer(b)));

  $$('.chip[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
    const c = chip.dataset.cat;
    const on = state.cats.includes(c);
    if (on && state.cats.length === 1) { haptics.play('warning'); return; }   // en az bir kategori
    state.cats = on ? state.cats.filter((x) => x !== c) : [...state.cats, c];
    chip.setAttribute('aria-pressed', String(!on));
    haptics.play('selection');
    save();
  }));

  $('#haptic-toggle').addEventListener('click', () => {
    const next = !haptics.enabled;
    haptics.setEnabled(next);
    state.haptics = next;
    save();
    renderHome();
  });

  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Tüm istatistikler sıfırlansın mı?')) return;
    Object.assign(state, defaultState());
    save(); renderStats(); renderHome();
    haptics.play('warning');
  });

  // klavye (iPad / Mac) — 1-4 şık, Esc çıkış
  window.addEventListener('keydown', (e) => {
    if (!$('#screen-play').classList.contains('is-active')) return;
    if (e.key >= '1' && e.key <= '4') { const b = $$('#answers .ans')[Number(e.key) - 1]; if (b && !b.disabled) answer(b); }
    if (e.key === 'Escape') quit();
  });

  // sekme gizlenince süreli modu duraklat
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && sess?.timer) { clearInterval(sess.timer); sess.timer = null; }
    else if (!document.hidden && sess?.mode === 'timed' && !sess.timer && sess.timeLeft > 0) sess.timer = setInterval(tick, 1000);
  });
}

/* ---------------------------------------------------------------- açılış --- */
wire();
renderHome();
show('screen-home');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// test kancası
window.__zihin = { get state() { return state; }, get sess() { return sess; }, startGame, nextQuestion };
