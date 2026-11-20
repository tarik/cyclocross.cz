/**
 * How the rider moves along the approved route (SPEC.md 5.2, 5.4 and 5.5):
 * speeds, the hop windows, the pose and idle timing and the action coverage.
 * Data only; `timeline.ts` turns it into motion and validates it.
 */
import type { Facing } from './scene.ts';

/** What the sprite shows. `ride` and `coast` come from the riding cycle sheets; the rest from the action sheets. */
export type Move = 'ride' | 'coast' | 'hop' | 'dismount' | 'carry' | 'remount' | 'straddle' | 'wave';

export interface Choreography {
  /** Speed at the start and end of each route segment, in ground units per second, measured along the path (height included). */
  speeds: Record<string, [number, number]>;
  /** Segments ridden with level pedals, freewheeling. */
  coast: string[];
  /** Ground distance per crank turn while pedalling, and per stride pair while running. */
  crankDistance: number;
  strideDistance: number;
  /** Bunny hops: the window around each barrier (from `before` units ahead to `after` past it) and the peak lift. */
  hop: { before: number; after: number; height: number };
  pose: {
    /** Putting a foot down, and each 45 degree turn while standing astride. */
    stop: number;
    turnStep: number;
    /** Range of the whole pose, from stopping to setting off, the number of waves and how long a wave lasts, in seconds. */
    total: [number, number];
    waves: [number, number];
    waveDuration: number;
    /** One breath, in and out. */
    breath: number;
  };
  /** The empty scene between one rider's exit and the next arrival. */
  gap: number;
  /** Directions each action is drawn in (the coverage matrix of SPEC.md 5.3). */
  coverage: Record<Move, Facing[]>;
}

const ALL: Facing[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

export const choreography: Choreography = {
  speeds: {
    entry: [72, 72],
    barriers: [72, 72],
    underpass: [72, 72],
    dismount: [72, 40],
    stairs: [34, 30],
    summit: [30, 44],
    downhill: [44, 104],
    return: [96, 70],
    'flyover-up': [70, 44],
    'flyover-top': [44, 58],
    'flyover-down': [58, 86],
    'to-pose': [86, 0],
    exit: [0, 72],
  },
  coast: ['downhill', 'flyover-down'],
  crankDistance: 30,
  strideDistance: 20,
  hop: { before: 34, after: 30.5, height: 28 },
  pose: { stop: 0.5, turnStep: 0.45, total: [12, 20], waves: [0, 2], waveDuration: 2, breath: 1.6 },
  gap: 1.2,
  coverage: {
    ride: ALL,
    coast: ALL,
    hop: ['E'],
    dismount: ['E'],
    carry: ['E', 'NE'],
    remount: ['E'],
    straddle: ['W', 'SW', 'S'],
    wave: ['S'],
  },
};
