/**
 * Wrap web/public/icon.png into a macOS .icns container (entry ic09 =
 * 512x512 PNG, which macOS accepts; the PNG payload is embedded verbatim).
 * Run once per icon change:  node scripts/make-icns.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

function main() {
  const src = path.join(__dirname, '..', '..', 'web', 'public', 'icon.png');
  const out = path.join(__dirname, '..', 'build', 'icon.icns');
  const png = fs.readFileSync(src);
  if (png.readUInt32BE(16) !== 512 || png.readUInt32BE(20) !== 512) {
    throw new Error(`icon.png must be 512x512, got ${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`);
  }
  const entry = Buffer.alloc(8 + png.length);
  entry.write('ic09', 0, 'ascii'); // 512x512 PNG
  entry.writeUInt32BE(png.length + 8, 4);
  png.copy(entry, 8);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(entry.length + 8, 4);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.concat([header, entry]));
  console.log('[icon] wrote', out, header.length + entry.length, 'bytes');
}

main();
