/**
 * Paints the static scenery of the desktop scene from the course data in
 * `src/hero/scene.ts`, so terrain, structures and riders share one
 * projection. Output is three layers of the same size:
 *
 * - back: sky, landscape, ground, hill, the far half of the flyover, the
 *   soil cutaway and its transition into the page;
 * - flyover-front: the near half of the flyover, drawn over riders that
 *   pass behind or under it (see FLYOVER_SPLIT_S);
 * - front: course tape in front of every rider.
 *
 * Everything is procedural but deliberate: shapes come from the scene data,
 * colours from the ramps in SCENERY, and texture from seeded noise snapped
 * to small pixel clusters, so a rebuild is byte-identical.
 */
import {
  canvas, DECK, DECK_THICKNESS, FLYOVER_SPLIT_S, GROUND_FRONT, hillHeight, occluders, pitchDegrees, route, structures, SUMMIT, TRACK_WIDTH,
} from '../src/hero/scene.ts';
import { SCENERY as C } from './palettes.mjs';

const W = canvas.width;
const H = canvas.height;
const SIN = Math.sin((pitchDegrees * Math.PI) / 180);
const COS = Math.cos((pitchDegrees * Math.PI) / 180);
const ORIGIN_Y = 150;
const screenY = (s, h = 0) => ORIGIN_Y + s * SIN - h * COS;
/** The far edge of the ground plane; the landscape sits behind it. */
const FAR = -80;
const HORIZON = screenY(FAR);
const SOIL_TOP = Math.floor(screenY(GROUND_FRONT));
const SOIL_BOTTOM = H - 16;

/** Direction towards the low golden-hour sun: from the west, a little in front of the scene, matching the riders' upper-left light. */
const SUN = (() => {
  const v = { e: -0.86, s: 0.2, h: 0.47 };
  const n = Math.hypot(v.e, v.s, v.h);
  return { e: v.e / n, s: v.s / n, h: v.h / n };
})();
const FLAT_LIGHT = SUN.h;

// ---------------------------------------------------------------- utilities

class Layer {
  constructor() {
    this.rgba = new Uint8Array(W * H * 4);
  }

  set(x, y, hex) {
    if (x < 0 || y < 0 || x >= W || y >= H || !hex) return;
    const i = (y * W + x) * 4;
    this.rgba[i] = parseInt(hex.slice(1, 3), 16);
    this.rgba[i + 1] = parseInt(hex.slice(3, 5), 16);
    this.rgba[i + 2] = parseInt(hex.slice(5, 7), 16);
    this.rgba[i + 3] = 255;
  }

  filled(x, y) {
    return x >= 0 && y >= 0 && x < W && y < H && this.rgba[(y * W + x) * 4 + 3] !== 0;
  }
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

/** Deterministic hash noise in [0, 1). */
function hash(x, y, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1). */
function noise(x, y, scale, seed = 0) {
  const fx = x / scale;
  const fy = y / scale;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed);
  const b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed);
  const d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Picks a ramp step from a continuous value, with a dithered seam between steps. */
function step(ramp, value, x, y, seam = 0.35) {
  const v = clamp(value, 0, ramp.length - 1);
  const base = Math.floor(v);
  const frac = v - base;
  const t = clamp((frac - (0.5 - seam / 2)) / seam);
  return ramp[Math.min(ramp.length - 1, base + (t > bayer(x, y) ? 1 : 0))];
}

/** Distance from (e, s) to a ground segment, with the position along it. */
function toSegment(e, s, a, b) {
  const de = b.e - a.e;
  const ds = b.s - a.s;
  const len2 = de * de + ds * ds;
  const t = len2 === 0 ? 0 : clamp(((e - a.e) * de + (s - a.s) * ds) / len2);
  const side = len2 === 0 ? 0 : ((e - a.e) * ds - (s - a.s) * de) / Math.sqrt(len2);
  return { distance: Math.hypot(e - (a.e + de * t), s - (a.s + ds * t)), t, side };
}

/** Scanline fill of a polygon given in screen space. */
function fillPolygon(points, paint) {
  const ys = points.map((p) => p.y);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y += 1) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a.y <= cy && b.y > cy) || (b.y <= cy && a.y > cy)) xs.push(a.x + ((cy - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((m, n) => m - n);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(W, Math.round(xs[k + 1])); x += 1) paint(x, y);
    }
  }
}

const proj = (p) => ({ x: p.e, y: screenY(p.s, p.h) });

/**
 * A planar face spanned from `origin` by vectors `u` and `v` (ground units).
 * Screen projection is affine, so each pixel maps back to (u, v) exactly.
 */
function face(origin, u, v, outline, paint) {
  const o = proj(origin);
  const pu = { x: u.e, y: u.s * SIN - u.h * COS };
  const pv = { x: v.e, y: v.s * SIN - v.h * COS };
  const det = pu.x * pv.y - pu.y * pv.x;
  if (Math.abs(det) < 1e-6) return;
  fillPolygon(outline.map(proj), (x, y) => {
    const dx = x + 0.5 - o.x;
    const dy = y + 0.5 - o.y;
    const a = (dx * pv.y - dy * pv.x) / det;
    const b = (pu.x * dy - pu.y * dx) / det;
    paint(x, y, a, b, {
      e: origin.e + u.e * a + v.e * b,
      s: origin.s + u.s * a + v.s * b,
      h: origin.h + u.h * a + v.h * b,
    });
  });
}

// ------------------------------------------------------------- the geometry

const { flyover, hill, barriers, poseArea } = structures;
const HALF = flyover.width / 2;
/** The flyover runs along e - s = K; u = e + s grows towards the ramp up. */
const K = flyover.topIn.e - flyover.topIn.s;
const along = (p) => p.e + p.s;
const lateralOf = (p) => ((p.e - p.s) - K) / -Math.SQRT2;
const U_FOOT_OUT = along(flyover.footOut);
const U_OUT = along(flyover.topOut);
const U_IN = along(flyover.topIn);
const U_FOOT_IN = along(flyover.footIn);

/** Height of the top of the flyover's deck at a position along it, or -1 off it. */
function deckAt(u) {
  if (u >= U_OUT && u <= U_IN) return DECK;
  if (u > U_IN && u <= U_FOOT_IN) return DECK * (1 - (u - U_IN) / (U_FOOT_IN - U_IN));
  if (u < U_OUT && u >= U_FOOT_OUT) return DECK * ((u - U_FOOT_OUT) / (U_OUT - U_FOOT_OUT));
  return -1;
}

/** A point on the flyover: along it, across it (positive towards the south-west side) and above its deck. */
function onFlyover(u, l, dh = 0, base = 'deck') {
  const deck = Math.max(0, deckAt(Math.max(U_FOOT_OUT, Math.min(U_FOOT_IN, u))));
  return {
    e: (u + K) / 2 - Math.SQRT1_2 * l,
    s: (u - K) / 2 + Math.SQRT1_2 * l,
    h: (base === 'deck' ? deck : 0) + dh,
  };
}

const RAIL = 26; // handrail height above the deck
const BANNER_DROP = 20; // side banners hang this far below the deck edge

/** Solid parts of the flyover for shadows: the deck plates and the side banners. */
function flyoverSolid(e, s, h) {
  const p = { e, s };
  const l = lateralOf(p);
  if (Math.abs(l) > HALF + 1) return false;
  const u = along(p);
  const top = deckAt(u);
  if (top < 0 || h > top + 0.5) return false;
  const flat = u >= U_OUT && u <= U_IN;
  if (h >= top - (flat ? DECK_THICKNESS : 3)) return true;
  return !flat && l > HALF - 1 && h > top - BANNER_DROP;
}

const groundPaths = route.filter((segment) => segment.path.every((point) => point.h === 0) && segment.id !== 'pose').map((segment) => segment.path);
const summitPath = route.find((segment) => segment.id === 'summit').path;
const dropPath = route.find((segment) => segment.id === 'downhill').path;

/** Distance to the nearest ridden track line on the ground or on the hill. */
function trackDistance(e, s) {
  let best = Infinity;
  for (const path of [...groundPaths, summitPath, dropPath]) {
    for (let i = 0; i + 1 < path.length; i += 1) best = Math.min(best, toSegment(e, s, path[i], path[i + 1]).distance);
  }
  return Math.min(best, Math.hypot(e - poseArea.e, (s - poseArea.s) * 1.3) - 8);
}

const stairs = (e, s) => toSegment(e, s, hill.stairsFoot, hill.stairsTop);
const drop = (e, s) => toSegment(e, s, hill.dropTop, hill.dropFoot);
const STAIR_HALF = hill.stairsWidth / 2;

/** Terrain height with the stairs and the drop cut into the hill. */
function terrain(e, s) {
  let h = hillHeight(e, s);
  if (h <= 0) return 0;
  const st = stairs(e, s);
  if (st.distance < STAIR_HALF + 3 && st.t > 0 && st.t < 1) {
    const stepped = (SUMMIT * Math.floor(st.t * hill.steps + 0.0001)) / hill.steps;
    const k = smooth(STAIR_HALF, STAIR_HALF + 3, st.distance);
    h = stepped + (h - stepped) * k;
  }
  const dr = drop(e, s);
  if (dr.distance < 12 && dr.t > 0 && dr.t < 1) {
    const line = SUMMIT * (1 - dr.t);
    h = line + (h - line) * smooth(7, 12, dr.distance);
  }
  return Math.max(0, h);
}

// ---------------------------------------------------- course furniture data

/** Banner fences: crowd barriers dressed with sponsor banners, along a ground line. */
export const FENCES = [
  // Behind the pose area; it ends before the track bends up to the flyover.
  { from: { e: -6, s: 52 }, to: { e: 214, s: 52 }, first: 6 },
  { from: { e: 478, s: 186 }, to: { e: 640, s: 186 }, first: 2 },
  // Along the north-west side of the stairs, stepping up the slope.
  { from: { e: 474, s: 102 }, to: { e: 560, s: 16 }, first: 5, onTerrain: true },
];
const FENCE_HEIGHT = 27;
const PANEL = 44;

/** Course tape on stakes, by layer. */
export const TAPES = [
  { layer: 'front', from: { e: -6, s: 137 }, to: { e: 252, s: 137 } },
  { layer: 'tape-mid', from: { e: 172, s: 97 }, to: { e: 268, s: 97 } },
  { layer: 'front', from: { e: 448, s: 220 }, to: { e: 718, s: 220 } },
  // Both sides of the drop and the near side of the stairs.
  { layer: 'back', from: { e: 622, s: 20 }, to: { e: 706, s: 138 }, onTerrain: true },
  { layer: 'hill-tape', from: { e: 603, s: 47 }, to: { e: 682, s: 158 }, onTerrain: true },
  { layer: 'hill-tape', from: { e: 492, s: 132 }, to: { e: 578, s: 46 }, onTerrain: true },
];
const TAPE_HEIGHT = 26;

/** Feather flags along the course. */
export const FLAGS = [
  { e: 14, s: 44, colour: 'teal' },
  // Behind the pose fence, clear of the track that bends down from the flyover.
  { e: 184, s: 30, colour: 'orange' },
  { e: 468, s: 90, colour: 'yellow' },
  { e: 652, s: 20, colour: 'navy' },
];

// ------------------------------------------------------------------ shadows

const BIG_TREE = { e: 46, s: 18, trunk: 30, crown: { h: 62, r: 30 } };
const BIRCHES = [{ e: 214, s: -6 }, { e: 236, s: -2 }, { e: 252, s: -9 }];

function treeSolid(e, s, h) {
  const t = BIG_TREE;
  if (h < t.trunk + 4 && Math.hypot(e - t.e, s - t.s) < 2.5) return true;
  const dz = (h - t.crown.h) / (t.crown.r * 0.85);
  return Math.hypot((e - t.e) / t.crown.r, (s - t.s) / t.crown.r, dz) < 1;
}

function barrierSolid(e, s, h) {
  const half = TRACK_WIDTH / 2;
  return barriers.some((b) => Math.abs(e - b.e) < 1.5 && Math.abs(s - b.s) < half && h < 16 && (h > 10 || Math.abs(Math.abs(s - b.s) - half + 1) < 1.2));
}

function fenceSolid(e, s, h) {
  if (h > FENCE_HEIGHT || h < 3) return false;
  for (const f of FENCES) {
    if (f.onTerrain) continue;
    if (Math.abs(s - f.from.s) < 1 && e > f.from.e && e < f.to.e) return true;
  }
  return false;
}

function inShadow(e, s, h0) {
  for (let z = h0 + 1; z < 112; z += 1.5) {
    const k = (z - h0) / SUN.h;
    const pe = e + SUN.e * k;
    const ps = s + SUN.s * k;
    if (flyoverSolid(pe, ps, z) || treeSolid(pe, ps, z) || (z < 17 && barrierSolid(pe, ps, z)) || (z < FENCE_HEIGHT + 1 && fenceSolid(pe, ps, z))) return true;
  }
  return false;
}

// -------------------------------------------------------------------- sky

/** The low sun, upper left, where the light comes from. */
const SUN_DISC = { x: 118, y: 74, r: 8 };

function paintSky(layer) {
  for (let y = 0; y < Math.ceil(HORIZON) + 1; y += 1) {
    const t = (y / HORIZON) ** 0.9;
    for (let x = 0; x < W; x += 1) {
      // A warm glow around the sun, widest near the horizon.
      const d = Math.hypot((x - SUN_DISC.x) / 2.4, y - SUN_DISC.y);
      const glow = clamp(1 - d / 120) * 1.6;
      layer.set(x, y, step(C.sky, t * (C.sky.length - 1) + glow, x, y, 0.5));
    }
  }
  // Halo rings and the disc.
  for (let y = SUN_DISC.y - 30; y <= SUN_DISC.y + 30; y += 1) {
    for (let x = SUN_DISC.x - 30; x <= SUN_DISC.x + 30; x += 1) {
      const d = Math.hypot(x - SUN_DISC.x, y - SUN_DISC.y);
      if (d <= SUN_DISC.r) layer.set(x, y, d < SUN_DISC.r - 2 ? C.sun[0] : C.sun[1]);
      else if (d <= SUN_DISC.r + 4 && bayer(x, y) < 0.75) layer.set(x, y, C.sun[2]);
      else if (d <= SUN_DISC.r + 9 && bayer(x, y) < 0.35) layer.set(x, y, C.sun[3]);
    }
  }
  // Long, thin evening clouds lit from below by the low sun.
  const clouds = [
    { x: 60, y: 40, w: 70, h: 5 },
    { x: 236, y: 26, w: 52, h: 4 },
    { x: 330, y: 58, w: 90, h: 5 },
    { x: 520, y: 34, w: 76, h: 6 },
    { x: 668, y: 62, w: 50, h: 4 },
    { x: 452, y: 82, w: 60, h: 3 },
  ];
  for (const [ci, cloud] of clouds.entries()) {
    for (let y = Math.floor(cloud.y - cloud.h * 2); y <= cloud.y + 1; y += 1) {
      for (let x = Math.floor(cloud.x - cloud.w); x <= cloud.x + cloud.w; x += 1) {
        const k = (x - cloud.x) / cloud.w;
        const top = cloud.y - cloud.h * (1 - k * k) * (0.7 + 0.6 * noise(x, ci, 9, 30 + ci));
        if (y < top || Math.abs(k) > 1) continue;
        const below = (y - top) / Math.max(1, cloud.y - top);
        // Lavender bodies, gold and rose undersides; the side towards the sun is brighter.
        const towardsSun = clamp(1 - Math.abs(x - SUN_DISC.x) / 500);
        const v = 2.6 - below * 2.2 - towardsSun * 0.8 + (noise(x, y, 3, 40 + ci) - 0.5) * 0.6;
        layer.set(x, y, step(C.cloud, v, x, y, 0.4));
      }
    }
  }
}

// --------------------------------------------------------- far landscape

function paintFarLandscape(layer) {
  // Two ranges of low hills, paler with distance.
  const ranges = [
    { base: HORIZON - 16, amp: 10, scale: 120, seed: 11, ramp: C.farHill },
    { base: HORIZON - 7, amp: 6, scale: 70, seed: 12, ramp: C.nearHill },
  ];
  for (const r of ranges) {
    for (let x = 0; x < W; x += 1) {
      const top = Math.round(r.base - r.amp * noise(x, 0, r.scale, r.seed) - r.amp * 0.4 * noise(x, 0, r.scale / 3, r.seed + 1));
      for (let y = top; y < HORIZON + 1; y += 1) {
        const slope = noise(x + 1, 0, r.scale, r.seed) - noise(x - 1, 0, r.scale, r.seed);
        let v = 1 + slope * 12 + (y - top) * 0.06;
        // Field strips on the nearer range.
        if (r.ramp === C.nearHill) {
          const strip = Math.floor((x * 0.35 + y * 1.6) / 9);
          if (hash(strip, 7, 2) > 0.62) v -= 0.8;
        }
        layer.set(x, y, step(r.ramp, v, x, y));
      }
    }
  }
  // A village on the far range: red roofs and a church tower.
  const village = { x: 150, y: Math.round(HORIZON - 9) };
  const houses = [-26, -18, -9, 6, 14, 24, 33];
  houses.forEach((dx, i) => {
    const x0 = village.x + dx;
    const y0 = village.y + (i % 2);
    for (let x = 0; x < 6; x += 1) for (let y = 0; y < 3; y += 1) layer.set(x0 + x, y0 - y, y === 0 ? C.wall[1] : C.wall[0]);
    for (let x = -1; x < 7; x += 1) layer.set(x0 + x, y0 - 3, C.roof[x < 3 ? 0 : 1]);
    for (let x = 0; x < 6; x += 1) layer.set(x0 + x, y0 - 4, C.roof[x < 3 ? 1 : 2]);
  });
  const tx = village.x;
  for (let y = 0; y < 12; y += 1) for (let x = 0; x < 3; x += 1) layer.set(tx + x, village.y - y, x === 0 ? C.wall[0] : C.wall[1]);
  layer.set(tx + 1, village.y - 9, C.trunk[2]);
  for (const [dx, dy] of [[0, 12], [1, 12], [2, 12], [1, 13], [0, 14], [1, 14], [2, 14], [1, 15], [1, 16]]) layer.set(tx + dx, village.y - dy, C.spire[dx === 0 ? 0 : 1]);
}

// ------------------------------------------------------------------- trees

/**
 * A rounded deciduous crown made of a few lumps, lit from the upper left,
 * with a lumpy edge and leaf clusters.
 */
function crown(layer, cx, cy, rx, ry, ramp, seed, { lumps = 5, haze = 0 } = {}) {
  const blobs = [{ x: cx, y: cy, r: 1 }];
  for (let i = 0; i < lumps; i += 1) {
    const a = (i / lumps) * Math.PI * 2 + hash(i, seed, 5) * 0.8;
    blobs.push({ x: cx + Math.cos(a) * rx * 0.45, y: cy + Math.sin(a) * ry * 0.45, r: 0.62 + hash(i, seed, 6) * 0.2 });
  }
  for (let y = Math.floor(cy - ry * 1.2); y <= cy + ry * 1.2; y += 1) {
    for (let x = Math.floor(cx - rx * 1.2); x <= cx + rx * 1.2; x += 1) {
      let d = Infinity;
      for (const b of blobs) d = Math.min(d, Math.hypot((x - b.x) / (rx * b.r), (y - b.y) / (ry * b.r)));
      const edge = 0.92 + (noise(x, y, 2.2, seed) - 0.5) * 0.35;
      if (d > edge) continue;
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      let v = 1.1 + nx * 0.9 + ny * 1.1 + d * 0.5;
      v += (noise(x, y, 2.6, seed + 9) - 0.5) * 1.6;
      layer.set(x, y, step(ramp, v + haze, x, y, 0.2));
    }
  }
}

function trunk(layer, x, yTop, yBottom, ramp, width = 1) {
  for (let y = Math.round(yTop); y <= Math.round(yBottom); y += 1) {
    for (let k = 0; k < width; k += 1) layer.set(x + k, y, ramp[k === 0 ? 1 : 2]);
  }
}

function paintTreeLine(layer) {
  const palettes = [C.gold, C.orange, C.olive, C.gold, C.rust, C.olive, C.spruce];
  const trees = [];
  for (let x = -6; x < W + 6; x += 7 + Math.floor(hash(x, 0, 21) * 8)) {
    if (x > 112 && x < 196) continue; // leaves a gap for the village
    trees.push({ x, s: FAR + 2 + hash(x, 1, 21) * 6, size: 0.7 + hash(x, 2, 21) * 0.6, ramp: palettes[Math.floor(hash(x, 3, 21) * palettes.length)] });
  }
  trees.sort((a, b) => a.s - b.s);
  for (const t of trees) {
    const base = screenY(t.s);
    const ry = 7 * t.size;
    const rx = 6 * t.size;
    if (t.ramp === C.spruce) {
      // A narrow spruce.
      for (let y = 0; y < ry * 3; y += 1) {
        const half = Math.max(0, Math.round((y / (ry * 3)) * rx * 0.8 + (y % 3 === 0 ? 1 : 0)));
        for (let dx = -half; dx <= half; dx += 1) layer.set(Math.round(t.x + dx), Math.round(base - ry * 3 + y), t.ramp[dx < 0 ? 1 : 2]);
      }
      continue;
    }
    trunk(layer, Math.round(t.x), base - ry, base, C.trunk);
    crown(layer, t.x, base - ry * 1.6, rx, ry, t.ramp, Math.round(t.x), { lumps: 4, haze: -0.5 });
  }
}

function paintBigTree(layer) {
  const t = BIG_TREE;
  const base = screenY(t.s);
  const top = screenY(t.s, t.trunk);
  // Trunk with a fork, lit on the left.
  for (let y = Math.round(top); y <= Math.round(base); y += 1) {
    const flare = y > base - 4 ? 1 : 0;
    for (let dx = -2 - flare; dx <= 2 + flare; dx += 1) layer.set(t.e + dx, y, C.trunk[dx < -1 ? 0 : dx < 1 ? 1 : 2]);
  }
  for (let k = 0; k < 12; k += 1) {
    layer.set(Math.round(t.e - 2 - k * 0.7), Math.round(top - k), C.trunk[1]);
    layer.set(Math.round(t.e + 2 + k * 0.8), Math.round(top - k * 0.9), C.trunk[2]);
  }
  const cy = screenY(t.s, t.crown.h);
  crown(layer, t.e - 14, cy + 6, 18, 14, C.gold, 41, { lumps: 6 });
  crown(layer, t.e + 16, cy + 4, 17, 15, C.gold, 42, { lumps: 6 });
  crown(layer, t.e, cy - 8, 22, 17, C.gold, 43, { lumps: 7 });
  crown(layer, t.e + 4, cy + 12, 12, 8, C.orange, 44, { lumps: 4 });
}

/** Low shrubs on the hill, placed away from the ridden lines. */
const BUSHES = [{ e: 642, s: 108, r: 10 }, { e: 534, s: 114, r: 7 }, { e: 714, s: 92, r: 12 }];

function paintBushes(layer) {
  for (const [i, b] of BUSHES.entries()) {
    const y = screenY(b.s, terrain(b.e, b.s));
    crown(layer, b.e, y - b.r * 0.55, b.r, b.r * 0.62, [C.olive, C.spruce, C.rust][i % 3], 80 + i, { lumps: 5 });
  }
}

/** A lost bidon in the grass by the entry lane. */
function paintBidon(layer) {
  const x = 330;
  const y = Math.round(screenY(150));
  sprite(layer, x, y, [
    '..cbbbbbb.',
    '.ccwwrrwwb',
    '..cbbbbbb.',
  ], { c: C.cap, b: C.bottle[1], w: C.bottle[0], r: C.tape[0] });
  for (let dx = 1; dx < 10; dx += 1) layer.set(x + dx, y + 3, C.grass[3]);
}

function paintBirches(layer) {
  for (const [i, b] of BIRCHES.entries()) {
    const base = screenY(b.s);
    const height = 44 + i * 6;
    for (let y = Math.round(base - height); y <= base; y += 1) {
      layer.set(b.e, y, C.birch[(y * 7 + i) % 9 === 0 ? 2 : 0]);
      layer.set(b.e + 1, y, C.birch[(y * 5 + i) % 7 === 0 ? 2 : 1]);
    }
    crown(layer, b.e + 1, base - height + 6, 8, 14, i === 1 ? C.olive : C.gold, 60 + i, { lumps: 5 });
  }
}

// ------------------------------------------------------------ ground voxels

/** Colour of the ground at a point, before shading. */
function groundColour(e, s, h, light, x, y, shadow) {
  // Shadows switch to cooler ramps instead of only darker steps.
  const R = (name) => (shadow ? C.shadow[name] : C[name]);
  const dark = (FLAT_LIGHT - light) * 3.2 + (shadow ? 0.2 : 0);
  const far = clamp((s - FAR) / 120);
  const haze = (1 - far) * 0.9;
  // Stairs: earth treads with a timber nosing.
  const st = stairs(e, s);
  if (h > 0 && st.distance < STAIR_HALF && st.t > 0 && st.t < 1) {
    const local = st.t * hill.steps - Math.floor(st.t * hill.steps);
    // Timber nosing on each step and timber boards along both sides; earth treads worn in the middle.
    if (local < 0.16) return step(R('timber'), 0.4 + dark * 0.5, x, y);
    if (STAIR_HALF - st.distance < 1.5) return step(R('timber'), 1.6 + dark * 0.5, x, y);
    const worn = st.distance < STAIR_HALF * 0.6 ? 0.5 : 0;
    return step(R('track'), 0.8 + worn + dark * 0.6 + (noise(x, y, 1.5, 4) - 0.5) * 0.8, x, y);
  }
  const d = trackDistance(e, s);
  const edge = TRACK_WIDTH / 2 + (noise(e, s, 3, 8) - 0.5) * 2.2;
  if (d < edge) {
    // Mud with two ruts and a drier crown.
    let v = 1.2 + dark;
    const rut = Math.abs(d - 3.6);
    if (rut < 0.7 && noise(e, s, 2, 5) > 0.35) v += 0.8;
    if (hash(x, y, 24) > 0.985) return step(C.stone, shadow ? 2 : 1, x, y);
    if (d > edge - 1.4) v -= 0.6;
    v += (noise(x, y, 2.5, 6) - 0.5) * 0.7 + (noise(e, s, 9, 25) > 0.72 ? 0.7 : 0);
    // Churned grass at the edges of the track.
    if (d > edge - 2.5 && hash(x, y, 26) > 0.55) return step(R('grass'), 1.6 + dark, x, y);
    return step(R('track'), v - haze * 0.5, x, y);
  }
  // Grass: green with ochre patches, trampled near the track, fallen leaves.
  const patch = noise(e, s * 1.6, 26, 9) + (noise(x, y, 3, 19) - 0.5) * 0.25;
  const ochre = patch > 0.66 || d < edge + 2.5 || (far < 0.35 && patch > 0.5);
  const ramp = ochre ? R('dryGrass') : R('grass');
  let v = 1.1 + dark + (noise(x, y, 3, 10) - 0.5) * 0.7 - haze;
  // Tufts: a light blade two pixels tall with a dark pixel at its foot.
  const density = 0.93 + far * -0.04 + (ochre ? 0.02 : 0);
  const tuft = (ty) => hash(x, ty, 17) > density + 0.06 * (1 - far);
  if (tuft(y) || tuft(y + 1)) return step(ramp, v - 1.2, x, y, 0);
  if (tuft(y - 1)) return step(ramp, v + 1.1, x, y, 0);
  if (h === 0 && hash(x, y, 13) > 0.985 && !shadow) return C.leaf[Math.floor(hash(x, y, 14) * C.leaf.length)];
  const nearTree = Math.hypot(e - BIG_TREE.e, (s - BIG_TREE.s) * 1.6);
  if (nearTree < 60 && hash(x, y, 15) > 0.55 + nearTree / 90) return C.leaf[Math.floor(hash(x, y, 16) * C.leaf.length)];
  return step(ramp, v, x, y);
}

function paintGround(layer) {
  for (let x = 0; x < W; x += 1) {
    const e = x + 0.5;
    let ybuf = SOIL_TOP + 1;
    let previous = null;
    for (let s = GROUND_FRONT; s >= FAR; s -= 0.2) {
      const h = terrain(e, s);
      const y = screenY(s, h);
      const yi = Math.floor(y);
      if (yi >= ybuf) {
        previous = { h };
        continue;
      }
      const dhde = (terrain(e + 1, s) - terrain(e - 1, s)) / 2;
      const dhds = (terrain(e, s + 1) - terrain(e, s - 1)) / 2;
      const n = Math.hypot(dhde, dhds, 1);
      const light = (-dhde * SUN.e - dhds * SUN.s + SUN.h) / n;
      const shadow = inShadow(e, s, h);
      const surface = groundColour(e, s, h, light, x, yi, shadow);
      const span = ybuf - Math.max(0, yi);
      for (let py = Math.max(0, yi); py < ybuf; py += 1) {
        let colour = surface;
        if (span > 2 && py > yi) {
          // A vertical face: a stair riser or a cut edge.
          const st = stairs(e, s);
          const onStairs = st.distance < STAIR_HALF + 1 && st.t > 0 && st.t < 1;
          colour = onStairs
            ? step(shadow ? C.shadow.timber : C.timber, 1.2 + (py - yi) * 0.2 + (py - yi === span - 1 ? 1 : 0), x, py)
            : step(C.soil, 1 + (py - yi) * 0.2, x, py);
        }
        layer.set(x, py, colour);
      }
      ybuf = Math.max(0, yi);
      previous = { h };
    }
  }
}

// ------------------------------------------------------- sponsor banners

/** A 3 by 5 pixel font for banner lettering. */
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010',
  Z: '111001010100111', Y: '101101010010010', J: '001001001101010', X: '101101010101101', W: '101101111111101',
  '.': '000000000000010', ' ': '000000000000000',
};
/**
 * Banner messages: the site itself, and the empty slots offered for sale.
 * Each message lists layouts from the longest to the shortest, as lines; the
 * first that fits the banner is used. Words need no diacritics.
 */
const MESSAGES = {
  brand: [['CYCLOCROSS.CZ'], ['CYCLO', 'CROSS.CZ'], ['CYCLO', 'CROSS']],
  ad: {
    cs: [['KUP SI REKLAMU'], ['KUP SI', 'REKLAMU'], ['REKLAMA']],
    en: [['ADVERTISE HERE'], ['ADVERTISE', 'HERE'], ['YOUR AD', 'HERE']],
  },
};
export const LOCALES = ['cs', 'en'];
let locale = 'cs';

/** Every third banner offers itself for sale; the rest carry the site. */
const isAd = (index) => index % 3 === 1;

/** Banner designs: background, lettering and an accent block. */
const BANNERS = [
  { bg: 'orange', fg: 'white', accent: 'navy' },
  { bg: 'navy', fg: 'white', accent: 'yellow' },
  { bg: 'yellow', fg: 'ink', accent: 'red' },
  { bg: 'white', fg: 'red', accent: 'navy' },
  { bg: 'teal', fg: 'white', accent: 'white' },
  { bg: 'red', fg: 'white', accent: 'yellow' },
  { bg: 'white', fg: 'navy', accent: 'orange' },
];

const lineWidth = (line) => line.length * 4 - 1;

/** The first layout of a message that fits, with room for the badge if any. */
function bannerLayout(index, bw, bh) {
  const options = isAd(index) ? MESSAGES.ad[locale] : MESSAGES.brand;
  for (const lines of options) {
    const width = Math.max(...lines.map(lineWidth));
    const height = lines.length * 5 + (lines.length - 1) * 2;
    if (width + 4 > bw || height + 4 > bh) continue;
    return { lines, width, height, badge: width + 13 <= bw };
  }
  return null;
}

/**
 * Abstract graphics for banners that carry no lettering, one per design:
 * chevrons, a wave, diagonal stripes, dots, a split with a stripe, a zigzag
 * and a sawtooth. Returns the name of a banner colour.
 */
function abstractPixel(index, bx, by, bh, design) {
  const mid = (bh - 1) / 2;
  switch (index % BANNERS.length) {
    case 0: // chevrons pointing along the banner
      return (bx + Math.round(Math.abs(by - mid))) % 10 < 3 ? design.fg : (bx + Math.round(Math.abs(by - mid))) % 10 === 4 ? design.accent : design.bg;
    case 1: { // a wave
      const wave = mid + Math.round(Math.sin(bx / 3.2) * (bh / 4));
      return by >= wave - 1 && by <= wave + 1 ? design.accent : by > wave + 1 ? design.fg : design.bg;
    }
    case 2: // diagonal stripes
      return Math.floor((bx + by) / 4) % 2 === 0 ? design.accent : design.bg;
    case 3: { // dots
      const cx = (bx % 8) - 3.5;
      const cy = by - mid + ((Math.floor(bx / 8) % 2) * 2 - 1) * (bh / 5);
      return Math.hypot(cx, cy) < 2.6 ? (Math.floor(bx / 8) % 2 ? design.accent : design.fg) : design.bg;
    }
    case 4: // a split in two colours with a stripe on the seam
      return by < mid - 1 ? design.bg : by <= mid + 1 ? design.fg : 'navy';
    case 5: { // a zigzag band
      const zig = mid + (Math.abs((bx % 8) - 4) - 2);
      return Math.abs(by - zig) <= 1 ? design.fg : design.bg;
    }
    default: { // a sawtooth of triangles with a line on each edge
      const edge = ((bx % 12) / 12) * bh;
      return Math.abs(by - edge) < 1 ? design.accent : by > edge ? design.fg : design.bg;
    }
  }
}

/**
 * Colour of a banner pixel. (bx, by) are pixel coordinates inside a banner of
 * bw by bh pixels; `index` picks the design and the message. `slope` is how
 * steeply the banner runs on screen, in pixels down per pixel across.
 */
function bannerPixel(index, bx, by, bw, bh, shade = 0, slope = 0) {
  const design = BANNERS[index % BANNERS.length];
  const tone = (name) => C.banner[name][Math.min(C.banner[name].length - 1, shade)];
  if (by < 0 || by >= bh || bx < 0 || bx >= bw) return null;
  // Hems top and bottom.
  if (by === 0 || by === bh - 1) return tone(design.bg === 'white' ? 'grey' : design.bg);
  // Lettering this small shears into noise on a steep banner, as on the ramps
  // and the stairs. There, and where a banner is too narrow, it carries an
  // abstract graphic instead.
  const layout = Math.abs(slope) < 0.4 ? bannerLayout(index, bw, bh) : null;
  if (!layout) return tone(abstractPixel(index, bx, by - 1, bh - 2, design));
  // The lines, each centred, with a badge before the block when it fits.
  const block = layout.width + (layout.badge ? 7 : 0);
  const left = Math.floor((bw - block) / 2);
  const top = Math.floor((bh - layout.height) / 2);
  const badgeTop = Math.floor((bh - 5) / 2);
  if (layout.badge && bx >= left && bx < left + 5 && by >= badgeTop && by < badgeTop + 5) return tone(design.accent);
  const textLeft = left + (layout.badge ? 7 : 0);
  for (const [row, line] of layout.lines.entries()) {
    const y0 = top + row * 7;
    if (by < y0 || by >= y0 + 5) continue;
    const lx = bx - textLeft - Math.floor((layout.width - lineWidth(line)) / 2);
    if (lx < 0 || lx >= lineWidth(line)) continue;
    const glyph = FONT[line[Math.floor(lx / 4)]] ?? FONT[' '];
    const gx = lx % 4;
    if (gx < 3 && glyph[(by - y0) * 3 + gx] === '1') return tone(design.fg);
  }
  return tone(design.bg);
}

// ------------------------------------------------------------- structures

/**
 * Structures are drawn into a depth buffer (nearness to the camera), then
 * handed to the background or an occluder layer pixel by pixel.
 */
class Structure {
  constructor() {
    this.depth = new Float32Array(W * H).fill(-Infinity);
    this.colour = new Array(W * H).fill(null);
    this.layer = new Array(W * H).fill(null);
  }

  plot(x, y, p, hex, layer) {
    if (!hex || x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    const near = p.s * COS + p.h * SIN;
    if (near < this.depth[i]) return;
    this.depth[i] = near;
    this.colour[i] = hex;
    this.layer[i] = layer ?? (p.s > FLYOVER_SPLIT_S ? 'flyover-front' : 'back');
  }

  /** A straight 3D line, one pixel wide. */
  line(a, b, colour, layer) {
    const pa = proj(a);
    const pb = proj(b);
    const n = Math.ceil(Math.max(Math.abs(pb.x - pa.x), Math.abs(pb.y - pa.y)) * 2) + 1;
    for (let i = 0; i <= n; i += 1) {
      const t = i / n;
      const p = { e: a.e + (b.e - a.e) * t, s: a.s + (b.s - a.s) * t, h: a.h + (b.h - a.h) * t };
      const q = proj(p);
      const x = Math.floor(q.x);
      const y = Math.floor(q.y);
      this.plot(x, y, p, typeof colour === 'function' ? colour(t, x, y) : colour, typeof layer === 'function' ? layer(p) : layer);
    }
  }

  flush(layers) {
    for (let i = 0; i < W * H; i += 1) {
      if (this.colour[i]) layers[this.layer[i]].set(i % W, Math.floor(i / W), this.colour[i]);
    }
  }
}

function plank(u, size, seed) {
  const k = Math.floor(u / size);
  return { index: k, seam: u / size - k < 0.14, tone: hash(k, seed, 31) };
}

/**
 * The flyover as a temporary race structure: a steel scaffold frame, deck
 * plates with grip strips, handrails on both sides and sponsor banners hung
 * on the ramp sides. The near handrails go to the front layer, because they
 * pass in front of a rider on the deck.
 */
function paintFlyover(st) {
  const sub = (a, b) => ({ e: a.e - b.e, s: a.s - b.s, h: a.h - b.h });
  const steel = (k) => C.steel[Math.max(0, Math.min(3, k))];
  const nearLayer = 'front';

  // Scaffold posts and ledgers on both sides, and cross braces.
  // No posts under the flat top: the lane passes there.
  const posts = [];
  for (let u = U_FOOT_OUT + 22; u < U_FOOT_IN - 10; u += 24) if (u < U_OUT - 4 || u > U_IN + 4) posts.push(u);
  posts.push(U_OUT, U_IN);
  for (const u of posts) {
    const top = deckAt(u) - (u >= U_OUT && u <= U_IN ? DECK_THICKNESS : 2);
    if (top < 6) continue;
    for (const l of [-HALF + 1, HALF - 1]) {
      const base = onFlyover(u, l, 0, 'ground');
      st.line(base, { ...base, h: top }, l > 0 ? steel(1) : steel(2));
      // Base plate.
      st.line(onFlyover(u - 2, l, 0, 'ground'), onFlyover(u + 2, l, 0, 'ground'), steel(3));
    }
    // Cross brace under the deck, seen through the frame.
    st.line(onFlyover(u, -HALF + 1, 0, 'ground'), { ...onFlyover(u, HALF - 1, 0, 'ground'), h: top }, steel(2));
  }
  // Ledgers and diagonals in the side frames.
  for (const l of [-HALF + 1, HALF - 1]) {
    const sorted = [...posts].sort((a, b) => a - b);
    for (let i = 0; i + 1 < sorted.length; i += 1) {
      const u0 = sorted[i];
      const u1 = sorted[i + 1];
      if (u0 >= U_OUT && u1 <= U_IN) continue; // keep the lane under the flat top clear
      const h0 = deckAt(u0) - 3;
      const h1 = deckAt(u1) - 3;
      if (Math.min(h0, h1) < 8) continue;
      st.line(onFlyover(u0, l, 6, 'ground'), onFlyover(u1, l, 6, 'ground'), steel(l > 0 ? 1 : 2));
      st.line(onFlyover(u0, l, 6, 'ground'), { ...onFlyover(u1, l, 0, 'ground'), h: Math.min(h0, h1) }, steel(l > 0 ? 2 : 3));
    }
  }

  // The underside of the ramp down, visible through the frame: plates and joists.
  {
    const o = onFlyover(U_FOOT_OUT, -HALF);
    const u = sub(onFlyover(U_OUT, -HALF), o);
    const v = sub(onFlyover(U_FOOT_OUT, HALF), o);
    face({ ...o, h: o.h - 1 }, { ...u }, v, [o, onFlyover(U_OUT, -HALF), onFlyover(U_OUT, HALF), onFlyover(U_FOOT_OUT, HALF)].map((p) => ({ ...p, h: p.h - 1 })), (x, y, a, b, p) => {
      const joist = plank(a * 150, 12, 7).seam;
      st.plot(x, y, p, joist ? C.steel[2] : step(C.plate, 2.6, x, y));
    });
  }

  // Deck plates: the flat top and the ramp up face the camera.
  const deckFace = (u0, u1, seed, ramp) => {
    const o = onFlyover(u0, -HALF);
    const corners = [o, onFlyover(u1, -HALF), onFlyover(u1, HALF), onFlyover(u0, HALF)];
    face(o, sub(corners[1], o), sub(corners[3], o), corners, (x, y, a, b, p) => {
      const along = a * Math.abs(u1 - u0) * 0.7;
      const pk = plank(along, 9, seed);
      let v = pk.seam ? 1.9 : 1 + pk.tone * 0.5;
      // Grip strips across the ramp.
      if (ramp && Math.floor(along) % 9 === 0) v = 0.5;
      // A coloured edge strip on both sides, as on race flyovers.
      if (b < 0.06 || b > 0.94) return st.plot(x, y, p, C.banner.teal[b < 0.5 ? 1 : 0]);
      // Mud carried by tyres along the line.
      if (Math.abs(b - 0.5) < 0.12 && noise(x, y, 2, seed) > 0.25 + (ramp ? a * 0.3 : 0.2)) return st.plot(x, y, p, step(C.track, 1.8, x, y));
      st.plot(x, y, p, step(C.plate, v, x, y));
    });
  };
  deckFace(U_OUT, U_IN, 3, false);
  deckFace(U_IN, U_FOOT_IN, 5, true);

  // South-west edge of the deck: a steel beam with the edge strip.
  const fascia = (u0, u1) => {
    const n = Math.ceil(Math.abs(u1 - u0) * 2);
    for (let i = 0; i <= n; i += 1) {
      const u = u0 + ((u1 - u0) * i) / n;
      const thick = u >= U_OUT && u <= U_IN ? DECK_THICKNESS : 3;
      st.line(onFlyover(u, HALF, -thick), onFlyover(u, HALF, 0), (t) => (t > 0.85 ? C.steel[0] : C.steel[2]));
    }
  };
  fascia(U_FOOT_OUT, U_FOOT_IN);

  // Sponsor banners hung on the south-west side of both ramps, following the slope.
  let banner = 0;
  for (const [u0, u1] of [[U_FOOT_OUT + 4, U_OUT - 2], [U_IN + 2, U_FOOT_IN - 4]]) {
    const length = u1 - u0;
    const count = Math.max(1, Math.round(length / 50));
    for (let k = 0; k < count; k += 1) {
      const a0 = u0 + (length * k) / count + 1;
      const a1 = u0 + (length * (k + 1)) / count - 1;
      const index = banner++;
      const top0 = onFlyover(a0, HALF + 0.5, -3);
      const top1 = onFlyover(a1, HALF + 0.5, -3);
      const drop = (p) => ({ ...p, h: Math.max(1, p.h - BANNER_DROP) });
      const widthPx = Math.abs(top1.e - top0.e);
      const slope = (proj(top1).y - proj(top0).y) / (proj(top1).x - proj(top0).x);
      face(top0, sub(top1, top0), sub(drop(top0), top0), [top0, top1, drop(top1), drop(top0)], (x, y, a, b, p) => {
        const bx = Math.floor(a * widthPx);
        const by = Math.floor(b * (BANNER_DROP * COS));
        st.plot(x, y, p, bannerPixel(index + 1, bx, by, Math.floor(widthPx), Math.floor(BANNER_DROP * COS), 0, slope));
      });
    }
  }

  // Handrails: posts, a top rail and a knee rail on both sides.
  for (const l of [-HALF, HALF]) {
    const layer = l > 0 ? nearLayer : undefined;
    for (let u = U_FOOT_OUT + 6; u <= U_FOOT_IN - 4; u += 16) {
      st.line(onFlyover(u, l, 0), onFlyover(u, l, RAIL), l > 0 ? C.steel[0] : C.steel[2], layer);
    }
    for (const dh of [RAIL, RAIL / 2]) {
      const n = 160;
      for (let i = 0; i < n; i += 1) {
        const ua = U_FOOT_OUT + 4 + ((U_FOOT_IN - U_FOOT_OUT - 8) * i) / n;
        const ub = U_FOOT_OUT + 4 + ((U_FOOT_IN - U_FOOT_OUT - 8) * (i + 1)) / n;
        st.line(onFlyover(ua, l, dh), onFlyover(ub, l, dh), dh === RAIL ? (l > 0 ? C.steel[0] : C.steel[1]) : C.steel[2], layer);
      }
    }
  }
}

// ------------------------------------------------------ barriers and tape

function paintBarriers(st) {
  const half = TRACK_WIDTH / 2;
  for (const b of barriers) {
    // A white plank on two legs across the lane, about 40 cm high.
    for (const ds of [-half + 1, half - 1]) {
      for (const de of [-1, 1]) st.line({ e: b.e + de, s: b.s + ds, h: 0 }, { e: b.e + de * 0.4, s: b.s + ds, h: 12 }, C.post[1], 'back');
      st.line({ e: b.e - 3, s: b.s + ds, h: 0 }, { e: b.e + 3, s: b.s + ds, h: 0 }, C.post[2], 'back');
    }
    for (let ds = -half; ds <= half; ds += 0.25) {
      for (let h = 11; h <= 16; h += 0.5) {
        for (const de of [-1, 0, 1]) {
          const p = { e: b.e + de, s: b.s + ds, h };
          const q = proj(p);
          const top = h >= 15.5;
          const colour = top ? C.board[0] : de < 0 ? C.board[1] : de === 0 ? C.board[1] : C.board[2];
          st.plot(Math.floor(q.x), Math.floor(q.y), p, ds > half - 0.6 ? C.board[2] : colour, 'back');
        }
      }
    }
  }
}

/** Course tape on stakes, about a metre high, following the ground. */
function paintTape(layer, from, to, { onTerrain = false } = {}) {
  const length = Math.hypot(to.e - from.e, to.s - from.s);
  const stakes = Math.max(1, Math.round(length / 38));
  const ground = (t) => {
    const e = from.e + (to.e - from.e) * t;
    const s = from.s + (to.s - from.s) * t;
    return { e, s, h: onTerrain ? terrain(e, s) : 0 };
  };
  for (let i = 0; i <= stakes; i += 1) {
    const g = ground(i / stakes);
    const top = proj({ ...g, h: g.h + TAPE_HEIGHT + 3 });
    const bottom = proj(g);
    for (let y = Math.round(top.y); y <= Math.round(bottom.y); y += 1) layer.set(Math.round(top.x), y, y === Math.round(top.y) ? C.post[0] : C.post[1]);
  }
  for (let i = 0; i < stakes; i += 1) {
    const g0 = ground(i / stakes);
    const g1 = ground((i + 1) / stakes);
    const a = proj({ ...g0, h: g0.h + TAPE_HEIGHT });
    const b = proj({ ...g1, h: g1.h + TAPE_HEIGHT });
    const n = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))) + 1;
    for (let k = 1; k < n; k += 1) {
      const t = k / n;
      const sag = Math.sin(t * Math.PI) * 1.6;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t + sag);
      layer.set(x, y, Math.floor((x + y) / 3) % 2 === 0 ? C.tape[0] : C.tape[1]);
    }
  }
}

/** Crowd barriers dressed with sponsor banners. On a slope the panels step up, each one level. */
function paintFences(st) {
  for (const fence of FENCES) {
    const length = Math.hypot(fence.to.e - fence.from.e, fence.to.s - fence.from.s);
    const point = (d) => {
      const t = d / length;
      return { e: fence.from.e + (fence.to.e - fence.from.e) * t, s: fence.from.s + (fence.to.s - fence.from.s) * t };
    };
    const panelLength = PANEL;
    let d = 0;
    let index = fence.first;
    while (d < length - 8) {
      // Some banners are twice as long, so the message fits on one line.
      const wide = index % BANNERS.length === 6 && !fence.onTerrain;
      const span = Math.min(length - d, wide ? panelLength * 2 : panelLength);
      const g0 = point(d + 0.6);
      const g1 = point(d + span - 0.6);
      // On a slope the banner follows the ground, like banners along a flight of stairs.
      const at = (g, dh) => ({ e: g.e, s: g.s, h: (fence.onTerrain ? terrain(g.e, g.s) - 1 : 0) + dh });
      for (const g of [g0, g1]) {
        st.line(at(g, 0), at(g, FENCE_HEIGHT + 1), C.steel[1], 'back');
        st.line(at({ ...g, e: g.e - 3 }, 0), at({ ...g, e: g.e + 3 }, 0), C.steel[3], 'back');
      }
      const p00 = at(g0, FENCE_HEIGHT);
      const p10 = at(g1, FENCE_HEIGHT);
      const p01 = at(g0, 3);
      const p11 = at(g1, 3);
      const widthPx = Math.abs(proj(p10).x - proj(p00).x);
      const heightPx = Math.round((FENCE_HEIGHT - 3) * COS);
      const which = index;
      const slope = (proj(p10).y - proj(p00).y) / (proj(p10).x - proj(p00).x);
      face(p00, { e: p10.e - p00.e, s: p10.s - p00.s, h: p10.h - p00.h }, { e: 0, s: 0, h: 3 - FENCE_HEIGHT }, [p00, p10, p11, p01], (x, y, a, b, p) => {
        st.plot(x, y, p, bannerPixel(which, Math.floor(a * widthPx), Math.floor(b * heightPx), Math.floor(widthPx), heightPx, 0, slope), 'back');
      });
      d += span;
      index += 1;
    }
  }
}

/** Feather flags: a tall curved sail on a bent pole. */
function paintFlags(layer) {
  for (const [i, flag] of FLAGS.entries()) {
    const base = { e: flag.e, s: flag.s, h: terrain(flag.e, flag.s) };
    const foot = proj(base);
    const height = 62;
    const top = proj({ ...base, h: base.h + height });
    const x = Math.round(foot.x);
    for (let y = Math.round(top.y); y <= Math.round(foot.y); y += 1) layer.set(x, y, C.steel[1]);
    const ramp = C.banner[flag.colour];
    const sailTop = Math.round(top.y) + 1;
    const sailHeight = Math.round(height * COS * 0.68);
    for (let k = 0; k < sailHeight; k += 1) {
      const t = k / sailHeight;
      // Widest a third of the way down, rounded at the top, tapering to the pole.
      const width = Math.round(8 * Math.sin(Math.min(1, t * 1.5 + 0.12) * Math.PI * 0.5) * (1 - t * 0.55));
      for (let dx = 1; dx <= width; dx += 1) {
        const edge = dx === width;
        const stripe = dx === 2 && t > 0.1;
        const letter = dx >= 4 && dx <= 5 && t > 0.2 && t < 0.8 && hash(i, k, 90) > 0.45;
        layer.set(x + dx, sailTop + k, edge ? ramp[1] : stripe ? C.banner.white[0] : letter ? C.banner.white[0] : ramp[0]);
      }
    }
  }
}

// ------------------------------------------------------------ soil cutaway

/** A small object buried in the soil: drawn from a pixel map and a key. */
function sprite(layer, x0, y0, rows, key) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => key[ch] && layer.set(x0 + x, y0 + y, key[ch])));
}

function paintSoil(layer) {
  // The lip: grass overhang and a line of tufts.
  for (let x = 0; x < W; x += 1) {
    const lip = SOIL_TOP + 1 + (noise(x, 0, 3, 50) > 0.6 ? 1 : 0);
    for (let y = SOIL_TOP + 1; y <= lip; y += 1) layer.set(x, y, C.grass[2]);
    if (hash(x, 1, 51) > 0.7) layer.set(x, lip + 1, C.grass[3]);
    const bottom = SOIL_BOTTOM + Math.floor(noise(Math.floor(x / 4), 0, 3, 52) * 3) * 2;
    for (let y = lip + 1; y < H; y += 1) {
      if (y > bottom) break;
      const depth = (y - SOIL_TOP) / (SOIL_BOTTOM - SOIL_TOP);
      const ramp = depth < 0.32 ? C.topsoil : C.soil;
      let v = 1 + (noise(x, y, 2.5, 53) - 0.5) * 1.4 + (depth < 0.32 ? depth : (depth - 0.32) * 0.8);
      if (depth > 0.3 && depth < 0.36) v += bayer(x, y) > 0.5 ? 1 : 0;
      if (y > lip + 1 || hash(x, 2, 51) > 0.7) layer.set(x, y, step(ramp, v, x, y));
    }
    // Stepped, dithered clusters fading into the page: a solid lighter band,
    // a checkerboard, then a sparse pattern, each two rows tall.
    const fadeTop = bottom + 1;
    for (let k = 0; k < 8; k += 1) {
      const y = fadeTop + k;
      if (y >= H) break;
      const chunk = hash(Math.floor(x / 4), Math.floor(k / 2), 54);
      const keep = k < 2 ? chunk > 0.15 : k < 4 ? chunk > 0.45 || (x + y) % 2 === 0 : k < 6 ? (x + y) % 2 === 0 && chunk > 0.35 : x % 4 === 0 && y % 2 === 0 && chunk > 0.5;
      if (keep) layer.set(x, y, C.fade[Math.min(2, Math.floor(k / 3))]);
    }
  }
  // Roots from the turf.
  for (let r = 0; r < 26; r += 1) {
    let x = Math.floor(hash(r, 0, 60) * W);
    let y = SOIL_TOP + 3;
    for (let k = 0; k < 6 + hash(r, 1, 60) * 10; k += 1) {
      layer.set(x, y, C.root);
      y += 1;
      x += hash(r, k, 61) > 0.6 ? 1 : hash(r, k, 61) < 0.25 ? -1 : 0;
    }
  }
  // Stones, kept out of the way of the finds.
  for (let i = 0; i < 34; i += 1) {
    const cx = Math.floor(hash(i, 0, 70) * W);
    const cy = Math.floor(SOIL_TOP + 14 + hash(i, 1, 70) * (SOIL_BOTTOM - SOIL_TOP - 18));
    if (FINDS.some((f) => cx > f.x - 5 && cx < f.x + f.w + 5 && cy > f.y - 4 && cy < f.y + f.h + 4)) continue;
    const r = 1.2 + hash(i, 2, 70) * 2.2;
    for (let y = -3; y <= 3; y += 1) {
      for (let x = -4; x <= 4; x += 1) {
        const d = Math.hypot(x / (r * 1.3), y / r);
        if (d > 1) continue;
        layer.set(cx + x, cy + y, C.stone[d > 0.8 ? 3 : x + y < -1 ? 0 : x + y > 1 ? 2 : 1]);
      }
    }
  }
  for (const find of FINDS) find.paint(layer, find.x, find.y);
}

/** Thick lines for the rusty frame: a lit upper pixel, a shaded lower one and pits of rust. */
function rustyTube(layer, a, b) {
  const n = Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))) * 2;
  for (let i = 0; i <= n; i += 1) {
    const x = Math.round(a.x + ((b.x - a.x) * i) / n);
    const y = Math.round(a.y + ((b.y - a.y) * i) / n);
    const pit = hash(x, y, 95);
    layer.set(x, y, pit < 0.12 ? C.rust[3] : pit > 0.85 ? C.rust[0] : C.rust[1]);
    layer.set(x, y + 1, pit < 0.3 ? C.rust[3] : C.rust[2]);
  }
}

/** An old steel frame, lying a little tilted, without wheels or cranks. */
function paintFrame(layer, x0, y0) {
  const tilt = (-7 * Math.PI) / 180;
  const k = 1.4;
  const at = (x, y) => ({
    x: x0 + 28 + ((x - 20) * Math.cos(tilt) - (y - 11) * Math.sin(tilt)) * k,
    y: y0 + 15 + ((x - 20) * Math.sin(tilt) + (y - 11) * Math.cos(tilt)) * k,
  });
  const rear = at(2, 18);
  const bracket = at(15, 19);
  const seat = at(12, 5);
  const headTop = at(32, 5);
  const headBottom = at(34, 11);
  for (const [a, b] of [
    [seat, rear], [bracket, rear], // the rear triangle
    [at(11, 2), bracket], [seat, headTop], [headBottom, bracket], [headTop, headBottom],
    [headBottom, at(36, 15)], [at(36, 15), at(38, 19)], // the fork
    [headTop, at(33, 2)], [at(33, 2), at(37, 2)], [at(37, 2), at(38, 5)], // stem and a bent bar
  ]) rustyTube(layer, a, b);
  // The saddle, its cover long gone.
  for (let x = 7; x <= 14; x += 0.5) layer.set(Math.round(at(x, 1).x), Math.round(at(x, 1).y), C.fur[2]);
}

/** A dinosaur, long before cyclocross: skull, spine, ribs, legs and tail. */
function paintFossil(layer, x0, y0) {
  const bone = (x, y, shade = 0) => layer.set(x0 + x, y0 + y, C.bone[shade]);
  const spine = (x) => Math.round(5 - 4 * Math.sin((Math.PI * (x - 11)) / 44) + (x > 48 ? (x - 48) * 0.28 : 0));
  sprite(layer, x0, y0 + 2, [
    '..aaaaaaa...',
    '.abbbbbbba..',
    'abbc.bbbbba.',
    'abbbbbbcbbba',
    'bbbbbbbbbbb.',
    'b.b.b.bbbb..',
    '............',
    '.b.b.b.bb...',
    'cccccccc....',
  ], { a: C.bone[0], b: C.bone[1], c: C.bone[2] });
  for (let x = 12; x <= 66; x += 3) {
    const y = spine(x);
    const small = x > 52;
    bone(x, y, 0);
    if (!small) bone(x + 1, y, 1);
    bone(x, y + 1, small ? 2 : 1);
    if (!small) bone(x + 1, y + 1, 2);
  }
  // Ribs curving down from the middle of the back.
  for (let x = 20; x <= 41; x += 3) {
    const y = spine(x) + 2;
    const length = 5 + Math.round(3 * Math.sin((Math.PI * (x - 18)) / 26));
    for (let k = 0; k < length; k += 1) bone(x + Math.floor(k / 3), y + k, k < 2 ? 1 : 2);
  }
  // Two legs with three-toed feet.
  for (const [hip, knee, ankle] of [[[19, 7], [21, 11], [18, 15]], [[46, 6], [49, 10], [46, 15]]]) {
    for (const [a, b] of [[hip, knee], [knee, ankle]]) {
      const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      for (let i = 0; i <= n; i += 1) bone(Math.round(a[0] + ((b[0] - a[0]) * i) / n), Math.round(a[1] + ((b[1] - a[1]) * i) / n), 1);
    }
    for (let k = -1; k <= 3; k += 1) bone(ankle[0] + k, ankle[1] + 1, k === 1 ? 1 : 2);
  }
}

/** A green lager bottle with a cream label and a gold foil neck, as Czech beer comes. */
function paintBottle(layer, x0, y0) {
  sprite(layer, x0, y0, [
    '.dddddddddddddddd.........',
    'dhhhhhhhhhhhhhhhhdd.......',
    'dgggllllllllggggggddddddf.',
    'dggllrrrrrrllgggggggggfffF',
    'dgglllyyyylllggggggddddff.',
    'dgggllllllllgggggggd......',
    '.dddddddddddddddddd.......',
  ], { d: C.glass[3], g: C.glass[2], h: C.glass[1], l: C.label[0], r: C.banner.red[0], y: C.gold[1], f: C.gold[1], F: C.gold[2] });
}

/** A cowbell, rung at every cyclocross race, with a stub of its strap. */
function paintCowbell(layer, x0, y0) {
  sprite(layer, x0, y0, [
    '..rrr....',
    '.r...r...',
    '..ddd....',
    '.dlggd...',
    '.dlggd...',
    'dlgggmd..',
    'dlgggmd..',
    'dgggmmd..',
    'ddddddd..',
    '...k.....',
  ], { r: C.banner.red[0], d: C.gold[3], l: C.gold[0], g: C.gold[1], m: C.gold[2], k: C.steel[3] });
}

/**
 * A mole at the end of its passage, nose first. The passage comes down from
 * the molehill at the front edge, bends and runs to the mole: one tunnel,
 * with no dead end.
 */
function paintMole(layer, x0, y0) {
  const hill = MOLEHILLS[0];
  const brush = (x, y) => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) layer.set(Math.round(x) + dx, Math.round(y) + dy, C.topsoil[3]);
  };
  const ty = y0 + 2;
  const bend = 4;
  // Down from the mound to the start of the bend.
  for (let y = hill.y - 1; y <= ty - bend; y += 1) brush(hill.x, y);
  // A quarter turn towards the mole.
  for (let a = 0; a <= 90; a += 5) {
    const r = (a * Math.PI) / 180;
    brush(hill.x + bend - bend * Math.cos(r), ty - bend + bend * Math.sin(r));
  }
  // Along to the mole, gently rising and falling.
  for (let x = hill.x + bend; x <= x0; x += 1) brush(x, ty + Math.round(Math.sin((x - hill.x - bend) / 5) * 1.2));
  sprite(layer, x0, y0, [
    '..ffffff...',
    '.fFFFFFFf..',
    'fFFFFFFFFpp',
    'fFFFFFFFFfp',
    '.pfffffpf..',
  ], { f: C.fur[1], F: C.fur[0], p: C.pink[0] });
}

/**
 * Molehills: round, bell-shaped domes of dark, fresh earth with steep sides
 * and a lumpy outline, the way the mole's piles look in Czech cartoons, lit
 * from the left with a short shadow on the grass. The one at the front edge
 * sits over the mole's passage.
 */
const MOLEHILLS = [
  { x: 22, y: SOIL_TOP + 1, r: 9, h: 10 },
  { x: 64, y: SOIL_TOP - 9, r: 6, h: 7 },
  { x: 40, y: SOIL_TOP - 21, r: 4, h: 5 },
];

function paintMolehills(layer) {
  for (const [i, hill] of MOLEHILLS.entries()) {
    // A short cast shadow to the right.
    for (let x = 1; x <= Math.ceil(hill.r / 2); x += 1) {
      for (let y = 0; y <= 1; y += 1) layer.set(hill.x + hill.r + x - y, hill.y - y, C.shadow.grass[2]);
    }
    const tops = [];
    for (let x = -hill.r; x <= hill.r; x += 1) {
      const t = Math.abs(x / (hill.r + 0.5));
      // A superellipse: steep sides and a broad, rounded crown.
      const lump = hash(Math.floor((x + 20) / 3), i, 121) > 0.6 && t < 0.85 ? 1 : 0;
      tops.push(hill.y - Math.round(hill.h * Math.pow(Math.max(0, 1 - Math.pow(t, 2.6)), 1 / 2.2)) - lump);
    }
    tops.forEach((top, k) => {
      const x = k - hill.r;
      const t = x / hill.r;
      for (let y = top; y <= hill.y; y += 1) {
        const edge = y === top || k === 0 || k === tops.length - 1 || y < tops[k - 1] || y < tops[k + 1];
        const depth = (y - top) / Math.max(1, hill.y - top);
        let shade = t < -0.35 ? 1 : t < 0.35 ? 1 + (depth > 0.5 ? 1 : 0) : 2;
        if (edge) shade = t < 0.1 && y === top ? 0 : 3;
        else if (hash(x, y, 122 + i) > 0.86) shade = Math.max(0, shade - 1);
        layer.set(hill.x + x, y, C.topsoil[shade]);
      }
    });
    // Crumbs on the grass at the foot.
    for (let k = 0; k < hill.r; k += 1) {
      const side = hash(k, i, 123) > 0.5 ? 1 : -1;
      const x = hill.x + side * (hill.r + 1 + Math.floor(hash(k, i, 124) * 3));
      const y = hill.y - Math.floor(hash(k, i, 125) * 2);
      layer.set(x, y, C.topsoil[hash(k, i, 126) > 0.5 ? 1 : 2]);
    }
  }
}

/** An earthworm near the surface: a plump, ringed S curve with a saddle. */
function paintWorm(layer, x0, y0) {
  const length = 20;
  for (let x = 0; x < length; x += 1) {
    const y = y0 + 3 + Math.round(Math.sin(x / 3) * 2);
    const end = x === 0 || x === length - 1;
    const ring = x % 3 === 2;
    const saddle = x >= 5 && x <= 7;
    layer.set(x0 + x, y, ring || saddle ? C.pink[1] : C.pink[0]);
    if (!end) layer.set(x0 + x, y + 1, C.pink[1]);
    if (!end && !ring && !saddle && x % 4 === 0) layer.set(x0 + x, y, C.paper[0]);
  }
}

/** An old blue bidon, standing: push-pull nozzle, black cap, a grip waist and a white stripe. */
function paintOldBidon(layer, x0, y0) {
  sprite(layer, x0, y0, [
    '...nn...',
    '...nm...',
    '..cccc..',
    '.cccccc.',
    '.kwwwgk.',
    'kwwwwwgk',
    'kwwwwwgk',
    'kooooopk',
    'kwwwwwgk',
    '.kwwwgk.',
    '.kwwwgk.',
    'kwwwwwgk',
    'kwwwwwgk',
    'kwwwwwgk',
    '.kkkkkk.',
  ], { k: C.bidon[2], w: C.bidon[0], g: C.bidon[1], c: C.cap, n: C.steel[1], m: C.steel[2], o: C.bottle[0], p: C.bottle[1] });
}

/**
 * Race number 13, pinned upside down for luck as riders do, so the whole
 * plate, pin holes and all, is drawn turned half way round.
 */
function paintRaceNumber(layer, x0, y0) {
  const plate = [
    'pppppppppppp',
    'p.pwwwwwwp.p',
    'pwwwwwwwwwwp',
    'pwwwbwwbbbwp',
    'pwwbbwwwwbwp',
    'pwwwbwwwbbwp',
    'pwwwbwwwwbwp',
    'pwwwbwwbbbwp',
    'p.pwwwwwwp.p',
    'pppppppppppp',
  ];
  const turned = plate.map((row) => [...row].reverse().join('')).reverse();
  sprite(layer, x0, y0, turned, { p: C.paper[1], w: C.paper[0], b: C.ink });
}

/** Lost things in the soil, left to right. */
const FINDS = [
  { x: 46, y: SOIL_TOP + 10, w: 11, h: 5, paint: paintMole },
  { x: 100, y: SOIL_TOP + 26, w: 62, h: 30, paint: paintFrame },
  { x: 214, y: SOIL_TOP + 20, w: 7, h: 10, paint: paintCowbell },
  { x: 252, y: SOIL_TOP + 7, w: 20, h: 7, paint: paintWorm },
  { x: 344, y: SOIL_TOP + 40, w: 68, h: 17, paint: paintFossil },
  { x: 468, y: SOIL_TOP + 17, w: 12, h: 10, paint: paintRaceNumber },
  { x: 548, y: SOIL_TOP + 34, w: 26, h: 7, paint: paintBottle },
  { x: 640, y: SOIL_TOP + 26, w: 8, h: 15, paint: paintOldBidon },
];

// --------------------------------------------------------------- the scene

/** The whole scene, with the banner lettering in one language. */
export function paintScene(language = 'cs') {
  locale = language;
  const layers = {};
  for (const id of ['back', ...occluders.map((o) => o.id)]) layers[id] = new Layer();
  const back = layers.back;
  paintSky(back);
  paintFarLandscape(back);
  paintTreeLine(back);
  paintGround(back);
  paintBirches(back);
  paintBigTree(back);
  paintBushes(back);
  paintBidon(back);
  paintFlags(back);
  for (const tape of TAPES.filter((t) => t.layer === 'back')) paintTape(back, tape.from, tape.to, tape);
  const st = new Structure();
  paintFences(st);
  paintBarriers(st);
  paintFlyover(st);
  st.flush(layers);
  for (const tape of TAPES.filter((t) => t.layer !== 'back')) paintTape(layers[tape.layer], tape.from, tape.to, tape);
  paintSoil(back);
  paintMolehills(back);
  const out = { width: W, height: H };
  for (const [id, layer] of Object.entries(layers)) out[id] = layer.rgba;
  return out;
}
