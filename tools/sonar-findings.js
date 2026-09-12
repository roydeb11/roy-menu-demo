/* SonarCloud bulgularını GitHub Checks API'sinden okur.
 *
 * sonarcloud.io'ya doğrudan erişilemediğinde (ağ politikası, kurumsal proxy)
 * bulgular yine de okunabilir: SonarCloud, sonuçlarını check-run
 * "annotations" olarak GitHub'a yazar ve herkese açık depolarda bu uç nokta
 * kimlik doğrulaması olmadan okunabilir.
 *
 * Kullanım:
 *   node tools/sonar-findings.js <owner/repo> <pr-numarası>
 *   node tools/sonar-findings.js roydeb11/roy-menu-demo 2
 */
const https = require('node:https');

const [slug, pr] = process.argv.slice(2);
if (!slug || !pr) {
  console.error('Kullanım: node tools/sonar-findings.js <owner/repo> <pr-numarası>');
  process.exit(2);
}
if (!/^[\w.-]+\/[\w.-]+$/.test(slug) || !/^\d+$/.test(pr)) {
  console.error('Geçersiz depo adı veya PR numarası.');
  process.exit(2);
}

// Herkese açık depolar için kimlik doğrulaması gerekmez. Özel depoda ya da
// hız sınırına takılınca SONAR_FINDINGS_TOKEN ile bir belirteç verilebilir.
// (Ortamda bulunabilecek GITHUB_TOKEN/GH_TOKEN bilerek kullanılmaz: başka
//  kapsamlar için üretilmiş bir belirteç isteği 401 ile düşürür.)
const headers = { 'User-Agent': 'zihin-tools', Accept: 'application/vnd.github+json' };
if (process.env.SONAR_FINDINGS_TOKEN) {
  headers.Authorization = `Bearer ${process.env.SONAR_FINDINGS_TOKEN}`;
}

function api(path) {
  return new Promise((resolve, reject) => {
    https.get({ host: 'api.github.com', path, headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

(async () => {
  const prData = await api(`/repos/${slug}/pulls/${pr}`);
  const sha = prData.head.sha;
  const runs = await api(`/repos/${slug}/commits/${sha}/check-runs?per_page=100`);
  const sonar = runs.check_runs.filter((r) => /sonar/i.test(r.name));

  if (sonar.length === 0) {
    console.log('Bu head için SonarCloud check-run bulunamadı:', sha);
    return;
  }

  for (const run of sonar) {
    console.log(`\n═══ ${run.name} · ${run.conclusion} · ${sha.slice(0, 7)} ═══`);
    const annotations = await api(`/repos/${slug}/check-runs/${run.id}/annotations?per_page=100`);
    const blocking = annotations.filter((a) => a.annotation_level === 'failure');
    const rest = annotations.filter((a) => a.annotation_level !== 'failure');

    const show = (list, label) => {
      console.log(`\n── ${label} (${list.length}) ──`);
      for (const a of list) {
        console.log(`${a.path}:${a.start_line}`);
        console.log(`    ${a.title ?? ''}`);
      }
    };
    show(blocking, 'ENGELLEYEN');
    show(rest, 'uyarı');
    console.log(`\nToplam ${annotations.length} anotasyon (GitHub en çok 50 tanesini saklar).`);
  }
})().catch((e) => { console.error('Hata:', e.message); process.exit(1); });
