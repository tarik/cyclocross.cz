import { describe, expect, it } from 'vitest';
import { FENCES, FLAGS, TAPES } from '../../art/scenery.mjs';
import { route, TRACK_WIDTH, type Point } from '../../src/hero/scene.ts';

interface Ground { e: number; s: number }

/** Plan distance from a point to the centre line of the route. */
function distanceToRoute(point: Ground): { distance: number; segment: string } {
  let best = { distance: Infinity, segment: '' };
  for (const segment of route) {
    for (let i = 0; i + 1 < segment.path.length; i += 1) {
      const a: Point = segment.path[i];
      const b: Point = segment.path[i + 1];
      const de = b.e - a.e;
      const ds = b.s - a.s;
      const t = Math.max(0, Math.min(1, ((point.e - a.e) * de + (point.s - a.s) * ds) / (de * de + ds * ds || 1)));
      const distance = Math.hypot(point.e - (a.e + de * t), point.s - (a.s + ds * t));
      if (distance < best.distance) best = { distance, segment: segment.id };
    }
  }
  return best;
}

/** Points every two units along a line of furniture. */
function alongLine(from: Ground, to: Ground): Ground[] {
  const n = Math.ceil(Math.hypot(to.e - from.e, to.s - from.s) / 2);
  return Array.from({ length: n + 1 }, (_, i) => ({ e: from.e + ((to.e - from.e) * i) / n, s: from.s + ((to.s - from.s) * i) / n }));
}

describe('course furniture', () => {
  const clear = TRACK_WIDTH / 2 + 1;

  it('keeps the flags off the track', () => {
    for (const flag of FLAGS) {
      const { distance, segment } = distanceToRoute(flag);
      expect(distance, `flag at ${flag.e},${flag.s} is on ${segment}`).toBeGreaterThan(clear);
    }
  });

  it('keeps the banner fences and the tape beside the track', () => {
    for (const line of [...FENCES, ...TAPES]) {
      for (const point of alongLine(line.from, line.to)) {
        const { distance, segment } = distanceToRoute(point);
        expect(distance, `furniture at ${point.e.toFixed(0)},${point.s.toFixed(0)} is on ${segment}`).toBeGreaterThan(clear);
      }
    }
  });
});
