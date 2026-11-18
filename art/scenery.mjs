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
  canvas, DECK, DECK_THICKNESS, FLYOVER_SPLIT_S, GROUND_FRONT, hillHeight, pitchDegrees, route, structures, SUMMIT, TRACK_WIDTH,
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

/** Direction towards the sun: from the west, a little in front of the scene, high, matching the riders' upper-left light. */
const SUN = (() => {
  const v = { e: -0.55, s: 0.25, h: 0.8 };
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
const LATERAL = { e: -Math.SQRT1_2, s: Math.SQRT1_2 }; // towards the south-west side of the flyover
const HALF = flyover.width / 2;
const side = (p, k, h = p.h) => ({ e: p.e + LATERAL.e * HALF * k, s: p.s + LATERAL.s * HALF * k, h });
/** Along the flyover, u = e + s grows towards the ramp up. */
const along = (p) => p.e + p.s;
const lateralOf = (p) => ((p.e - p.s) - (flyover.topIn.e - flyover.topIn.s)) / -Math.SQRT2;

/** Height of the top of the flyover at a position along it. */
function deckAt(u) {
  const uIn = along(flyover.topIn);
  const uOut = along(flyover.topOut);
  const uFootIn = along(flyover.footIn);
  const uFootOut = along(flyover.footOut);
  if (u >= uOut && u <= uIn) return DECK;
  if (u > uIn && u <= uFootIn) return DECK * (1 - (u - uIn) / (uFootIn - uIn));
  if (u < uOut && u >= uFootOut) return DECK * ((u - uFootOut) / (uOut - uFootOut));
  return -1;
}

/** True inside the flyover's solid timber: the ramps are wedges, the flat top a slab. */
function flyoverSolid(e, s, h) {
  const p = { e, s };
  if (Math.abs(lateralOf(p)) > HALF) return false;
  const u = along(p);
  const top = deckAt(u);
  if (top < 0 || h > top) return false;
  const flat = u >= along(flyover.topOut) && u <= along(flyover.topIn);
  return !flat || h >= DECK - DECK_THICKNESS;
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
  return Math.min(best, Math.hypot(e - poseArea.e, (s - poseArea.s) * 1.3) - 6);
}

const stairs = (e, s) => toSegment(e, s, hill.stairsFoot, hill.stairsTop);
const drop = (e, s) => toSegment(e, s, hill.dropTop, hill.dropFoot);
const STAIR_HALF = 7;

/** Terrain height with the stairs and the drop cut into the hill. */
function terrain(e, s) {
  let h = hillHeight(e, s);
  if (h <= 0) return 0;
  const st = stairs(e, s);
  if (st.distance < STAIR_HALF + 2 && st.t > 0 && st.t < 1) {
    const stepped = (SUMMIT * Math.floor(st.t * hill.steps + 0.0001)) / hill.steps;
    const k = smooth(STAIR_HALF, STAIR_HALF + 2, st.distance);
    h = stepped + (h - stepped) * k;
  }
  const dr = drop(e, s);
  if (dr.distance < 10 && dr.t > 0 && dr.t < 1) {
    const line = SUMMIT * (1 - dr.t);
    h = line + (h - line) * smooth(6, 10, dr.distance);
  }
  return Math.max(0, h);
}

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
  return barriers.some((b) => Math.abs(e - b.e) < 1.5 && Math.abs(s - b.s) < 9 && h < 15 && (h > 9 || Math.abs(Math.abs(s - b.s) - 8) < 1.2));
}

function inShadow(e, s, h0) {
  for (let z = h0 + 1; z < 100; z += 1.5) {
    const k = (z - h0) / SUN.h;
    const pe = e + SUN.e * k;
    const ps = s + SUN.s * k;
    if (flyoverSolid(pe, ps, z) || treeSolid(pe, ps, z) || (z < 16 && barrierSolid(pe, ps, z))) return true;
  }
  return false;
}

// -------------------------------------------------------------------- sky

function paintSky(layer) {
  for (let y = 0; y < Math.ceil(HORIZON) + 1; y += 1) {
    const t = (y / HORIZON) ** 1.2;
    for (let x = 0; x < W; x += 1) layer.set(x, y, step(C.sky, t * (C.sky.length - 1), x, y, 0.5));
  }
  const clouds = [
    { x: 92, y: 30, w: 46, h: 9 },
    { x: 300, y: 18, w: 34, h: 6 },
    { x: 470, y: 40, w: 58, h: 10 },
    { x: 650, y: 14, w: 30, h: 5 },
  ];
  for (const cloud of clouds) {
    const blobs = [];
    for (let i = 0; i < 6; i += 1) {
      const k = i / 5 - 0.5;
      blobs.push({ x: cloud.x + k * cloud.w * 0.9, y: cloud.y - cloud.h * (0.35 + 0.5 * (1 - Math.abs(k) * 1.8)) * hash(i, cloud.x, 3), r: cloud.h * (0.8 + 0.5 * (1 - Math.abs(k) * 2)) });
    }
    for (let y = Math.floor(cloud.y - cloud.h * 2.2); y <= cloud.y; y += 1) {
      for (let x = Math.floor(cloud.x - cloud.w); x <= cloud.x + cloud.w; x += 1) {
        let inside = false;
        let lit = 0;
        for (const b of blobs) {
          const d = Math.hypot((x - b.x) / (b.r * 1.5), (y - b.y) / b.r);
          if (d < 1) {
            inside = true;
            lit = Math.max(lit, (-(x - b.x) * 0.4 - (y - b.y)) / b.r);
          }
        }
        if (!inside) continue;
        const bottom = (y - (cloud.y - 2)) / 2;
        layer.set(x, y, step(C.cloud, 1.2 - lit * 1.4 + Math.max(0, bottom), x, y));
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
const BUSHES = [{ e: 606, s: 114, r: 11 }, { e: 712, s: 110, r: 13 }, { e: 646, s: 88, r: 7 }];

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
  const dark = (FLAT_LIGHT - light) * 4 + (shadow ? 1.4 : 0);
  const far = clamp((s - FAR) / 120);
  const haze = (1 - far) * 0.9;
  // Stairs: earth treads with a timber nosing.
  const st = stairs(e, s);
  if (h > 0 && st.distance < STAIR_HALF && st.t > 0 && st.t < 1) {
    const local = st.t * hill.steps - Math.floor(st.t * hill.steps);
    if (local < 0.18) return step(C.timber, 0.6 + dark * 0.5, x, y);
    if (Math.abs(st.distance - STAIR_HALF) < 1) return step(C.timber, 1.5 + dark * 0.5, x, y);
    return step(C.track, 1 + dark * 0.6 + (noise(x, y, 1.5, 4) - 0.5), x, y);
  }
  const d = trackDistance(e, s);
  const edge = TRACK_WIDTH / 2 + (noise(e, s, 3, 8) - 0.5) * 2.2;
  if (d < edge) {
    // Mud with two ruts and a drier crown.
    let v = 1.2 + dark;
    const rut = Math.abs(d - 3.6);
    if (rut < 0.7 && noise(e, s, 2, 5) > 0.35) v += 0.8;
    if (hash(x, y, 24) > 0.985) return step(C.stone, 1, x, y);
    if (d > edge - 1.4) v -= 0.6;
    v += (noise(x, y, 2.5, 6) - 0.5) * 0.7 + (noise(e, s, 9, 25) > 0.72 ? 0.7 : 0);
    return step(C.track, v - haze * 0.5, x, y);
  }
  // Grass: green with ochre patches, trampled near the track, fallen leaves.
  const patch = noise(e, s * 1.6, 26, 9) + (noise(x, y, 3, 19) - 0.5) * 0.25;
  const ochre = patch > 0.66 || d < edge + 2.5 || (far < 0.35 && patch > 0.5);
  const ramp = ochre ? C.dryGrass : C.grass;
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
            ? step(C.timber, 1.2 + (py - yi) * 0.25 + (py - yi === span - 1 ? 1 : 0), x, py)
            : step(C.soil, 1 + (py - yi) * 0.2, x, py);
        }
        layer.set(x, py, colour);
      }
      ybuf = Math.max(0, yi);
      previous = { h };
    }
  }
}

// -------------------------------------------------------------- the flyover

function plank(u, size, seed) {
  const k = Math.floor(u / size);
  return { index: k, seam: u / size - k < 0.12, tone: hash(k, seed, 31) };
}

/** Paints the flyover into `back` or `front` depending on each pixel's depth. */
function paintFlyover(back, front) {
  const { footIn, topIn, topOut, footOut } = flyover;
  const target = (p) => (p.s > FLYOVER_SPLIT_S ? front : back);
  const ground = (p) => ({ ...p, h: 0 });
  const sub = (a, b) => ({ e: a.e - b.e, s: a.s - b.s, h: a.h - b.h });

  // South-west side of the far wedge: vertical boards.
  {
    const o = side(footOut, 1, 0);
    const corner = side(topOut, 1, DECK);
    face(o, sub(side(topOut, 1, 0), o), { e: 0, s: 0, h: 1 }, [o, corner, side(topOut, 1, 0)], (x, y, a, b, p) => {
      const pk = plank(a * 75, 4, 1);
      const v = pk.seam ? 3 : 2 + (pk.tone > 0.7 ? 0.5 : 0) + (b < 6 ? 0.6 : 0);
      target(p).set(x, y, step(C.timber, v, x, y));
    });
  }
  // The far wedge's end face under the flat top, facing south-east, in shade.
  {
    const o = side(topOut, 1, 0);
    face(o, sub(side(topOut, -1, 0), o), { e: 0, s: 0, h: 1 }, [o, side(topOut, 1, DECK - DECK_THICKNESS), side(topOut, -1, DECK - DECK_THICKNESS), side(topOut, -1, 0)], (x, y, a, b, p) => {
      const pk = plank(b, 6, 2);
      target(p).set(x, y, step(C.timber, pk.seam ? 3 : 2.6, x, y));
    });
  }
  // Two cross-braced posts mid-span on the far side, so the deck reads as supported.
  // (The near ones would stand on the lane, so the lane gets none.)

  // Flat top: the south-west fascia beam.
  {
    const a0 = side(topIn, 1, DECK - DECK_THICKNESS);
    const a1 = side(topOut, 1, DECK - DECK_THICKNESS);
    face(a0, sub(a1, a0), { e: 0, s: 0, h: 1 }, [a0, a1, side(topOut, 1, DECK), side(topIn, 1, DECK)], (x, y, a, b, p) => {
      const v = b > DECK_THICKNESS - 2 ? 1.4 : b < 1.5 ? 3 : 2.1;
      target(p).set(x, y, step(C.timber, v, x, y));
    });
  }
  // Flat top deck: planks across the direction of travel, with tyre marks.
  {
    const o = side(topOut, -1, DECK);
    face(o, sub(side(topIn, -1, DECK), o), sub(side(topOut, 1, DECK), o), [side(topOut, -1, DECK), side(topIn, -1, DECK), side(topIn, 1, DECK), side(topOut, 1, DECK)], (x, y, a, b, p) => {
      const pk = plank(a * 83, 3, 3);
      let v = pk.seam ? 2 : 0.6 + pk.tone * 0.8;
      if (Math.abs(b - 0.5) < 0.08 && noise(x, y, 2, 3) > 0.35) v = 2.2;
      if (b > 0.93) v = 1.6;
      target(p).set(x, y, step(C.deck, v, x, y));
    });
  }
  // South-west side of the near wedge.
  {
    const o = side(footIn, 1, 0);
    face(o, sub(side(topIn, 1, 0), o), { e: 0, s: 0, h: 1 }, [o, side(topIn, 1, DECK), side(topIn, 1, 0)], (x, y, a, b, p) => {
      const pk = plank(a * 75, 4, 4);
      const v = pk.seam ? 3 : 2 + (pk.tone > 0.7 ? 0.5 : 0) + (b < 6 ? 0.6 : 0);
      target(p).set(x, y, step(C.timber, v, x, y));
    });
  }
  // The ramp up: planks with grip battens and mud carried up by tyres.
  {
    const o = side(footIn, -1, 0);
    face(o, sub(side(topIn, -1, DECK), o), sub(side(footIn, 1, 0), o), [side(footIn, -1, 0), side(topIn, -1, DECK), side(topIn, 1, DECK), side(footIn, 1, 0)], (x, y, a, b, p) => {
      const pk = plank(a * 113, 3, 5);
      let v = pk.seam ? 2 : 0.3 + pk.tone * 0.7;
      if (pk.index % 4 === 0 && !pk.seam) v = 2.4; // batten
      if (Math.abs(b - 0.5) < 0.1 && noise(x, y, 2, 5) > 0.3 - (1 - a) * 0.5) return target(p).set(x, y, step(C.track, 1.6, x, y));
      if (b > 0.93) v = 1.6;
      target(p).set(x, y, step(C.deck, v, x, y));
    });
  }
  // A dark outline round the whole structure keeps it legible against the grass.
  void ground;
}

// ------------------------------------------------------- barriers and tape

function paintBarriers(layer) {
  const half = TRACK_WIDTH / 2 + 1;
  for (const b of barriers) {
    // A white board on two legs across the lane, seen from its end: the
    // board's top and its near end face show, the legs stand at both edges.
    for (const ds of [-half + 1, half - 1]) {
      for (const dx of [-1, 1]) {
        for (let y = Math.round(screenY(b.s + ds, 10)); y <= Math.round(screenY(b.s + ds)); y += 1) layer.set(b.e + dx, y, C.post[dx < 0 ? 1 : 2]);
      }
    }
    const yTop0 = Math.round(screenY(b.s - half, 16));
    const yTop1 = Math.round(screenY(b.s + half, 16));
    for (let y = yTop0; y <= yTop1; y += 1) for (let dx = -1; dx <= 1; dx += 1) layer.set(b.e + dx, y, C.board[dx < 1 ? 0 : 1]);
    // The near end of the board, facing the viewer.
    for (let y = yTop1 + 1; y <= Math.round(screenY(b.s + half, 10)); y += 1) for (let dx = -1; dx <= 1; dx += 1) layer.set(b.e + dx, y, C.board[dx < 1 ? 2 : 3]);
    for (let dx = -2; dx <= 2; dx += 1) layer.set(b.e + dx, yTop0 - 1, C.board[3]);
    for (let y = yTop0; y <= Math.round(screenY(b.s + half, 10)); y += 1) {
      layer.set(b.e - 2, y, C.board[3]);
      layer.set(b.e + 2, y, C.board[3]);
    }
    // Splayed feet at both legs.
    for (const ds of [-half + 1, half - 1]) {
      const yf = Math.round(screenY(b.s + ds));
      for (const dx of [-3, -2, 2, 3]) layer.set(b.e + dx, yf, C.post[2]);
    }
  }
}

/** Course tape on stakes along a line on the ground. */
function paintTape(layer, from, to, { height = 10, spacing = 34 } = {}) {
  const length = Math.hypot(to.e - from.e, to.s - from.s);
  const stakes = Math.max(1, Math.round(length / spacing));
  const at = (t, h) => ({ x: from.e + (to.e - from.e) * t, y: screenY(from.s + (to.s - from.s) * t, h) });
  for (let i = 0; i <= stakes; i += 1) {
    const top = at(i / stakes, height + 2);
    const bottom = at(i / stakes, 0);
    for (let y = Math.round(top.y); y <= Math.round(bottom.y); y += 1) layer.set(Math.round(top.x), y, y === Math.round(top.y) ? C.post[0] : C.post[2]);
  }
  for (let i = 0; i < stakes; i += 1) {
    const a = at(i / stakes, height);
    const b = at((i + 1) / stakes, height);
    const steps = Math.ceil(Math.abs(b.x - a.x)) + 1;
    for (let k = 1; k < steps; k += 1) {
      const t = k / steps;
      const sag = Math.sin(t * Math.PI) * 1.4;
      const x = Math.round(a.x + (b.x - a.x) * t);
      const y = Math.round(a.y + (b.y - a.y) * t + sag);
      layer.set(x, y, Math.floor((x + 1) / 3) % 2 === 0 ? C.tape[0] : C.tape[1]);
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
  // Stones.
  for (let i = 0; i < 34; i += 1) {
    const cx = Math.floor(hash(i, 0, 70) * W);
    const cy = Math.floor(SOIL_TOP + 14 + hash(i, 1, 70) * (SOIL_BOTTOM - SOIL_TOP - 18));
    const r = 1.2 + hash(i, 2, 70) * 2.2;
    for (let y = -3; y <= 3; y += 1) {
      for (let x = -4; x <= 4; x += 1) {
        const d = Math.hypot(x / (r * 1.3), y / r);
        if (d > 1) continue;
        layer.set(cx + x, cy + y, C.stone[d > 0.8 ? 3 : x + y < -1 ? 0 : x + y > 1 ? 2 : 1]);
      }
    }
  }
  // Cycling discoveries.
  const y0 = SOIL_TOP + 16;
  sprite(layer, 96, y0 + 6, [
    '..oooo..',
    '.oeeeeo.',
    'oe.oo.eo',
    'oeo..oeo',
    'oeo..oeo',
    'oe.oo.eo',
    '.oeeeeo.',
    '..oooo..',
  ], { o: C.rust[2], e: C.rust[0] });
  sprite(layer, 300, y0 + 12, [
    'kkkkkkkkkkk',
    'kyyyyyyyyyk',
    '.kkkkkkkkk.',
  ], { k: C.lever[1], y: C.lever[0] });
  sprite(layer, 470, y0 + 2, [
    'pppppppppp',
    'p.p......p',
    'pwwwwwwwwp',
    'pwbwwbbbwp',
    'pwbwwwwbwp',
    'pwbwwwbwwp',
    'pwbwwwbwwp',
    'pwwwwwwwwp',
    'pppppppppp',
  ], { p: C.paper[1], w: C.paper[0], b: C.ink });
  sprite(layer, 642, y0 + 18, [
    '.cc.......',
    'ccbbbbbbb.',
    'cbwwwwwwwb',
    'cbwrrwwwwb',
    'ccbbbbbbb.',
    '.cc.......',
  ], { c: C.cap, b: C.bottle[1], w: C.bottle[0], r: C.tape[0] });
}

// --------------------------------------------------------------- the scene

export function paintScene() {
  const back = new Layer();
  const flyoverFront = new Layer();
  const front = new Layer();
  const tapeMid = new Layer();
  paintSky(back);
  paintFarLandscape(back);
  paintTreeLine(back);
  paintGround(back);
  paintBirches(back);
  paintBigTree(back);
  paintBushes(back);
  paintBidon(back);
  // Tape behind the lanes is part of the background.
  paintTape(back, { e: 470, s: 188 }, { e: 676, s: 188 });
  paintBarriers(back);
  paintFlyover(back, flyoverFront);
  // Tape in front of the lanes is drawn over every rider.
  paintTape(tapeMid, { e: 172, s: 97 }, { e: 264, s: 97 }, { spacing: 30 });
  paintTape(front, { e: -4, s: 136 }, { e: 240, s: 136 });
  paintTape(front, { e: 450, s: 218 }, { e: 716, s: 218 });
  paintSoil(back);
  return { back: back.rgba, 'tape-mid': tapeMid.rgba, 'flyover-front': flyoverFront.rgba, front: front.rgba, width: W, height: H };
}
