#!/usr/bin/env bash
# SonarCloud'un uyguladığı kural ailelerini yerelde çalıştırır:
#   • JavaScript → eslint-plugin-sonarjs (SonarSource'un kendi kural motoru)
#   • CSS        → stylelint, Sonar'ın "bug" ailesine karşılık gelen kurallar
#   • HTML       → html-validate
set -u
cd "$(dirname "$0")/.."
BIN="tools/node_modules/.bin"
rc=0

echo "— JavaScript (SonarJS) —"
"$BIN/eslint" --config tools/eslint.sonar.mjs --no-config-lookup \
  zihin/js zihin/sw.js zihin/tests tools/*.js && echo "  temiz" || rc=1

echo "— CSS —"
"$BIN/stylelint" --config tools/stylelint.sonar.mjs "zihin/css/*.css" && echo "  temiz" || rc=1

echo "— HTML —"
"$BIN/html-validate" zihin/index.html && echo "  temiz" || rc=1

exit $rc
