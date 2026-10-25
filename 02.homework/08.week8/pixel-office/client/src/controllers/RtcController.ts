// Controller: audio/video calls with people nearby (WebRTC, browser to browser).
//
// How it works
// - Every 250 ms we check, for each person, whether a call should be open
//   (shared/proximity.ts). The person with the smaller id starts the call.
// - Each call carries three fixed channels: mic, camera, screen. Turning the
//   camera on/off just swaps the track (replaceTrack), so the call never has to be
//   renegotiated.
// - The server only passes the setup messages along; media goes directly between browsers.

import type { Socket } from 'socket.io-client';
import { shouldConnect, volumeBetween } from '../../../shared/proximity.ts';
import { cleanSignal, type Signal } from '../../../shared/signal.ts';
import type { ClientToServer, ServerToClient } from '../../../shared/types.ts';
import { Emitter } from '../models/Emitter.ts';
import type { SpaceModel } from '../models/SpaceModel.ts';
import type { MediaController } from './MediaController.ts';

type Sock = Socket<ServerToClient, ClientToServer>;

const KINDS = ['audio', 'cam', 'screen'] as const;
type Kind = (typeof KINDS)[number];

interface Peer {
  id: string;
  pc: RTCPeerConnection;
  transceivers: RTCRtpTransceiver[];
  streams: Record<Kind, MediaStream>;
  audioEl: HTMLAudioElement;
  pendingIce: RTCIceCandidateInit[];
  /** Whether my mic/camera/screen are being sent to this person right now. */
  sending: boolean;
}

/** ICE candidates kept while waiting for the other side's description. */
const MAX_PENDING_ICE = 40;

export class RtcController extends Emitter<{ peers: void }> {
  private readonly peers = new Map<string, Peer>();
  private readonly socket: Sock;
  private readonly model: SpaceModel;
  private readonly media: MediaController;
  private readonly iceServers: RTCIceServer[];
  private readonly failedAt = new Map<string, number>();

  constructor(socket: Sock, model: SpaceModel, media: MediaController, iceServers: RTCIceServer[]) {
    super();
    this.socket = socket;
    this.model = model;
    this.media = media;
    this.iceServers = iceServers;
    socket.on('signal', ({ from, data }) => {
      const clean = cleanSignal(data);
      if (clean) void this.onSignal(from, clean);
    });
    media.on('local', () => this.pushLocalTracks());
  }

  /** Remote camera/screen streams of a person, if a call with them is open. */
  streamsOf(id: string): { cam: MediaStream; screen: MediaStream } | null {
    const p = this.peers.get(id);
    return p ? { cam: p.streams.cam, screen: p.streams.screen } : null;
  }

  isConnected(id: string): boolean {
    return this.peers.has(id);
  }

  /** Opens and closes calls as people move. */
  update(): void {
    const me = this.model.me;
    const now = Date.now();
    for (const other of this.model.others()) {
      const open = this.peers.has(other.id);
      const want = shouldConnect(me, other, open);
      if (want && !open && this.model.selfId < other.id) {
        // wait a bit after a failure before trying again
        if (now - (this.failedAt.get(other.id) ?? 0) > 5000) void this.call(other.id);
      } else if (!want && open) {
        this.hangUp(other.id, true);
      } else if (open) {
        // send my media only while this person can actually hear me
        const peer = this.peers.get(other.id)!;
        if (peer.sending !== this.maySend(peer)) void this.applyLocalTracks(peer).catch(() => undefined);
      }
    }
    for (const id of this.peers.keys()) if (!this.model.players.has(id)) this.hangUp(id, false);
  }

  /** Sets everyone's volume by distance. Called every frame. */
  updateVolumes(): void {
    const me = this.model.me;
    for (const peer of this.peers.values()) {
      const other = this.model.players.get(peer.id);
      const v = other ? volumeBetween(me, other) : 0;
      if (Math.abs(peer.audioEl.volume - v) > 0.01) peer.audioEl.volume = v;
    }
  }

  async setSpeaker(deviceId: string): Promise<void> {
    for (const p of this.peers.values()) await setSink(p.audioEl, deviceId);
  }

  closeAll(): void {
    for (const id of [...this.peers.keys()]) this.hangUp(id, true);
  }

  private newPeer(id: string): Peer {
    const pc = new RTCPeerConnection({ iceServers: this.iceServers });
    const audioEl = new Audio();
    audioEl.autoplay = true;
    audioEl.volume = 0;
    void setSink(audioEl, this.media.speakerId);
    const peer: Peer = {
      id,
      pc,
      transceivers: [],
      streams: { audio: new MediaStream(), cam: new MediaStream(), screen: new MediaStream() },
      audioEl,
      pendingIce: [],
      sending: false,
    };
    audioEl.srcObject = peer.streams.audio;
    pc.onicecandidate = (e) => {
      if (e.candidate) this.send(id, { kind: 'ice', candidate: { candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex } });
    };
    pc.ontrack = (e) => {
      // Channel order is fixed by the offer: 0 = mic, 1 = camera, 2 = screen.
      const kind = KINDS[pc.getTransceivers().indexOf(e.transceiver)];
      if (!kind) return;
      const s = peer.streams[kind];
      for (const t of s.getTracks()) s.removeTrack(t);
      s.addTrack(e.track);
      if (kind === 'audio') {
        void audioEl.play().catch(() => undefined);
        this.media.watch(id, s);
      }
      this.emit('peers', undefined);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        this.failedAt.set(id, Date.now());
        this.hangUp(id, true);
      }
    };
    this.peers.set(id, peer);
    return peer;
  }

  /** I start the call (I have the smaller id). */
  private async call(id: string): Promise<void> {
    const peer = this.newPeer(id);
    for (let i = 0; i < 3; i++) {
      peer.transceivers.push(peer.pc.addTransceiver(i === 0 ? 'audio' : 'video', { direction: 'sendrecv' }));
    }
    await this.applyLocalTracks(peer);
    const offer = await peer.pc.createOffer();
    await peer.pc.setLocalDescription(offer);
    this.send(id, { kind: 'offer', sdp: peer.pc.localDescription!.sdp });
    this.emit('peers', undefined);
  }

  private async onSignal(from: string, data: Signal): Promise<void> {
    try {
      switch (data.kind) {
        case 'offer':
          return await this.onOffer(from, data.sdp);
        case 'answer': {
          const peer = this.peers.get(from);
          if (!peer || peer.pc.signalingState !== 'have-local-offer') return;
          await peer.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
          await this.flushIce(peer);
          limitBitrate(peer);
          return;
        }
        case 'ice': {
          const peer = this.peers.get(from);
          if (!peer) return;
          if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
          else if (peer.pendingIce.length < MAX_PENDING_ICE) peer.pendingIce.push(data.candidate);
          return;
        }
        case 'bye':
          this.hangUp(from, false);
          // short pause before calling again, in case we disagree about the distance
          this.failedAt.set(from, Date.now() - 3500);
          return;
      }
    } catch (err) {
      // a broken offer/answer: drop the half-made call instead of keeping it around
      console.warn('WebRTC signal error', err);
      if (data.kind === 'offer' || data.kind === 'answer') this.hangUp(from, true);
    }
  }

  /** Someone with a smaller id calls me. */
  private async onOffer(from: string, sdp: string): Promise<void> {
    const other = this.model.players.get(from);
    // Only accept calls from people who are actually near me (my own check, not just theirs).
    if (!other || typeof sdp !== 'string' || !shouldConnect(this.model.me, other, true)) {
      this.send(from, { kind: 'bye' });
      return;
    }
    if (this.peers.has(from)) this.hangUp(from, false);
    const peer = this.newPeer(from);
    await peer.pc.setRemoteDescription({ type: 'offer', sdp });
    peer.transceivers = peer.pc.getTransceivers().slice(0, 3);
    for (const t of peer.transceivers) t.direction = 'sendrecv';
    await this.applyLocalTracks(peer);
    const answer = await peer.pc.createAnswer();
    await peer.pc.setLocalDescription(answer);
    this.send(from, { kind: 'answer', sdp: peer.pc.localDescription!.sdp });
    await this.flushIce(peer);
    limitBitrate(peer);
    this.emit('peers', undefined);
  }

  private async flushIce(peer: Peer): Promise<void> {
    for (const c of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(c).catch(() => undefined);
  }

  /**
   * My media goes to a person only if they can hear me (by the shared rules).
   * Example: while someone uses the megaphone, the far-away listeners do NOT send
   * their mic/camera back to them — even if that person's app was modified.
   */
  private maySend(peer: Peer): boolean {
    const other = this.model.players.get(peer.id);
    return !!other && volumeBetween(other, this.model.me) > 0;
  }

  private async applyLocalTracks(peer: Peer): Promise<void> {
    peer.sending = this.maySend(peer);
    const tracks = peer.sending ? [this.media.mic, this.media.cam, this.media.screen] : [null, null, null];
    await Promise.all(
      peer.transceivers.map((t, i) => (t.sender.track === tracks[i] ? undefined : t.sender.replaceTrack(tracks[i] ?? null))),
    );
  }

  private pushLocalTracks(): void {
    for (const p of this.peers.values()) void this.applyLocalTracks(p).catch(() => undefined);
  }

  private hangUp(id: string, notify: boolean): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.pc.close();
    peer.audioEl.srcObject = null;
    this.media.unwatch(id);
    if (notify) this.send(id, { kind: 'bye' });
    this.emit('peers', undefined);
  }

  private send(to: string, data: Signal): void {
    this.socket.emit('signal', { to, data });
  }
}

async function setSink(el: HTMLAudioElement, deviceId: string): Promise<void> {
  const withSink = el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
  if (deviceId && withSink.setSinkId) await withSink.setSinkId(deviceId).catch(() => undefined);
}

/** Caps upload per call so a full-mesh call with several people stays smooth. */
function limitBitrate(peer: Peer): void {
  const caps = [64_000, 500_000, 1_500_000];
  peer.transceivers.forEach((t, i) => {
    const params = t.sender.getParameters();
    if (!params.encodings?.length) params.encodings = [{}];
    params.encodings[0]!.maxBitrate = caps[i];
    void t.sender.setParameters(params).catch(() => undefined);
  });
}
