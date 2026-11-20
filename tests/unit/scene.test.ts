import { describe, expect, it } from 'vitest';
import { along, canvas, drawDepth, FLYOVER_SPLIT_S, DECK, DECK_THICKNESS, elevatedSegments, hillHeight, project, RIDER_HEIGHT, route, routeGaps, structures, TRACK_WIDTH, underpasses } from '../../src/hero/scene.ts';

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

  it('passes under the flat top between the ramps, with headroom', () => {
    const { topIn, topOut, width } = structures.flyover;
    // The flyover runs along e - s = k; along it, u = e + s grows towards the ramp up.
    const k = topIn.e - topIn.s;
    const reach = width / Math.SQRT2;
    for (const id of underpasses) {
      const [from, to] = route.find((segment) => segment.id === id)!.path;
      expect(from.s, id).toBe(to.s);
      const half = TRACK_WIDTH / 2;
      // Every point of the lane band below the deck lies between the two ramps.
      const lowest = k - reach + 2 * (from.s - half);
      const highest = k + reach + 2 * (from.s + half);
      expect(lowest, id).toBeGreaterThan(topOut.e + topOut.s);
      expect(highest, id).toBeLessThan(topIn.e + topIn.s);
      expect(Math.min(from.e, to.e), id).toBeLessThan(from.s + k - reach);
      expect(Math.max(from.e, to.e), id).toBeGreaterThan(from.s + k + reach);
      // A rider under the flat top is drawn before the near half of the flyover.
      expect(drawDepth(id, along(route.find((segment) => segment.id === id)!.path, 0.5)), id).toBeLessThan(FLYOVER_SPLIT_S);
    }
    expect(DECK - DECK_THICKNESS).toBeGreaterThanOrEqual(RIDER_HEIGHT + 4);
    const top = route.find((segment) => segment.id === 'flyover-top')!;
    expect(top.path.every((point) => point.h === DECK)).toBe(true);
  });

  it('puts the stairs and the drop on the hill surface', () => {
    const { stairsFoot, stairsTop, dropTop, dropFoot } = structures.hill;
    for (const point of [stairsFoot, stairsTop, dropTop, dropFoot]) {
      expect(Math.abs(hillHeight(point.e, point.s) - point.h), `${point.e},${point.s}`).toBeLessThan(1);
    }
    // The ground lanes stay clear of the hill.
    for (const id of ['entry', 'barriers', 'underpass', 'dismount', 'return', 'to-pose', 'exit']) {
      for (const point of route.find((segment) => segment.id === id)!.path) {
        expect(hillHeight(point.e, point.s), id).toBeLessThan(1);
      }
    }
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

  it('turns left after the flyover instead of passing under it again', () => {
    const index = route.findIndex((segment) => segment.id === 'flyover-down');
    for (const segment of route.slice(index + 1)) {
      const { path } = segment;
      expect(path[path.length - 1].e, segment.id).toBeLessThanOrEqual(path[0].e);
    }
    expect(underpasses).toEqual(['underpass']);
  });

  it('runs the hill off the right edge with the whole descent on screen', () => {
    const { ridgeEnd } = structures.hill;
    expect(project(ridgeEnd).x).toBeGreaterThan(canvas.width);
    for (const point of route.find((segment) => segment.id === 'downhill')!.path) {
      expect(project(point).x).toBeLessThan(canvas.width - 20);
    }
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
