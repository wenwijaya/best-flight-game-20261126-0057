// Meridian Courier — synthesised sound.
// One clear job: every sound the game makes, built live with WebAudio.
// No audio files, no network: engine hum, wind, ring chimes and alarms
// are all oscillators and filtered noise, generated in code.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.windSource = null;
    this.windGain = null;
    this.windFilter = null;
    this.muted = false;
    this.started = false;
  }

  // Browsers only allow audio after a user gesture; call this from one.
  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 62;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'sine';
      this.engineOsc2.frequency.value = 31;
      const engineFilter = this.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(engineFilter);
      this.engineOsc2.connect(engineFilter);
      engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();

      const noise = this.makeNoiseBuffer();
      this.windSource = this.ctx.createBufferSource();
      this.windSource.buffer = noise;
      this.windSource.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 700;
      this.windFilter.Q.value = 0.6;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0;
      this.windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.master);
      this.windSource.start();
      this.started = true;
    } catch (err) {
      this.ctx = null;
    }
  }

  makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  // Called every frame while flying: engine pitch follows throttle and
  // speed, wind follows airspeed.
  update(state) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 46 + state.throttle * 78 + state.speed * 0.22;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    const engineLevel = state.onGround && state.throttle < 0.05 ? 0 : 0.05 + state.throttle * 0.06;
    this.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(500 + state.speed * 6, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.16, state.speed * 0.0011), t, 0.15);
  }

  silence() {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(0, t, 0.05);
    this.windGain.gain.setTargetAtTime(0, t, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  blip(freq, dur, type, vol, when = 0) {
    if (!this.started || !this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (err) {
      // Sound is garnish; a failure here must never break the game.
    }
  }

  ringChime() {
    this.blip(880, 0.35, 'sine', 0.22);
    this.blip(1318, 0.5, 'sine', 0.16, 0.09);
  }

  beaconChime() {
    this.blip(660, 0.3, 'triangle', 0.2);
    this.blip(990, 0.45, 'triangle', 0.16, 0.1);
  }

  alarm() {
    this.blip(440, 0.16, 'square', 0.08);
    this.blip(440, 0.16, 'square', 0.08, 0.2);
  }

  thud() {
    if (!this.started || !this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.makeNoiseBuffer();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
      src.stop(t + 0.4);
    } catch (err) {
      // Sound is garnish; never break the game.
    }
  }
}
