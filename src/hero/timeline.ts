/**
 * The action sequencer: turns the route (`scene.ts`) and the choreography
 * into one loop of motion, and answers "where is the rider, doing what, at
 * time t". Pure and deterministic: the same seed gives the same loop, so
 * review and tests can step through it frame by frame.
 */
import { drawDepth, route as defaultRoute, structures, type Facing, type Point, type Segment } from './scene.ts';
import { choreography as defaults, type Choreography, type Move } from './choreography.ts';

export interface RiderState {
  /** Seconds since the rider entered. */
  time: number;
  segment: string;
  move: Move;
  facing: Facing;
  /** Frame within the action row, or the crank frame (0-7) for riding. */
  frame: number;
  /** The anchor on the surface the rider is on (ground, stairs, hill or deck). */
  ground: Point;
  /** Height above that surface, for hops. */
  lift: number;
  /** Draw depth against the scenery's occluder layers. */
  depth: number;
}

interface MoveLeg {
  kind: 'move';
  segment: Segment;
  start: number;
  duration: number;
  length: number;
  v0: number;
  v1: number;
  /** Route distance at the start of the leg. */
  offset: number;
}

interface PoseLeg {
  kind: 'pose';
  segment: Segment;
  start: number;
  duration: number;
  offset: number;
  waves: number[];
}

type Leg = MoveLeg | PoseLeg;

export interface Timeline {
  legs: Leg[];
  /** From entry to leaving the scene. */
  duration: number;
  /** From entry to stopping at the pose area. */
  traversal: number;
  pose: number;
  waves: number[];
  config: Choreography;
  /** The whole route as one path, for facing along it. */
  path: Point[];
}

const FACINGS: Facing[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const KNOWN_ACTIONS = ['ride', 'hop', 'dismount', 'run', 'remount', 'pose'];

/** A small seeded generator (mulberry32). */
export function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const length3 = (a: Point, b: Point) => Math.hypot(b.e - a.e, b.s - a.s, b.h - a.h);
const pathLength = (path: Point[]) => path.slice(1).reduce((sum, point, i) => sum + length3(path[i], point), 0);

/** The point at a distance along a path (3D length). */
function pointAlong(path: Point[], distance: number): Point {
  let remaining = Math.max(0, distance);
  for (let i = 0; i + 1 < path.length; i += 1) {
    const step = length3(path[i], path[i + 1]);
    if (remaining <= step && step > 0) {
      const k = remaining / step;
      const a = path[i];
      const b = path[i + 1];
      return { e: a.e + (b.e - a.e) * k, s: a.s + (b.s - a.s) * k, h: a.h + (b.h - a.h) * k };
    }
    remaining -= step;
  }
  return path[path.length - 1];
}

/** Throws on anything the controller cannot play: unknown actions, missing speeds, impossible ranges. */
export function validate(config: Choreography = defaults, segments: Segment[] = defaultRoute): void {
  const problems: string[] = [];
  for (const segment of segments) {
    if (!KNOWN_ACTIONS.includes(segment.action)) problems.push(`${segment.id}: unknown action "${segment.action}"`);
    if (segment.action === 'pose') continue;
    const speed = config.speeds[segment.id];
    if (!speed) problems.push(`${segment.id}: no speed`);
    else if (speed[0] < 0 || speed[1] < 0 || speed[0] + speed[1] <= 0) problems.push(`${segment.id}: impossible speed ${speed.join(' -> ')}`);
  }
  for (const id of Object.keys(config.speeds)) {
    if (!segments.some((segment) => segment.id === id)) problems.push(`speed for unknown segment "${id}"`);
  }
  const { pose, hop } = config;
  if (pose.total[0] > pose.total[1] || pose.waves[0] > pose.waves[1]) problems.push('pose ranges are reversed');
  const overhead = 2 * pose.stop + 4 * pose.turnStep;
  if (pose.total[0] < overhead + pose.waves[1] * pose.waveDuration) problems.push('the shortest pose cannot hold its turns and waves');
  if (hop.before <= 0 || hop.after <= 0 || hop.height <= 0) problems.push('hop window must be positive');
  for (const [move, directions] of Object.entries(config.coverage)) {
    if (directions.length === 0) problems.push(`${move}: no directions`);
    for (const direction of directions) if (!FACINGS.includes(direction)) problems.push(`${move}: unknown direction ${direction}`);
  }
  if (problems.length > 0) throw new Error(`Invalid choreography:\n${problems.join('\n')}`);
}

/** One loop of motion. The seed decides the length of the pose and when the rider waves. */
export function buildTimeline(seed = 1, config: Choreography = defaults, segments: Segment[] = defaultRoute): Timeline {
  validate(config, segments);
  const rng = random(seed);
  const legs: Leg[] = [];
  let start = 0;
  let offset = 0;
  let traversal = 0;
  let pose = 0;
  let waves: number[] = [];
  for (const segment of segments) {
    if (segment.action === 'pose') {
      const p = config.pose;
      pose = p.total[0] + rng() * (p.total[1] - p.total[0]);
      const count = p.waves[0] + Math.floor(rng() * (p.waves[1] - p.waves[0] + 1));
      // Waves spread over the idle part, each nudged a little.
      const idleStart = p.stop + 2 * p.turnStep;
      const idle = pose - 2 * (p.stop + 2 * p.turnStep);
      waves = Array.from({ length: count }, (_, k) => {
        const centre = idleStart + ((k + 1) * idle) / (count + 1);
        const jitter = (rng() - 0.5) * Math.min(2, idle / (count + 1) - p.waveDuration);
        return Math.max(idleStart, Math.min(idleStart + idle - p.waveDuration, centre - p.waveDuration / 2 + jitter));
      });
      traversal = start;
      legs.push({ kind: 'pose', segment, start, duration: pose, offset, waves });
      start += pose;
      continue;
    }
    const length = pathLength(segment.path);
    const [v0, v1] = config.speeds[segment.id];
    const duration = (2 * length) / (v0 + v1);
    legs.push({ kind: 'move', segment, start, duration, length, v0, v1, offset });
    start += duration;
    offset += length;
  }
  const path = segments.flatMap((segment, i) => (i === 0 ? segment.path : segment.path.slice(1)));
  return { legs, duration: start, traversal, pose, waves, config, path };
}

/** Facing from the direction of travel, over a short chord so turns step through the directions in between. */
function facingAt(path: Point[], distance: number): Facing {
  const a = pointAlong(path, distance - 8);
  const b = pointAlong(path, distance + 8);
  const angle = Math.atan2(b.s - a.s, b.e - a.e);
  const index = ((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8;
  return FACINGS[index];
}

/** The nearest direction an action is drawn in. */
function nearest(facing: Facing, allowed: Facing[]): Facing {
  if (allowed.includes(facing)) return facing;
  const index = FACINGS.indexOf(facing);
  let best = allowed[0];
  let bestDistance = 9;
  for (const option of allowed) {
    const raw = Math.abs(FACINGS.indexOf(option) - index);
    const distance = Math.min(raw, 8 - raw);
    if (distance < bestDistance) [best, bestDistance] = [option, distance];
  }
  return best;
}

/** Bunny hop phase: preload, front up, level, rear up, land, ride on. */
function hopFrame(u: number): number {
  return u < 0.12 ? 0 : u < 0.34 ? 1 : u < 0.6 ? 2 : u < 0.84 ? 3 : u < 0.95 ? 4 : 5;
}

function poseState(leg: PoseLeg, t: number, config: Choreography): { move: Move; facing: Facing; frame: number } {
  const p = config.pose;
  const end = leg.duration;
  // Stop with a foot down, turn to face the viewer, idle, turn back, set off.
  if (t < p.stop) return { move: 'straddle', facing: 'W', frame: 0 };
  if (t < p.stop + p.turnStep) return { move: 'straddle', facing: 'SW', frame: 1 };
  if (t >= end - p.stop) return { move: 'straddle', facing: 'W', frame: 0 };
  if (t >= end - p.stop - p.turnStep) return { move: 'straddle', facing: 'W', frame: 1 };
  if (t >= end - p.stop - 2 * p.turnStep) return { move: 'straddle', facing: 'SW', frame: 1 };
  if (t < p.stop + 2 * p.turnStep) return { move: 'straddle', facing: 'S', frame: 1 };
  for (const at of leg.waves) {
    const w = t - at;
    if (w >= 0 && w < p.waveDuration) {
      const frame = w < 0.25 || w > p.waveDuration - 0.25 ? 0 : [1, 2, 3, 2][Math.floor((w - 0.25) / 0.16) % 4];
      return { move: 'wave', facing: 'S', frame };
    }
  }
  const idleStart = p.stop + 2 * p.turnStep;
  const idle = end - 2 * idleStart;
  const k = (t - idleStart) / idle;
  if (k > 0.46 && k < 0.54) return { move: 'straddle', facing: 'S', frame: 3 };
  return { move: 'straddle', facing: 'S', frame: Math.floor((t - idleStart) / (p.breath / 2)) % 2 === 0 ? 1 : 2 };
}

/** Where the rider is and what they are doing at time t, or null once they have left. */
export function sample(timeline: Timeline, time: number): RiderState | null {
  const { legs, config } = timeline;
  if (time < 0 || time >= timeline.duration) return null;
  const leg = legs.find((candidate) => time < candidate.start + candidate.duration) ?? legs[legs.length - 1];
  const t = time - leg.start;
  const segment = leg.segment;
  if (leg.kind === 'pose') {
    const ground = segment.path[0];
    const state = poseState(leg, t, config);
    return { time, segment: segment.id, ...state, ground, lift: 0, depth: drawDepth(segment.id, ground) };
  }
  const { v0, v1, duration, length } = leg;
  const d = Math.min(length, v0 * t + ((v1 - v0) * t * t) / (2 * duration));
  const u = length === 0 ? 1 : d / length;
  const speed = v0 + ((v1 - v0) * t) / duration;
  const ground = pointAlong(segment.path, d);
  const along = leg.offset + d;
  let facing = facingAt(timeline.path, along);
  let move: Move = 'ride';
  let frame = 0;
  let lift = 0;
  const pedalling = Math.floor((along / config.crankDistance) * 8) % 8;
  switch (segment.action) {
    case 'hop': {
      move = 'ride';
      frame = pedalling;
      const { before, after, height } = config.hop;
      for (const barrier of structures.barriers) {
        const k = (ground.e - (barrier.e - before)) / (before + after);
        if (k >= 0 && k <= 1) {
          move = 'hop';
          frame = hopFrame(k);
          lift = height * Math.sin(Math.PI * Math.max(0, Math.min(1, (k - 0.1) / 0.8)));
        }
      }
      break;
    }
    case 'dismount':
      move = 'dismount';
      frame = Math.min(5, Math.floor(u * 6));
      break;
    case 'run':
      move = 'carry';
      frame = Math.floor((d / config.strideDistance) * 6) % 6;
      break;
    case 'remount':
      move = 'remount';
      frame = Math.min(4, Math.floor(u * 5));
      break;
    default: {
      const slowing = v1 < v0 && speed < 34;
      move = config.coast.includes(segment.id) || slowing ? 'coast' : 'ride';
      frame = move === 'coast' ? 0 : pedalling;
    }
  }
  facing = nearest(facing, config.coverage[move]);
  return { time, segment: segment.id, move, facing, frame, ground, lift, depth: drawDepth(segment.id, ground) };
}

/** The rider for each loop: chosen once per visit, then alternating. */
export function riderFor(seed: number, loop: number): 'female' | 'male' {
  const first = random(seed ^ 0x9e3779b9)() < 0.5 ? 'female' : 'male';
  return loop % 2 === 0 ? first : first === 'female' ? 'male' : 'female';
}

/** Start time of each route segment, for jumping to it in review. */
/**
 * The still frame shown when the animation does not play on its own: the
 * rider stopped at the pose area, facing the viewer.
 */
export function posterTime(timeline: Timeline): number {
  const leg = timeline.legs.find((candidate) => candidate.kind === 'pose');
  if (!leg) return 0;
  const { stop, turnStep } = timeline.config.pose;
  return leg.start + stop + 2 * turnStep + 0.5;
}

export function segmentStarts(timeline: Timeline): { id: string; label: string; start: number }[] {
  return timeline.legs.map((leg) => ({ id: leg.segment.id, label: leg.segment.label, start: leg.start }));
}
