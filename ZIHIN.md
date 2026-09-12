# Zihin — Zihinden Matematik

Apple Human Interface Guidelines ve Liquid Glass'a göre tasarlanmış, **hiç bitmeyen**
zihinden matematik antrenmanı. Toplama, çıkarma, çarpma, bölme, yüzde hesabı,
günlük hayat problemleri ve görsel sorular. Her soru rastgele üretilir; aynı soru
bir daha karşına çıkmaz.

İki sürüm var, ikisi de **aynı soru motorunu** uygular:

| | Yol | Ne zaman |
|---|---|---|
| **iPhone uygulaması** (SwiftUI) | `ios/ZihinMath/` | Xcode'da aç, iPhone'una kur. Gerçek Liquid Glass + Core Haptics. |
| **Web / PWA** | `zihin/` | Şimdi aç, "Ana Ekrana Ekle" de — tam ekran uygulama gibi çalışır, çevrimdışı da. |

---

## Tasarım kuralları

### Üç ton, başka renk yok

| Ton | Değer |
|---|---|
| Apple Black | `#000000` |
| Apple White | `#FFFFFF` |
| Apple Blue (systemBlue) | `#007AFF` açık · `#0A84FF` koyu |

Diğer bütün yüzeyler bu üç rengin **saydamlık varyasyonudur**. Doğru cevap yeşil
değil **mavi**, yanlış cevap kırmızı değil **beyaz konturlu**. Bu kural tarayıcı
testiyle otomatik denetleniyor (`docs/DOGRULAMA.md`).

### Liquid Glass

Native sürümde doğrulanmış Apple API'leri kullanılıyor (iOS 26.0):

```swift
func glassEffect(_ glass: Glass = .regular, in shape: some Shape = DefaultGlassEffectShape()) -> some View
struct Glass          // .regular · .clear · .tint(_:) · .interactive(_:)
struct GlassEffectContainer   // init(spacing: CGFloat? = nil, content: () -> Content)
func glassEffectID(_ id: (some Hashable & Sendable)?, in namespace: Namespace.ID) -> some View
func glassEffectUnion(id: (some Hashable & Sendable)?, namespace: Namespace.ID) -> some View
func glassEffectTransition(_ transition: GlassEffectTransition) -> some View
static var glass: GlassButtonStyle
```

Yan yana duran cam yüzeyler daima tek bir `GlassEffectContainer` içinde toplanıyor —
Apple'ın kuralı: *cam camı örnekleyemez*. iOS 26 öncesinde aynı hiyerarşi
`.ultraThinMaterial` ile boyanıyor, uygulama eski cihazlarda da doğru görünüyor.

### Tipografi

Sistem yazı tipi (SF Pro / SF Pro Rounded), gömülü font yok. Bütün metinler
Dynamic Type stilleriyle tanımlı. Web sürümündeki ölçekler Apple'ın iOS tablosundan
birebir alındı:

| Stil | Ağırlık | Punto | Satır yüksekliği |
|---|---|---|---|
| Large Title | Regular | 34 | 41 |
| Title 1 | Regular | 28 | 34 |
| Title 2 | Regular | 22 | 28 |
| Title 3 | Regular | 20 | 25 |
| Headline | Semibold | 17 | 22 |
| Body | Regular | 17 | 22 |
| Callout | Regular | 16 | 21 |
| Subhead | Regular | 15 | 20 |
| Footnote | Regular | 13 | 18 |
| Caption 1 | Regular | 12 | 16 |

Sayılar tabular (tnum) ve yuvarlak varyantla; değiştiklerinde
`.contentTransition(.numericText())` ile akıyor. Ultralight/Thin/Light ağırlık
hiç kullanılmadı (HIG okunabilirlik önerisi). En küçük dokunma hedefi 44 pt.

### Haptik

Apple'ın "Playing haptics" ilkeleri: standart desenler belgelenmiş anlamlarında,
her haptik onu doğuran eylemle nedensel ilişkili, aşırıya kaçılmadan, ve
tamamen kapatılabilir.

| Olay | Desen |
|---|---|
| Doğru cevap | `UINotificationFeedbackGenerator` · `.success` |
| Yanlış cevap | `.error` |
| Konu aç/kapat | `UISelectionFeedbackGenerator` |
| Gezinme | `UIImpactFeedbackGenerator` · `.light` / `.medium` |
| Son 5 saniye | `.rigid`, %55 şiddet |
| 5'lik seri | Core Haptics — hızlanan 3 geçici darbe, yükselen keskinlik |
| Seviye atlama | Core Haptics — yükselen 4 darbe + kısa sürekli titreşim |

Web sürümünde: iOS Safari `navigator.vibrate` desteklemez; onun yerine iOS'un
görünmez `<input type="checkbox" switch>` tekniğiyle Taptic Engine tetiklenir,
Android'de `navigator.vibrate` desenleri çalışır. **Tam haptik deneyim native
uygulamadadır.**

---

## Soru motoru

7 kategori, 10 zorluk seviyesi, sonsuz akış.

* **Toplama / Çıkarma** — seviyeyle birlikte 1 haneden 4 haneye, 5. seviyeden sonra ondalıklı varyantlar. Çıkarma sonucu asla negatif olmaz.
* **Çarpma** — 2×2'den 3 hane × 2 haneye.
* **Bölme** — bölünen her zaman tam bölünecek şekilde kurulur, kalan çıkmaz.
* **Yüzde** — "x'in %y'si", "x, y'nin yüzde kaçı", indirim, zam, ve indirimli fiyattan orijinali bulma.
* **Günlük hayat** — 32 farklı şablon: market, hesap bölüşme, bahşiş, KDV, taksit, yakıt, hız, maaş zammı, tarif ölçeklendirme, kupon, saatlik ücret, benzin, sınıf mevcudu, depo, kitap, fatura artışı, metrekare, kumaş, faiz, bilet, su, kâr, peşinat, pizza, koşu temposu, kira, para üstü, yumurta, ortalama, kampanya…
* **Görsel** — 6 çizim tipi: gruplanmış noktalar, ızgara (alan modeli), çubuk karşılaştırma, pasta yüzdesi, sayı doğrusu, Türk Lirası para toplamı.

**Sonsuzluk ve çeşitlilik**
* Son 60 sorunun imzası tutulur; aynı soru pencere içinde bir daha gelmez.
* Üç ardışık soru asla aynı konudan gelmez.
* Şıklar "tipik hata" adaylarından üretilir (işlem karıştırma, rakam yer değiştirme, birim kaydırma), dördü de benzersiz ve doğru cevap her zaman içlerinde.

**Uyarlanır zorluk**
Son 8 cevabın doğruluk ve ortalama süresine bakılır. Doğruluk ≥ %85 **ve** ortalama
süre eşiğin altındaysa seviye +1; doğruluk ≤ %50 ise −1. Seviye 1…10 arasında kalır.

**Puanlama**
`(10 × seviye + hız bonusu) × seri çarpanı` — hız bonusu 0…20, seri çarpanı 1,00…2,00.

---

## Nasıl çalıştırılır

### iPhone uygulaması

```bash
open ios/ZihinMath/ZihinMath.xcodeproj
```

Xcode 26+ gerekir (Liquid Glass için). Dağıtım hedefi iOS 17.0 — iOS 26'da gerçek
Liquid Glass, öncesinde materyal yedeği çalışır. Kendi Apple ID'nle imzalayıp
iPhone'una kurabilirsin (`Signing & Capabilities → Team`).

Testler: `⌘U` (Xcode) veya

```bash
xcodebuild test -project ios/ZihinMath/ZihinMath.xcodeproj \
  -scheme ZihinMath -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

### Web / PWA

GitHub Pages'ten doğrudan: **`/zihin/`**

Yerelde:

```bash
cd zihin && python3 -m http.server 8099
# http://localhost:8099
```

Motor testleri (Node 18+, bağımlılık yok):

```bash
node zihin/tests/engine.test.mjs
```

Kod kalitesi (SonarJS + CSS + HTML kuralları):

```bash
cd tools && npm install && cd ..
./tools/lint.sh
```

---

## Doğrulama

Bu uygulamanın çalıştığı iddia edilmiyor — **ölçüldü**. Bütün ölçümler ve nasıl
tekrar edileceği: [`docs/DOGRULAMA.md`](docs/DOGRULAMA.md).
Ekran görüntüleri: [`docs/screenshots/`](docs/screenshots/).
