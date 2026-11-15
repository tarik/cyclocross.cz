import { describe, expect, it } from 'vitest';
import { along, canvas, DECK, DECK_THICKNESS, elevatedSegments, project, RIDER_HEIGHT, route, routeGaps, structures, underpasses } from '../../src/hero/scene.ts';

describe('course route', () => {
  it('is continuous from entry to exit', () => {
    expect(routeGaps()).toEqual([]);
  });

  it('never leaves the ground except on the stairs, hill and flyover', () => {
    for (const segment of route) {
      if (elevatedSegments.includes(segment.id)) continue;
      expect(segment.path.every((point) => point.h === 0), segment.id).toBe(true);
    }
  });

  it('passes under the flat top twice with headroom and crosses it at deck height', () => {
    const { topIn, topOut, width } = structures.flyover;
    for (const id of underpasses) {
      const [from, to] = route.find((segment) => segment.id === id)!.path;
      expect(from.s, id).toBe(to.s);
      // The flyover runs along e - s = constant, so the lane meets it here.
      const crossing = from.s + (topIn.e - topIn.s);
      expect(Math.min(from.e, to.e), id).toBeLessThan(crossing - width);
      expect(Math.max(from.e, to.e), id).toBeGreaterThan(crossing + width);
      // The whole lane width lies under the flat part, not under a ramp.
      expect(from.s - 7, id).toBeGreaterThan(topOut.s);
      expect(from.s + 7, id).toBeLessThan(topIn.s);
    }
    expect(DECK - DECK_THICKNESS).toBeGreaterThanOrEqual(RIDER_HEIGHT + 4);
    const top = route.find((segment) => segment.id === 'flyover-top')!;
    expect(top.path.every((point) => point.h === DECK)).toBe(true);
  });

  it('rides the flyover north-west and the downhill south-east', () => {
    const heading = (id: string) => {
      const { path } = route.find((segment) => segment.id === id)!;
      return { e: Math.sign(path[path.length - 1].e - path[0].e), s: Math.sign(path[path.length - 1].s - path[0].s) };
    };
    for (const id of ['flyover-up', 'flyover-top', 'flyover-down']) expect(heading(id), id).toEqual({ e: -1, s: -1 });
    expect(heading('stairs')).toEqual({ e: 1, s: -1 });
    expect(heading('downhill')).toEqual({ e: 1, s: 1 });
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
