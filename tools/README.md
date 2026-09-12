# Doğrulama araçları

Bunlar uygulamanın parçası değil; **iddiaları ölçen** araçlar. Sonuçları
[`../docs/DOGRULAMA.md`](../docs/DOGRULAMA.md) içinde.

```bash
cd tools && npm install     # playwright + tree-sitter-swift + pbxproj ayrıştırıcı
npx playwright install chromium
```

| Komut | Ne yapar |
|---|---|
| `npm run lint` | SonarCloud'un uyguladığı kural ailelerini yerelde çalıştırır: JavaScript için **SonarSource'un kendi kural motoru** (`eslint-plugin-sonarjs`), CSS için Sonar'ın hata ailesine karşılık gelen stylelint kuralları, HTML için `html-validate`. |
| `npm run swift` | Bütün Swift dosyalarını gerçek Swift gramerine (tree-sitter-swift) göre ayrıştırır; tek `ERROR`/`MISSING` düğümü varsa bildirir. |
| `npm run e2e` | Chromium'u iPhone görünümünde açar, 250 soru oynar, üç-ton palet denetimi yapar, ekran görüntüsü alır. |
| `npm run fit` | Üç iPhone boyutunda her soru tipinde taşma olup olmadığını ölçer. |
| `npm run shots` | Her kategori ve her görsel tipi için temiz ekran görüntüsü üretir. |
| `npm run icons` | Uygulama ikonlarını (iOS + PWA) Chromium ile üretir. |

`e2e`, `fit` ve `shots` için `zihin/` klasörünün `http://127.0.0.1:8099` üzerinden
sunuluyor olması gerekir — kök dizindeki `./verify.sh` bunu kendisi başlatır.

Kendi Chromium'unu kullanmak için: `CHROME_PATH=/yol/chrome npm run e2e`.
