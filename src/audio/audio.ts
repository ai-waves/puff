// Everything is synthesised, so the game ships no audio files.
// World 1 audio (level board): low wind and crickets, and a music-box melody that adds one voice
// for each living clone. iOS only allows audio after a touch, so the first pointer-down calls unlock().

type Note = number | null;

// A slow pentatonic music-box line, one note per eighth at 92 bpm.
const MELODY: Note[] = [76, 79, 81, 79, 76, null, 74, 72, 74, 76, 79, null, 84, 81, 79, 76];
// Each extra clone adds a voice from this list, in semitones from the melody.
const VOICES = [0, -12, -5, 7, -17, 12];
const EIGHTH = 60 / 92 / 2;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private ambience: AudioNode[] = [];
  private timer: number | null = null;
  private nextNoteAt = 0;
  private noteIndex = 0;
  private voices = 1;
  private cricketAt = 0;
  music = true;
  sound = true;

  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.apply();
    }
    void this.ctx.resume();
  }

  setMusic(on: boolean): void {
    this.music = on;
    this.apply();
  }

  setSound(on: boolean): void {
    this.sound = on;
    this.apply();
  }

  private apply(): void {
    if (!this.ctx || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.music ? 1 : 0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.sound ? 1 : 0, t, 0.05);
  }

  // ---------- Level ambience and music box ----------

  startLevel(): void {
    this.stopLevel();
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    // Low wind: brown noise through a gentle low-pass, slowly swelling.
    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoise(4);
    noise.loop = true;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 380;
    const wind = ctx.createGain();
    wind.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.025;
    lfo.connect(lfoDepth).connect(wind.gain);
    noise.connect(lowpass).connect(wind).connect(this.musicBus);
    noise.start();
    lfo.start();
    this.ambience = [noise, lfo];
    this.nextNoteAt = ctx.currentTime + 0.4;
    this.noteIndex = 0;
    this.cricketAt = ctx.currentTime + 1.5;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stopLevel(): void {
    for (const node of this.ambience) {
      try {
        (node as AudioScheduledSourceNode).stop();
      } catch {
        // already stopped
      }
    }
    this.ambience = [];
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  setVoices(count: number): void {
    this.voices = Math.max(1, Math.min(VOICES.length, count));
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    while (this.nextNoteAt < ctx.currentTime + 0.25) {
      const note = MELODY[this.noteIndex % MELODY.length];
      if (note !== null && note !== undefined) {
        for (let v = 0; v < this.voices; v++) this.musicBoxNote(midi(note + VOICES[v]!), this.nextNoteAt, 0.05 / (1 + v * 0.25));
      }
      this.noteIndex += 1;
      this.nextNoteAt += EIGHTH;
    }
    while (this.cricketAt < ctx.currentTime + 0.25) {
      this.cricket(this.cricketAt);
      this.cricketAt += 1.1 + ((this.noteIndex * 7) % 13) / 10;
    }
  }

  private musicBoxNote(freq: number, at: number, gain: number): void {
    const ctx = this.ctx!;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(gain, at + 0.005);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
    amp.connect(this.musicBus!);
    for (const [mult, level] of [[1, 1], [4, 0.18]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(amp);
      osc.start(at);
      osc.stop(at + 1.5);
    }
  }

  private cricket(at: number): void {
    const ctx = this.ctx!;
    for (let i = 0; i < 3; i++) {
      const t = at + i * 0.07;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 4600;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, t);
      amp.gain.linearRampToValueAtTime(0.006, t + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(amp).connect(this.musicBus!);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  private brownNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let seed = 12345;
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const white = (seed / 0x7fffffff) * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    return buffer;
  }

  // ---------- Sound effects ----------

  private tone(freq: number, { at = 0, dur = 0.5, gain = 0.1, type = 'sine' as OscillatorType, slide = 0 } = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(gain, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, gain: number, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.brownNoise(dur);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    src.connect(bp).connect(amp).connect(this.sfxBus);
    src.start();
  }

  chime(at = 0): void {
    this.tone(988, { at, dur: 0.9, gain: 0.09 });
    this.tone(1480, { at: at + 0.06, dur: 0.8, gain: 0.05 });
  }
  seed(at = 0): void {
    this.tone(1319, { at, dur: 0.35, gain: 0.07 });
    this.tone(1976, { at: at + 0.05, dur: 0.3, gain: 0.04 });
  }
  knock(at = 0): void {
    this.tone(180, { at, dur: 0.18, gain: 0.16, type: 'triangle', slide: 0.6 });
  }
  bump(): void {
    this.tone(140, { dur: 0.12, gain: 0.08, type: 'triangle', slide: 0.7 });
  }
  fluff(): void {
    this.noise(0.4, 0.12, 1800);
  }
  pop(): void {
    this.tone(660, { dur: 0.18, gain: 0.08, slide: 1.8 });
  }
  creak(): void {
    this.tone(90, { dur: 0.6, gain: 0.07, type: 'sawtooth', slide: 1.3 });
  }
  jam(): void {
    this.noise(0.3, 0.12, 400);
    this.tone(70, { dur: 0.3, gain: 0.1, type: 'square', slide: 0.5 });
  }
  tap(): void {
    this.tone(880, { dur: 0.08, gain: 0.04 });
  }
}

export const audio = new Audio();
