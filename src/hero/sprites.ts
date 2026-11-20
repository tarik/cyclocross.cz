/**
 * Sprite selection: which cell of which sheet shows a rider state, and a
 * check that the sheets cover every action and direction the choreography
 * can ask for (SPEC.md 5.3 and 5.5).
 */
import type { Choreography, Move } from './choreography.ts';
import type { RiderState } from './timeline.ts';

export type Body = 'female' | 'male';
export type Kit = 'club' | 'national';

export interface SheetMeta {
  cell: { width: number; height: number; anchor: { x: number; y: number } };
  columns: number;
  rows: number;
  /** Riding cycle sheets: one row per direction. */
  directions?: string[];
  /** Action sheets: action -> direction -> row and frame count. */
  actions?: Record<string, Record<string, { row: number; frames: number }>>;
}

export type Sheets = Record<string, SheetMeta>;

/** Frames each action needs; the sequencer picks frames below these counts. */
export const FRAMES_NEEDED: Record<Move, number> = { ride: 8, coast: 1, hop: 6, dismount: 6, carry: 6, remount: 5, straddle: 4, wave: 4 };

export function sheetName(move: Move, body: Body, kit: Kit): string {
  return move === 'ride' || move === 'coast' ? `cycle-${body}-${kit}.png` : `act-${body}-${kit}.png`;
}

export interface Cell {
  sheet: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchor: { x: number; y: number };
}

/** The sheet cell for a state; throws if the sheets lack it. */
export function cellFor(sheets: Sheets, state: Pick<RiderState, 'move' | 'facing' | 'frame'>, body: Body, kit: Kit): Cell {
  const sheet = sheetName(state.move, body, kit);
  const meta = sheets[sheet];
  if (!meta) throw new Error(`Missing sheet ${sheet}`);
  const { width, height, anchor } = meta.cell;
  let row: number;
  if (state.move === 'ride' || state.move === 'coast') {
    row = meta.directions?.indexOf(state.facing) ?? -1;
  } else {
    const entry = meta.actions?.[state.move]?.[state.facing];
    if (!entry || state.frame >= entry.frames) throw new Error(`No frame ${state.frame} for ${state.move} ${state.facing} in ${sheet}`);
    row = entry.row;
  }
  if (row < 0) throw new Error(`No row for ${state.move} ${state.facing} in ${sheet}`);
  return { sheet, x: state.frame * width, y: row * height, width, height, anchor };
}

/** Every action and direction the choreography may use, for every rider and kit. */
export function coverageProblems(sheets: Sheets, config: Choreography): string[] {
  const problems: string[] = [];
  for (const body of ['female', 'male'] as Body[]) {
    for (const kit of ['club', 'national'] as Kit[]) {
      for (const [move, directions] of Object.entries(config.coverage) as [Move, string[]][]) {
        for (const facing of directions) {
          try {
            cellFor(sheets, { move, facing: facing as RiderState['facing'], frame: FRAMES_NEEDED[move] - 1 }, body, kit);
          } catch (error) {
            problems.push((error as Error).message);
          }
        }
      }
    }
  }
  return problems;
}
