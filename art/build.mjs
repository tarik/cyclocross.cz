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
import { DIRECTIONS, drawRider } from './rider.mjs';
import { paintScene } from './scenery.mjs';
import { occluders } from '../src/hero/scene.ts';

const out = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'art');
mkdirSync(out, { recursive: true });

const meta = {};
/** Renders frames into one sheet, `columns` per row, and records its layout. */
function sheet(name, cell, frames, extra = {}) {
  const columns = extra.columns ?? frames.length;
  const rows = Math.ceil(frames.length / columns);
  const pixels = new Uint8Array(cell.width * columns * cell.height * rows * 4);
  frames.forEach((frame, index) => {
    const { body, kit, ...options } = frame;
    const sprite = drawRider({ body, design: kit, ...cell, ...options });
    blit(pixels, cell.width * columns, sprite.toRgba(palette(kit, body)), cell.width, cell.height, (index % columns) * cell.width, Math.floor(index / columns) * cell.height);
  });
  writeFileSync(join(out, name), encodePng(cell.width * columns, cell.height * rows, pixels));
  meta[name] = { cell: { width: cell.width, height: cell.height, anchor: cell.anchor }, frames: frames.length, columns, rows, ...extra };
}

const RIDE = { width: 76, height: 88, anchor: { x: 38, y: 71 } };
const STAND = { width: 36, height: 84, anchor: { x: 18, y: 78 } };
const BODY_ONLY = ['legs', 'torso', 'arms', 'head'];

for (const body of ['female', 'male']) {
  for (const kit of ['club', 'national']) {
    // Riding: side, front three-quarter, rear three-quarter, and the other side.
    sheet(`ride-${body}-${kit}.png`, RIDE, ['E', 'SE', 'NE', 'W'].map((direction) => ({ body, kit, direction })));
    // Standing off the bike: front, side, three-quarter, back.
    sheet(`stand-${body}-${kit}.png`, STAND, ['S', 'E', 'SE', 'N'].map((direction) => ({ body, kit, direction, stance: 'stand', parts: BODY_ONLY })));
  }
}

// The riding cycle: one row per direction, eight crank positions per row.
const CYCLE = 8;
for (const body of ['female', 'male']) {
  for (const kit of ['club', 'national']) {
    const directions = Object.keys(DIRECTIONS);
    sheet(`cycle-${body}-${kit}.png`, RIDE,
      directions.flatMap((direction) => Array.from({ length: CYCLE }, (_, i) => ({ body, kit, direction, crank: (i * 360) / CYCLE }))),
      { columns: CYCLE, directions });
  }
}

// Components, one per frame, so each can be discussed on its own.
for (const kit of ['club', 'national']) {
  const body = 'female';
  sheet(`parts-${kit}.png`, RIDE, [
    { body, kit, direction: 'E', parts: ['bike'] },
    { body, kit, direction: 'SE', parts: ['bike'] },
    { body, kit, direction: 'E', parts: BODY_ONLY },
    { body, kit, direction: 'E', parts: ['torso', 'arms'] },
    { body, kit, direction: 'S', parts: ['torso', 'arms'] },
    { body, kit, direction: 'E', parts: ['legs'] },
  ]);
  // Head and helmet at double scale, from four sides.
  const HEAD = { width: 44, height: 40, scale: 2.6 };
  sheet(`head-${kit}.png`, HEAD, ['E', 'SE', 'S', 'N'].flatMap((direction) =>
    ['female', 'male'].map((who) => ({ body: who, kit, direction, stance: 'stand', parts: ['head'], anchor: { x: 22, y: 141 } }))));
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

// The desktop scenery: a background and the occluder layers drawn between riders.
{
  const scene = paintScene();
  const layers = [{ id: 'back', file: 'scene-back.png' }];
  writeFileSync(join(out, 'scene-back.png'), encodePng(scene.width, scene.height, scene.back));
  for (const occluder of occluders) {
    const file = `scene-${occluder.id}.png`;
    writeFileSync(join(out, file), encodePng(scene.width, scene.height, scene[occluder.id]));
    layers.push({ id: occluder.id, file, s: occluder.s });
  }
  writeFileSync(join(out, 'scene.json'), `${JSON.stringify({ width: scene.width, height: scene.height, layers }, null, 2)}\n`);
}

writeFileSync(join(out, 'sheets.json'), `${JSON.stringify(meta, null, 2)}\n`);
console.log(`Wrote ${Object.keys(meta).length} sheets to ${out}`);
