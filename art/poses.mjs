/**
 * Poses for the actions beyond plain riding (SPEC.md 5.2 and 5.3): the bunny
 * hop, the dismount, running with the bike on the shoulder, the remount, and
 * the stop, idle and wave at the pose area. Each action is a short list of
 * frames in model units (see rider.mjs). A frame gives the hip, chest and
 * head, the body's sideways offset `bodyZ`, the bike transform and the crank.
 * Hands and feet that hold the bike follow it through the transform, and
 * knees and elbows are solved, so limbs stay attached in every frame.
 *
 * These are the first, rough poses for the motion review (SPEC.md 5.7 step
 * 5); timing and geometry are judged in motion before they are polished.
 */
import { BODIES, bikeTransform, joint } from './rider.mjs';

const P = (x, y, z = 0) => ({ x, y, z });
const TAU = Math.PI * 2;

// Points on the bicycle, in its own frame.
const BB = P(0, 8.6);
const REAR_HUB = P(-13.5, 10);
const FRONT_HUB = P(17, 10);
const TOP_TUBE = P(4, 25.5);
const hood = (side) => P(18.6, 29.6, side * 4.6);
const BAR_TOP = P(15.2, 27.2, -2.2);
const GRIP = P(6, 26.2, -0.8); // the right hand on the top tube
function pedal(crank, side) {
  const a = ((crank + (side === 1 ? 0 : 180)) * Math.PI) / 180;
  return P(BB.x + Math.cos(a) * 4.6, BB.y - Math.sin(a) * 4.6, side * 3.2);
}

/** A leg from the hip to a given ankle; the shoe sits just ahead of the ankle. */
function legTo(hip, ankle, side, z, bend = 1) {
  return { side, knee: joint(hip, ankle, 12.4, 12.2, bend), ankle, toe: P(ankle.x + 1.2, ankle.y - 2.1), z };
}

/** A leg with its foot clipped into a pedal of the moved bike. */
function legOnPedal(hip, crank, side, move) {
  const at = move(pedal(crank, side));
  return legTo(hip, P(at.x - 1.2, at.y + 3.2), side, at.z);
}

/** An arm from the shoulder to a given hand. */
function armTo(chest, hand, side, bend = -1) {
  return { side, elbow: joint(P(chest.x, chest.y - 0.3), hand, 7.6, 7.4, bend), hand, z: hand.z };
}

/** The rider on the bike, both hands on the hoods and both feet on the pedals. */
function onBike({ hip, chest, head, crank = 0, bike = {}, bodyZ = 0 }) {
  const move = bikeTransform(bike);
  return {
    hip, chest, head, bodyZ, bike, crank,
    legs: [-1, 1].map((side) => legOnPedal(hip, crank, side, move)),
    arms: [-1, 1].map((side) => armTo(chest, move(hood(side)), side)),
  };
}

/** Running legs: `phase` 0..1 over one stride pair; the swinging foot is lifted. */
function runLegs(hip, phase, build, bodyZ, { stride = 5.4, lift = 6 } = {}) {
  return [-1, 1].map((side) => {
    const f = phase * TAU + (side === 1 ? 0 : Math.PI);
    const ankle = P(hip.x + 0.6 + stride * Math.cos(f), 3.3 + Math.max(0, -Math.sin(f)) * lift);
    return legTo(hip, ankle, side, bodyZ + side * (build.hip + 0.6));
  });
}

/** Running beside the bike on its left side: left hand on the left hood, right hand on the top tube. */
function besideBike(build, phase, { bike = {}, bodyZ = -7, hip = P(0.6, 27), chest = P(8.2, 39.6), head = P(12, 46.2) } = {}) {
  const move = bikeTransform(bike);
  return {
    hip, chest, head, bodyZ, bike, crank: 0,
    legs: runLegs(hip, phase, build, bodyZ),
    arms: [armTo(chest, move(hood(-1)), -1), armTo(chest, move(GRIP), 1)],
  };
}

const RIDE = { hip: P(-4.6, 30.6), chest: P(8.6, 38.6), head: P(12.8, 43.9) };

/** Side-view bunny hop with level pedals: preload, front up, tuck, rear up, land, ride on. */
function hop() {
  return [
    onBike({ hip: P(-5.6, 27.9), chest: P(7.4, 34.4), head: P(11.8, 39.8) }),
    onBike({ hip: P(-9.4, 31.4), chest: P(2.6, 40.4), head: P(6.6, 46.0), bike: { pitch: 15, pivot: REAR_HUB } }),
    onBike({ hip: P(-5.2, 29.6), chest: P(7.0, 35.6), head: P(11.2, 41.0), bike: { pitch: 3, pivot: REAR_HUB } }),
    onBike({ hip: P(-2.6, 31.6), chest: P(11.0, 37.4), head: P(15.0, 42.6), bike: { pitch: -9, pivot: FRONT_HUB } }),
    onBike({ hip: P(-5.8, 27.6), chest: P(7.4, 33.8), head: P(11.8, 39.2) }),
    onBike({ ...RIDE }),
  ];
}

/** Cyclocross dismount on the left: right leg over the back, step off, run beside, lift to the shoulder. */
function dismount(build) {
  const plain = bikeTransform({});
  const crank = 270; // left pedal at the bottom
  const frames = [];
  {
    const hip = P(-3.4, 31.8);
    const chest = P(7.6, 40.6);
    frames.push({
      hip, chest, head: P(11.6, 46.2), bodyZ: -1.5, bike: {}, crank,
      legs: [legOnPedal(hip, crank, -1, plain), legTo(hip, P(-18.6, 27.6), 1, 0.6, -1)],
      arms: [-1, 1].map((side) => armTo(chest, hood(side), side)),
    });
  }
  {
    const hip = P(-2.2, 31);
    const chest = P(7.8, 40.4);
    frames.push({
      hip, chest, head: P(11.8, 46.2), bodyZ: -3.2, bike: {}, crank,
      legs: [legOnPedal(hip, crank, -1, plain), legTo(hip, P(-3, 7.6), 1, -7.2)],
      arms: [armTo(chest, hood(-1), -1), armTo(chest, GRIP, 1)],
    });
  }
  {
    const hip = P(-0.6, 27.6);
    const chest = P(7.8, 39.4);
    frames.push({
      hip, chest, head: P(11.8, 45.6), bodyZ: -5.2, bike: {}, crank,
      legs: [legTo(hip, P(-5, 9.4), -1, -6), legTo(hip, P(2.4, 3.3), 1, -7.2)],
      arms: [armTo(chest, hood(-1), -1), armTo(chest, GRIP, 1)],
    });
  }
  frames.push(besideBike(build, 0.25));
  frames.push(besideBike(build, 0.75));
  frames.push(besideBike(build, 0, {
    bike: { dx: -2.5, dy: 9, dz: -0.5, pitch: 6, pivot: TOP_TUBE }, bodyZ: -5.5,
    hip: P(0, 26.2), chest: P(5.2, 38.4), head: P(8.8, 45.2),
  }));
  return frames;
}

/** Running with the bike on the right shoulder, the right arm round the head tube to the bar. */
function carryFrame(build, phase, { lift = 6 } = {}) {
  const f = phase * TAU;
  const bodyZ = -build.shoulder + 0.2;
  const hip = P(0.6, 26.8 + 0.5 * Math.cos(2 * f));
  const chest = P(3.4, hip.y + 13.6);
  const head = P(5.4, chest.y + 6.6);
  const bike = { pivot: TOP_TUBE, pitch: 9, dx: chest.x - TOP_TUBE.x - 3.6, dy: chest.y + 1.9 - TOP_TUBE.y };
  const move = bikeTransform(bike);
  const swing = P(chest.x + 4.5 * Math.cos(f), chest.y - 11.5 + 1.5 * Math.max(0, Math.cos(f)), bodyZ - build.shoulder - 1);
  return {
    hip, chest, head, bodyZ, bike, crank: 0,
    legs: runLegs(hip, phase, build, bodyZ, { lift }),
    arms: [armTo(chest, swing, -1, -1), armTo(chest, move(BAR_TOP), 1)],
  };
}

function carry(build, { lift }) {
  return Array.from({ length: 6 }, (_, i) => carryFrame(build, i / 6, { lift }));
}

/** Remount at the summit: lower the bike, run beside it, leap on, land on the saddle, ride. */
function remount(build) {
  const frames = [];
  frames.push(besideBike(build, 0.25, {
    bike: { dy: 8, dz: -0.5, pitch: 4, pivot: TOP_TUBE }, bodyZ: -6,
    hip: P(0.4, 26.8), chest: P(6.6, 39.2), head: P(10.4, 45.8),
  }));
  frames.push(besideBike(build, 0.75));
  {
    const hip = P(-3.6, 35.4);
    const chest = P(7.8, 42.4);
    frames.push({
      hip, chest, head: P(11.8, 48), bodyZ: -3.4, bike: {}, crank: 20,
      legs: [legTo(hip, P(-9.5, 10.4), -1, -6.2), legTo(hip, P(-17, 31), 1, -0.2, -1)],
      arms: [-1, 1].map((side) => armTo(chest, hood(side), side)),
    });
  }
  {
    const hip = P(-4.6, 31.4);
    const chest = P(8.4, 38.8);
    const plain = bikeTransform({});
    frames.push({
      hip, chest, head: P(12.6, 44.2), bodyZ: -0.8, bike: {}, crank: 20,
      legs: [legTo(hip, P(-1.6, 9.2), -1, -4.2), legOnPedal(hip, 20, 1, plain)],
      arms: [-1, 1].map((side) => armTo(chest, hood(side), side)),
    });
  }
  frames.push(onBike({ ...RIDE, crank: 35 }));
  return frames;
}

/** Standing astride the bike, both feet down, hands on the hoods. */
function astride({ chestY = 39.4, bodyZ = 0, lean = 0 } = {}) {
  const hip = P(-1.4, 27.4);
  const chest = P(8 + lean, chestY);
  return {
    hip, chest, head: P(10.4 + lean, chestY + 6.6), bodyZ, bike: {}, crank: 0,
    legs: [-1, 1].map((side) => legTo(hip, P(-1.6, 3.3), side, side * 6.4)),
    arms: [-1, 1].map((side) => armTo(chest, hood(side), side)),
  };
}

/** Stop and idle: seated with the left foot down, then astride, breathing, a weight shift. */
function straddle() {
  const hip = P(-4.6, 30.8);
  const chest = P(8.0, 39.2);
  const plain = bikeTransform({});
  return [
    {
      hip, chest, head: P(12.0, 44.8), bodyZ: -0.6, bike: {}, crank: 315,
      legs: [legTo(hip, P(-3.2, 3.3), -1, -7.6), legOnPedal(hip, 315, 1, plain)],
      arms: [-1, 1].map((side) => armTo(chest, hood(side), side)),
    },
    astride(),
    astride({ chestY: 38.6 }),
    astride({ bodyZ: 1, lean: 0.3 }),
  ];
}

/** A wave towards the viewer: the right hand comes off the bar and waves side to side. */
function wave(build) {
  const base = astride();
  const { chest, bodyZ } = base;
  const shoulderZ = bodyZ + build.shoulder;
  const raised = (y, z, x = 1.4) => {
    const hand = P(chest.x + x, chest.y + y, shoulderZ + z);
    return { side: 1, elbow: P(chest.x + 0.8, chest.y + 1.6), elbowZ: shoulderZ + 4.2, hand, z: hand.z };
  };
  return [
    { ...base, arms: [base.arms[0], raised(5.6, 3.6, 3)] },
    { ...base, arms: [base.arms[0], raised(9.6, 2.2)] },
    { ...base, arms: [base.arms[0], raised(9.2, 5.8)] },
    { ...base, arms: [base.arms[0], raised(9.6, 3.4)] },
  ];
}

/**
 * The action rows of the sheet: each action in the directions the route uses
 * (the coverage matrix of SPEC.md 5.3). Riding itself comes from the cycle
 * sheets in all eight directions.
 */
export const ACTION_ROWS = [
  { action: 'hop', direction: 'E' },
  { action: 'dismount', direction: 'E' },
  { action: 'carry', direction: 'E' },
  { action: 'carry', direction: 'NE', stairs: true },
  { action: 'remount', direction: 'E' },
  { action: 'straddle', direction: 'W' },
  { action: 'straddle', direction: 'SW' },
  { action: 'straddle', direction: 'S' },
  { action: 'wave', direction: 'S' },
];

/** Frames of one action row for one body. */
export function actionFrames(row, body) {
  const build = BODIES[body];
  switch (row.action) {
    case 'hop': return hop();
    case 'dismount': return dismount(build);
    case 'carry': return carry(build, { lift: row.stairs ? 9 : 6 });
    case 'remount': return remount(build);
    case 'straddle': return straddle();
    case 'wave': return wave(build);
    default: throw new Error(`Unknown action ${row.action}`);
  }
}
