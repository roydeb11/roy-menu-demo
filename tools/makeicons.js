/* Uygulama ikonlarını Chromium ile üretir. Üç ton dışına çıkılmaz. */
const { chromium } = require('playwright');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');

/** @param {{bg:string,fg:string,glow:string,rounded:boolean,ring:string}} o */
const html = (o) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;width:1024px;height:1024px;background:${o.bg};overflow:hidden}
  .wrap{width:1024px;height:1024px;display:grid;place-items:center;position:relative}
  .glow{position:absolute;width:900px;height:900px;border-radius:50%;
        background:radial-gradient(circle,${o.glow},transparent 62%);filter:blur(40px)}
  .lens{position:absolute;width:660px;height:660px;border-radius:${o.rounded ? '170px' : '0'};
        background:linear-gradient(150deg, rgba(255,255,255,.14), rgba(255,255,255,.03));
        border:6px solid ${o.ring};
        box-shadow: inset 0 12px 0 -6px rgba(255,255,255,.30), 0 40px 90px -30px rgba(0,0,0,.8);}
  .z{position:relative;font-family:ui-rounded,-apple-system,"SF Pro Rounded",system-ui,sans-serif;
     font-weight:800;font-size:420px;line-height:1;color:${o.fg};letter-spacing:-10px;
     text-shadow:0 0 60px ${o.glow}}
</style><div class="wrap"><div class="glow"></div><div class="lens"></div><div class="z">Z</div></div>`;

(async () => {
  const browser = await chromium.launch({ executablePath: require('./chrome')(), args: ['--no-sandbox','--font-render-hinting=none'] });
  const page = await browser.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });

  const variants = [
    { file: 'ios/ZihinMath/ZihinMath/Assets.xcassets/AppIcon.appiconset/icon-1024.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(10,132,255,.75)', ring: 'rgba(10,132,255,.85)', rounded: true }, size: 1024 },
    { file: 'ios/ZihinMath/ZihinMath/Assets.xcassets/AppIcon.appiconset/icon-1024-dark.png',
      o: { bg: '#000000', fg: '#0A84FF', glow: 'rgba(10,132,255,.55)', ring: 'rgba(255,255,255,.28)', rounded: true }, size: 1024 },
    { file: 'ios/ZihinMath/ZihinMath/Assets.xcassets/AppIcon.appiconset/icon-1024-tinted.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(255,255,255,.35)', ring: 'rgba(255,255,255,.55)', rounded: true }, size: 1024 },
    { file: 'zihin/icons/icon-512.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(10,132,255,.75)', ring: 'rgba(10,132,255,.85)', rounded: true }, size: 512 },
    { file: 'zihin/icons/icon-192.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(10,132,255,.75)', ring: 'rgba(10,132,255,.85)', rounded: true }, size: 192 },
    { file: 'zihin/icons/apple-touch-icon.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(10,132,255,.75)', ring: 'rgba(10,132,255,.85)', rounded: true }, size: 180 },
    // maskable: güvenli alan için kenar boşluğu bırakılmış sürüm (yuvarlak maske kırpar)
    { file: 'zihin/icons/icon-maskable-512.png',
      o: { bg: '#000000', fg: '#FFFFFF', glow: 'rgba(10,132,255,.6)', ring: 'rgba(10,132,255,.85)', rounded: true, small: true }, size: 512 },
  ];

  for (const v of variants) {
    let markup = html(v.o);
    if (v.o.small) markup = markup.replace('width:660px;height:660px', 'width:520px;height:520px')
                                 .replace('font-size:420px', 'font-size:320px');
    await page.setContent(markup);
    await page.waitForTimeout(120);
    const out = path.join(ROOT, v.file);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const shot = await page.screenshot({ type: 'png' });
    if (v.size === 1024) fs.writeFileSync(out, shot);
    else {
      await page.setViewportSize({ width: v.size, height: v.size });
      await page.setContent(markup.replaceAll('1024px', v.size + 'px')
        .replace('width:900px;height:900px', `width:${Math.round(v.size * 0.88)}px;height:${Math.round(v.size * 0.88)}px`)
        .replace(/width:(660|520)px;height:(660|520)px/, (m, a) => `width:${Math.round(v.size * (a === '660' ? 0.645 : 0.508))}px;height:${Math.round(v.size * (a === '660' ? 0.645 : 0.508))}px`)
        .replace(/font-size:(420|320)px/, (m, a) => `font-size:${Math.round(v.size * (a === '420' ? 0.41 : 0.3125))}px`)
        .replace('border-radius:170px', `border-radius:${Math.round(v.size * 0.166)}px`)
        .replace('border:6px', `border:${Math.max(2, Math.round(v.size * 0.0059))}px`));
      await page.waitForTimeout(100);
      fs.writeFileSync(out, await page.screenshot({ type: 'png' }));
      await page.setViewportSize({ width: 1024, height: 1024 });
    }
    console.log('✓', v.file, fs.statSync(out).size, 'bayt');
  }
  await browser.close();
})();
