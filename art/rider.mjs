/**
 * The cyclist and bicycle as a small posable model. Positions are in model
 * units: X forward, Y up, Z to the rider's right, origin on the ground under
 * the bottom bracket. The model is projected for any facing direction, so all
 * views share one set of proportions and anchors.
 */
import { Sprite } from './lib/raster.mjs';

export const DIRECTIONS = { E: 0, SE: 45, S: 90, SW: 135, W: 180, NW: 225, N: 270, NE: 315 };

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
 * Draws one frame. `crank` is the right crank angle in degrees (0 = forward),
 * `scale` the pixels per model unit.
 */
export function drawRider({ direction, body, crank = 35, scale = 1.3, width = 76, height = 78, anchor = { x: 38, y: 69 } }) {
  const sprite = new Sprite(width, height);
  const yaw = (DIRECTIONS[direction] * Math.PI) / 180;
  const build = BODIES[body];
  const project = (p) => {
    const east = p.x * Math.cos(yaw) - (p.z ?? 0) * Math.sin(yaw);
    const south = p.x * Math.sin(yaw) + (p.z ?? 0) * Math.cos(yaw);
    return {
      x: anchor.x + east * scale,
      y: anchor.y - (p.y * Math.cos(PITCH) - south * Math.sin(PITCH)) * scale,
      z: (south * Math.cos(PITCH) + p.y * Math.sin(PITCH)) * scale,
    };
  };
  /** Limbs on the side turned away from the viewer are drawn one step darker. */
  const far = (side) => (project({ x: 0, y: 0, z: side }).z < -0.2 ? 1 : 0);
  let partId = 0;
  const tube = (a, b, ra, rb, material, options) => {
    partId += 1;
    sprite.capsule(project(a), project(b), ra * scale, rb * scale, material, options?.part ?? partId, options);
    return partId;
  };
  const ball = (c, r, material, options) => tube(c, c, r, r, material, options);
  const P = (x, y, z = 0) => ({ x, y, z });

  // ---- Bicycle ----
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
          thickness * scale, thickness * scale, material, id, { flat: true },
        );
      }
    };
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + crank * 0.02;
      sprite.capsule(project(hub), project(P(hub.x + Math.cos(a) * 8, hub.y + Math.sin(a) * 8)), 0.3, 0.3, 'spoke', id, { flat: true });
    }
    ring(7.9, 0.45, 'rim');
    ring(9.2, 0.85, 'tyre');
    sprite.sphere(project(hub), 0.9 * scale, 'metal', id, { flat: true });
  };
  wheel(rearHub);
  wheel(frontHub);

  const thin = { flat: true };
  tube(bb, rearHub, 0.6, 0.6, 'frame', thin); // chainstay
  tube(seatTop, rearHub, 0.55, 0.55, 'frame', thin); // seatstay
  tube(bb, P(-5.2, 29), 0.8, 0.7, (t) => (t > 0.86 ? 'metal' : 'frame'), thin); // seat tube and post
  tube(seatTop, headTop, 0.8, 0.8, 'frame', thin); // top tube
  tube(headLow, bb, 0.95, 0.95, (t) => (t > 0.25 && t < 0.62 ? 'frameMark' : 'frame'), thin); // down tube
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

  // ---- Rider ----
  const limb = build.limb;
  const hipY = 30.6;
  const hipX = -4.6;
  const shoulder = P(8.6, 38.6);
  const legs = [-1, 1].map((side) => {
    const angle = ((crank + (side === 1 ? 0 : 180)) * Math.PI) / 180;
    const z = side * 3.2;
    const pedal = P(bb.x + Math.cos(angle) * 4.6, bb.y - Math.sin(angle) * 4.6, z);
    return { side, z, pedal };
  });
  for (const { side, z, pedal } of legs) {
    tube(P(bb.x, bb.y, side * 1.8), P(pedal.x, pedal.y, side * 2.2), 0.55, 0.55, 'metal', thin); // crank
    const ankle = { x: pedal.x - 1.2, y: pedal.y + 3.2 };
    const hip = { x: hipX, y: hipY };
    const knee = joint(hip, ankle, 12.4, 12.2, 1);
    const hipZ = side * build.hip;
    const kneeZ = side * (build.hip + 0.3);
    const group = { part: 500 + side, dim: far(side) };
    tube(P(hip.x, hip.y, hipZ), P(knee.x, knee.y, kneeZ), 2.9 * limb, 2.2 * limb, (t) => (t < 0.72 ? 'shorts' : 'skin'), group);
    tube(P(knee.x, knee.y, kneeZ), P(ankle.x, ankle.y, z), 2.0 * limb, 1.45 * limb, (t) => (t > 0.68 ? 'sock' : 'skin'), group);
    tube(P(pedal.x - 2.6, pedal.y + 1.3, z), P(pedal.x + 3.2, pedal.y + 0.9, z), 1.5, 1.25, 'shoe', group);
  }
  // Pelvis, torso and jersey design. The stripes run across the chest.
  ball(P(hipX, hipY + 0.2), 3.9 * limb, 'shorts', { part: 600 });
  tube(P(hipX + 0.6, hipY + 1.4), P(shoulder.x - 0.6, shoulder.y), 4.1 * limb, build.torso,
    (t) => (t < 0.16 ? 'shorts' : t > 0.5 && t < 0.62 ? 'jerseyBand' : t >= 0.62 && t < 0.72 ? 'jerseyTrim' : t >= 0.72 ? 'jerseyTop' : 'jersey'),
    { part: 600 });
  for (const side of [-1, 1]) {
    const from = { x: shoulder.x, y: shoulder.y - 0.3 };
    const hand = { x: 18.6, y: 29.6 };
    const elbow = joint(from, hand, 7.6, 7.4, -1);
    const group = { part: 700 + side, dim: far(side) };
    const sz = side * build.shoulder;
    tube(P(from.x, from.y, sz), P(elbow.x, elbow.y, side * (build.shoulder + 0.9)), 2.1 * limb, 1.8 * limb, (t) => (t < 0.62 ? 'jerseyTop' : t < 0.74 ? 'jerseyTrim' : 'skin'), group);
    tube(P(elbow.x, elbow.y, side * (build.shoulder + 0.9)), P(hand.x, hand.y, side * 4.6), 1.7 * limb, 1.4 * limb, 'skin', group);
    ball(P(hand.x + 0.2, hand.y, side * 4.6), 1.6, 'glove', group);
  }
  const head = P(12.6, 44.2);
  tube(P(shoulder.x + 0.6, shoulder.y + 0.8), P(head.x - 0.6, head.y - 1.2), 1.7, 1.6, 'skin', { part: 800 });
  ball(head, 3.5, 'skin', { part: 800 });
  if (build.ponytail) {
    tube(P(head.x - 3.4, head.y + 0.4), P(head.x - 7.4, head.y - 3.6), 1.5, 0.9, 'hair', { part: 801 });
  } else {
    tube(P(head.x - 2.4, head.y - 1.6, -2), P(head.x - 2.4, head.y - 1.6, 2), 1.7, 1.7, 'hair', { part: 800 });
  }
  // Helmet: a shell over the top and back of the head, with a contrast stripe.
  tube(P(head.x - 2.2, head.y + 2.0), P(head.x + 1.6, head.y + 2.3), 3.5, 3.1, (t) => (t > 0.3 && t < 0.62 ? 'helmetMark' : 'helmet'), { part: 802 });
  // Glasses across the face.
  tube(P(head.x + 3.0, head.y + 0.1, -2.0), P(head.x + 3.0, head.y + 0.1, 2.0), 0.9, 0.9, 'black', { part: 803, flat: true });

  return sprite.finish();
}
