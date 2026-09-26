// Web Audio API による 8bit 風の合成効果音（BGM なし）

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;

  constructor(public muted: boolean) {}

  /** ユーザー操作の中で呼び、AudioContext を起動する */
  unlock(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.35;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.35, this.ctx.currentTime, 0.01);
  }

  private tone(freq: number, start: number, dur: number, wave: Wave = 'square', vol = 0.3, slideTo?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hiss(start: number, dur: number, vol: number, from: number, to: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.muted) return;
    const t = ctx.currentTime + start;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** 振りかぶり中の上昇音。ratio は溜め量 [0, 1] */
  charge(ratio: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (this.muted) {
      this.stopCharge();
      return;
    }
    if (!this.chargeOsc) {
      this.chargeOsc = ctx.createOscillator();
      this.chargeGain = ctx.createGain();
      this.chargeOsc.type = 'triangle';
      this.chargeGain.gain.value = 0.06;
      this.chargeOsc.connect(this.chargeGain).connect(this.master);
      this.chargeOsc.start();
    }
    const f = ratio >= 1 ? 660 : 220 + 360 * ratio;
    this.chargeOsc.frequency.setTargetAtTime(f, ctx.currentTime, 0.02);
  }

  stopCharge(): void {
    if (this.chargeOsc) {
      try {
        this.chargeOsc.stop();
      } catch {
        // すでに停止済み
      }
      this.chargeOsc.disconnect();
      this.chargeGain?.disconnect();
    }
    this.chargeOsc = null;
    this.chargeGain = null;
  }

  /** 最大まで溜まった合図 */
  full(): void {
    this.tone(880, 0, 0.06, 'square', 0.12);
  }

  swing(): void {
    this.stopCharge();
    this.hiss(0, 0.18, 0.5, 800, 3200);
  }

  catch(rarity: number): void {
    this.tone(523, 0, 0.08, 'square', 0.25);
    this.tone(784, 0.07, 0.08, 'square', 0.25);
    this.tone(1047, 0.14, 0.14, 'square', 0.25);
    if (rarity >= 3) {
      this.tone(1319, 0.24, 0.1, 'square', 0.2);
      this.tone(1568, 0.32, 0.22, 'square', 0.2);
    }
  }

  get(rarity: number): void {
    if (rarity >= 4) {
      [784, 988, 1175, 1568, 1976].forEach((f, i) => this.tone(f, i * 0.07, 0.12, 'square', 0.18));
    } else if (rarity >= 2) {
      this.tone(988, 0, 0.08, 'triangle', 0.25);
      this.tone(1319, 0.08, 0.16, 'triangle', 0.25);
    }
  }

  tick(last: boolean): void {
    this.tone(last ? 880 : 660, 0, 0.05, 'square', 0.12);
  }

  ui(): void {
    this.tone(660, 0, 0.05, 'square', 0.15);
    this.tone(990, 0.05, 0.07, 'square', 0.15);
  }

  end(): void {
    this.stopCharge();
    [784, 659, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.1, 0.12, 'square', 0.2));
  }

  record(): void {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, 0.7 + i * 0.09, 0.1, 'square', 0.2));
  }
}

/** 対応端末のみ振動 */
export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // 非対応
  }
}
