// Controller: my own microphone, camera and screen share, plus "who is talking" detection.

import { Emitter } from '../models/Emitter.ts';

type Events = { local: void; speaking: Set<string>; level: number; devices: void };

export interface DeviceLists {
  mics: MediaDeviceInfo[];
  cams: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  /** False until the browser lets us see device names (before camera/mic permission). */
  named: boolean;
}

/** True if this browser can choose where sound comes out (Chrome / Edge / Electron, not Firefox/Safari). */
export const canPickSpeaker = typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;

export class MediaController extends Emitter<Events> {
  mic: MediaStreamTrack | null = null;
  cam: MediaStreamTrack | null = null;
  screen: MediaStreamTrack | null = null;
  micId = '';
  camId = '';
  speakerId = '';

  private audioCtx: AudioContext | null = null;
  private meters = new Map<string, { src: MediaStreamAudioSourceNode; analyser: AnalyserNode; buf: Float32Array<ArrayBuffer> }>();
  private meterTimer = 0;

  constructor() {
    super();
    // headset plugged in / camera unplugged -> lists must be refreshed
    navigator.mediaDevices?.addEventListener?.('devicechange', () => this.emit('devices', undefined));
  }

  /**
   * Asks for camera and microphone permission once (and closes them right away),
   * so the browser shows the real device names in the lists.
   * Returns which of the two were allowed.
   */
  async requestAccess(): Promise<{ audio: boolean; video: boolean }> {
    const tryGet = async (c: MediaStreamConstraints) => {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        for (const t of s.getTracks()) t.stop();
        return true;
      } catch {
        return false;
      }
    };
    // both at once (one permission dialog); if that fails, one of them may be missing or blocked
    const both = await tryGet({ audio: true, video: true });
    const result = both ? { audio: true, video: true } : { audio: await tryGet({ audio: true }), video: await tryGet({ video: true }) };
    this.emit('devices', undefined);
    return result;
  }

  /** The device ids really in use right now (they can differ from the saved choice, e.g. "default"). */
  inUse(): { mic: string; cam: string } {
    return { mic: this.mic?.getSettings().deviceId ?? this.micId, cam: this.cam?.getSettings().deviceId ?? this.camId };
  }

  /** Plays a short chime on the chosen speaker, to check that sound comes out. */
  async testSpeaker(deviceId: string): Promise<void> {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    [660, 880, 990].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + 0.16);
    });
    const el = new Audio();
    el.srcObject = dest.stream;
    const withSink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (deviceId && withSink.setSinkId) await withSink.setSinkId(deviceId);
    await el.play();
    setTimeout(() => {
      el.srcObject = null;
      void ctx.close();
    }, 800);
  }

  /** A stream with my camera only, for my own preview. */
  get camStream(): MediaStream | null {
    return this.cam ? new MediaStream([this.cam]) : null;
  }

  async setMic(on: boolean): Promise<void> {
    if (!on) {
      this.mic?.stop();
      this.mic = null;
      this.unwatch('self');
      this.emit('local', undefined);
      return;
    }
    if (this.mic) return;
    const audio = (id: string): MediaTrackConstraints => ({
      deviceId: id ? { exact: id } : undefined,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    const s = await this.open({ audio: audio(this.micId) }, { audio: audio('') }, () => (this.micId = ''));
    this.mic = s.getAudioTracks()[0] ?? null;
    if (this.mic) this.watch('self', new MediaStream([this.mic]));
    this.emit('local', undefined);
  }

  async setCam(on: boolean): Promise<void> {
    if (!on) {
      this.cam?.stop();
      this.cam = null;
      this.emit('local', undefined);
      return;
    }
    if (this.cam) return;
    const video = (id: string): MediaTrackConstraints => ({
      deviceId: id ? { exact: id } : undefined,
      width: { ideal: 640 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 30 },
    });
    const s = await this.open({ video: video(this.camId) }, { video: video('') }, () => (this.camId = ''));
    this.cam = s.getVideoTracks()[0] ?? null;
    this.emit('local', undefined);
  }

  /** Opens a device; if the saved one is gone (unplugged), falls back to the default one. */
  private async open(wanted: MediaStreamConstraints, fallback: MediaStreamConstraints, forget: () => void): Promise<MediaStream> {
    try {
      return await navigator.mediaDevices.getUserMedia(wanted);
    } catch (e) {
      if ((e as Error).name !== 'OverconstrainedError' && (e as Error).name !== 'NotFoundError') throw e;
      forget();
      return navigator.mediaDevices.getUserMedia(fallback);
    }
  }

  async startScreen(): Promise<void> {
    if (this.screen) return;
    const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15, max: 30 } }, audio: false });
    const t = s.getVideoTracks()[0] ?? null;
    if (!t) return;
    t.contentHint = 'detail';
    t.addEventListener('ended', () => this.stopScreen());
    this.screen = t;
    this.emit('local', undefined);
  }

  stopScreen(): void {
    if (!this.screen) return;
    this.screen.stop();
    this.screen = null;
    this.emit('local', undefined);
  }

  /** Re-opens mic/camera after a different device was chosen. */
  async switchDevices(micId: string, camId: string): Promise<void> {
    const micChanged = micId !== this.micId;
    const camChanged = camId !== this.camId;
    this.micId = micId;
    this.camId = camId;
    if (micChanged && this.mic) {
      await this.setMic(false);
      await this.setMic(true);
    }
    if (camChanged && this.cam) {
      await this.setCam(false);
      await this.setCam(true);
    }
  }

  async listDevices(): Promise<DeviceLists> {
    const all = await navigator.mediaDevices.enumerateDevices();
    const named = all.some((d) => d.label !== '');
    // Before permission the browser returns placeholder entries without id or name: hide them.
    const real = all.filter((d) => d.deviceId !== '');
    return {
      mics: real.filter((d) => d.kind === 'audioinput'),
      cams: real.filter((d) => d.kind === 'videoinput'),
      speakers: real.filter((d) => d.kind === 'audiooutput'),
      named,
    };
  }

  stopAll(): void {
    this.mic?.stop();
    this.cam?.stop();
    this.screen?.stop();
    this.mic = this.cam = this.screen = null;
    for (const id of [...this.meters.keys()]) this.unwatch(id);
    clearInterval(this.meterTimer);
    this.meterTimer = 0;
    void this.audioCtx?.close();
    this.audioCtx = null;
  }

  /** Starts measuring the loudness of a stream (mine or someone else's). */
  watch(id: string, stream: MediaStream): void {
    this.unwatch(id);
    if (stream.getAudioTracks().length === 0) return;
    this.audioCtx ??= new AudioContext();
    void this.audioCtx.resume();
    const src = this.audioCtx.createMediaStreamSource(stream);
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    this.meters.set(id, { src, analyser, buf: new Float32Array(analyser.fftSize) });
    if (!this.meterTimer) this.meterTimer = window.setInterval(() => this.measure(), 150);
  }

  unwatch(id: string): void {
    const m = this.meters.get(id);
    if (!m) return;
    m.src.disconnect();
    this.meters.delete(id);
  }

  private measure(): void {
    const talking = new Set<string>();
    for (const [id, m] of this.meters) {
      m.analyser.getFloatTimeDomainData(m.buf);
      let sum = 0;
      for (const v of m.buf) sum += v * v;
      const rms = Math.sqrt(sum / m.buf.length);
      if (rms > 0.02) talking.add(id);
      if (id === 'self') this.emit('level', Math.min(1, rms * 6)); // my mic level, 0..1, for the meter
    }
    if (!this.meters.has('self')) this.emit('level', 0);
    this.emit('speaking', talking);
  }
}
