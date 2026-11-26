// Meridian Courier — the game itself.
// One clear job: own the screens, the loop and the wiring. It builds the
// world for the chosen mission, steps the flight model, asks the renderer
// to draw, and turns key presses and clicks into mission choices. The
// flight model, the world and the drawing each live in their own files.

import { VIEW_W, VIEW_H, MISSIONS, PALETTES } from './config.js';
import { buildWorld } from './world.js';
import { makeFlightState, stepFlight } from './flight.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { applyShot, readShotQuery } from './shots.js';

const SEED = 20261126;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.missions = MISSIONS;
    this.mission = MISSIONS[0];
    this.palette = PALETTES.morning;
    this.world = buildWorld(SEED, this.mission);
    this.state = makeFlightState(this.mission);
    this.screen = 'title';
    this.time = 0;
    this.last = 0;
    this.endAt = 0;
    this.mouse = this.input.mouse;
    this.prevRings = 0;
    this.prevBeacons = 0;
    this.shotMode = false;
    this.attract = null;
    this.startAttract();
  }

  startAttract() {
    const mission = MISSIONS[0];
    this.attract = {
      world: buildWorld(SEED, mission),
      state: makeFlightState(mission),
      mission,
    };
    const s = this.attract.state;
    s.x = 0;
    s.alt = 130;
    s.z = 900;
    s.speed = 110;
    s.throttle = 0.65;
    s.onGround = false;
    s.airborne = true;
  }

  startMission(mission, options = {}) {
    this.mission = mission;
    this.palette = PALETTES[mission.timeOfDay];
    this.world = buildWorld(SEED + this.missions.indexOf(mission) * 101, mission);
    this.state = makeFlightState(mission);
    this.screen = 'flying';
    this.endAt = 0;
    this.prevRings = 0;
    this.prevBeacons = 0;
    if (!options.quiet) {
      this.state.message = mission.brief;
      this.state.messageUntil = 6;
      this.audio.ensure();
    }
  }

  backToMenu() {
    this.screen = 'title';
    this.startAttract();
    this.audio.silence();
  }

  frame(now) {
    const dt = Math.min(0.05, Math.max(0.001, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;
    this.handleKeys();

    if (this.screen === 'title' && this.attract) {
      const a = this.attract;
      const controls = {
        pitch: Math.sin(this.time * 0.24) * 0.22,
        roll: Math.sin(this.time * 0.17) * 0.5,
        throttle: 0,
      };
      a.state.throttle = 0.62;
      stepFlight(a.state, controls, a.world, a.mission, dt);
      if (a.state.crashed || a.state.z > a.world.courseLength - 600) this.startAttract();
      // The title screen draws the attract flight as its backdrop.
      this.renderBackdrop(a);
    } else if (this.screen === 'flying') {
      const controls = this.input.readControls();
      this.input.updateMouseSteer(VIEW_W / 2, 460);
      stepFlight(this.state, controls, this.world, this.mission, dt);
      this.audio.update(this.state);
      this.watchEvents();
      if (this.state.finished && this.endAt === 0) {
        this.endAt = this.time + 1.4;
        if (this.state.landed) this.audio.thud();
      }
      if (this.state.crashed && this.endAt === 0) {
        this.endAt = this.time + 1.6;
        this.audio.thud();
        this.audio.alarm();
      }
      if (this.endAt !== 0 && this.time >= this.endAt) {
        this.screen = this.state.crashed ? 'crashed' : 'complete';
        this.audio.silence();
        this.endAt = 0;
      }
      this.renderer.render(this);
    } else if (this.screen === 'paused' || this.screen === 'complete' || this.screen === 'crashed') {
      this.renderer.render(this);
    }

    this.input.endFrame();
  }

  renderBackdrop(attract) {
    const standIn = {
      state: attract.state,
      world: attract.world,
      mission: attract.mission,
      palette: PALETTES[attract.mission.timeOfDay],
      time: this.time,
      screen: 'title',
      mouse: this.mouse,
      missions: this.missions,
    };
    this.renderer.render(standIn);
  }

  watchEvents() {
    const s = this.state;
    if (s.ringsPassed > this.prevRings) {
      this.audio.ringChime();
      this.prevRings = s.ringsPassed;
    }
    if (s.beaconsReached > this.prevBeacons) {
      this.audio.beaconChime();
      this.prevBeacons = s.beaconsReached;
    }
    if (s.stallWarn && Math.sin(this.time * 6) > 0.9) this.audio.alarm();
  }

  handleKeys() {
    const input = this.input;
    if (this.screen === 'title') {
      if (input.wasPressed('1')) this.startMission(this.missions[0]);
      else if (input.wasPressed('2')) this.startMission(this.missions[1]);
      else if (input.wasPressed('3')) this.startMission(this.missions[2]);
      else if (input.wasPressed('Enter')) this.startMission(this.missions[0]);
      if (input.mouse.clicked) {
        const cards = this.renderer.missionCards(this);
        for (const card of cards) {
          if (this.mouse.x >= card.x && this.mouse.x <= card.x + card.w
            && this.mouse.y >= card.y && this.mouse.y <= card.y + card.h) {
            this.startMission(card.mission);
            break;
          }
        }
      }
      return;
    }
    if (this.screen === 'flying') {
      if (input.wasPressed('p', 'P')) {
        this.screen = 'paused';
        this.audio.silence();
      }
      if (input.wasPressed('m', 'M')) this.audio.toggleMute();
      return;
    }
    if (this.screen === 'paused') {
      if (input.wasPressed('p', 'P', 'Escape')) {
        this.screen = 'flying';
      }
      return;
    }
    if (this.screen === 'complete' || this.screen === 'crashed') {
      if (input.wasPressed('r', 'R')) this.startMission(this.mission);
      else if (input.wasPressed('m', 'M', 'Escape')) this.backToMenu();
    }
  }

  start() {
    const { shot } = readShotQuery();
    if (shot) {
      this.shotMode = true;
      applyShot(this, shot);
    }
    const loop = (now) => {
      if (this.last === 0) this.last = now;
      try {
        this.frame(now);
      } catch (err) {
        // Never blank the page: a render error still leaves the last
        // good frame up, and the loop keeps trying.
        console.error(err);
      }
      if (this.shotMode) window.__shotReady = true;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const game = new Game(canvas);
window.__meridianCourier = game;
game.start();
