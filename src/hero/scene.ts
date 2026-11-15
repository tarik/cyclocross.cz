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
export const canvas = { width: 720, height: 320 } as const;

/** The camera looks down by this angle; the same value is used to draw the sprites. */
export const pitchDegrees = 28;
const pitch = (pitchDegrees * Math.PI) / 180;
/** Screen position of the ground origin (e = 0, s = 0, h = 0). */
const origin = { x: 0, y: 150 };

export function project(point: Point): { x: number; y: number } {
  return {
    x: origin.x + point.e,
    y: origin.y + point.s * Math.sin(pitch) - point.h * Math.cos(pitch),
  };
}

const p = (e: number, s: number, h = 0): Point => ({ e, s, h });

/** A mounted rider is this tall in ground units, helmet included. */
export const RIDER_HEIGHT = 66;
export const DECK = 84; // top of the flyover
export const DECK_THICKNESS = 8; // the underside must clear a mounted rider
export const SUMMIT = 112;

export const structures = {
  /**
   * The flyover: a steep ramp up, a flat top and a steep ramp down, ridden
   * towards the north-west. Two lanes pass under the flat top: the entry
   * lane (south) and the way out (north).
   */
  flyover: { footIn: p(453, 203, 0), topIn: p(400, 150, DECK), topOut: p(341, 91, DECK), footOut: p(288, 38, 0), width: 26 },
  /** The hill on the right: stairs up its north-east face, a steep drop down the south-east face. */
  hill: { stairsFoot: p(500, 140, 0), stairsTop: p(570, 70, SUMMIT), dropTop: p(592, 72, SUMMIT), dropFoot: p(667, 147, 0), steps: 14 },
  barriers: [p(112, 140, 0), p(222, 140, 0)],
  poseArea: p(130, 104, 0),
};

export const route: Segment[] = [
  { id: 'entry', label: 'Entry', action: 'ride', facing: 'E', marker: 0.85, path: [p(-40, 140), p(60, 140)] },
  { id: 'barriers', label: 'Barriers', action: 'hop', facing: 'E', marker: 0.85, path: [p(60, 140), p(262, 140)] },
  { id: 'underpass', label: 'Under the flyover', action: 'ride', facing: 'E', marker: 0.45, path: [p(262, 140), p(420, 140)] },
  { id: 'dismount', label: 'Dismount', action: 'dismount', facing: 'E', marker: 0.6, path: [p(420, 140), p(500, 140)] },
  { id: 'stairs', label: 'Stairs', action: 'run', facing: 'NE', marker: 0.5, path: [p(500, 140), p(570, 70, SUMMIT)] },
  { id: 'summit', label: 'Summit', action: 'remount', facing: 'SE', marker: 0.5, path: [p(570, 70, SUMMIT), p(592, 72, SUMMIT)] },
  { id: 'downhill', label: 'Steep downhill', action: 'ride', facing: 'SE', marker: 0.55, path: [p(592, 72, SUMMIT), p(667, 147, 0)] },
  { id: 'return', label: 'Back to the flyover', action: 'ride', facing: 'W', marker: 0.72, path: [p(667, 147), p(692, 172), p(676, 198), p(620, 203), p(453, 203)] },
  { id: 'flyover-up', label: 'Flyover, steep up', action: 'ride', facing: 'NW', marker: 0.5, path: [p(453, 203), p(400, 150, DECK)] },
  { id: 'flyover-top', label: 'Flyover, flat top', action: 'ride', facing: 'NW', marker: 0.5, path: [p(400, 150, DECK), p(341, 91, DECK)] },
  { id: 'flyover-down', label: 'Flyover, steep down', action: 'ride', facing: 'NW', marker: 0.6, path: [p(341, 91, DECK), p(288, 38, 0)] },
  { id: 'loop', label: 'Round the end of the flyover', action: 'ride', facing: 'E', marker: 0.25, path: [p(288, 38), p(272, 22), p(290, 6), p(340, 10), p(396, 50), p(420, 90), p(404, 104)] },
  { id: 'under-return', label: 'Under the flyover again', action: 'ride', facing: 'W', marker: 0.32, path: [p(404, 104), p(250, 104)] },
  { id: 'to-pose', label: 'To the pose area', action: 'ride', facing: 'W', marker: 0.6, path: [p(250, 104), p(130, 104)] },
  { id: 'pose', label: 'Pose and idle', action: 'pose', facing: 'S', marker: 0, path: [p(130, 104), p(130, 104)] },
  { id: 'exit', label: 'Exit', action: 'ride', facing: 'W', marker: 0.6, path: [p(130, 104), p(-60, 104)] },
];

/** The two lanes that pass under the flat top of the flyover. */
export const underpasses = ['underpass', 'under-return'];

/** Segments that are allowed to leave the ground. */
export const elevatedSegments = ['stairs', 'summit', 'downhill', 'flyover-up', 'flyover-top', 'flyover-down'];

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
