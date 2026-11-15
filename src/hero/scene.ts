/**
 * The desktop course as data: one projection, the structures and the route.
 * Positions are ground coordinates in art pixels: `e` east (screen right),
 * `s` south (towards the viewer) and `h` height above the ground. This is a
 * proposal for the owner's route approval (SPEC.md section 5.2); the
 * animation controller will read the same data.
 */
export interface Point {
  e: number;
  s: number;
  h: number;
}

export type Facing = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type Action = 'ride' | 'hop' | 'dismount' | 'run' | 'remount' | 'pose';

export interface Segment {
  id: string;
  label: string;
  action: Action;
  facing: Facing;
  /** Where the rider is drawn in the route drawing: 0 start, 1 end of the path. */
  marker: number;
  path: Point[];
}

/** Design canvas of the desktop scene, in art pixels. Shown at two screen pixels per art pixel. */
export const canvas = { width: 720, height: 300 } as const;

/** The camera looks down by this angle; the same value is used to draw the sprites. */
export const pitchDegrees = 18;
const pitch = (pitchDegrees * Math.PI) / 180;
/** Screen position of the ground origin (e = 0, s = 0, h = 0). */
const origin = { x: 0, y: 188 };

export function project(point: Point): { x: number; y: number } {
  return {
    x: origin.x + point.e,
    y: origin.y + point.s * Math.sin(pitch) - point.h * Math.cos(pitch),
  };
}

const p = (e: number, s: number, h = 0): Point => ({ e, s, h });

/** A mounted rider is this tall in ground units, helmet included. */
export const RIDER_HEIGHT = 66;
export const DECK = 84; // top of the bridge deck
export const DECK_THICKNESS = 8; // the underside must clear a mounted rider
export const SUMMIT = 112;

export const structures = {
  /** The flyover: a level deck with a ramp down at its west end. */
  bridge: { west: p(250, 80, DECK), east: p(500, 80, DECK), width: 26, rampFoot: p(100, 92, 0), pillars: [256, 330, 440, 494] },
  /** The hill on the right, reached by stairs and left by a descent onto the deck. */
  hill: { summit: p(655, -6, SUMMIT), stairsFoot: p(560, 44, 0), stairsTop: p(632, -8, SUMMIT), steps: 14 },
  barriers: [p(112, 150, 0), p(222, 150, 0)],
  poseArea: p(300, 176, 0),
};

export const route: Segment[] = [
  { id: 'entry', label: 'Entry', action: 'ride', facing: 'E', marker: 0.85, path: [p(-40, 150), p(60, 150)] },
  { id: 'barriers', label: 'Barriers', action: 'hop', facing: 'E', marker: 0.62, path: [p(60, 150), p(262, 150)] },
  { id: 'underpass', label: 'Underpass', action: 'ride', facing: 'NE', marker: 0.8, path: [p(262, 150), p(336, 140), p(380, 104), p(396, 52), p(430, 34)] },
  { id: 'dismount', label: 'Dismount', action: 'dismount', facing: 'E', marker: 0.8, path: [p(430, 34), p(560, 44)] },
  { id: 'stairs', label: 'Stairs', action: 'run', facing: 'NE', marker: 0.5, path: [p(560, 44), p(632, -8, SUMMIT)] },
  { id: 'summit', label: 'Summit', action: 'remount', facing: 'S', marker: 0.6, path: [p(632, -8, SUMMIT), p(655, -6, SUMMIT), p(662, 8, SUMMIT)] },
  { id: 'descent', label: 'Descent', action: 'ride', facing: 'SW', marker: 0.5, path: [p(662, 8, SUMMIT), p(600, 58, 96), p(500, 80, DECK)] },
  { id: 'bridge', label: 'Bridge', action: 'ride', facing: 'W', marker: 0.45, path: [p(500, 80, DECK), p(250, 80, DECK)] },
  { id: 'ramp', label: 'Ramp', action: 'ride', facing: 'W', marker: 0.5, path: [p(250, 80, DECK), p(100, 92, 0)] },
  { id: 'turn', label: 'To the pose area', action: 'ride', facing: 'SE', marker: 0.2, path: [p(100, 92), p(70, 120), p(96, 162), p(300, 176)] },
  { id: 'pose', label: 'Pose and idle', action: 'pose', facing: 'S', marker: 0, path: [p(300, 176), p(300, 176)] },
  { id: 'exit', label: 'Exit', action: 'ride', facing: 'E', marker: 0.75, path: [p(300, 176), p(760, 176)] },
];

/** A point part of the way along a polyline, by length. */
export function along(path: Point[], t: number): Point {
  const lengths = path.slice(1).map((point, i) => Math.hypot(point.e - path[i].e, point.s - path[i].s, point.h - path[i].h));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total === 0) return path[0];
  let remaining = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    if (remaining <= lengths[i]) {
      const k = lengths[i] === 0 ? 0 : remaining / lengths[i];
      const a = path[i];
      const b = path[i + 1];
      return { e: a.e + (b.e - a.e) * k, s: a.s + (b.s - a.s) * k, h: a.h + (b.h - a.h) * k };
    }
    remaining -= lengths[i];
  }
  return path[path.length - 1];
}

/** Each segment starts where the previous one ends: no hidden teleports. */
export function routeGaps(segments: Segment[] = route): string[] {
  const gaps: string[] = [];
  for (let i = 1; i < segments.length; i += 1) {
    const end = segments[i - 1].path[segments[i - 1].path.length - 1];
    const start = segments[i].path[0];
    if (end.e !== start.e || end.s !== start.s || end.h !== start.h) gaps.push(`${segments[i - 1].id} -> ${segments[i].id}`);
  }
  return gaps;
}
