// Meridian Courier — the valley itself.
// One clear job: build every piece of terrain from a seed — ridges, fields,
// river, road, runway and the mission's rings and beacons — and answer
// "how high is the ground here?" for the flight model.

import { makeNoise1D, makeRng, hash2 } from './random.js';

export const COURSE_LENGTH = 9200;
export const RUNWAY = { x: 0, z: 8800, length: 620, width: 46, headingDeg: 27 };

export function buildWorld(seed, mission) {
  const rng = makeRng(seed);
  const ridgeLift = mission.ridgeLift ?? 1;
  const groundNoise = makeNoise1D(seed + 11, 3);
  const crestNoise = makeNoise1D(seed + 77, 3);

  // Ground height: a valley floor that rises into ridges on both sides,
  // with a gentle swell along the course so no two sorties feel flat.
  function groundHeight(x, z) {
    const side = Math.abs(x);
    const valley = Math.max(0, side - 260) * 0.16 * ridgeLift;
    const swell = groundNoise(x * 0.6 + z * 0.22) * 7 + groundNoise(z * 0.31) * 5;
    const crest = Math.max(0, crestNoise(x * 0.9 + z * 0.05) - 0.25) * 46 * ridgeLift;
    const base = Math.max(0, swell);
    return base + valley + crest;
  }

  // Ridge silhouettes: three layers, far to near, drawn as polylines in
  // angle space so the renderer can parallax them against the heading.
  function ridgeLayer(count, amp, baseY, lift) {
    const noise = makeNoise1D(seed + count * 13 + 5, 2);
    const points = [];
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const x = (t - 0.5) * 2600;
      const y = baseY - Math.abs(noise(x * 0.55)) * amp * lift - noise(x * 1.7) * amp * 0.22 * lift;
      points.push({ x, y });
    }
    return points;
  }
  const ridges = [
    ridgeLayer(26, 190, 0, 1.5 * ridgeLift),
    ridgeLayer(22, 120, 26, 1.1 * ridgeLift),
    ridgeLayer(18, 64, 52, 0.8 * ridgeLift),
  ];

  // Field patchwork: seeded rectangles across the valley floor.
  const fields = [];
  const fieldColors = ['fieldA', 'fieldB', 'fieldC', 'fieldD'];
  for (let z = 200; z < COURSE_LENGTH; z += 170) {
    for (let x = -640; x < 640; x += 170) {
      const h = hash2(Math.round(x / 170), Math.round(z / 170), seed);
      if (h < 0.24) continue;
      const color = fieldColors[Math.floor(h * fieldColors.length) % fieldColors.length];
      fields.push({
        x0: x + 6, x1: x + 164, z0: z + 6, z1: z + 164, color,
        hedge: h > 0.82,
      });
    }
  }

  // The river winds down the valley, west of the course line.
  const river = [];
  for (let z = 0; z <= COURSE_LENGTH; z += 260) {
    river.push({ x: -330 + Math.sin(z * 0.00042 + 1.2) * 150 + groundNoise(z * 0.4) * 40, z });
  }

  // A country road runs east of the river, crossing under the course.
  const road = [];
  for (let z = 0; z <= COURSE_LENGTH; z += 300) {
    road.push({ x: 300 + Math.sin(z * 0.00031 + 4.0) * 130, z });
  }

  // Clouds: soft billboards at several heights and depths.
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: rng.range(-900, 900),
      y: rng.range(190, 420),
      z: rng.range(300, 9500),
      s: rng.range(90, 260),
      drift: rng.range(1.5, 5),
    });
  }

  // Mission goals, laid out along the course so each sortie reads
  // differently from the air.
  let rings = [];
  let beacons = [];
  if (mission.goal === 'rings') {
    for (let i = 0; i < mission.goalCount; i += 1) {
      const z = 900 + i * 950;
      rings.push({
        id: i,
        x: Math.sin(i * 1.15) * 150 + Math.sin(i * 0.5) * 60,
        y: 95 + Math.sin(i * 0.9) * 55 + i * 6,
        z,
        r: 42,
        passed: false,
      });
    }
  } else if (mission.goal === 'beacons') {
    const spots = [
      { x: -260, y: 150, z: 2600 },
      { x: 300, y: 210, z: 5400 },
      { x: -120, y: 170, z: 8000 },
    ];
    beacons = spots.slice(0, mission.goalCount).map((s, i) => ({ ...s, id: i, r: 90, reached: false }));
  }

  // Scattered trees as low dark cones near the fields (drawn as billboards).
  const trees = [];
  for (let i = 0; i < 90; i += 1) {
    const x = rng.range(-620, 620);
    const z = rng.range(300, COURSE_LENGTH);
    if (Math.abs(x) < 90 && z > 8200) continue;
    trees.push({ x, z, s: rng.range(9, 18), y: groundHeight(x, z) });
  }

  return {
    seed, mission, ridges, fields, river, road, clouds, rings, beacons,
    trees, groundHeight, runway: RUNWAY, courseLength: COURSE_LENGTH,
  };
}

// Distance from the aircraft to the next unpassed goal, for the HUD arrow.
export function nextGoal(world, mission) {
  if (mission.goal === 'rings') return world.rings.find((r) => !r.passed) ?? null;
  if (mission.goal === 'beacons') return world.beacons.find((b) => !b.reached) ?? null;
  return null;
}

export function goalsDone(world, mission) {
  if (mission.goal === 'rings') return world.rings.filter((r) => r.passed).length;
  if (mission.goal === 'beacons') return world.beacons.filter((b) => b.reached).length;
  return 0;
}
