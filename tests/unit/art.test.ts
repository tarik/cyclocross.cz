import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIRECTIONS, drawRider, PITCH_DEGREES } from '../../art/rider.mjs';
import { pitchDegrees } from '../../src/hero/scene.ts';
import { palette } from '../../art/palettes.mjs';
import { ACTION_ROWS, actionFrames } from '../../art/poses.mjs';

describe('art pipeline', () => {
  it('draws sprites with the camera pitch of the scene', () => {
    expect(PITCH_DEGREES).toBe(pitchDegrees);
  });

  it('draws every direction inside the cell with a resolvable palette', () => {
    for (const direction of Object.keys(DIRECTIONS)) for (const crank of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const sprite = drawRider({ direction, body: 'male', crank, width: 76, height: 88, anchor: { x: 38, y: 71 } });
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

  it('draws every action frame inside the cell, for both bodies', () => {
    for (const body of ['female', 'male']) {
      for (const row of ACTION_ROWS) {
        actionFrames(row, body).forEach((posed: { crank: number }, i: number) => {
          const sprite = drawRider({ direction: row.direction, body, width: 76, height: 88, anchor: { x: 38, y: 71 }, posed, crank: posed.crank });
          const touchesEdge = sprite.material.some((material: string | null, k: number) => {
            const x = k % sprite.width;
            const y = Math.floor(k / sprite.width);
            return material !== null && (x === 0 || y === 0 || x === sprite.width - 1 || y === sprite.height - 1);
          });
          expect(touchesEdge, `${body} ${row.action} ${row.direction} frame ${i} is clipped`).toBe(false);
        });
      }
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
    // Rebuilding every sheet and scene takes a few seconds, more on a busy runner.
  }, 30_000);
});
