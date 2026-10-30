// Small synth chimes, so the game needs no audio files. iOS only allows audio after a user gesture,
// so the first pointer-down calls unlock().
export class Sfx {
  private ctx: AudioContext | null = null;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    void this.ctx.resume();
  }

  tone(freq: number, { duration = 0.5, gain = 0.12, type = 'sine', delay = 0 }: { duration?: number; gain?: number; type?: OscillatorType; delay?: number } = {}): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, start);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(amp).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }
}
