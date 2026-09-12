/* Haptik katmanı.
 *
 * Apple HIG "Playing haptics": haptik görsel geri bildirimi pekiştirmeli,
 * neden-sonuç ilişkisi kurmalı, aşırıya kaçmamalı ve kapatılabilmelidir.
 *
 * Web'de:
 *  • iOS Safari `navigator.vibrate` DESTEKLEMEZ. Bunun yerine iOS 17.4+'ta
 *    `<input type="checkbox" switch>` öğesinin durum değişiminde Taptic Engine
 *    tetiklenir — burada görünmez bir switch ile bu davranış kullanılır.
 *  • Android/Chrome'da `navigator.vibrate` desenleri çalışır.
 * Native uygulamada (ios/ZihinMath) tam Core Haptics + UIFeedbackGenerator var.
 */

const KEY = 'zihin.haptics';

/** ms cinsinden titreşim desenleri — Apple'ın anlam eşleşmesini taklit eder. */
const PATTERNS = {
  selection: [8],
  light:     [10],
  medium:    [18],
  heavy:     [28],
  success:   [12, 60, 24],       // kısa-uzun: olumlu sonuç
  warning:   [22, 70, 22],
  error:     [30, 55, 30, 55, 30], // üçlü darbe: olumsuz sonuç
  streak:    [10, 40, 10, 40, 22], // seri kilometre taşı
  levelUp:   [14, 45, 14, 45, 14, 45, 30],
};

export class Haptics {
  constructor() {
    this.enabled = localStorage.getItem(KEY) !== '0';
    this.canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
    this.sw = null;
    /* Tarayıcılar, kullanıcı sayfaya dokunmadan titreşim çağrısını engeller
       (ve konsola hata yazar). İlk etkileşime kadar haptik sessiz kalır. */
    this.unlocked = false;
    this._installSwitch();
    this._armUnlock();
  }

  _armUnlock() {
    if (typeof document === 'undefined') return;
    const unlock = () => { this.unlocked = true; };
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      document.addEventListener(ev, unlock, { once: true, passive: true });
    }
  }

  /** iOS Taptic Engine tetikleyicisi: görünmez switch. */
  _installSwitch() {
    if (typeof document === 'undefined') return;
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.setAttribute('switch', '');
    el.className = 'haptic-switch';
    el.setAttribute('aria-hidden', 'true');
    el.tabIndex = -1;
    document.body.appendChild(el);
    this.sw = el;
  }

  setEnabled(on) {
    this.enabled = !!on;
    localStorage.setItem(KEY, on ? '1' : '0');
    if (on) this.play('selection');
  }

  _tap(times = 1, gap = 70) {
    if (!this.sw) return;
    for (let i = 0; i < times; i++) {
      setTimeout(() => { this.sw.checked = !this.sw.checked; }, i * gap);
    }
  }

  /** @param {keyof PATTERNS} kind */
  play(kind) {
    if (!this.enabled || !this.unlocked) return;
    const p = PATTERNS[kind] ?? PATTERNS.light;
    if (this.canVibrate) {
      try { navigator.vibrate(p); } catch { /* yok say */ }
    }
    // iOS: desendeki darbe sayısı kadar switch geçişi
    const pulses = Math.ceil(p.length / 2) || 1;
    this._tap(pulses, 65);
  }
}
