#!/usr/bin/env bash
# Zihin — bütün doğrulamaları çalıştırır.  Kullanım:  ./verify.sh
set -u
cd "$(dirname "$0")"
rc=0
have_tools=0

# Playwright'in kendi Chromium'u yoksa, sistemde kurulu olanı bul.
if [ -z "${CHROME_PATH:-}" ]; then
  for cand in \
    "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"/chromium-*/chrome-linux/chrome \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome; do
    [ -x "$cand" ] && export CHROME_PATH="$cand" && break
  done
fi
[ -n "${CHROME_PATH:-}" ] && echo "Chromium: $CHROME_PATH"

[ -d tools/node_modules ] && have_tools=1

echo "=== 1) Soru motoru değişmez testleri (Node, bağımlılık yok) ==="
node zihin/tests/engine.test.mjs || rc=1

if [ "$have_tools" -eq 0 ]; then
  echo
  echo "! tools/node_modules yok — lint, Swift, Xcode ve tarayıcı doğrulamaları atlandı."
  echo "  Çalıştırmak için:  cd tools && npm install && npx playwright install chromium"
  exit $rc
fi

echo
echo "=== 2) Kod kalitesi: SonarJS + CSS + HTML kuralları ==="
./tools/lint.sh || rc=1

echo
echo "=== 3) Swift sözdizimi (tree-sitter-swift, gerçek gramer) ==="
node tools/swiftcheck.js ios/ || rc=1

echo
echo "=== 4) Xcode projesi (gerçek pbxproj ayrıştırıcısı) ==="
node -e "
const xcode=require('./tools/node_modules/xcode');
const p=xcode.project('ios/ZihinMath/ZihinMath.xcodeproj/project.pbxproj'); p.parseSync();
const t=p.hash.project.objects.PBXNativeTarget;
console.log('✓ pbxproj ayrıştırıldı · objectVersion', p.hash.project.objectVersion);
Object.keys(t).filter(k=>!k.endsWith('_comment')).forEach(k=>console.log('  · hedef:', t[k].name, t[k].productType));
" || rc=1

echo
echo "=== 5) Tarayıcıda uçtan uca (Chromium, iPhone görünümü) ==="
(cd zihin && python3 -m http.server 8099 --bind 127.0.0.1 >/dev/null 2>&1 & echo $! > /tmp/zihin_verify.pid)
sleep 1
node tools/e2e.js || rc=1

echo
echo "=== 6) Yerleşim: üç iPhone boyutunda taşma yok ==="
node tools/fitcheck.js || rc=1

kill "$(cat /tmp/zihin_verify.pid)" 2>/dev/null

echo
if [ $rc -eq 0 ]; then echo "TÜMÜ GEÇTİ"; else echo "BAŞARISIZ ADIM VAR"; fi
exit $rc
