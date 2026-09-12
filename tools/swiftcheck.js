/* Swift kaynaklarını gerçek bir gramerle (tree-sitter-swift) ayrıştırır.
 * ERROR / MISSING düğümü varsa dosya ve satır bildirir.  */
const fs = require('fs'), path = require('path');
const Parser = require('tree-sitter');
const Swift = require('tree-sitter-swift');

const parser = new Parser();
parser.setLanguage(Swift);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.swift')) out.push(p);
  }
  return out;
}

const roots = process.argv.slice(2);
let files = [];
for (const r of roots) files = files.concat(fs.statSync(r).isDirectory() ? walk(r) : [r]);

let bad = 0, totalNodes = 0, totalLines = 0;
for (const f of files.sort()) {
  const src = fs.readFileSync(f, 'utf8');
  totalLines += src.split('\n').length;
  const tree = parser.parse(src);
  const errors = [];
  (function visit(n) {
    totalNodes++;
    if (n.type === 'ERROR' || n.isMissing) {
      errors.push(`${n.type === 'ERROR' ? 'ERROR' : 'MISSING ' + n.type} @ ${n.startPosition.row + 1}:${n.startPosition.column + 1}  «${src.slice(n.startIndex, Math.min(n.endIndex, n.startIndex + 70)).replace(/\n/g, '⏎')}»`);
    }
    for (let i = 0; i < n.childCount; i++) visit(n.child(i));
  })(tree.rootNode);

  const rel = path.relative(process.cwd(), f);
  if (errors.length) { bad++; console.log(`✗ ${rel}`); errors.slice(0, 6).forEach((e) => console.log('    ' + e)); }
  else console.log(`✓ ${rel}  (${src.split('\n').length} satır)`);
}
console.log(`\n${files.length} Swift dosyası · ${totalLines} satır · ${totalNodes} sözdizimi düğümü · hatalı dosya: ${bad}`);
process.exit(bad ? 1 : 0);
