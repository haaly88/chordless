/**
 * Convert the Chordless PNG icon into a multi-size Windows .ico so Windows
 * (taskbar, Alt-Tab, Explorer) shows the real Chordless icon.
 * Run once per icon change:  node scripts/make-ico.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const mod = require('png-to-ico');
const pngToIco = mod.default || mod;

async function main() {
  const src = path.join(__dirname, '..', '..', 'web', 'public', 'icon.png');
  const out = path.join(__dirname, '..', 'build', 'icon.ico');
  const png = fs.readFileSync(src);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ico = await pngToIco(png);
  fs.writeFileSync(out, ico);
  console.log('[icon] wrote', out, ico.length, 'bytes');
}

main().catch((e) => { console.error(e); process.exit(1); });
