import { describe, expect, it } from 'vitest';
import { along, canvas, DECK, DECK_THICKNESS, project, RIDER_HEIGHT, route, routeGaps, structures } from '../../src/hero/scene.ts';

describe('course route', () => {
  it('is continuous from entry to exit', () => {
    expect(routeGaps()).toEqual([]);
  });

  it('never leaves the ground except on the stairs, hill, bridge and ramp', () => {
    const elevated = new Set(['stairs', 'summit', 'descent', 'bridge', 'ramp']);
    for (const segment of route) {
      const heights = segment.path.map((point) => point.h);
      if (!elevated.has(segment.id)) expect(heights.every((h) => h === 0), segment.id).toBe(true);
    }
  });

  it('passes under the deck with headroom and crosses it at deck height', () => {
    const under = route.find((segment) => segment.id === 'underpass')!;
    const { west, east } = structures.bridge;
    const crossing = under.path.some((point, i) => i > 0 && (under.path[i - 1].s - west.s) * (point.s - west.s) <= 0 && point.e > west.e && point.e < east.e);
    expect(crossing).toBe(true);
    expect(DECK - DECK_THICKNESS).toBeGreaterThanOrEqual(RIDER_HEIGHT + 4);
    const bridge = route.find((segment) => segment.id === 'bridge')!;
    expect(bridge.path.every((point) => point.h === DECK)).toBe(true);
  });

  it('keeps every marker inside the canvas', () => {
    for (const segment of route) {
      const { x, y } = project(along(segment.path, segment.marker));
      expect(x, segment.id).toBeGreaterThan(0);
      expect(x, segment.id).toBeLessThan(canvas.width);
      expect(y - RIDER_HEIGHT, segment.id).toBeGreaterThan(0);
      expect(y, segment.id).toBeLessThan(canvas.height);
    }
  });
});
