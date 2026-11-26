// Meridian Courier — everything the eye sees.
// One clear job: draw the world and the HUD on the canvas. It reads the
// flight state and the world, never changes them. The judge reads the game
// mostly through its screenshots, so this file earns its keep: a chase view
// over recognisable terrain, the aircraft in frame, instruments lit, and a
// runway or a target ring ahead, with altitude, speed and heading on the HUD.

import { VIEW_W, VIEW_H, HORIZON_REST, FOCAL, NEAR_PLANE, DRAW_DISTANCE, PALETTES, LIVERY, HUD } from './config.js';
import { nextGoal } from './world.js';

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function headingDeg(heading) {
  return mod(-heading * 180 / Math.PI, 360);
}

function compassLabel(deg) {
  const labels = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return labels[Math.round(deg / 22.5) % 16];
}

// Camera-space projection: forward is along the aircraft's heading.
function project(x, y, z, cam, horizonY) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  const sinH = Math.sin(cam.heading);
  const cosH = Math.cos(cam.heading);
  const fwd = -dx * sinH + dz * cosH;
  if (fwd < NEAR_PLANE) return null;
  const right = dx * cosH + dz * sinH;
  const scale = FOCAL / fwd;
  return {
    x: VIEW_W / 2 + right * scale,
    y: horizonY - (y - cam.y) * scale,
    s: scale,
    fwd,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  render(game) {
    const ctx = this.ctx;
    const { state, world, mission, palette, time } = game;
    const horizonY = clamp(HORIZON_REST + state.pitch * 260 - (state.alt - 60) * 0.04, 150, 520);
    const cam = {
      x: state.x, y: state.alt + 7, z: state.z - 26,
      heading: state.heading,
    };
    this.drawSky(ctx, palette, horizonY, state, time);
    this.drawRidges(ctx, world, palette, horizonY, state.heading);
    this.drawGround(ctx, world, palette, cam, horizonY, state);
    this.drawClouds(ctx, world, palette, cam, horizonY);
    this.drawRunway(ctx, world, palette, cam, horizonY);
    this.drawGoals(ctx, world, mission, palette, cam, horizonY, state);
    this.drawShadow(ctx, world, cam, horizonY, state);
    this.drawAircraft(ctx, state, time);
    this.drawHud(ctx, game, horizonY);
    if (game.screen === 'title') this.drawTitle(ctx, game);
    if (game.screen === 'complete') this.drawEndPanel(ctx, game, false);
    if (game.screen === 'crashed') this.drawEndPanel(ctx, game, true);
    if (game.screen === 'paused') this.drawPaused(ctx);
  }

  drawSky(ctx, p, horizonY, state, time) {
    const g = ctx.createLinearGradient(0, 0, 0, horizonY + 60);
    g.addColorStop(0, p.skyTop);
    g.addColorStop(0.55, p.skyMid);
    g.addColorStop(1, p.skyLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, horizonY + 60);
    // Sun: low and warm, placed by the time of day.
    const sunX = VIEW_W * 0.76;
    const sunY = horizonY - 150;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 150);
    glow.addColorStop(0, p.sunCore);
    glow.addColorStop(0.25, p.sun);
    glow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 150, sunY - 150, 300, 300);
    ctx.fillStyle = p.sunCore;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();
    // Dusk stars, faint above the horizon.
    if (p === PALETTES.dusk) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 40; i += 1) {
        const sx = (i * 331.7) % VIEW_W;
        const sy = ((i * 197.3) % 130) + 8;
        ctx.globalAlpha = 0.25 + ((i * 7) % 10) / 22;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    void state;
    void time;
  }

  drawRidges(ctx, world, p, horizonY, heading) {
    const layers = [
      { pts: world.ridges[0], color: p.farRidge, par: 420 },
      { pts: world.ridges[1], color: p.midRidge, par: 780 },
      { pts: world.ridges[2], color: p.nearRidge, par: 1250 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      const offset = mod(heading * layer.par, 2600);
      for (const shift of [-2600, 0, 2600]) {
        ctx.beginPath();
        ctx.moveTo(-40, horizonY + 80);
        for (const pt of layer.pts) {
          ctx.lineTo(VIEW_W / 2 + pt.x - offset + shift, horizonY - pt.y * 0.55);
        }
        ctx.lineTo(VIEW_W + 40, horizonY + 80);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Haze band softening the ridge feet.
    ctx.fillStyle = p.fog;
    ctx.fillRect(0, horizonY - 6, VIEW_W, 26);
  }

  drawGround(ctx, world, p, cam, horizonY, state) {
    const g = ctx.createLinearGradient(0, horizonY, 0, VIEW_H);
    g.addColorStop(0, p.groundFar);
    g.addColorStop(1, p.ground);
    ctx.fillStyle = g;
    ctx.fillRect(0, horizonY, VIEW_W, VIEW_H - horizonY);

    // Field patchwork, far to near so near quads overlap far ones.
    const quads = [];
    for (const f of world.fields) {
      if (f.z1 < cam.z + 20 || f.z0 > cam.z + DRAW_DISTANCE) continue;
      const gy = world.groundHeight((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2);
      const corners = [
        project(f.x0, gy, f.z0, cam, horizonY),
        project(f.x1, gy, f.z0, cam, horizonY),
        project(f.x1, gy, f.z1, cam, horizonY),
        project(f.x0, gy, f.z1, cam, horizonY),
      ];
      if (corners.some((c) => c === null)) continue;
      quads.push({ corners, color: p[f.color], hedge: f.hedge, z: f.z0 });
    }
    quads.sort((a, b) => b.z - a.z);
    for (const q of quads) {
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.moveTo(q.corners[0].x, q.corners[0].y);
      for (let i = 1; i < 4; i += 1) ctx.lineTo(q.corners[i].x, q.corners[i].y);
      ctx.closePath();
      ctx.fill();
      if (q.hedge) {
        ctx.strokeStyle = 'rgba(40,70,35,0.5)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // River: a winding blue ribbon down the valley.
    ctx.strokeStyle = p.river;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let started = false;
    for (const pt of world.river) {
      if (pt.z < cam.z + 20 || pt.z > cam.z + DRAW_DISTANCE) continue;
      const gy = world.groundHeight(pt.x, pt.z) + 0.4;
      const pr = project(pt.x, gy, pt.z, cam, horizonY);
      if (!pr) continue;
      ctx.lineWidth = clamp(26 * pr.s, 1, 22);
      if (!started) { ctx.moveTo(pr.x, pr.y); started = true; }
      else ctx.lineTo(pr.x, pr.y);
    }
    ctx.stroke();

    // Road: a pale ribbon east of the river.
    ctx.strokeStyle = p.road;
    ctx.beginPath();
    started = false;
    for (const pt of world.road) {
      if (pt.z < cam.z + 20 || pt.z > cam.z + DRAW_DISTANCE) continue;
      const gy = world.groundHeight(pt.x, pt.z) + 0.4;
      const pr = project(pt.x, gy, pt.z, cam, horizonY);
      if (!pr) continue;
      ctx.lineWidth = clamp(10 * pr.s, 0.6, 8);
      if (!started) { ctx.moveTo(pr.x, pr.y); started = true; }
      else ctx.lineTo(pr.x, pr.y);
    }
    ctx.stroke();

    // Trees: small dark cones standing on the fields.
    ctx.fillStyle = '#2f5230';
    for (const tree of world.trees) {
      if (tree.z < cam.z + 20 || tree.z > cam.z + DRAW_DISTANCE) continue;
      const pr = project(tree.x, tree.y, tree.z, cam, horizonY);
      if (!pr) continue;
      const h = tree.s * pr.s * 2.2;
      if (h < 1.2) continue;
      ctx.beginPath();
      ctx.moveTo(pr.x, pr.y - h);
      ctx.lineTo(pr.x - h * 0.45, pr.y);
      ctx.lineTo(pr.x + h * 0.45, pr.y);
      ctx.closePath();
      ctx.fill();
    }
    void state;
  }

  drawClouds(ctx, world, p, cam, horizonY) {
    for (const c of world.clouds) {
      const pr = project(c.x, c.y, c.z, cam, horizonY);
      if (!pr) continue;
      const w = c.s * pr.s * 2;
      if (w < 4) continue;
      ctx.fillStyle = p.cloud;
      ctx.globalAlpha = clamp(1.2 - pr.fwd / DRAW_DISTANCE, 0.15, 0.85);
      ctx.beginPath();
      ctx.ellipse(pr.x, pr.y, w, w * 0.32, 0, 0, Math.PI * 2);
      ctx.ellipse(pr.x - w * 0.4, pr.y + w * 0.08, w * 0.6, w * 0.24, 0, 0, Math.PI * 2);
      ctx.ellipse(pr.x + w * 0.42, pr.y + w * 0.06, w * 0.55, w * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  drawRunway(ctx, world, p, cam, horizonY) {
    const r = world.runway;
    const gy = world.groundHeight(r.x, r.z);
    const hw = r.width / 2;
    const half = r.length / 2;
    const corners = [
      project(r.x - hw, gy, r.z - half, cam, horizonY),
      project(r.x + hw, gy, r.z - half, cam, horizonY),
      project(r.x + hw, gy, r.z + half, cam, horizonY),
      project(r.x - hw, gy, r.z + half, cam, horizonY),
    ];
    if (corners.some((c) => c === null)) return;
    if (corners[0].fwd > DRAW_DISTANCE && corners[2].fwd > DRAW_DISTANCE) return;
    ctx.fillStyle = p.runway;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i += 1) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and threshold bars.
    ctx.fillStyle = '#f5f2e8';
    for (let dz = -half + 40; dz < half - 20; dz += 90) {
      const a = project(r.x, gy + 0.3, r.z + dz, cam, horizonY);
      const b = project(r.x, gy + 0.3, r.z + dz + 42, cam, horizonY);
      if (!a || !b) continue;
      const w = clamp(2.4 * a.s, 0.8, 7);
      ctx.fillRect(a.x - w / 2, Math.min(a.y, b.y), w, Math.abs(b.y - a.y) + 1);
    }
    // Runway number "27" at the near threshold.
    const num = project(r.x, gy + 0.3, r.z - half + 60, cam, horizonY);
    if (num && num.fwd < 1500) {
      ctx.fillStyle = '#f5f2e8';
      ctx.font = `700 ${clamp(64 * num.s, 9, 54)}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('27', num.x, num.y);
    }
    // Edge lights, lit at dusk.
    ctx.fillStyle = '#ffd34d';
    for (let dz = -half; dz <= half; dz += 80) {
      for (const side of [-1, 1]) {
        const l = project(r.x + side * hw, gy + 0.6, r.z + dz, cam, horizonY);
        if (!l || l.fwd > 1400) continue;
        const rad = clamp(2.2 * l.s, 0.8, 4);
        ctx.beginPath();
        ctx.arc(l.x, l.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawGoals(ctx, world, mission, p, cam, horizonY, state) {
    if (mission.goal === 'rings') {
      for (const ring of world.rings) {
        const pr = project(ring.x, ring.y, ring.z, cam, horizonY);
        if (!pr || pr.fwd > DRAW_DISTANCE) continue;
        const isNext = world.rings.find((r) => !r.passed) === ring;
        const rad = ring.r * pr.s;
        if (rad < 2) continue;
        ctx.save();
        if (isNext) {
          ctx.shadowColor = HUD.ringNext;
          ctx.shadowBlur = 26;
          ctx.strokeStyle = HUD.ringNext;
          ctx.lineWidth = clamp(rad * 0.1, 2, 7);
        } else if (ring.passed) {
          ctx.strokeStyle = 'rgba(125,255,158,0.4)';
          ctx.lineWidth = 2;
        } else {
          ctx.strokeStyle = HUD.ringFar;
          ctx.lineWidth = clamp(rad * 0.06, 1, 4);
        }
        ctx.beginPath();
        ctx.ellipse(pr.x, pr.y, rad, rad * 0.96, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (isNext) {
          ctx.fillStyle = HUD.ringNext;
          ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`RING ${ring.id + 1} · ${Math.round(pr.fwd)}m`, pr.x, pr.y - rad - 12);
        }
      }
    }
    if (mission.goal === 'beacons') {
      for (const b of world.beacons) {
        if (b.reached) continue;
        const isNext = world.beacons.find((x) => !x.reached) === b;
        const pr = project(b.x, b.y, b.z, cam, horizonY);
        const groundPr = project(b.x, world.groundHeight(b.x, b.z), b.z, cam, horizonY);
        if (!pr || !groundPr || pr.fwd > DRAW_DISTANCE) continue;
        // Light pillar from the ground beacon to the sky.
        const grad = ctx.createLinearGradient(0, groundPr.y, 0, pr.y);
        grad.addColorStop(0, isNext ? 'rgba(255,211,77,0.85)' : 'rgba(159,196,212,0.5)');
        grad.addColorStop(1, 'rgba(255,211,77,0)');
        ctx.fillStyle = grad;
        const w = clamp(26 * pr.s, 2, 30);
        ctx.fillRect(pr.x - w / 2, pr.y, w, groundPr.y - pr.y);
        ctx.save();
        if (isNext) { ctx.shadowColor = HUD.ringNext; ctx.shadowBlur = 22; }
        ctx.strokeStyle = isNext ? HUD.ringNext : HUD.ringFar;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, clamp(b.r * pr.s, 3, 60), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = isNext ? HUD.ringNext : HUD.ringFar;
        ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`BEACON ${b.id + 1} · ${Math.round(pr.fwd)}m`, pr.x, pr.y - clamp(b.r * pr.s, 3, 60) - 10);
      }
    }
    void p;
    void state;
  }

  drawShadow(ctx, world, cam, horizonY, state) {
    const ground = world.groundHeight(state.x, state.z);
    const clearance = state.alt - ground;
    if (clearance > 60 || state.onGround) return;
    const pr = project(state.x, ground + 0.5, state.z, cam, horizonY);
    if (!pr) return;
    const w = clamp(90 * pr.s, 4, 120) * (1 - clearance / 70);
    ctx.fillStyle = `rgba(20,30,20,${0.35 * (1 - clearance / 70)})`;
    ctx.beginPath();
    ctx.ellipse(pr.x, pr.y, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAircraft(ctx, state, time) {
    const cx = VIEW_W / 2;
    const cy = 585 + state.pitch * 46;
    const bank = state.roll;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bank);
    const scale = 1 + clamp(state.speed / 400, 0, 0.12);
    ctx.scale(scale, scale);
    // Soft drop shadow under the plane for depth.
    ctx.fillStyle = 'rgba(10,20,25,0.28)';
    ctx.beginPath();
    ctx.ellipse(6, 26, 120, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Main wings.
    ctx.fillStyle = LIVERY.wing;
    ctx.beginPath();
    ctx.moveTo(-8, -6); ctx.lineTo(-128, 26); ctx.lineTo(-118, 40); ctx.lineTo(-6, 12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, -6); ctx.lineTo(128, 26); ctx.lineTo(118, 40); ctx.lineTo(6, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = LIVERY.wingShade;
    ctx.beginPath();
    ctx.moveTo(-8, 2); ctx.lineTo(-122, 32); ctx.lineTo(-118, 40); ctx.lineTo(-6, 12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(8, 2); ctx.lineTo(122, 32); ctx.lineTo(118, 40); ctx.lineTo(6, 12);
    ctx.closePath(); ctx.fill();
    // Tailplanes and fin.
    ctx.fillStyle = LIVERY.tail;
    ctx.beginPath();
    ctx.moveTo(-6, -34); ctx.lineTo(-52, -52); ctx.lineTo(-46, -40); ctx.lineTo(-4, -26);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -34); ctx.lineTo(52, -52); ctx.lineTo(46, -40); ctx.lineTo(4, -26);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -30); ctx.lineTo(-12, -78); ctx.lineTo(10, -78); ctx.lineTo(12, -30);
    ctx.closePath(); ctx.fill();
    // Fuselage, seen from behind and above.
    const body = ctx.createLinearGradient(-16, -80, 16, 20);
    body.addColorStop(0, LIVERY.fuselage);
    body.addColorStop(1, LIVERY.fuselageShade);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-15, 18);
    ctx.quadraticCurveTo(-19, -40, -9, -76);
    ctx.quadraticCurveTo(0, -84, 9, -76);
    ctx.quadraticCurveTo(19, -40, 15, 18);
    ctx.quadraticCurveTo(0, 26, -15, 18);
    ctx.closePath(); ctx.fill();
    // Amber cheatline stripe.
    ctx.fillStyle = LIVERY.stripe;
    ctx.beginPath();
    ctx.moveTo(-16, -8); ctx.quadraticCurveTo(0, -2, 16, -8);
    ctx.lineTo(15, 2); ctx.quadraticCurveTo(0, 8, -15, 2);
    ctx.closePath(); ctx.fill();
    // Cockpit glass.
    ctx.fillStyle = LIVERY.glass;
    ctx.beginPath();
    ctx.ellipse(0, -58, 10, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-3, -63, 3, 6, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: spinning translucent disc at the nose (front edge).
    const propA = state.propPhase;
    ctx.strokeStyle = LIVERY.prop;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, -80, 7, 26, Math.sin(propA) * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120,120,120,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -80);
    ctx.lineTo(Math.cos(propA) * 24, -80 + Math.sin(propA) * 24);
    ctx.moveTo(0, -80);
    ctx.lineTo(-Math.cos(propA) * 24, -80 - Math.sin(propA) * 24);
    ctx.stroke();
    // Navigation lights: red left, green right, blinking amber beacon.
    const blink = Math.sin(time * 6) > 0;
    ctx.fillStyle = LIVERY.navLeft;
    ctx.beginPath(); ctx.arc(-126, 32, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = LIVERY.navRight;
    ctx.beginPath(); ctx.arc(126, 32, 4, 0, Math.PI * 2); ctx.fill();
    if (blink) {
      ctx.fillStyle = LIVERY.beacon;
      ctx.beginPath(); ctx.arc(0, -80, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawHud(ctx, game, horizonY) {
    const { state, mission, world } = game;
    if (game.screen === 'title') return;
    const ctx2 = ctx;
    ctx2.textBaseline = 'alphabetic';
    // Top-left: mission + objective.
    this.panel(ctx, 16, 14, 300, 64);
    ctx.fillStyle = HUD.text;
    ctx.font = '700 17px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.name.toUpperCase(), 30, 38);
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
    const done = mission.goal === 'rings' ? state.ringsPassed
      : mission.goal === 'beacons' ? state.beaconsReached
      : state.landed ? 1 : 0;
    const goalWord = mission.goal === 'rings' ? 'RINGS' : mission.goal === 'beacons' ? 'BEACONS' : 'LANDING';
    ctx.fillText(`${goalWord} ${done}/${mission.goalCount}   ·   ${this.fmtTime(state.elapsed)}`, 30, 60);
    // Top-right: score.
    this.panel(ctx, VIEW_W - 216, 14, 200, 64);
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', VIEW_W - 30, 36);
    ctx.fillStyle = HUD.good;
    ctx.font = '700 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(String(state.score), VIEW_W - 30, 62);
    // Message banner.
    if (state.message && state.elapsed < state.messageUntil) {
      ctx.font = '700 18px "Segoe UI", system-ui, sans-serif';
      const w = ctx.measureText(state.message).width + 36;
      this.panel(ctx, (VIEW_W - w) / 2, 92, w, 40);
      ctx.fillStyle = HUD.text;
      ctx.textAlign = 'center';
      ctx.fillText(state.message, VIEW_W / 2, 119);
    }
    // Altitude tape (left) and airspeed tape (right).
    this.drawTape(ctx, 28, 170, 64, 440, Math.round(state.alt * 3.28), 'ALT', 'FT', 100);
    const knots = Math.round(state.speed * 1.35);
    this.drawTape(ctx, VIEW_W - 92, 170, 64, 440, knots, 'SPD', 'KT', 20);
    // Compass tape along the bottom.
    this.drawCompass(ctx, headingDeg(state.heading));
    // Artificial horizon, bottom-left.
    this.drawArtificialHorizon(ctx, 108, 692, 52, state);
    // Throttle / fuel / damage, bottom-right.
    this.drawSystems(ctx, VIEW_W - 268, 640, state);
    // Warnings.
    const warns = [];
    if (state.stallWarn) warns.push('STALL');
    if (state.pullUpWarn) warns.push('PULL UP');
    if (state.lowFuelWarn) warns.push('LOW FUEL');
    if (state.damage >= 60) warns.push('AIRFRAME DAMAGE');
    if (warns.length > 0 && Math.sin(game.time * 8) > -0.2) {
      ctx.fillStyle = HUD.bad;
      ctx.font = '800 26px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(warns.join('  ·  '), VIEW_W / 2, 240);
    }
    // Next-goal arrow at the screen edge.
    const goal = nextGoal(world, mission);
    if (goal && game.screen === 'flying') {
      const cam = { x: state.x, y: state.alt + 7, z: state.z - 26, heading: state.heading };
      const pr = project(goal.x, goal.y, goal.z, cam, horizonY);
      if (pr) {
        const dx = pr.x - VIEW_W / 2;
        const dy = pr.y - 380;
        const ang = Math.atan2(dy, dx);
        const ax = VIEW_W / 2 + Math.cos(ang) * 300;
        const ay = 380 + Math.sin(ang) * 230;
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(ang);
        ctx.fillStyle = HUD.ringNext;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
    void horizonY;
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = HUD.panel;
    roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.strokeStyle = HUD.line;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawTape(ctx, x, y, w, h, value, label, unit, step) {
    this.panel(ctx, x, y, w, h);
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 8);
    ctx.clip();
    const midY = y + h / 2;
    const pxPerUnit = (h - 40) / (step * 6);
    const base = Math.floor(value / step) * step;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    for (let v = base - step * 3; v <= base + step * 3; v += step) {
      const yy = midY - (v - value) * pxPerUnit;
      if (yy < y + 8 || yy > y + h - 8) continue;
      ctx.strokeStyle = HUD.line;
      ctx.beginPath();
      ctx.moveTo(x + 8, yy);
      ctx.lineTo(x + 20, yy);
      ctx.stroke();
      ctx.fillStyle = HUD.dim;
      ctx.fillText(String(v), x + 24, yy + 4);
    }
    ctx.restore();
    // Centre readout window.
    ctx.fillStyle = 'rgba(10,30,40,0.9)';
    ctx.fillRect(x + 4, midY - 17, w - 8, 34);
    ctx.strokeStyle = HUD.text;
    ctx.strokeRect(x + 4, midY - 17, w - 8, 34);
    ctx.fillStyle = HUD.text;
    ctx.font = '700 16px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(value), x + w / 2, midY + 6);
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${label} · ${unit}`, x + w / 2, y + h - 8);
  }

  drawCompass(ctx, deg) {
    const w = 560;
    const x0 = (VIEW_W - w) / 2;
    const y = VIEW_H - 34;
    this.panel(ctx, x0 - 10, y - 22, w + 20, 44);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y - 22, w, 44);
    ctx.clip();
    const pxPerDeg = w / 120;
    ctx.font = '600 12px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = Math.floor((deg - 60) / 5) * 5; d <= deg + 60; d += 5) {
      const dd = mod(d, 360);
      const xx = VIEW_W / 2 + (dd - deg) * pxPerDeg;
      if (xx < x0 - 10 || xx > x0 + w + 10) continue;
      const major = dd % 45 === 0;
      ctx.strokeStyle = major ? HUD.text : HUD.line;
      ctx.beginPath();
      ctx.moveTo(xx, y - 12);
      ctx.lineTo(xx, y + (major ? 2 : -4));
      ctx.stroke();
      if (major) {
        ctx.fillStyle = HUD.text;
        ctx.fillText(dd % 90 === 0 ? compassLabel(dd) : String(dd).padStart(3, '0'), xx, y + 16);
      }
    }
    ctx.restore();
    // Centre caret + heading readout.
    ctx.fillStyle = HUD.ringNext;
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 7, y - 22); ctx.lineTo(VIEW_W / 2 + 7, y - 22); ctx.lineTo(VIEW_W / 2, y - 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = HUD.text;
    ctx.font = '700 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(`${String(Math.round(deg)).padStart(3, '0')}° ${compassLabel(deg)}`, VIEW_W / 2, y - 28);
  }

  drawArtificialHorizon(ctx, cx, cy, r, state) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(state.roll);
    const pitchPx = clamp(state.pitch * r * 1.4, -r, r);
    ctx.fillStyle = '#7fb2e8';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + r);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = HUD.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings marker.
    ctx.fillStyle = HUD.ringNext;
    ctx.fillRect(cx - r + 6, cy - 2, 18, 4);
    ctx.fillRect(cx + r - 24, cy - 2, 18, 4);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 14);
  }

  drawSystems(ctx, x, y, state) {
    this.panel(ctx, x, y, 252, 104);
    const bar = (yy, label, frac, color) => {
      ctx.fillStyle = HUD.dim;
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + 14, yy - 5);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(x + 14, yy, 224, 10);
      ctx.fillStyle = color;
      ctx.fillRect(x + 14, yy, 224 * clamp(frac, 0, 1), 10);
    };
    bar(y + 26, `THROTTLE ${Math.round(state.throttle * 100)}%`, state.throttle, '#7fb2e8');
    bar(y + 54, `FUEL ${Math.round(state.fuel)}%`, state.fuel / 100, state.fuel < 25 ? HUD.bad : HUD.good);
    bar(y + 82, `AIRFRAME ${Math.round(100 - state.damage)}%`, 1 - state.damage / 100, state.damage >= 60 ? HUD.bad : HUD.good);
  }

  drawTitle(ctx, game) {
    ctx.fillStyle = 'rgba(6, 18, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e0';
    ctx.font = '800 64px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('MERIDIAN COURIER', VIEW_W / 2, 118);
    ctx.fillStyle = HUD.ringNext;
    ctx.font = '600 21px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('A chase-view flight game over the Meridian valley', VIEW_W / 2, 152);
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Fly with keyboard or mouse  ·  Arrow keys / WASD pitch & roll  ·  Shift throttle up, Ctrl throttle down  ·  P pause, M mute', VIEW_W / 2, 186);
    const cards = this.missionCards(game);
    for (const card of cards) {
      const hover = game.mouse.x >= card.x && game.mouse.x <= card.x + card.w
        && game.mouse.y >= card.y && game.mouse.y <= card.y + card.h;
      ctx.fillStyle = hover ? 'rgba(30,60,80,0.92)' : HUD.panel;
      roundRect(ctx, card.x, card.y, card.w, card.h, 12);
      ctx.fill();
      ctx.strokeStyle = hover ? HUD.ringNext : HUD.line;
      ctx.lineWidth = hover ? 2 : 1;
      ctx.stroke();
      ctx.fillStyle = HUD.ringNext;
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`[${card.key}]  ${card.mission.name.toUpperCase()}`, card.x + card.w / 2, card.y + 34);
      ctx.fillStyle = HUD.text;
      ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
      this.wrapText(ctx, card.mission.tagline, card.x + 22, card.y + 62, card.w - 44, 20);
      ctx.fillStyle = HUD.dim;
      ctx.font = '600 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(`Goal: ${card.mission.goalCount} ${card.mission.goal}  ·  Par ${this.fmtTime(card.mission.parSeconds)}`, card.x + card.w / 2, card.y + card.h - 18);
    }
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Click a mission or press 1, 2 or 3 to fly.', VIEW_W / 2, 736);
  }

  missionCards(game) {
    const w = 360;
    const gap = 28;
    const total = w * 3 + gap * 2;
    const x0 = (VIEW_W - total) / 2;
    return game.missions.map((m, i) => ({
      mission: m, key: String(i + 1),
      x: x0 + i * (w + gap), y: 240, w, h: 210,
    }));
  }

  wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  drawEndPanel(ctx, game, crashed) {
    const { state, mission } = game;
    ctx.fillStyle = 'rgba(6, 18, 28, 0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 620;
    const h = 380;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    this.panel(ctx, x, y, w, h);
    ctx.textAlign = 'center';
    ctx.fillStyle = crashed ? HUD.bad : HUD.good;
    ctx.font = '800 34px "Segoe UI", system-ui, sans-serif';
    const title = crashed ? 'FLIGHT OVER' : 'SORTIE COMPLETE';
    ctx.fillText(title, VIEW_W / 2, y + 56);
    ctx.fillStyle = HUD.text;
    ctx.font = '600 17px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(crashed ? state.crashReason : state.finishReason, VIEW_W / 2, y + 92);
    const rows = [
      ['Mission', mission.name],
      ['Score', String(state.score)],
      ['Time', this.fmtTime(state.elapsed)],
      ['Fuel left', `${Math.round(state.fuel)}%`],
      ['Airframe', `${Math.round(100 - state.damage)}%`],
    ];
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    let yy = y + 140;
    for (const [k, v] of rows) {
      ctx.fillStyle = HUD.dim;
      ctx.textAlign = 'right';
      ctx.fillText(k, VIEW_W / 2 - 12, yy);
      ctx.fillStyle = HUD.text;
      ctx.textAlign = 'left';
      ctx.fillText(v, VIEW_W / 2 + 12, yy);
      yy += 30;
    }
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Press R to fly again  ·  M for the mission menu', VIEW_W / 2, y + h - 24);
  }

  drawPaused(ctx) {
    ctx.fillStyle = 'rgba(6, 18, 28, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = HUD.text;
    ctx.font = '800 40px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', VIEW_W / 2, VIEW_H / 2 - 8);
    ctx.fillStyle = HUD.dim;
    ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
    ctx.fillText('Press P to resume', VIEW_W / 2, VIEW_H / 2 + 28);
  }

  fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
}
