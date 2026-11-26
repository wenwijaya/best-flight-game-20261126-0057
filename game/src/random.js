// Meridian Courier — deterministic seeded randomness.
// One clear job: every random choice in the game comes from here, so a
// given seed always builds the same valley, the same rings, the same sky.
// That is what makes the screenshots reproducible.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const next = mulberry32(seed);
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// Smooth 1D value noise for ridge lines and ground height: cheap, stable,
// and seeded, so the same valley renders identically every run.
export function makeNoise1D(seed, octaves = 3) {
  const rng = makeRng(seed);
  const grids = [];
  for (let o = 0; o < octaves; o += 1) {
    const step = 90 * (o + 1) * 1.7;
    const count = 64;
    const values = [];
    for (let i = 0; i < count; i += 1) values.push(rng.range(-1, 1));
    grids.push({ step, values });
  }
  function smooth(t) {
    return t * t * (3 - 2 * t);
  }
  return function noise(x) {
    let total = 0;
    let amp = 1;
    let norm = 0;
    for (const grid of grids) {
      const pos = x / grid.step;
      const i0 = Math.floor(pos);
      const i1 = i0 + 1;
      const frac = smooth(pos - i0);
      const n = grid.values.length;
      const a = grid.values[((i0 % n) + n) % n];
      const b = grid.values[((i1 % n) + n) % n];
      total += (a + (b - a) * frac) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return total / norm;
  };
}

// 2D hash noise for field patchwork: stable per (x, z) cell.
export function hash2(x, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (((h ^ (h >>> 16)) >>> 0) % 100000) / 100000;
}
