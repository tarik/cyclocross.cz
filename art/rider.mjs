/**
 * The cyclist and bicycle as a small posable model. Positions are in model
 * units: X forward, Y up, Z to the rider's right, origin on the ground under
 * the bottom bracket (riding) or between the feet (standing). The model is
 * projected for any facing direction, so all views share one set of
 * proportions and anchors.
 */
import { Sprite } from './lib/raster.mjs';

export const DIRECTIONS = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315 };
export const PARTS = ['bike', 'legs', 'torso', 'arms', 'head'];

const PITCH = (18 * Math.PI) / 180; // the camera looks slightly down

/** Solves a two-bone joint in the X/Y plane; `bend` picks the side (+1 forward). */
function joint(a, b, la, lb, bend) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.min(Math.hypot(dx, dy), la + lb - 0.01);
  const along = (la * la - lb * lb + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, la * la - along * along));
  const ux = dx / Math.hypot(dx, dy);
  const uy = dy / Math.hypot(dx, dy);
  return { x: a.x + ux * along - uy * off * bend, y: a.y + uy * along + ux * off * bend };
}

export const BODIES = {
  // Same bicycle fit, different build. `shoulder` and `hip` are half-widths.
  male: { shoulder: 4.9, hip: 2.9, torso: 4.7, limb: 1.05, ponytail: false },
  female: { shoulder: 3.9, hip: 3.1, torso: 3.9, limb: 0.88, ponytail: true },
};

/**
 * Jersey designs. Each returns a material for a point on the torso or an arm.
 * `t` runs from the hem (0) to the shoulders (1) on the torso and from the
 * shoulder (0) down each arm bone. `lateral` runs from -1 (rider's left) to 1
 * (rider's right) around the body, for designs with vertical panels.
 */
export const DESIGNS = {
  // One colour, long sleeves, a single band on the right upper arm.
  club: {
    torso: () => 'jersey',
    upperArm: (t, side) => (side === 1 && t > 0.42 && t < 0.72 ? 'armBand' : 'jersey'),
    forearm: (t) => (t > 0.88 ? 'cuff' : 'jersey'),
  },
  // Four horizontal bands, white at the shoulders, then red, blue and light
  // blue down to the hem. Short white sleeves.
  national: {
    torso: (t) => (t > 0.7 ? 'bandA' : t > 0.52 ? 'bandB' : t > 0.34 ? 'bandC' : 'bandD'),
    upperArm: (t) => (t > 0.74 ? 'skin' : 'bandA'),
    forearm: () => 'skin',
  },
};

const P = (x, y, z = 0) => ({ x, y, z });

/** Joint positions for the two poses. `crank` is the right crank angle in degrees. */
function pose(kind, build, crank) {
  if (kind === 'stand') {
    return {
      hip: P(0, 27.6),
      chest: P(0.4, 42.2),
      head: P(1.2, 49.0),
      legs: [-1, 1].map((side) => ({ side, knee: P(0.5, 15.4), ankle: P(-0.2, 3.3), toe: P(0.4, 1.3), z: side * (build.hip + 0.4), crankEnd: null })),
      arms: [-1, 1].map((side) => ({ side, elbow: P(-0.4, 34.6), hand: P(1.0, 27.6), z: side * (build.shoulder + 1.2) })),
    };
  }
  const bb = P(0, 8.6);
  const hip = P(-4.6, 30.6);
  const chest = P(8.6, 38.6);
  return {
    hip,
    chest,
    head: P(12.8, 43.9),
    legs: [-1, 1].map((side) => {
      const angle = ((crank + (side === 1 ? 0 : 180)) * Math.PI) / 180;
      const pedal = P(bb.x + Math.cos(angle) * 4.6, bb.y - Math.sin(angle) * 4.6);
      const ankle = P(pedal.x - 1.2, pedal.y + 3.2);
      return { side, knee: joint(hip, ankle, 12.4, 12.2, 1), ankle, toe: P(pedal.x + 0.3, pedal.y + 1.1), z: side * 3.2, crankEnd: pedal };
    }),
    arms: [-1, 1].map((side) => {
      const hand = P(18.6, 29.6);
      return { side, elbow: joint(P(chest.x, chest.y - 0.3), hand, 7.6, 7.4, -1), hand, z: side * 4.6 };
    }),
  };
}

/**
 * Draws one frame.
 * - `direction`: one of DIRECTIONS.
 * - `body`: a key of BODIES. `design`: a key of DESIGNS.
 * - `stance`: 'ride' or 'stand'.
 * - `parts`: which components to draw (see PARTS).
 * - `scale`: pixels per model unit.
 */
export function drawRider({
  direction, body, design = 'club', stance = 'ride', parts = PARTS, crank = 35, scale = 1.3,
  width = 76, height = 78, anchor = { x: 38, y: 69 },
}) {
  const sprite = new Sprite(width, height);
  const yaw = (DIRECTIONS[direction] * Math.PI) / 180;
  const build = BODIES[body];
  const jersey = DESIGNS[design];
  const show = (part) => parts.includes(part);
  const project = (p) => {
    const east = p.x * Math.cos(yaw) - (p.z ?? 0) * Math.sin(yaw);
    const south = p.x * Math.sin(yaw) + (p.z ?? 0) * Math.cos(yaw);
    return {
      x: anchor.x + east * scale,
      y: anchor.y - (p.y * Math.cos(PITCH) - south * Math.sin(PITCH)) * scale,
      z: (south * Math.cos(PITCH) + p.y * Math.sin(PITCH)) * scale,
    };
  };
  /** The rider's right, as a screen-space vector, to place jersey panels. */
  const right = { x: -Math.sin(yaw), y: Math.cos(yaw) * Math.sin(PITCH), z: Math.cos(yaw) * Math.cos(PITCH) };
  const lateral = (n) => n.x * right.x + n.y * right.y + n.z * right.z;
  /** Limbs on the side turned away from the viewer are drawn one step darker. */
  const far = (side) => (project({ x: 0, y: 0, z: side }).z < -0.2 ? 1 : 0);
  let partId = 0;
  const tube = (a, b, ra, rb, material, options) => {
    partId += 1;
    sprite.capsule(project(a), project(b), ra * scale, rb * scale, material, options?.part ?? partId, options);
  };
  const ball = (c, r, material, options) => tube(c, c, r, r, material, options);
  const thin = { flat: true };

  // ---- Bicycle ----
  if (show('bike')) {
    const rearHub = P(-13.5, 10);
    const frontHub = P(17, 10);
    const bb = P(0, 8.6);
    const seatTop = P(-4.2, 25.5);
    const headTop = P(12.2, 25.5);
    const headLow = P(13.4, 21);
    const wheel = (hub) => {
      partId += 1;
      const id = partId;
      const steps = 40;
      const ring = (radius, thickness, material) => {
        for (let i = 0; i < steps; i += 1) {
          const a0 = (i / steps) * Math.PI * 2;
          const a1 = ((i + 1) / steps) * Math.PI * 2;
          sprite.capsule(
            project(P(hub.x + Math.cos(a0) * radius, hub.y + Math.sin(a0) * radius)),
            project(P(hub.x + Math.cos(a1) * radius, hub.y + Math.sin(a1) * radius)),
            thickness * scale, thickness * scale, material, id, thin,
          );
        }
      };
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + crank * 0.02;
        sprite.capsule(project(hub), project(P(hub.x + Math.cos(a) * 8, hub.y + Math.sin(a) * 8)), 0.3, 0.3, 'spoke', id, thin);
      }
      ring(7.9, 0.45, 'rim');
      ring(9.2, 0.85, 'tyre');
      sprite.sphere(project(hub), 0.9 * scale, 'metal', id, thin);
    };
    wheel(rearHub);
    wheel(frontHub);
    tube(bb, rearHub, 0.6, 0.6, 'frame', thin); // chainstay
    tube(seatTop, rearHub, 0.55, 0.55, 'frame', thin); // seatstay
    tube(bb, P(-5.2, 29), 0.8, 0.7, (t) => (t > 0.86 ? 'metal' : 'frame'), thin); // seat tube and post
    tube(seatTop, headTop, 0.8, 0.8, 'frame', thin); // top tube
    tube(headLow, bb, 0.95, 0.95, 'frame', thin); // down tube
    tube(headTop, headLow, 0.9, 0.9, 'frame', thin);
    tube(headLow, frontHub, 0.7, 0.55, 'fork', thin);
    tube(P(-8.2, 29.6), P(-1.6, 29.3), 1.0, 0.8, 'black', thin); // saddle
    tube(headTop, P(15.2, 27.2), 0.6, 0.6, 'black', thin); // stem
    tube(P(15.2, 27.2, -4.6), P(15.2, 27.2, 4.6), 0.7, 0.7, 'black', thin); // bar top
    for (const side of [-1, 1]) {
      const z = side * 4.6;
      tube(P(15.2, 27.2, z), P(18.4, 27.6, z), 0.7, 0.7, 'black', thin);
      tube(P(18.4, 27.6, z), P(19.2, 29.6, z), 0.75, 0.6, 'black', thin); // hood
      tube(P(18.4, 27.6, z), P(18.2, 23.6, z), 0.6, 0.6, 'black', thin); // drop
      tube(P(18.2, 23.6, z), P(15.4, 23.2, z), 0.6, 0.6, 'black', thin);
    }
    // Drivetrain on the right side.
    partId += 1;
    for (let i = 0; i < 16; i += 1) {
      const a0 = (i / 16) * Math.PI * 2;
      const a1 = ((i + 1) / 16) * Math.PI * 2;
      sprite.capsule(project(P(bb.x + Math.cos(a0) * 3, bb.y + Math.sin(a0) * 3, 1.4)), project(P(bb.x + Math.cos(a1) * 3, bb.y + Math.sin(a1) * 3, 1.4)), 0.5, 0.5, 'metal', partId, thin);
    }
    tube(P(bb.x, bb.y + 3, 1.4), P(rearHub.x, rearHub.y + 1.4, 1.4), 0.35, 0.35, 'chain', thin);
    tube(P(bb.x, bb.y - 3, 1.4), P(rearHub.x, rearHub.y - 1.4, 1.4), 0.35, 0.35, 'chain', thin);
    for (const side of [-1, 1]) {
      const angle = ((crank + (side === 1 ? 0 : 180)) * Math.PI) / 180;
      tube(P(bb.x, bb.y, side * 1.8), P(bb.x + Math.cos(angle) * 4.6, bb.y - Math.sin(angle) * 4.6, side * 2.2), 0.55, 0.55, 'metal', thin);
    }
  }

  // ---- Rider ----
  const limb = build.limb;
  const joints = pose(stance, build, crank);
  const { hip, chest, head } = joints;

  if (show('legs')) {
    for (const leg of joints.legs) {
      const group = { part: 500 + leg.side, dim: far(leg.side) };
      const hipZ = leg.side * build.hip;
      const kneeZ = leg.side * (build.hip + 0.3);
      tube(P(hip.x, hip.y, hipZ), P(leg.knee.x, leg.knee.y, kneeZ), 2.9 * limb, 2.2 * limb, (t) => (t < 0.72 ? 'shorts' : 'skin'), group);
      tube(P(leg.knee.x, leg.knee.y, kneeZ), P(leg.ankle.x, leg.ankle.y, leg.z), 2.0 * limb, 1.45 * limb, (t) => (t > 0.68 ? 'sock' : 'skin'), group);
      tube(P(leg.toe.x - 2.9, leg.toe.y + 0.2, leg.z), P(leg.toe.x + 2.9, leg.toe.y - 0.2, leg.z), 1.6, 1.4, 'shoe', group);
    }
    ball(P(hip.x, hip.y + 0.2), 3.9 * limb, 'shorts', { part: 600 });
  }

  if (show('torso')) {
    const along = { x: chest.x - hip.x, y: chest.y - hip.y };
    const length = Math.hypot(along.x, along.y);
    const from = P(hip.x + (along.x / length) * 1.5, hip.y + (along.y / length) * 1.5);
    tube(from, P(chest.x - (along.x / length) * 0.6, chest.y - (along.y / length) * 0.6), 4.1 * limb, build.torso,
      (t, n) => (t < 0.16 ? 'shorts' : jersey.torso(t, lateral(n))), { part: 600 });
  }

  if (show('arms')) {
    for (const arm of joints.arms) {
      const group = { part: 700 + arm.side, dim: far(arm.side) };
      const shoulderZ = arm.side * build.shoulder;
      const elbowZ = arm.side * (build.shoulder + 0.9);
      tube(P(chest.x, chest.y - 0.3, shoulderZ), P(arm.elbow.x, arm.elbow.y, elbowZ), 2.1 * limb, 1.8 * limb, (t) => jersey.upperArm(t, arm.side), group);
      tube(P(arm.elbow.x, arm.elbow.y, elbowZ), P(arm.hand.x, arm.hand.y, arm.z), 1.7 * limb, 1.4 * limb, (t) => jersey.forearm(t, arm.side), group);
      ball(P(arm.hand.x + 0.2, arm.hand.y, arm.z), 1.6, 'glove', group);
    }
  }

  if (show('head')) {
    const lean = stance === 'stand' ? 0 : 1; // the riding head sits forward of the chest
    tube(P(chest.x + 0.6 * lean, chest.y + 0.8), P(head.x - 0.6 * lean, head.y - 1.2), 1.5, 1.35, 'skin', { part: 799 });
    // A face longer than it is wide, with a small nose.
    tube(P(head.x, head.y - 1.9), P(head.x, head.y + 0.7), 2.4, 2.7, 'skin', { part: 800 });
    ball(P(head.x + 2.65, head.y - 1.2), 0.6, 'skin', { part: 800 });
    if (build.ponytail) {
      tube(P(head.x - 2.8, head.y + 0.4), P(head.x - 6.2, head.y - 3.8), 1.4, 0.8, 'hair', { part: 801 });
    } else {
      tube(P(head.x - 2.0, head.y - 0.6, -1.8), P(head.x - 2.0, head.y - 0.6, 1.8), 1.5, 1.5, 'hair', { part: 800 });
    }
    // Helmet: a smooth aero shell. The profile is low and rounded at the
    // front, long and nearly flat on top, and ends in a blunt tail.
    const profile = [P(3.0, 2.0), P(2.2, 3.1), P(0.4, 3.7), P(-2.0, 3.5), P(-3.5, 2.7), P(-3.3, 1.7)];
    for (const z of [-2.0, -1.0, 0, 1.0, 2.0]) {
      const drop = Math.abs(z) > 1.5 ? 0.7 : Math.abs(z) > 0.5 ? 0.2 : 0; // rounded across the top
      for (let i = 0; i < profile.length - 1; i += 1) {
        tube(P(head.x + profile[i].x, head.y + profile[i].y - drop, z), P(head.x + profile[i + 1].x, head.y + profile[i + 1].y - drop, z), 0.9, 0.9, 'helmet', { part: 802 });
      }
    }
    // Two intake slots low on each side near the front.
    for (const side of [-1, 1]) {
      tube(P(head.x + 0.8, head.y + 2.2, side * 2.75), P(head.x + 2.1, head.y + 1.9, side * 2.65), 0.36, 0.36, 'vent', { part: 802, flat: true });
    }
    // Glasses across the face.
    tube(P(head.x + 2.3, head.y - 0.1, -1.6), P(head.x + 2.3, head.y - 0.1, 1.6), 0.6, 0.6, 'black', { part: 803, flat: true });
  }

  return sprite.finish();
}
