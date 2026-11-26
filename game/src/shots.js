// Meridian Courier — screenshot staging.
// One clear job: put the game into a chosen, deterministic moment for a
// screenshot, driven by the page's ?shot= query. The screenshots are real
// renders of the game's own code: this file only picks the moment — a
// runway start, a ring pass mid-flight, a dusk final approach — then steps
// the real flight model forward with scripted inputs so the frame shows
// the aircraft alive (banked, prop spinning, instruments lit).

import { stepFlight } from './flight.js';

const SHOT_PRESETS = {
  start: {
    mission: 'ring-run',
    place: (state) => {
      state.x = 0;
      state.alt = 4;
      state.z = 60;
      state.heading = 0;
      state.speed = 58;
      state.throttle = 0.62;
      state.onGround = true;
      state.airborne = false;
    },
    script: (controls, step) => {
      controls.throttle = step < 40 ? 1 : 0;
      controls.pitch = 0;
      controls.roll = 0;
    },
    steps: 70,
  },
  play: {
    mission: 'ring-run',
    place: (state) => {
      state.x = -30;
      state.alt = 128;
      state.z = 1750;
      state.heading = 0.04;
      state.speed = 118;
      state.throttle = 0.72;
      state.onGround = false;
      state.airborne = true;
      state.ringsPassed = 1;
      state.score = 500;
    },
    script: (controls, step) => {
      controls.throttle = 0;
      controls.pitch = step < 50 ? 0.25 : -0.1;
      controls.roll = step < 60 ? 0.45 : -0.2;
    },
    steps: 95,
  },
  end: {
    mission: 'dusk-landing',
    place: (state) => {
      state.x = 18;
      state.alt = 42;
      state.z = 8180;
      state.heading = -0.02;
      state.speed = 82;
      state.throttle = 0.34;
      state.onGround = false;
      state.airborne = true;
    },
    script: (controls, step) => {
      controls.throttle = step < 30 ? -0.4 : 0;
      controls.pitch = -0.32;
      controls.roll = step < 40 ? -0.25 : 0.1;
    },
    steps: 80,
  },
};

export function shotPreset(name) {
  return SHOT_PRESETS[name] ?? null;
}

// Stage the game for a screenshot, then run the real model forward.
export function applyShot(game, name) {
  const preset = SHOT_PRESETS[name];
  if (!preset) return false;
  const mission = game.missions.find((m) => m.id === preset.mission);
  if (!mission) return false;
  game.startMission(mission, { quiet: true });
  preset.place(game.state);
  const dt = 1 / 60;
  for (let step = 0; step < preset.steps; step += 1) {
    const controls = { pitch: 0, roll: 0, throttle: 0 };
    preset.script(controls, step);
    stepFlight(game.state, controls, game.world, mission, dt);
    if (game.state.crashed || game.state.finished) break;
  }
  game.state.message = name === 'play'
    ? 'RING 2 OF 8 — clean!'
    : name === 'end'
      ? 'FINAL — runway 27 ahead. Flare gently.'
      : 'MERIDIAN FIELD — cleared for takeoff.';
  game.state.messageUntil = game.state.elapsed + 30;
  game.screen = 'flying';
  return true;
}

// Parse the page query: ?shot=start&seed=1 (seed is fixed at 1 for shots).
export function readShotQuery() {
  try {
    const q = new URLSearchParams(window.location.search);
    return { shot: q.get('shot'), seed: Number(q.get('seed') ?? 1) || 1 };
  } catch (err) {
    return { shot: null, seed: 1 };
  }
}
