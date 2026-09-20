#!/usr/bin/env node
//
// GitHub Actions workflow denetleyicisi.
//
// Yaptıkları:
//   1. Her workflow dosyasını gerçek bir YAML ayrıştırıcısıyla okur.
//   2. Her `run:` bloğunu geçici dosyaya yazıp `bash -n` ile sözdizimi denetler
//      (kabuk hatası, CI'da dakikalar sonra değil burada yakalanır).
//   3. Her işin `runs-on` değeri olduğunu doğrular.
//   4. Kullanılan bütün `secrets.*` adlarını listeler — belgeyle karşılaştırmak için.
//
// Kullanım:  node tools/workflowcheck.js [workflow-dizini]
//
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const YAML = require('yaml');

const REPO_ROOT = path.resolve(__dirname, '..');

// Kabuk, PATH'ten değil sabit mutlak yoldan çağrılır: PATH yazılabilir bir
// dizin içeriyorsa oraya konan sahte bir "bash" çalıştırılabilirdi (SonarJS S4036).
// /bin/bash hem Linux hem macOS'ta bu yoldadır.
const BASH = '/bin/bash';

/** argv'den gelen yolu depo kökünün içine hapseder. */
function safeRoot(arg) {
  const abs = path.resolve(REPO_ROOT, arg ?? '.github/workflows');
  const rel = path.relative(REPO_ROOT, abs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Yol depo kökünün dışında: ${arg}`);
  }
  return abs;
}

function collectRuns(doc, file, problems, secrets) {
  const jobs = doc?.jobs ?? {};
  const steps = [];
  for (const [jobName, job] of Object.entries(jobs)) {
    if (!job || typeof job !== 'object') continue;
    if (!job['runs-on']) {
      problems.push(`${file}: '${jobName}' işinde runs-on yok`);
    }
    for (const [i, step] of (job.steps ?? []).entries()) {
      if (typeof step?.run === 'string') {
        steps.push({ jobName, index: i, name: step.name ?? `adım ${i + 1}`, run: step.run });
      }
    }
  }
  for (const m of JSON.stringify(doc).matchAll(/secrets\.([A-Z0-9_]+)/g)) {
    secrets.add(m[1]);
  }
  return steps;
}

function main() {
  if (!fs.existsSync(BASH)) {
    console.error(`Kabuk bulunamadı: ${BASH} — kabuk sözdizimi denetimi yapılamıyor.`);
    process.exit(1);
  }
  const dir = safeRoot(process.argv[2]);
  if (!fs.existsSync(dir)) {
    console.error(`Workflow dizini yok: ${path.relative(REPO_ROOT, dir)}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .toSorted((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error('Denetlenecek workflow bulunamadı.');
    process.exit(1);
  }

  const problems = [];
  const secrets = new Set();
  let shellBlocks = 0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wfcheck-'));

  for (const file of files) {
    const full = path.join(dir, file);
    let doc;
    try {
      doc = YAML.parse(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      problems.push(`${file}: YAML ayrıştırılamadı — ${err.message}`);
      continue;
    }
    const steps = collectRuns(doc, file, problems, secrets);
    for (const step of steps) {
      shellBlocks += 1;
      const script = path.join(tmp, `${file}-${step.jobName}-${step.index}.sh`);
      fs.writeFileSync(script, step.run);
      try {
        execFileSync(BASH, ['-n', script], { stdio: 'pipe' });
        console.log(`✓ ${file} · ${step.jobName} · ${step.name}`);
      } catch (err) {
        const msg = (err.stderr?.toString() ?? err.message).trim();
        problems.push(`${file} · ${step.jobName} · ${step.name}: ${msg}`);
        console.log(`✗ ${file} · ${step.jobName} · ${step.name}`);
      }
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(
    `\n${files.length} workflow · ${shellBlocks} kabuk bloğu · gerekli gizli anahtarlar: ` +
      `${[...secrets].toSorted((a, b) => a.localeCompare(b)).join(', ') || '(yok)'}`
  );

  if (problems.length > 0) {
    console.error(`\n${problems.length} sorun:`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log('Sorun yok.');
}

main();
