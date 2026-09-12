// Original synthesized cue palette. No music files, samples, or network requests.
export class Soundscape {
  constructor() {
    this.enabled = false;
    this.context = null;
    this.nextBeat = 0;
    this.beat = 0;
  }
  async toggle() {
    if (!this.context) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return false;
      this.context = new Audio();
    }
    this.enabled = !this.enabled;
    if (this.enabled) await this.context.resume();
    return this.enabled;
  }
  tone(frequency, duration = 0.1, volume = 0.025, type = 'triangle', offset = 0) {
    if (!this.enabled || !this.context) return;
    const t = this.context.currentTime + offset,
      osc = this.context.createOscillator(),
      gain = this.context.createGain();
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.007);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.context.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }
  event(type) {
    if (type === 'cells.claimed') {
      [392, 494, 587].forEach((n, i) => this.tone(n, 0.19, 0.028, 'triangle', i * 0.045));
    } else if (type === 'player.failed') {
      this.tone(147, 0.15, 0.025, 'sawtooth');
      this.tone(98, 0.22, 0.02, 'triangle', 0.1);
    } else if (type === 'run.completed') {
      [392, 494, 587, 784].forEach((n, i) => this.tone(n, 0.3, 0.025, 'triangle', i * 0.11));
    } else if (type === 'boss.warning') this.tone(220, 0.16, 0.023, 'square');
    else if (type === 'ability.used' || type === 'pickup.collected') this.tone(660, 0.1, 0.015);
  }
  update(active, theme) {
    if (!active || !this.enabled || !this.context) return;
    const now = this.context.currentTime;
    if (now < this.nextBeat) return;
    this.nextBeat = now + 0.27;
    const notes =
      theme.scene === 'arcade'
        ? [196, 0, 294, 392, 247, 0, 330, 294]
        : [196, 0, 247, 0, 294, 247, 220, 0];
    const n = notes[this.beat++ % notes.length];
    if (n) this.tone(n, 0.24, 0.009, 'triangle');
  }
}
