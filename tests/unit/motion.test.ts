import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { choreography } from '../../src/hero/choreography.ts';
import { FLYOVER_SPLIT_S, route, structures } from '../../src/hero/scene.ts';
import { cellFor, coverageProblems, type Sheets } from '../../src/hero/sprites.ts';
import { buildTimeline, posterTime, riderFor, sample, validate, type RiderState } from '../../src/hero/timeline.ts';

const sheets = JSON.parse(readFileSync('public/art/sheets.json', 'utf8')) as Sheets;
const FACINGS = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const STEP = 1 / 30;

/** Every state of one loop at 30 frames a second. */
function states(seed = 1): RiderState[] {
  const timeline = buildTimeline(seed);
  const out: RiderState[] = [];
  for (let t = 0; t < timeline.duration; t += STEP) out.push(sample(timeline, t)!);
  return out;
}

describe('motion sequencer', () => {
  it('validates the shipped choreography', () => {
    expect(() => validate()).not.toThrow();
  });

  it('rejects unknown actions, missing speeds and impossible ranges', () => {
    const odd = route.map((segment) => (segment.id === 'entry' ? { ...segment, action: 'cartwheel' as never } : segment));
    expect(() => validate(choreography, odd)).toThrow(/unknown action/);
    const { entry: _, ...speeds } = choreography.speeds;
    expect(() => validate({ ...choreography, speeds })).toThrow(/entry: no speed/);
    expect(() => validate({ ...choreography, pose: { ...choreography.pose, total: [20, 12] } })).toThrow(/reversed/);
  });

  it('crosses the course in 18 to 30 seconds and poses for 12 to 20', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const timeline = buildTimeline(seed);
      expect(timeline.traversal).toBeGreaterThanOrEqual(18);
      expect(timeline.traversal).toBeLessThanOrEqual(30);
      expect(timeline.pose).toBeGreaterThanOrEqual(12);
      expect(timeline.pose).toBeLessThanOrEqual(20);
      expect(timeline.waves.length).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic for a seed', () => {
    expect(buildTimeline(7)).toEqual(buildTimeline(7));
    expect(riderFor(7, 0)).toBe(riderFor(7, 0));
    expect(riderFor(7, 1)).not.toBe(riderFor(7, 0));
  });

  it('never teleports', () => {
    const fastest = Math.max(...Object.values(choreography.speeds).flat());
    const all = states();
    for (let i = 1; i < all.length; i += 1) {
      const a = all[i - 1].ground;
      const b = all[i].ground;
      expect(Math.hypot(b.e - a.e, b.s - a.s, b.h - a.h), `${all[i].segment} at ${all[i].time.toFixed(2)} s`).toBeLessThanOrEqual(fastest * STEP + 0.01);
    }
  });

  it('turns one direction at a time', () => {
    const all = states();
    for (let i = 1; i < all.length; i += 1) {
      const raw = Math.abs(FACINGS.indexOf(all[i].facing) - FACINGS.indexOf(all[i - 1].facing));
      expect(Math.min(raw, 8 - raw), `${all[i - 1].facing} to ${all[i].facing} at ${all[i].time.toFixed(2)} s`).toBeLessThanOrEqual(1);
    }
  });

  it('only asks for frames the sheets have, for both riders and kits', () => {
    expect(coverageProblems(sheets, choreography)).toEqual([]);
    for (const state of states()) {
      for (const body of ['female', 'male'] as const) {
        for (const kit of ['club', 'national'] as const) expect(() => cellFor(sheets, state, body, kit)).not.toThrow();
      }
    }
  });

  it('clears the barriers: front wheel in the front-up frame, rear wheel in the rear-up frame', () => {
    const all = states();
    const FRONT = 17;
    const REAR = -13.5;
    const BARRIER = 16;
    for (const barrier of structures.barriers) {
      const front = all.find((state) => state.ground.e + FRONT >= barrier.e)!;
      const rear = all.find((state) => state.ground.e + REAR >= barrier.e)!;
      expect(front.move).toBe('hop');
      expect(front.frame).toBe(1);
      expect(rear.frame).toBe(3);
      // The pitched frames raise the leading or trailing wheel further.
      expect(front.lift).toBeGreaterThan(BARRIER - 30.5 * Math.sin((15 * Math.PI) / 180));
      expect(rear.lift).toBeGreaterThan(BARRIER - 30.5 * Math.sin((9 * Math.PI) / 180));
    }
  });

  it('draws the rider behind the near half of the flyover underneath it and in front of it on the deck', () => {
    for (const state of states()) {
      if (state.segment === 'underpass') expect(state.depth).toBeLessThan(FLYOVER_SPLIT_S);
      if (state.segment.startsWith('flyover')) expect(state.depth).toBeGreaterThan(FLYOVER_SPLIT_S);
    }
  });

  it('stops, turns to face the viewer and turns back before leaving', () => {
    const pose = states().filter((state) => state.segment === 'pose');
    const facings = pose.map((state) => state.facing).filter((facing, i, list) => facing !== list[i - 1]);
    expect(facings).toEqual(['W', 'SW', 'S', 'SW', 'W']);
  });

  it('holds a still frame of the rider facing the viewer for reduced motion', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const timeline = buildTimeline(seed);
      const still = sample(timeline, posterTime(timeline))!;
      expect(still.segment).toBe('pose');
      expect(still.facing).toBe('S');
      expect(still.move).toBe('straddle');
    }
  });
});
