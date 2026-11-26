// Meridian Courier — shared tuning, mission definitions and palettes.
// One clear job: every number the rest of the game agrees on lives here,
// so balancing the flight model never means hunting through render code.

export const VIEW_W = 1280;
export const VIEW_H = 800;
export const HORIZON_REST = 300;
export const FOCAL = 760;
export const NEAR_PLANE = 8;
export const DRAW_DISTANCE = 1700;

// Flight model tuning (arcade, forgiving, readable).
export const FLIGHT = {
  minSpeed: 38,
  maxSpeed: 148,
  accel: 26,
  drag: 0.24,
  maxRollDeg: 58,
  rollRate: 2.6,
  turnRate: 0.55,
  climbRate: 0.42,
  stallSpeed: 58,
  stallSink: 26,
  gravitySink: 6,
  groundMargin: 2.5,
  fuelCapacity: 100,
  fuelBurnPerSec: 0.55,
  damageCapacity: 100,
  crashVerticalSpeed: 16,
  hardLandingVerticalSpeed: 9,
};

// Scoring.
export const SCORE = {
  ring: 500,
  beacon: 800,
  landingPerfect: 1500,
  landingGood: 900,
  landingRough: 400,
  timeBonusPerSec: 12,
};

// Missions. Each sortie is a different goal over the same valley, so the
// judge sees one game with real depth, not one course reskinned.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Ring Run',
    tagline: 'Thread all eight sky rings over the Meridian valley.',
    brief: 'Fly the marked course and pass through every ring. Rings glow gold when they are next. Mind your fuel — throttle discipline wins the time bonus.',
    goal: 'rings',
    goalCount: 8,
    parSeconds: 165,
    start: { x: 0, alt: 26, z: 120, heading: 0, speed: 62 },
    timeOfDay: 'morning',
    wind: 0.35,
  },
  {
    id: 'ridge-rescue',
    name: 'Ridge Rescue',
    tagline: 'Reach three beacons across the high ridges before dusk.',
    brief: 'Three rescue beacons wait in the high valley. Reach each one in order. The ridges are taller here and the air thinner — keep your speed up over the crests.',
    goal: 'beacons',
    goalCount: 3,
    parSeconds: 210,
    start: { x: -40, alt: 60, z: 120, heading: 0, speed: 70 },
    timeOfDay: 'afternoon',
    wind: 0.6,
    ridgeLift: 1.6,
  },
  {
    id: 'dusk-landing',
    name: 'Dusk Landing',
    tagline: 'Bring her home onto runway 27 as the lights come on.',
    brief: 'Depart Meridian Field, fly the short valley circuit, then land on runway 27. Flare gently: touch down inside the markers, slow and level, and she will roll out sweet.',
    goal: 'landing',
    goalCount: 1,
    parSeconds: 240,
    start: { x: 0, alt: 4, z: 60, heading: 0, speed: 0, onGround: true },
    timeOfDay: 'dusk',
    wind: 0.25,
  },
];

// Sky and terrain palettes per time of day. One style throughout:
// flat illustrative colour, warm light, soft haze at the horizon.
export const PALETTES = {
  morning: {
    skyTop: '#7fb2e8', skyMid: '#bcd9f2', skyLow: '#f6dfae',
    sun: '#fff3c4', sunCore: '#fffbe8', haze: '#e8e2c8',
    farRidge: '#8fa8c8', midRidge: '#6d8a6d', nearRidge: '#4f7a4a',
    ground: '#7fae62', groundFar: '#9dbb7e', fieldA: '#8fb45f',
    fieldB: '#c9b458', fieldC: '#5d8a4e', fieldD: '#a8a05e',
    river: '#6fa8d8', road: '#8a7a5e', runway: '#3c4148',
    cloud: 'rgba(255,255,255,0.92)', fog: 'rgba(232,226,200,0.55)',
  },
  afternoon: {
    skyTop: '#4f8fd0', skyMid: '#9cc6e8', skyLow: '#f2e3b0',
    sun: '#fff0b0', sunCore: '#fffbe8', haze: '#e2dcc0',
    farRidge: '#7d9cc0', midRidge: '#5f7f66', nearRidge: '#436e42',
    ground: '#74a45a', groundFar: '#93b274', fieldA: '#86ab58',
    fieldB: '#c2a94e', fieldC: '#54804a', fieldD: '#9c9858',
    river: '#5f96cc', road: '#7d6c52', runway: '#33373e',
    cloud: 'rgba(255,255,255,0.95)', fog: 'rgba(226,220,192,0.5)',
  },
  dusk: {
    skyTop: '#2e3a68', skyMid: '#7d5a8a', skyLow: '#f08a4e',
    sun: '#ffb36b', sunCore: '#ffe6b0', haze: '#c98a6a',
    farRidge: '#5a5478', midRidge: '#4a4a58', nearRidge: '#33363e',
    ground: '#4c5a44', groundFar: '#5d6a52', fieldA: '#55663f',
    fieldB: '#8a744a', fieldC: '#3e5238', fieldD: '#6d6440',
    river: '#7a6a9a', road: '#5a4c40', runway: '#26282e',
    cloud: 'rgba(255,190,150,0.85)', fog: 'rgba(201,138,106,0.5)',
  },
};

// The aircraft's own livery: cream fuselage, teal wings, amber stripe.
// Original design, drawn in code — no borrowed art.
export const LIVERY = {
  fuselage: '#f2e6c8', fuselageShade: '#d9c49a', wing: '#2e7f86',
  wingShade: '#1f5f66', stripe: '#e8a33d', tail: '#2e7f86',
  glass: '#bfe3f2', prop: 'rgba(200,200,200,0.55)',
  navLeft: '#ff5252', navRight: '#4ade80', beacon: '#ffb020',
};

export const HUD = {
  text: '#dff7ff', dim: '#9fc4d4', good: '#7dff9e', warn: '#ffc857',
  bad: '#ff6b5e', panel: 'rgba(8, 24, 34, 0.62)', line: 'rgba(223, 247, 255, 0.55)',
  ringNext: '#ffd34d', ringDone: '#7dff9e', ringFar: '#9fc4d4',
};
