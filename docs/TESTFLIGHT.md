# Zihin'i TestFlight'a yükleme

Bu depoda hazır bir GitHub Actions hattı var: **Actions → TestFlight → Run workflow**.
Hat, uygulamayı macOS runner'ında derler, imzalar, IPA üretir ve App Store Connect'e yükler.

Sen yalnızca bir kez aşağıdaki hazırlığı yapıyorsun; sonrası tek tuş.

---

## Önce dürüst sınırlar

TestFlight, Apple'ın kapalı bir hizmeti. Aşağıdakiler olmadan **hiçbir araç** — ben de dahil —
uygulamayı TestFlight'a koyamaz:

| Gereken | Neden | Maliyet |
|---|---|---|
| **Apple Developer Program üyeliği** | TestFlight dağıtımı yalnızca ücretli üyelikte açık | 99 USD / yıl |
| **App Store Connect'te uygulama kaydı** | Yükleme, var olan bir paket kimliğine yapılır | ücretsiz (üyelikle) |
| **App Store Connect API anahtarı** | CI'ın senin adına imzalayıp yükleyebilmesi için | ücretsiz |

Bu depo, bu üçü hazır olduğunda geri kalan her şeyi otomatik yapar.

---

## 1. Paket kimliğini kaydet

1. <https://developer.apple.com/account/resources/identifiers/list> → **+**
2. **App IDs → App** seç.
3. Description: `Zihin`, Bundle ID: **Explicit** → `com.roy.zihin`
   *(bu kimlik başkası tarafından alınmışsa kendi tersine alan adını kullan, örn.
   `com.adisoyadi.zihin` — workflow'u çalıştırırken `bundle_id` kutusuna yaz, projeyi
   değiştirmene gerek yok.)*
4. Capabilities: hiçbirini işaretleme — Zihin ağ, konum, bildirim, hesap kullanmıyor.
5. **Continue → Register**.

## 2. App Store Connect'te uygulama oluştur

1. <https://appstoreconnect.apple.com/apps> → **+ → New App**
2. Platform **iOS**, İsim: `Zihin`, Birincil dil: **Türkçe**,
   Bundle ID: 1. adımda kaydettiğin kimlik, SKU: `zihin-001`.
3. **Create**.

> Bu adım atlanırsa yükleme `ERROR ITMS-90189: No suitable application records were found`
> ile reddedilir.

## 3. API anahtarı üret

1. <https://appstoreconnect.apple.com/access/integrations/api> → **Team Keys** sekmesi
2. **+** → Name: `GitHub Actions`, Access: **App Manager**
3. **Generate** → `AuthKey_XXXXXXXXXX.p8` dosyasını indir.
   **Bu dosya bir kez indirilir**, ikinci kez indiremezsin; kaybedersen yeni anahtar üret.
4. Aynı sayfadan not et: **KEY ID** (anahtar satırında) ve **ISSUER ID** (sayfanın üstünde).

## 4. Takım kimliğini öğren

<https://developer.apple.com/account> → **Membership details** → **Team ID**
(10 karakter, örn. `A1B2C3D4E5`).

## 5. Dört gizli anahtarı depoya ekle

GitHub → bu depo → **Settings → Secrets and variables → Actions → New repository secret**

| Ad | Değer |
|---|---|
| `APPLE_TEAM_ID` | 4. adımdaki 10 karakter |
| `APPSTORE_KEY_ID` | 3. adımdaki KEY ID |
| `APPSTORE_ISSUER_ID` | 3. adımdaki ISSUER ID |
| `APPSTORE_PRIVATE_KEY` | `.p8` dosyasının **tam içeriği** — `-----BEGIN PRIVATE KEY-----` satırından `-----END PRIVATE KEY-----` satırına kadar, olduğu gibi yapıştır |

## 6. Çalıştır

**Actions → TestFlight → Run workflow**

| Kutu | Ne zaman değiştirilir |
|---|---|
| `runner` | Gerçek Liquid Glass için Xcode 26 taşıyan imaj gerekir (örn. `macos-26`). Bırakırsan `macos-15` kullanılır ve uygulama cam yerine `.ultraThinMaterial` yedeğiyle derlenir — **derleme yine başarılı olur.** |
| `bundle_id` | 1. adımda farklı bir kimlik kaydettiysen |
| `marketing_version` | Sürümü yükseltirken, örn. `1.0.1` |
| `upload` | Kapatırsan yüklemez, yalnızca IPA üretir ve iş çıktısı (artifact) olarak bırakır — **ilk denemede bunu kapatmanı öneririm** |

Derleme numarası her çalıştırmada otomatik artar (`GITHUB_RUN_NUMBER`), böylece
"build already exists" hatası almazsın.

## 7. Telefonuna indir

1. Yükleme bittikten **5–15 dakika** sonra App Store Connect → uygulaman → **TestFlight**
   sekmesinde derleme "Processing"den çıkar.
2. **Internal Testing** → bir grup oluştur → kendini ekle (Apple Kimliğin).
3. iPhone'una App Store'dan **TestFlight** uygulamasını kur, aynı Apple Kimliğiyle gir,
   daveti kabul et → **Install**.

İhracat uyumluluğu (export compliance) sorusu çıkmaz: `Info.plist` içinde
`ITSAppUsesNonExemptEncryption = false` tanımlı ve uygulama gerçekten şifreleme kullanmıyor.

---

## Mac'in varsa: hattı beklemeden

```bash
open ios/ZihinMath/ZihinMath.xcodeproj
```
Xcode → hedef **ZihinMath** → **Signing & Capabilities** → Team'ini seç →
**Product → Archive** → **Distribute App → TestFlight & App Store**.

Sadece kendi telefonunda denemek istiyorsan TestFlight'a hiç gerek yok:
iPhone'u kabloyla bağla, Xcode'da cihazı seç, **⌘R**. (Ücretsiz Apple Kimliğiyle
imzalanan uygulama 7 günde bir yenilenmek zorundadır.)

## Hiç Apple hesabı istemiyorsan

`zihin/` klasöründeki PWA sürümü aynı soru motorunu kullanır ve iPhone'a
**Safari → Paylaş → Ana Ekrana Ekle** ile tam ekran kurulur; çevrimdışı çalışır.
Bunun için GitHub Pages'in bu depoda açık olması yeterli
(**Settings → Pages → Source: main**), ardından adres:
`https://<kullanıcı-adın>.github.io/<depo-adı>/zihin/`

Tek eksik, iOS Safari'nin `navigator.vibrate` desteklememesi: haptik geri bildirim
web sürümünde sınırlıdır, tam Taptic deneyim native uygulamadadır.

---

## Hata çıkarsa

| Hata | Sebep ve çözüm |
|---|---|
| `No suitable application records were found` | 2. adım atlanmış — App Store Connect'te uygulama kaydı yok |
| `No signing certificate "iOS Distribution" found` | API anahtarının rolü **App Manager** değil; 3. adımı tekrarla |
| `Bundle identifier is not available` | Paket kimliği başkasında — `bundle_id` kutusuna kendi kimliğini yaz |
| `value of type 'Content' has no member 'glassEffect'` | Bu hata artık çıkmamalı: kod `#if canImport(FoundationModels)` ile iOS 26 SDK'sını derleme zamanında yokluyor. Çıkarsa depodaki `ios/ZihinMath/ZihinMath/Theme/LiquidGlass.swift` güncel değildir |
| `The provided entity includes an attribute with an invalid value` | `marketing_version` biçimi hatalı; `1.0.1` gibi üç parçalı yaz |

Workflow'un kendisini yerelde denetlemek için:

```bash
node tools/workflowcheck.js     # her kabuk bloğunu bash -n ile ayrıştırır
```
