// Ember Vault — all sound is synthesized with WebAudio, no audio files.
// Footsteps, pebble ticks, alert stings, pickup chimes and a low ambient
// drone are built from oscillators and filtered noise at run time.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.ambientNodes = null;
    this.lastStepAt = 0;
  }

  /** Create the context on first user gesture; browsers require that. */
  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** A short tone with an exponential decay envelope. */
  tone(freq, duration, type, volume, when = 0, slideTo = 0) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /** A burst of filtered noise, for footsteps and pebble impacts. */
  noiseBurst(duration, filterFreq, volume, when = 0) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + when;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(t0);
  }

  /** Alternating soft footstep ticks; sneaking is quieter and lower. */
  footstep(sneaking) {
    if (!this.context || this.muted) return;
    const now = performance.now();
    if (now - this.lastStepAt < 240) return;
    this.lastStepAt = now;
    this.noiseBurst(0.07, sneaking ? 500 : 900, sneaking ? 0.05 : 0.11);
  }

  /** A guard's footstep, heard from wherever the guard walks. */
  guardStep(distanceTiles) {
    if (!this.context || this.muted) return;
    const volume = Math.max(0.02, 0.16 - distanceTiles * 0.02);
    if (volume <= 0.02) return;
    this.noiseBurst(0.06, 700, volume);
  }

  pebbleThrow() {
    this.noiseBurst(0.09, 2400, 0.10);
    this.tone(620, 0.08, 'sine', 0.06, 0, 380);
  }

  pebbleLand() {
    this.noiseBurst(0.12, 1400, 0.16);
    this.tone(190, 0.10, 'triangle', 0.10, 0, 120);
  }

  pickup() {
    this.tone(880, 0.10, 'sine', 0.14);
    this.tone(1318, 0.16, 'sine', 0.12, 0.07);
  }

  alertSting() {
    this.tone(220, 0.22, 'sawtooth', 0.14, 0, 440);
    this.tone(233, 0.22, 'sawtooth', 0.12, 0.02, 466);
  }

  spotted() {
    this.tone(156, 0.30, 'square', 0.10, 0, 98);
  }

  caughtSting() {
    this.tone(330, 0.18, 'sawtooth', 0.16, 0, 165);
    this.tone(247, 0.22, 'sawtooth', 0.16, 0.16, 123);
    this.tone(165, 0.40, 'sawtooth', 0.16, 0.34, 82);
  }

  levelClear() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => this.tone(freq, 0.22, 'triangle', 0.14, i * 0.11));
  }

  victory() {
    const notes = [523, 659, 784, 1046, 784, 1046, 1318];
    notes.forEach((freq, i) => this.tone(freq, 0.26, 'triangle', 0.14, i * 0.13));
  }

  /** A quiet low drone with a slow swell, started once per session. */
  startAmbient() {
    if (!this.context || this.ambientNodes || this.muted) return;
    const osc = this.context.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const osc2 = this.context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 55.7;
    const gain = this.context.createGain();
    gain.gain.value = 0.035;
    const lfo = this.context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = this.context.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain);
    lfoGain.connect(gain.gain);
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc2.start();
    lfo.start();
    this.ambientNodes = { osc, osc2, lfo, gain };
  }
}
