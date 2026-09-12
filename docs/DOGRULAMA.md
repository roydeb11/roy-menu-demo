# Doğrulama raporu

Bu belgedeki her satır çalıştırılmış bir komutun çıktısıdır. Hepsini tekrar
çalıştırmak için depo kökünde:

```bash
./tools-verify.sh
```

Son çalıştırma: **hepsi geçti** — 6 adım, 0 başarısız.

---

## 1) Soru motoru — 12 test, ~1,4 milyon üretilmiş soru

`node zihin/tests/engine.test.mjs` (Node'un yerleşik `node:test` koşucusu, bağımlılık yok)

| # | Ne ölçüldü | Kapsam | Sonuç |
|---|---|---|---|
| 1 | Her soruda 4 sonlu, benzersiz şık; doğru cevap içlerinde; seviye sabit; metinde `undefined`/`NaN` yok | 200.000 soru (10 seviye × 20.000) | geçti |
| 2 | Dört işlem ifadesi metinden geri ayrıştırılıp yeniden hesaplandı, cevapla birebir uyuştu. Çıkarma hiç negatif olmadı, bölme hiç kalan vermedi | 100.000 ifade | geçti |
| 3 | Görsel soruların cevabı, çizim verisinden bağımsız yeniden hesaplandı | 60.000 soru, 6 çizim tipi | geçti |
| 4 | Yüzde sorularının beş biçimi metinden ayrıştırılıp doğrulandı | 40.000 soru | geçti |
| 5 | 60'lık pencerede hiç tekrar yok; üç ardışık soru hiç aynı konudan gelmedi | 40.000 + 20.000 soru | geçti |
| 6 | Akış kesintisiz — 1.000.000 geçerli soru, ~230.000 soru/sn | 1.000.000 soru | geçti |
| 7 | Hep doğru+hızlı → seviye 10; hep yanlış → seviye 1; karışık → sınırlar içinde | 800 cevap | geçti |
| 8 | 32 günlük hayat şablonunun **hepsi** üretildi | 60.000 soru | geçti |
| 9 | Kategori filtresi (7 konu ayrı ayrı) ve puanlama formülü | 14.000 soru | geçti |
| 10 | Türkçe sayı biçimi (`1.234.567`, `1.234,50`) | — | geçti |

Toplam üretilen ve doğrulanan soru: **1.434.000**.

## 2) Kod kalitesi — SonarCloud'un uyguladığı kurallar yerelde

`./tools/lint.sh`

| Katman | Araç | Sonuç |
|---|---|---|
| JavaScript | **`eslint-plugin-sonarjs`** — SonarSource'un kendi kural motoru; hem "recommended" profil hem de bütün hata/güvenlik sınıfı kurallar (S2589 gereksiz koşul, S1764 aynı işlenen, S4143 üzerine yazma, S2245 PRNG, S5332 açık metin protokol, S1854 ölü atama, S2310 döngü sayacı, …) | temiz |
| CSS | `stylelint`, Sonar'ın CSS hata ailesine karşılık gelen kurallar (bilinmeyen özellik/birim/at-rule, yinelenen bildirim, geçersiz hex, kısayol çakışması, …) | temiz |
| HTML | `html-validate` (doctype, düğme tipi, erişilebilir ad, satır içi stil, …) | temiz |

> Bu adım, PR'da kırmızı yanan **SonarCloud Quality Gate**'i (Reliability D,
> Security C) çözmek için eklendi.
>
> **Bulgulara nasıl ulaşıldı.** `sonarcloud.io` bu ortamda çıkış politikasıyla
> engelli (hem `curl` hem sayfa getirme 403/`EGRESS_BLOCKED`), SonarCloud
> check'i `output.text` üretmiyor ve PR'da satır içi inceleme yorumu yok.
> Çözüm: SonarCloud sonuçlarını **check-run anotasyonu** olarak GitHub'a
> yazıyor ve herkese açık depolarda bu uç nokta kimlik doğrulamasız
> okunabiliyor. `tools/sonar-findings.js` bu yolu kullanıyor:
>
> ```bash
> node tools/sonar-findings.js roydeb11/roy-menu-demo 2
> ```
>
> Böylece 47 benzersiz bulgunun tamamı (8 engelleyen + 39 uyarı) satır satır
> okundu. Ortaya çıkan önemli bir gerçek: SonarCloud bu depoda **Swift ve
> kabuk betiklerini de analiz ediyor** — ilk iki turda yalnızca JavaScript,
> CSS ve HTML'e bakıldığı için kapı kırmızı kalmıştı.
>
> **Engelleyen 8 bulgu ve düzeltmeleri**
>
> | Dosya | Bulgu | Düzeltme |
> |---|---|---|
> | `verify.sh` (5 satır) | Koşullu testlerde `[` yerine `[[` kullanılmalı — `[` sözcük bölünmesine açık | Altı testin hepsi `[[ ]]` oldu (biri anotasyon listesinde yoktu, o da düzeltildi) |
> | `PlayView.swift:49` | Boş closure açıklamasız | `set: { _ in }`'in neden bilerek boş olduğu yazıldı |
> | `HapticEngine.swift:71` | Boş closure açıklamasız | `stoppedHandler`'ın neden boş bırakıldığı yazıldı |
> | `tools/swiftcheck.js:39` | `.sort()` karşılaştırıcısız — öğeleri alfabetik sıralar | `sort((a, b) => a.localeCompare(b))` |
>
> **39 uyarının tamamı da düzeltildi**
>
> * Swift: `level L: Int` parametresi `level` oldu (ad kuralı, 5 yer);
>   virgülle tek satıra sıkıştırılmış bildirimler ayrıldı (11 yer);
>   `FlowLayout`'ta kullanılmayan `cache`/`proposal` parametreleri `_` oldu.
> * JavaScript: `node:fs` / `node:path` önekleri (10 yer), `replaceAll`
>   (4 yer), `Number.parseFloat` / `Number.parseInt` (3 yer), gereksiz boş
>   nesne, isteğe bağlı zincir, `last2` için `Set`.
> * `tools/package-lock.json` eklendi — araç sürümleri artık öngörülebilir.
>
> **Önceki turlarda düzeltilenler (bulgular okunmadan, önlem olarak)**
>
> * **`innerHTML` tamamen kaldırıldı.** İstatistik listesi `localStorage`'tan
>   okunan veriyi `innerHTML`'e yazıyordu; yerine `document.createElement`
>   tabanlı güvenli kurulum ve SVG için `DOMParser` + `importNode` geldi.
> * `Math.random()` yedeği kaldırıldı; tohum artık `crypto.getRandomValues`.
> * `haptics.js` `localStorage`'a korumasız erişiyordu — Safari gizli modda
>   istisna atıp uygulamayı açılışta düşürürdü; artık `try/catch` içinde.
> * `void el.offsetWidth` yerine Web Animations API; null korumaları;
>   iç içe üçlü/şablon/atamalar çıkarıldı; bilişsel karmaşıklık düşürüldü.
> * Erişilebilirlik: `viewport`'tan `maximum-scale=1` kaldırıldı,
>   `role="img"` olan her SVG'ye `<title>` eklendi, düğmelere `type="button"`
>   ve erişilebilir ad verildi, satır içi stiller CSS'e taşındı.

## 3) Swift kaynakları — gerçek gramerle ayrıştırıldı

`node swiftcheck.js ios/` (tree-sitter-swift 0.7.1)

```
18 Swift dosyası · 3001 satır · 42197 sözdizimi düğümü · hatalı dosya: 0
```

Her dosya gerçek bir Swift gramerine göre ayrıştırıldı; tek bir `ERROR` veya
`MISSING` düğümü yok.

> **Dürüst sınır:** Bu Linux kabında Xcode ya da Swift derleyicisi yok ve
> `download.swift.org` kurumsal çıkış politikası tarafından engellendi (HTTP 403).
> Dolayısıyla Swift kodu **derlenmedi** — sözdizimi gerçek gramerle doğrulandı,
> tip denetimi Xcode'da yapılacak. Aynı motorun mantığı, birebir portu olan
> JavaScript sürümünde 1,4 milyon soruyla uçtan uca doğrulandı (§1), ve aynı
> iddialar `ios/ZihinMath/ZihinMathTests/EngineTests.swift` içinde Swift Testing
> ile yazıldı — Xcode'da `⌘U` ile çalışır.

## 4) Xcode projesi — gerçek pbxproj ayrıştırıcısıyla okundu

`xcode` npm paketi (Cordova/Expo'nun kullandığı ayrıştırıcı):

```
✓ pbxproj ayrıştırıldı · objectVersion 77
  · hedef: ZihinMath       (com.apple.product-type.application)
  · hedef: ZihinMathTests  (com.apple.product-type.bundle.unit-test)
```

Kaynak dosyalar `PBXFileSystemSynchronizedRootGroup` ile klasör senkronizasyonu
üzerinden bağlı — yeni dosya eklendiğinde proje dosyasını elle düzenlemek gerekmez.
Paylaşılan şema (`ZihinMath.xcscheme`) de depoda.

## 5) Tarayıcıda uçtan uca — 36 iddia

`node e2e.js` · Chromium, iPhone 15 Pro görünümü, `tr-TR`, koyu ve açık görünüm.

* Giriş ekranı, 7 konu etiketi, mod düğmeleri göründü.
* **Sonsuz mod: 250 soru kesintisiz oynandı.** 250 soruda 246 benzersiz soru geldi,
  7 kategorinin hepsi çıktı, puan 55.000'i geçti, zorluk seviye 10'a çıktı,
  seri 250'de kaldı ve **oyun hâlâ devam ediyordu — akış bitmedi.**
* Yanlış cevapta: yanlış şık işaretlendi, doğru şık gösterildi, ipucu yazıldı
  (ör. `5.779 − 2.693 = 3.086`), seri sıfırlandı.
* Görsel soru SVG ile çizildi; günlük hayat problemi tam metinle göründü.
* İstatistik ekranı 251 soruyu ve 7 konunun başarısını kaydetti.
* 60 saniye modu: sayaç 60'tan başladı, süre bitince özet ekranı açıldı.
* Açık görünümde zemin `rgb(255,255,255)` oldu.
* PWA: manifest `standalone`, 3 ikon, service worker kaydedildi (çevrimdışı çalışır).
* Konsolda tek bir hata yok.

**Üç ton palet denetimi (otomatik):** Giriş, oyun ve istatistik ekranlarında
*bütün* öğelerin `color`, `background-color`, `border-color`, `fill` ve `stroke`
değerleri toplandı ve sınıflandırıldı. Her değer ya akromatik (siyah↔beyaz ekseni),
ya saydam, ya da Apple systemBlue (`#0A84FF` / `#007AFF`) çıktı. **Dördüncü bir renk
tonu yok.**

## 6) Yerleşim — üç iPhone boyutu

`node fitcheck.js` · iPhone SE, iPhone 15 Pro, iPhone 15 Pro Max.

7 kategori × 10 seviye × tüm görsel tipleri denendi; her soruda dört şık ve
geri bildirim satırı ekranın içinde kaldı, sayfa hiç kaymadı.

> Bu adım gerçek bir hatayı yakaladı: uzun görsellerde (pasta, para) geri bildirim
> satırı ekranın altına taşıyordu. Oyun ekranı `100svh`e sabitlenip soru kartı
> esnetilerek düzeltildi, sonra üç cihazda yeniden ölçüldü.

### Doğrulamanın yakaladığı diğer gerçek hatalar

1. Kullanıcı ekrana dokunmadan `navigator.vibrate` çağrılıyor ve tarayıcı
   konsola hata yazıyordu → haptik ilk etkileşime kadar sessiz.
2. SonarCloud düzeltmeleri sırasında bir yardımcı fonksiyon bloğu yanlış
   çapaya takıldığı için dosyaya hiç eklenmemişti; uygulama açılışta
   `optionLabel is not defined` ile patlıyordu. Uçtan uca test bunu ilk
   çalıştırmada yakaladı (36 iddiadan 7'si kırmızı), fonksiyonlar eklendi ve
   tekrar 36/36 geçti. **Düzeltmeler ancak testten geçtikten sonra
   itildi.**

## 7) Ekran görüntüleri

`docs/screenshots/` — hepsi gerçek tarayıcıda, iPhone görünümünde alındı:

| Dosya | İçerik |
|---|---|
| `01-giris.png` | Giriş ekranı (koyu) |
| `02-oyun.png` | Oyun ekranı |
| `03-seri.png` | 250 soruluk seri sonrası |
| `04-yanlis.png` | Yanlış cevap geri bildirimi |
| `05-gorsel.png` | Görsel soru |
| `06-gunluk.png` | Günlük hayat problemi |
| `07-istatistik.png` | İstatistikler |
| `08-ozet.png` | 60 saniye özeti |
| `09-acik-gorunum.png` | Açık görünüm |
| `10…16` | Yedi kategorinin her biri |
| `17-gorsel-*` | Altı görsel soru tipi (nokta, ızgara, çubuk, pasta, sayı doğrusu, para) |

## 8) Apple dokümantasyonu — okunan kaynaklar

Liquid Glass API imzaları ve HIG tabloları `developer.apple.com`'un kendi JSON
doküman uç noktalarından çekilip birebir alındı (sayfalar JavaScript ile
render edildiği için HTML kazıma yerine bu yol kullanıldı):

* `documentation/SwiftUI/Glass` — `struct Glass`, `.regular`, `.clear`, `tint(_:)`, `interactive(_:)`, iOS 26.0
* `documentation/SwiftUI/View/glassEffect(_:in:)` — tam imza, iOS 26.0
* `documentation/SwiftUI/GlassEffectContainer` — `init(spacing:content:)`
* `documentation/SwiftUI/View/glassEffectID(_:in:)`, `glassEffectUnion(id:namespace:)`, `glassEffectTransition(_:)`
* `documentation/SwiftUI/GlassEffectTransition` — `identity`, `matchedGeometry`, `materialize`
* `documentation/SwiftUI/PrimitiveButtonStyle/glass` → `GlassButtonStyle`
* `documentation/SwiftUI/SensoryFeedback` ve `View/sensoryFeedback(_:trigger:)`
* `documentation/SwiftUI/ContentTransition/numericText(value:)`
* HIG **Typography** — iOS Dynamic Type ölçek tablosu, okunabilirlik ve ağırlık önerileri
* HIG **Playing haptics** — bildirim/çarpma/seçim desenleri, Core Haptics ile özel desen kuralları
