/**
 * A tiny depth-buffered pixel rasteriser. Shapes are drawn in screen space
 * with a depth value (larger is nearer the viewer). Every pixel stores a
 * material, a part and a shade step; colours are resolved from a palette at
 * the end, which is what makes kits palette swaps.
 */
/** Offset direction of the lit side: the light comes from the upper left. */
const LIGHT = { x: -0.55, y: -0.83 };

export class Sprite {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    const size = width * height;
    this.material = new Array(size).fill(null);
    this.depth = new Float32Array(size).fill(-Infinity);
    this.shade = new Int8Array(size);
    this.part = new Int16Array(size);
  }

  put(x, y, depth, material, shade, part) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = y * this.width + x;
    if (depth < this.depth[i]) return;
    this.depth[i] = depth;
    this.material[i] = material;
    this.shade[i] = shade;
    this.part[i] = part;
  }

  /**
   * A thick segment with round ends. `a` and `b` are {x, y, z}; `material`
   * is a name or a function of t (0 at a, 1 at b). `flat` disables shading and
   * `dim` darkens the whole shape by that many steps (far-side limbs).
   */
  capsule(a, b, ra, rb, material, part, { flat = false, dim = 0 } = {}) {
    const r = Math.max(ra, rb);
    const x0 = Math.floor(Math.min(a.x, b.x) - r - 1);
    const x1 = Math.ceil(Math.max(a.x, b.x) + r + 1);
    const y0 = Math.floor(Math.min(a.y, b.y) - r - 1);
    const y1 = Math.ceil(Math.max(a.y, b.y) + r + 1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const cx = px + 0.5;
        const cy = py + 0.5;
        let t = len2 === 0 ? 0 : ((cx - a.x) * dx + (cy - a.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const ox = cx - (a.x + dx * t);
        const oy = cy - (a.y + dy * t);
        const radius = ra + (rb - ra) * t;
        const d2 = ox * ox + oy * oy;
        if (d2 > radius * radius) continue;
        const bulge = Math.sqrt(radius * radius - d2);
        const depth = a.z + (b.z - a.z) * t + bulge;
        let shade = 0;
        if (!flat && radius >= 1.2) {
          const lit = (ox * LIGHT.x + oy * LIGHT.y) / radius;
          shade = lit > 0.5 ? -1 : lit < -0.45 ? 1 : 0;
        }
        shade += dim;
        const name = typeof material === 'function' ? material(t) : material;
        this.put(px, py, depth, name, shade, part);
      }
    }
  }

  sphere(c, radius, material, part, options) {
    this.capsule(c, c, radius, radius, material, part, options);
  }

  /** Adds the dark outline and separates overlapping parts. */
  finish({ outline = 'outline' } = {}) {
    const { width, height } = this;
    const at = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? null : this.material[y * width + x]);
    // Only the outside gets an outline: gaps inside the wheels stay open.
    const outside = new Uint8Array(width * height);
    const queue = [];
    const visit = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const i = y * width + x;
      if (outside[i] || this.material[i] !== null) return;
      outside[i] = 1;
      queue.push(i);
    };
    for (let x = 0; x < width; x += 1) { visit(x, 0); visit(x, height - 1); }
    for (let y = 0; y < height; y += 1) { visit(0, y); visit(width - 1, y); }
    while (queue.length > 0) {
      const i = queue.pop();
      const x = i % width;
      const y = (i - x) / width;
      visit(x + 1, y); visit(x - 1, y); visit(x, y + 1); visit(x, y - 1);
    }
    const edge = [];
    const crease = [];
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        if (this.material[i] === null) {
          if (outside[i] && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) edge.push(i);
          continue;
        }
        // A part that sits clearly behind its neighbour gets a contact shadow.
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (this.material[j] !== null && this.part[j] !== this.part[i] && this.depth[j] - this.depth[i] > 1.6) {
            crease.push(i);
            break;
          }
        }
      }
    }
    for (const i of crease) this.shade[i] = Math.min(2, this.shade[i] + 1);
    for (const i of edge) {
      this.material[i] = outline;
      this.shade[i] = 0;
    }
    return this;
  }

  /** Resolves materials to RGBA with a palette of {name: [light, base, dark, darker]}. */
  toRgba(palette) {
    const out = new Uint8Array(this.width * this.height * 4);
    for (let i = 0; i < this.material.length; i += 1) {
      const name = this.material[i];
      if (name === null) continue;
      const ramp = palette[name];
      if (!ramp) throw new Error(`Palette has no material "${name}"`);
      const hex = ramp[Math.min(ramp.length - 1, Math.max(0, this.shade[i] + 1))];
      out[i * 4] = parseInt(hex.slice(1, 3), 16);
      out[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      out[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}

/** Copies an RGBA image into a larger sheet. */
export function blit(sheet, sheetWidth, image, width, height, left, top) {
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const s = (y * width + x) * 4;
      if (image[s + 3] === 0) continue;
      const d = ((top + y) * sheetWidth + left + x) * 4;
      sheet.set(image.subarray(s, s + 4), d);
    }
  }
}
