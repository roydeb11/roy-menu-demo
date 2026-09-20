/* Görsel soru çizimleri — yalnızca üç ton (siyah / beyaz / Apple mavisi). */

const BLUE = 'var(--blue)';
const INK = 'var(--ink)';
const DIM = 'var(--ink-3)';

/** XML metin içeriğini kaçışlar. */
const esc = (s) => String(s)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/**
 * Ortak SVG sarmalayıcı. `role="img"` kullanan her çizim, ekran okuyucular
 * için bir <title> ile adlandırılır.
 */
const svg = (w, h, body, title) =>
  `<svg viewBox="0 0 ${w} ${h}" role="img" xmlns="http://www.w3.org/2000/svg">`
  + `<title>${esc(title)}</title>${body}</svg>`;

/** Gruplanmış noktalar — çarpma/sayma sezgisi */
function dots({ groups, per }) {
  const cols = Math.min(groups, 3);
  const rows = Math.ceil(groups / cols);
  const gw = 104, gh = 78, pad = 8;
  const w = cols * gw + pad * 2, h = rows * gh + pad * 2;
  let body = '';
  for (let g = 0; g < groups; g++) {
    const gx = pad + (g % cols) * gw, gy = pad + Math.floor(g / cols) * gh;
    body += `<rect x="${gx + 3}" y="${gy + 3}" width="${gw - 10}" height="${gh - 10}" rx="16"
              fill="rgba(255,255,255,.05)" stroke="${DIM}" stroke-width="1"/>`;
    const pc = Math.min(per, 3);
    const pr = Math.ceil(per / pc);
    for (let i = 0; i < per; i++) {
      const cx = gx + (gw - 10) / (pc + 1) * ((i % pc) + 1) + 3;
      const cy = gy + (gh - 10) / (pr + 1) * (Math.floor(i / pc) + 1) + 3;
      body += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7" fill="${BLUE}">
                 <animate attributeName="opacity" values="0;1" dur="0.28s" begin="${(g * per + i) * 0.024}s" fill="freeze"/>
               </circle>`;
    }
  }
  return svg(w, h, body, `${groups} grup, her grupta ${per} nokta`);
}

/** Izgara — satır × sütun alan modeli */
function grid({ rows, cols }) {
  const cell = 30, pad = 6;
  const w = cols * cell + pad * 2, h = rows * cell + pad * 2;
  let body = '';
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      body += `<rect x="${pad + c * cell + 2}" y="${pad + r * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="7"
                fill="${BLUE}" opacity="0">
                 <animate attributeName="opacity" values="0;.88" dur="0.26s" begin="${(r * cols + c) * 0.014}s" fill="freeze"/>
               </rect>`;
  return svg(w, h, body, `${rows} satır ${cols} sütunluk ızgara`);
}

/** İki çubuk — fark sezgisi */
function bars({ a, b }) {
  const unit = 13, maxV = Math.max(a, b);
  const w = 300, h = 150;
  const bw = 58, x1 = 62, x2 = 180, base = h - 26;
  const mk = (x, v, fill, label) => {
    const bh = v * unit * (Math.min(1, 96 / (maxV * unit)));
    return `<rect x="${x}" y="${base - bh}" width="${bw}" height="${bh}" rx="10" fill="${fill}" opacity=".92">
              <animate attributeName="height" values="0;${bh.toFixed(1)}" dur="0.5s" fill="freeze"/>
              <animate attributeName="y" values="${base};${(base - bh).toFixed(1)}" dur="0.5s" fill="freeze"/>
            </rect>
            <text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle" fill="${DIM}"
                  font-size="13" font-family="ui-rounded,-apple-system,system-ui" font-weight="600">${label}</text>`;
  };
  let body = `<line x1="34" y1="${base}" x2="${w - 24}" y2="${base}" stroke="${DIM}" stroke-width="1"/>`;
  body += mk(x1, a, BLUE, `${a}`);
  body += mk(x2, b, 'rgba(255,255,255,.62)', `${b}`);
  return svg(w, h, body, `İki çubuk: ${a} birim ve ${b} birim`);
}

/** Pasta — yüzde sezgisi */
function pie({ percent }) {
  const w = 240, h = 190, cx = 120, cy = 95, R = 74;
  const C = 2 * Math.PI * R;
  const on = (C * percent) / 100;
  let body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="rgba(255,255,255,.06)" stroke="${DIM}" stroke-width="1"/>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${R / 2}" fill="none" stroke="${BLUE}" stroke-width="${R}"
            stroke-dasharray="${(on / 2).toFixed(2)} ${((C - on) / 2).toFixed(2)}"
            transform="rotate(-90 ${cx} ${cy})" opacity=".92">
             <animate attributeName="stroke-dasharray" values="0 ${(C / 2).toFixed(2)};${(on / 2).toFixed(2)} ${((C - on) / 2).toFixed(2)}" dur="0.7s" fill="freeze"/>
           </circle>`;
  body += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>`;
  // 4 çeyrek kılavuzu
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2 - Math.PI / 2;
    body += `<line x1="${cx}" y1="${cy}" x2="${(cx + Math.cos(ang) * R).toFixed(1)}" y2="${(cy + Math.sin(ang) * R).toFixed(1)}"
              stroke="rgba(255,255,255,.18)" stroke-width="1"/>`;
  }
  return svg(w, h, body, `Dairenin yüzde ${percent}'i dolu`);
}

/** Sayı doğrusu */
function numberline({ start, end, ticks, at }) {
  const w = 320, h = 118, x0 = 22, x1 = w - 22, y = 74;
  const step = (x1 - x0) / ticks;
  let body = `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${DIM}" stroke-width="2" stroke-linecap="round"/>`;
  for (let i = 0; i <= ticks; i++) {
    const x = x0 + i * step;
    const major = i === 0 || i === ticks;
    body += `<line x1="${x.toFixed(1)}" y1="${y - (major ? 11 : 6)}" x2="${x.toFixed(1)}" y2="${y + (major ? 11 : 6)}"
              stroke="${major ? INK : DIM}" stroke-width="${major ? 2 : 1}" stroke-linecap="round"/>`;
    if (major) {
      const val = i === 0 ? start : end;
      body += `<text x="${x.toFixed(1)}" y="${y + 30}" text-anchor="middle" fill="${DIM}"
                font-size="13" font-family="ui-rounded,-apple-system,system-ui" font-weight="600">${val}</text>`;
    }
  }
  const ax = x0 + at * step;
  body += `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.4s" begin="0.15s" fill="freeze"/>
            <path d="M ${ax.toFixed(1)} ${y - 16} l -8 -16 h 16 z" fill="${BLUE}"/>
            <circle cx="${ax.toFixed(1)}" cy="${y}" r="5.5" fill="${BLUE}"/>
            <text x="${ax.toFixed(1)}" y="${y - 40}" text-anchor="middle" fill="${BLUE}"
              font-size="17" font-weight="700" font-family="ui-rounded,-apple-system,system-ui">?</text></g>`;
  return svg(w, h, body, `${start} ile ${end} arası sayı doğrusu`);
}

/** Para — banknot/madeni para toplamı */
function coins({ items }) {
  const per = 62, gap = 9;
  const total = items.reduce((s, i) => s + i.count, 0);
  const cols = Math.min(5, total);
  const rows = Math.ceil(total / cols);
  const w = cols * (per + gap) + gap, h = rows * (per + gap) + gap + 4;
  let body = '', k = 0;
  for (const it of items) {
    for (let c = 0; c < it.count; c++, k++) {
      const x = gap + (k % cols) * (per + gap), y = gap + Math.floor(k / cols) * (per + gap);
      const isCoin = it.value <= 5;
      body += isCoin
        ? `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.25s" begin="${k * 0.05}s" fill="freeze"/>
             <circle cx="${x + per / 2}" cy="${y + per / 2}" r="${per / 2 - 3}" fill="rgba(255,255,255,.10)" stroke="${INK}" stroke-width="1.5"/>
             <text x="${x + per / 2}" y="${y + per / 2 + 6}" text-anchor="middle" fill="${INK}" font-size="17" font-weight="700"
               font-family="ui-rounded,-apple-system,system-ui">${it.value}</text></g>`
        : `<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.25s" begin="${k * 0.05}s" fill="freeze"/>
             <rect x="${x + 1}" y="${y + 11}" width="${per - 2}" height="${per - 24}" rx="7" fill="var(--blue-fill)" stroke="${BLUE}" stroke-width="1.5"/>
             <text x="${x + per / 2}" y="${y + per / 2 + 6}" text-anchor="middle" fill="${BLUE}" font-size="16" font-weight="700"
               font-family="ui-rounded,-apple-system,system-ui">${it.value}</text></g>`;
    }
  }
  return svg(w, h, body, 'Madeni para ve banknotlar');
}

const RENDERERS = { dots, grid, bars, pie, numberline, coins };

export function renderVisual(spec) {
  const fn = RENDERERS[spec?.type];
  return fn ? fn(spec) : '';
}
