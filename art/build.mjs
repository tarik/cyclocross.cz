/**
 * Exports the sprite sheets from the model. Usage: node art/build.mjs
 * Output: public/art/*.png plus public/art/sheets.json with frame rectangles.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './lib/png.mjs';
import { Sprite, blit } from './lib/raster.mjs';
import { palette } from './palettes.mjs';
import { drawRider } from './rider.mjs';

const out = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
mkdirSync(out, { recursive: true });

const CELL = { width: 76, height: 78 };
const views = ['E', 'SE', 'NE'];
const meta = {};
for (const body of ['female', 'male']) {
  for (const kit of ['club', 'national']) {
    const sheet = new Uint8Array(CELL.width * views.length * CELL.height * 4);
    views.forEach((direction, index) => {
      const sprite = drawRider({ direction, body, ...CELL });
      blit(sheet, CELL.width * views.length, sprite.toRgba(palette(kit, body)), CELL.width, CELL.height, index * CELL.width, 0);
    });
    const name = `proposal-${body}-${kit}.png`;
    writeFileSync(join(out, name), encodePng(CELL.width * views.length, CELL.height, sheet));
    meta[name] = { cell: CELL, views };
  }
}

// Wordmark proposal: a small wheel that can sit beside the name.
{
  const size = 23;
  const wheel = new Sprite(size, size);
  const c = { x: size / 2, y: size / 2, z: 0 };
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    wheel.capsule(c, { x: c.x + Math.cos(a) * 8, y: c.y + Math.sin(a) * 8, z: 0 }, 0.4, 0.4, 'spoke', 1, { flat: true });
  }
  for (let i = 0; i < 48; i += 1) {
    const a0 = (i / 48) * Math.PI * 2;
    const a1 = ((i + 1) / 48) * Math.PI * 2;
    const at = (a, r) => ({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, z: 1 });
    wheel.capsule(at(a0, 9.4), at(a1, 9.4), 1.3, 1.3, 'tyre', 2, { flat: true });
  }
  wheel.sphere({ ...c, z: 2 }, 1.6, 'jersey', 3, { flat: true });
  writeFileSync(join(out, 'mark-wheel.png'), encodePng(size, size, wheel.toRgba(palette('club', 'female'))));
}

writeFileSync(join(out, 'sheets.json'), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`Wrote ${Object.keys(meta).length} sheets to ${out}`);
