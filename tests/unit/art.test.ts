import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIRECTIONS, drawRider } from '../../art/rider.mjs';
import { palette } from '../../art/palettes.mjs';

describe('art pipeline', () => {
  it('draws every direction inside the cell with a resolvable palette', () => {
    for (const direction of Object.keys(DIRECTIONS)) {
      const sprite = drawRider({ direction, body: 'female' });
      const rgba = sprite.toRgba(palette('club', 'female'));
      const touchesEdge = sprite.material.some((material: string | null, i: number) => {
        const x = i % sprite.width;
        const y = Math.floor(i / sprite.width);
        return material !== null && (x === 0 || y === 0 || x === sprite.width - 1 || y === sprite.height - 1);
      });
      expect(touchesEdge, `${direction} is clipped`).toBe(false);
      expect(rgba.some((value: number) => value !== 0)).toBe(true);
    }
  });

  it('committed sheets match the source', () => {
    const dir = mkdtempSync(join(tmpdir(), 'art-'));
    execFileSync('node', ['art/build.mjs', dir]);
    const generated = readdirSync(dir).sort();
    expect(readdirSync('public/art').sort()).toEqual(generated);
    for (const file of generated) {
      expect(readFileSync(join('public/art', file)).equals(readFileSync(join(dir, file))), file).toBe(true);
    }
  });
});
