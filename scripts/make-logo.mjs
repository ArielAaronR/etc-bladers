// Prepares the logo for the page: keys a black background to transparency (if the
// source has none), trims the empty margin and writes public/logo.png, which the 3D
// scene and the flat fallback both use. Usage:
//   node scripts/make-logo.mjs [path/to/source.png]   (default: public/ETCLOGO.png)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const src = process.argv[2] ?? fileURLToPath(new URL('../public/ETCLOGO.png', import.meta.url));
const out = fileURLToPath(new URL('../public/logo.png', import.meta.url));

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

// If the source already has meaningful transparency, keep it as-is.
let transparent = 0;
for (let i = 3; i < data.length; i += 4) if (data[i] < 250) transparent++;
const alreadyTransparent = transparent > data.length / 4 / 20;

if (!alreadyTransparent) {
  // Black-key: alpha = brightest channel, then un-premultiply the color.
  for (let i = 0; i < data.length; i += 4) {
    const a = Math.max(data[i], data[i + 1], data[i + 2]);
    if (a === 0) {
      data[i + 3] = 0;
      continue;
    }
    data[i] = Math.round((data[i] * 255) / a);
    data[i + 1] = Math.round((data[i + 1] * 255) / a);
    data[i + 2] = Math.round((data[i + 2] * 255) / a);
    data[i + 3] = a;
  }
}

const trimmed = await sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer();
const result = await sharp(trimmed)
  .resize({ width: 1600, withoutEnlargement: true })
  .png({ compressionLevel: 9 })
  .toFile(out);
console.log(`${alreadyTransparent ? 'Trimmed' : 'Keyed and trimmed'} logo → ${out} (${result.width}×${result.height})`);
