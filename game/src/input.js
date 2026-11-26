// Meridian Courier — keyboard and mouse input.
// One clear job: turn raw DOM events into one tidy control state the
// flight model reads. No game logic lives here.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false, moved: false };
    this.steer = { active: false, roll: 0, pitch: 0 };
    this.canvas = canvas;
    this.listeners = [];
    this.attach(canvas);
  }

  on(target, type, fn, options) {
    target.addEventListener(type, fn, options);
    this.listeners.push([target, type, fn, options]);
  }

  attach(canvas) {
    this.on(window, 'keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      this.keys.add(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    this.on(window, 'keyup', (e) => {
      this.keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    });
    this.on(window, 'blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.steer.active = false;
    });
    this.on(canvas, 'pointerdown', (e) => {
      this.mouse.down = true;
      this.updateMouse(e);
      this.mouse.clicked = true;
    });
    this.on(window, 'pointerup', () => {
      this.mouse.down = false;
      this.steer.active = false;
    });
    this.on(canvas, 'pointermove', (e) => {
      this.updateMouse(e);
      this.mouse.moved = true;
    });
    this.on(canvas, 'contextmenu', (e) => e.preventDefault());
  }

  updateMouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouse.x = (e.clientX - rect.left) * scaleX;
    this.mouse.y = (e.clientY - rect.top) * scaleY;
  }

  held(...names) {
    return names.some((n) => this.keys.has(n));
  }

  // True once per physical press; the game loop clears it each frame.
  wasPressed(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.mouse.moved = false;
  }

  // Pitch / roll / throttle in -1..1, from keys, or from a held mouse drag.
  readControls() {
    let pitch = 0;
    let roll = 0;
    if (this.held('ArrowUp', 'w')) pitch += 1;
    if (this.held('ArrowDown', 's')) pitch -= 1;
    if (this.held('ArrowLeft', 'a')) roll -= 1;
    if (this.held('ArrowRight', 'd')) roll += 1;
    if (this.mouse.down && this.steer.active) {
      roll = this.steer.roll;
      pitch = this.steer.pitch;
    }
    let throttle = 0;
    if (this.held('Shift')) throttle += 1;
    if (this.held('Control')) throttle -= 1;
    return { pitch, roll, throttle };
  }

  // While the mouse is held on empty sky, steer by pointer offset.
  updateMouseSteer(cx, cy) {
    if (!this.mouse.down) return;
    const dx = (this.mouse.x - cx) / 320;
    const dy = (this.mouse.y - cy) / 240;
    if (Math.abs(dx) > 0.08 || Math.abs(dy) > 0.08) {
      this.steer.active = true;
      this.steer.roll = Math.max(-1, Math.min(1, dx));
      this.steer.pitch = Math.max(-1, Math.min(1, -dy));
    }
  }

  destroy() {
    for (const [target, type, fn, options] of this.listeners) {
      target.removeEventListener(type, fn, options);
    }
    this.listeners = [];
  }
}
