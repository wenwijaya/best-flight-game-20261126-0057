// Meridian Courier — the flight model.
// One clear job: move the aircraft through the air. No drawing, no input
// polling, no scoring here — just physics, fuel, damage and goal checks,
// stepped in fixed time slices so replays and screenshots are exact.

import { FLIGHT } from './config.js';

export function makeFlightState(mission) {
  const s = mission.start;
  return {
    x: s.x, alt: s.alt, z: s.z,
    heading: s.heading, speed: s.speed,
    pitch: 0, roll: 0, throttle: s.onGround ? 0 : 0.55,
    verticalSpeed: 0,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,
    score: 0,
    ringsPassed: 0,
    beaconsReached: 0,
    elapsed: 0,
    onGround: !!s.onGround,
    airborne: !s.onGround,
    landed: false,
    crashed: false,
    crashReason: '',
    finished: false,
    finishReason: '',
    message: '',
    messageUntil: 0,
    stallWarn: false,
    lowFuelWarn: false,
    pullUpWarn: false,
    lastRingAt: 0,
    gustPhase: 0,
    propPhase: 0,
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function stepFlight(state, controls, world, mission, dt) {
  if (state.finished || state.crashed) return state;
  const t = state.elapsed + dt;
  state.elapsed = t;
  state.propPhase += dt * (4 + state.throttle * 26);

  // Wind gusts: gentle, seeded by time, stronger on the ridge sortie.
  const gust = Math.sin(t * 0.45) * 0.5 + Math.sin(t * 1.13) * 0.5;
  state.gustPhase = gust * (mission.wind ?? 0.3);

  // Throttle moves speed toward its target; climbing bleeds speed.
  // Parked on the ground with the throttle closed, she stays put.
  state.throttle = clamp(state.throttle + controls.throttle * dt * 0.9, 0, 1);
  const targetSpeed = state.onGround && state.throttle < 0.05
    ? 0
    : FLIGHT.minSpeed + state.throttle * (FLIGHT.maxSpeed - FLIGHT.minSpeed);
  const climbBleed = Math.max(0, state.pitch) * 14;
  state.speed = lerp(state.speed, targetSpeed - climbBleed, clamp(FLIGHT.accel * dt / 60, 0, 1));
  state.speed = Math.max(0, state.speed - FLIGHT.drag * dt * (state.speed > targetSpeed ? 1 : 0.2));

  // Roll banks the aircraft; bank turns the heading; pitch climbs/dives.
  const targetRoll = controls.roll * (FLIGHT.maxRollDeg * Math.PI / 180);
  state.roll = lerp(state.roll, targetRoll, clamp(FLIGHT.rollRate * dt, 0, 1));
  const turn = -state.roll * FLIGHT.turnRate * (state.speed / FLIGHT.maxSpeed);
  state.heading += turn * dt + state.gustPhase * 0.012 * dt;
  const targetPitch = controls.pitch * 0.42;
  state.pitch = lerp(state.pitch, targetPitch, clamp(2.2 * dt, 0, 1));

  // Vertical motion: pitch climbs, stalls sink, gravity always tugs.
  let climb = Math.sin(state.pitch) * state.speed * FLIGHT.climbRate;
  state.stallWarn = state.speed < FLIGHT.stallSpeed && !state.onGround;
  if (state.stallWarn) climb -= FLIGHT.stallSink;
  climb -= FLIGHT.gravitySink * (1 - state.throttle * 0.55) * 0.12;
  state.verticalSpeed = climb;
  state.alt += climb * dt;

  // Forward motion along the heading.
  const forward = state.onGround ? Math.max(state.speed, 0) : state.speed;
  state.z += Math.cos(state.heading) * forward * dt;
  state.x += Math.sin(state.heading) * forward * dt * -1;
  state.x = clamp(state.x, -700, 700);

  // Fuel burns with throttle; empty tanks mean a glider, not a crash.
  if (!state.onGround) {
    state.fuel = Math.max(0, state.fuel - FLIGHT.fuelBurnPerSec * (0.35 + state.throttle) * dt);
  }
  state.lowFuelWarn = state.fuel < 25;
  if (state.fuel <= 0 && state.throttle > 0.08) {
    state.throttle = 0.08;
    state.message = 'FUEL EMPTY — gliding. Find the runway.';
    state.messageUntil = t + 4;
  }

  // Terrain: the ground is real, and it bites.
  const ground = world.groundHeight(state.x, state.z);
  const clearance = state.alt - ground;
  state.pullUpWarn = clearance < 26 && clearance > 0 && !state.onGround;
  if (clearance <= FLIGHT.groundMargin) {
    if (state.onGround) {
      state.alt = ground;
    } else if (mission.goal === 'landing' && Math.abs(state.z - world.runway.z) < world.runway.length / 2
      && Math.abs(state.x - world.runway.x) < world.runway.width / 2) {
      landAircraft(state, world, mission, t);
    } else if (state.verticalSpeed > -FLIGHT.crashVerticalSpeed && state.speed < 95) {
      state.damage += 34;
      state.alt = ground + FLIGHT.groundMargin;
      state.verticalSpeed = 2;
      state.message = 'TERRAIN STRIKE — airframe damaged.';
      state.messageUntil = t + 3;
      if (state.damage >= FLIGHT.damageCapacity) crash(state, 'Terrain strike', t);
    } else {
      crash(state, 'Terrain strike', t);
    }
  }

  // Runway roll-out: taking off again needs speed; rolling past the end stops the sortie.
  if (state.onGround) {
    if (state.speed > 62 && state.throttle > 0.4) {
      state.onGround = false;
      state.airborne = true;
      state.message = 'AIRBORNE — gear up, valley ahead.';
      state.messageUntil = t + 3;
    }
    if (state.z > world.runway.z + world.runway.length) {
      state.onGround = false;
      state.airborne = true;
      state.alt = ground + 1;
    }
  }

  // Rings: crossing the ring's plane inside its radius scores.
  if (mission.goal === 'rings') {
    for (const ring of world.rings) {
      if (ring.passed) continue;
      const prevZ = state.z - Math.cos(state.heading) * forward * dt;
      const crossed = prevZ < ring.z && state.z >= ring.z;
      if (!crossed) continue;
      const dx = state.x - ring.x;
      const dy = state.alt - ring.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= ring.r) {
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += 500;
        state.lastRingAt = t;
        state.message = `RING ${state.ringsPassed} OF ${mission.goalCount} — clean!`;
        state.messageUntil = t + 2.5;
        if (state.ringsPassed >= mission.goalCount) {
          finish(state, 'All rings threaded — course complete!', t, timeBonusFor(state, mission));
        }
      } else if (dist <= ring.r + 26) {
        state.damage += 8;
        ring.passed = true;
        state.ringsPassed += 1;
        state.score += 150;
        state.message = 'RING CLIPPED — through, but the airframe felt it.';
        state.messageUntil = t + 2.5;
        if (state.damage >= FLIGHT.damageCapacity) crash(state, 'Airframe failure', t);
        else if (state.ringsPassed >= mission.goalCount) finish(state, 'All rings threaded — course complete!', t, timeBonusFor(state, mission));
      }
    }
  }

  // Beacons: flying within the beacon's radius reaches it.
  if (mission.goal === 'beacons') {
    for (const beacon of world.beacons) {
      if (beacon.reached) continue;
      const dx = state.x - beacon.x;
      const dy = state.alt - beacon.y;
      const dz = state.z - beacon.z;
      if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= beacon.r) {
        beacon.reached = true;
        state.beaconsReached += 1;
        state.score += 800;
        state.message = `BEACON ${state.beaconsReached} OF ${mission.goalCount} — survivors wave from below.`;
        state.messageUntil = t + 3;
        if (state.beaconsReached >= mission.goalCount) {
          finish(state, 'All beacons reached — rescue complete!', t, timeBonusFor(state, mission));
        }
      }
    }
  }

  // Landing sortie: crossing the runway threshold low and slow is the goal.
  if (mission.goal === 'landing' && !state.landed && state.z > world.runway.z - world.runway.length / 2 - 40
    && state.z < world.runway.z + world.runway.length / 2 && state.alt - ground < 30) {
    state.message = 'FINAL — runway 27 ahead. Flare gently.';
    state.messageUntil = t + 3;
  }

  // Running out of valley ends the flight.
  if (state.z > world.courseLength + 400) {
    finish(state, 'Course complete — out of the valley.', t, timeBonusFor(state, mission));
  }
  if (state.damage >= FLIGHT.damageCapacity && !state.crashed) {
    crash(state, 'Airframe failure', t);
  }
  return state;
}

function landAircraft(state, world, mission, t) {
  const vs = Math.abs(state.verticalSpeed);
  const level = Math.abs(state.roll) < 0.35 && Math.abs(state.pitch) < 0.3;
  state.onGround = true;
  state.airborne = false;
  state.alt = world.groundHeight(state.x, state.z);
  if (mission.goal === 'landing') {
    state.landed = true;
    let award = 400;
    let grade = 'ROUGH';
    if (vs < 4 && level && state.speed < 95) { award = 1500; grade = 'PERFECT'; }
    else if (vs < FLIGHT.hardLandingVerticalSpeed && level) { award = 900; grade = 'GOOD'; }
    else state.damage += 30;
    state.score += award;
    const timeBonus = Math.max(0, Math.round((mission.parSeconds - state.elapsed) * 12));
    state.score += timeBonus;
    finish(state, `${grade} LANDING — runway 27. +${award} pts, time bonus +${timeBonus}.`, t);
  } else {
    state.message = 'TOUCHDOWN — rolling out. Throttle up to go around.';
    state.messageUntil = t + 3;
  }
}

function crash(state, reason, t) {
  state.crashed = true;
  state.crashReason = reason;
  state.message = `${reason.toUpperCase()} — flight over.`;
  state.messageUntil = t + 5;
}

function finish(state, reason, t, bonus = 0) {
  state.finished = true;
  state.finishReason = reason;
  if (bonus > 0) state.score += bonus;
  state.message = bonus > 0 ? `${reason} Time bonus +${bonus}.` : reason;
  state.messageUntil = t + 6;
}

export function timeBonusFor(state, mission) {
  return Math.max(0, Math.round((mission.parSeconds - state.elapsed) * 12));
}
