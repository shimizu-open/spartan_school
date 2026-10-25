// Controller: runs one visit to a space. It connects to the server, keeps the
// model up to date from server events, turns button presses and keys into
// actions, and drives the views every frame.

import { io, type Socket } from 'socket.io-client';
import { DRINKS, MAX_FILE_BYTES, REACTIONS, STATUSES, TILE } from '../../../shared/constants.ts';
import { areaEntry, objectNear, occupiedBy, roomOfObject, seatAt, type MapObject } from '../../../shared/map.ts';
import { volumeBetween } from '../../../shared/proximity.ts';
import type { ChatChannel, ClientToServer, FileMeta, JoinError, JoinResult, PlayerStatePatch, ServerToClient, Status } from '../../../shared/types.ts';
import { saveSettings, type Settings } from '../models/SettingsModel.ts';
import { SpaceModel, type PlayerView } from '../models/SpaceModel.ts';
import { SIT_DROP, headTop } from '../views/avatarSprite.ts';
import { h, icon, toast } from '../views/dom.ts';
import { openFile } from '../views/Lightbox.ts';
import { MapView } from '../views/MapView.ts';
import { MinimapView } from '../views/MinimapView.ts';
import { openNoteEditor, openNoteViewer } from '../views/NoteViews.ts';
import { ChatPanel } from '../views/panels/ChatPanel.ts';
import { FilesPanel } from '../views/panels/FilesPanel.ts';
import { MapPanel } from '../views/panels/MapPanel.ts';
import { MembersPanel } from '../views/panels/MembersPanel.ts';
import { SettingsPanel } from '../views/panels/SettingsPanel.ts';
import { EMOTE_KEYS, ShellView, type PanelName } from '../views/ShellView.ts';
import { VideoView, type VideoEntry } from '../views/VideoView.ts';
import { WhiteboardView } from '../views/WhiteboardView.ts';
import { InputController } from './InputController.ts';
import type { MediaController } from './MediaController.ts';
import { RtcController } from './RtcController.ts';

type Sock = Socket<ServerToClient, ClientToServer>;
type Panel = MembersPanel | ChatPanel | FilesPanel | MapPanel | SettingsPanel;

const OBJECT_HINT: Record<string, string> = { whiteboard: 'ホワイトボードに描く', vending: '自販機でドリンクを買う', photo: '記念撮影する' };

export class SpaceController {
  private readonly socket: Sock;
  private readonly model: SpaceModel;
  private readonly media: MediaController;
  private readonly settings: Settings;
  private shell!: ShellView;
  private map!: MapView;
  private minimap!: MinimapView;
  private videos!: VideoView;
  private input!: InputController;
  private rtc!: RtcController;
  private panel: Panel | null = null;
  private board: WhiteboardView | null = null;
  private unread = 0;
  private running = true;
  private leaving = false;
  private popup: HTMLElement | null = null;
  private localCam: MediaStream | null = null;
  private localScreen: MediaStream | null = null;
  private drinkTimer = 0;
  private near: MapObject | null = null;

  /** Connects and joins. Resolves with an error message if joining failed. */
  static async join(root: HTMLElement, spaceId: string, settings: Settings, media: MediaController): Promise<SpaceController | string> {
    const socket: Sock = io({ reconnection: false, timeout: 8000 });
    const res = await new Promise<JoinResult | JoinError>((resolve) => {
      socket.once('connect_error', () => resolve({ ok: false, error: 'サーバーに接続できませんでした' }));
      socket.timeout(8000).emit('join', { spaceId, name: settings.name, look: settings.look, clientKey: settings.clientKey }, (err, r) =>
        resolve(err ? { ok: false, error: 'サーバーから応答がありません' } : r),
      );
    });
    if (!res.ok) {
      socket.disconnect();
      return res.error;
    }
    await document.fonts.load('12px "DotGothic16"').catch(() => undefined);
    // STUN/TURN settings come with the join answer (TURN passwords are per person and expire).
    return new SpaceController(root, socket, res, settings, media, res.iceServers);
  }

  private constructor(root: HTMLElement, socket: Sock, joined: JoinResult, settings: Settings, media: MediaController, iceServers: RTCIceServer[]) {
    this.socket = socket;
    this.media = media;
    this.settings = settings;
    this.model = new SpaceModel(joined);
    document.title = `Pixel Office - ${joined.spaceId}`;
    this.buildViews(root);
    this.rtc = new RtcController(socket, this.model, media, iceServers);
    this.listenServer();
    this.listenModel();
    this.listenDrop();
    this.syncLocalMedia();
    this.loop();
    toast('ようこそ！クリックした場所へ歩けます。数字キーでリアクション 🎉');
  }

  // ---- setup -------------------------------------------------------------

  private buildViews(root: HTMLElement): void {
    this.shell = new ShellView(root, this.model.spaceId, {
      setStatus: (s) => void this.setStatus(s),
      setStatusNote: (n) => this.sendState({ statusNote: n }),
      toggleMic: () => void this.toggleMic(),
      toggleCam: () => void this.toggleCam(),
      toggleScreen: () => void this.toggleScreen(),
      toggleHand: () => this.sendState({ hand: !this.model.me.hand }),
      toggleMegaphone: () => this.toggleMegaphone(),
      toggleDance: () => this.toggleDance(),
      toggleSit: () => this.toggleSit(),
      action: (k) => this.socket.emit('action', k),
      addNote: () => this.addNote(),
      copyInvite: () => void this.copyInvite(),
      react: (e) => this.socket.emit('react', e),
      zoom: (step) => this.map.zoomBy(step),
      layout: (l) => {
        this.settings.layout = l;
        saveSettings(this.settings);
        this.videos.setLayout(l);
      },
      panel: (p) => this.openPanel(p),
      exit: () => this.exit(),
    });
    this.map = new MapView(this.shell.stage, this.model);
    this.shell.stage.prepend(this.map.canvas);
    this.map.weather = this.settings.weather;
    this.map.daylight = this.settings.daylight;
    this.videos = new VideoView(this.shell.stage);
    this.videos.setLayout(this.settings.layout);
    this.minimap = new MinimapView(this.model, this.map.base);
    this.minimap.onPick = (x, y) => {
      if (!this.input.walkTo(x, y)) this.input.teleport(x, y);
    };
    this.shell.minimapSlot.append(this.minimap.el);
    this.shell.minimapSlot.hidden = !this.settings.minimap;
    this.input = new InputController(this.socket, this.model, this.map, {
      playerClick: (p, x, y) => this.showPlayerPopup(p, x, y),
      noteClick: (n) => openNoteViewer(n, n.by === this.model.selfUid, () => this.socket.emit('note:remove', n.id)),
      fileClick: (f) => this.openFile(f),
      hotkey: (e) => this.hotkey(e),
    });
    this.map.canvas.focus();
  }

  private listenServer(): void {
    const s = this.socket;
    const m = this.model;
    s.on('player:join', (p) => {
      m.add(p);
      toast(`${p.name} さんが来ました 👋`);
      this.sound('join');
    });
    s.on('player:leave', (id) => {
      if (this.input.following === id) this.input.follow(null);
      m.remove(id);
    });
    s.on('player:move', ({ id, ...pos }) => m.move(id, pos));
    s.on('player:state', ({ id, ...patch }) => m.setState(id, patch));
    s.on('player:profile', ({ id, name, look }) => m.setProfile(id, name, look));
    s.on('react', ({ id, emoji }) => m.addReaction(id, emoji));
    s.on('action', ({ id, kind }) => m.startAction(id, kind));
    s.on('chat', (msg) => m.addChat(msg));
    s.on('intercom', ({ name }) => {
      this.sound('bell');
      toast(`🔔 ${name} さんが呼んでいます`, 'info', 8000);
    });
    s.on('notice', (text) => toast(text, 'error', 6000));
    s.on('file:add', (f) => m.addFile(f));
    s.on('file:remove', (id) => m.removeFile(id));
    s.on('note:add', (n) => m.addNote(n));
    s.on('note:remove', (id) => m.removeNote(id));
    s.on('wb:stroke', ({ board, stroke }) => {
      if (this.board?.board === board && this.board.isOpen && stroke.by !== m.selfUid) this.board.add(stroke);
    });
    s.on('wb:clear', ({ board }) => {
      if (this.board?.board === board && this.board.isOpen) this.board.clear();
    });
    s.on('disconnect', () => {
      if (this.leaving) return;
      this.stop();
      document.body.append(
        h(
          'div',
          { class: 'overlay' },
          h('div', { class: 'overlay-card' }, h('h2', null, '接続が切れました'), h('p', null, 'ネットワークを確認してから、もう一度入室してください。'), h('button', { class: 'btn btn-primary', onclick: () => location.reload() }, '再接続する')),
        ),
      );
    });
  }

  private listenModel(): void {
    const m = this.model;
    m.on('chat', (msg) => {
      if (this.panel instanceof ChatPanel) this.panel.add(msg);
      else if (msg.uid !== m.selfUid) this.unread++;
    });
    m.on('players', () => this.refreshPanel(true));
    m.on('state', () => this.refreshPanel(false));
    m.on('files', () => {
      if (this.panel instanceof FilesPanel) this.panel.refresh();
      if (this.panel instanceof ChatPanel) this.panel.refreshFiles();
    });
    this.media.on('speaking', (ids) => {
      const mapped = new Set([...ids].map((i) => (i === 'self' ? m.selfId : i)));
      if (!this.media.mic) mapped.delete(m.selfId);
      m.setSpeaking(mapped);
    });
    this.media.on('local', () => this.syncLocalMedia());
  }

  /** Drag & drop files: on the chat panel -> chat, anywhere else -> placed on the map at my feet. */
  private listenDrop(): void {
    let depth = 0;
    const root = this.shell.root;
    const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files');
    root.addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      depth++;
      this.shell.showDropZone(true);
    });
    root.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) this.shell.showDropZone(false);
    });
    root.addEventListener('dragover', (e) => {
      if (hasFiles(e)) e.preventDefault();
    });
    root.addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      this.shell.showDropZone(false);
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      const onPanel = (e.target as Element).closest('.panel');
      if (onPanel && this.panel instanceof ChatPanel) void this.upload(files, this.panel.channel);
      else void this.upload(files, 'map');
    });
  }

  // ---- main loop -----------------------------------------------------------

  private loop(): void {
    let last = performance.now();
    let slow = 0;
    let slower = 0;
    const frame = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      this.input.update(dt);
      this.model.tick(dt);
      this.rtc.updateVolumes();
      this.map.render(dt);
      this.videos.place((id) => {
        const p = this.model.players.get(id);
        if (!p) return null;
        const lift = p.pose === 'sit' ? SIT_DROP : 0;
        return this.map.worldToScreen(p.drawX, p.drawY - headTop(p.look) + lift - 26);
      }, this.map.zoom);
      slow += dt;
      slower += dt;
      if (slow > 0.25) {
        slow = 0;
        this.rtc.update();
        this.refreshVideos();
        this.refreshShell();
        this.refreshHint();
        if (this.settings.minimap) this.minimap.render(this.map.viewRect());
      }
      if (slower > 1) {
        slower = 0;
        this.refreshPanel(false);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  private refreshShell(): void {
    const me = this.model.me;
    this.shell.update({
      name: me.name,
      status: me.status,
      statusNote: me.statusNote,
      mic: !!this.media.mic,
      cam: !!this.media.cam,
      screen: !!this.media.screen,
      hand: me.hand,
      megaphone: me.megaphone,
      dancing: me.dancing,
      sitting: me.pose === 'sit',
      members: this.model.players.size,
      unread: this.unread,
      files: this.model.files.length,
      look: me.look,
      zoom: this.map.zoom,
      layout: this.settings.layout,
    });
    const speaker = this.model.others().find((p) => p.megaphone && this.rtc.isConnected(p.id));
    this.shell.setMegaphoneBanner(speaker ? speaker.name : null);
  }

  /** "Press E" hint for things near me, and the highlight on the map. */
  private refreshHint(): void {
    const me = this.model.me;
    this.near = objectNear(me.x, me.y);
    this.map.nearObject = this.near;
    if (this.near) return this.shell.setHint('E', OBJECT_HINT[this.near.kind] ?? this.near.name);
    if (me.pose !== 'sit' && seatAt(me.x, me.y)) return this.shell.setHint('X', '座る');
    if (this.input.following) {
      const t = this.model.players.get(this.input.following);
      if (t) return this.shell.setHint('Esc', `${t.name} さんについていくのをやめる`);
    }
    this.shell.setHint(null, null);
  }

  /** Decides which video tiles to show: me, and the people I can hear (or who can hear me). */
  private refreshVideos(): void {
    const me = this.model.me;
    const list: VideoEntry[] = [];
    const speaking = this.model.speaking;
    const others: VideoEntry[] = [];
    for (const p of this.model.others().sort((a, b) => a.name.localeCompare(b.name, 'ja'))) {
      const streams = this.rtc.streamsOf(p.id);
      if (!streams) continue;
      if (volumeBetween(me, p) <= 0 && volumeBetween(p, me) <= 0) continue;
      others.push({ key: `${p.id}:cam`, playerId: p.id, label: p.name, kind: 'cam', stream: streams.cam, showVideo: p.cam, look: p.look, micOn: p.mic, speaking: speaking.has(p.id), self: false, megaphone: p.megaphone });
      if (p.screen) others.push({ key: `${p.id}:screen`, playerId: p.id, label: `${p.name} の画面`, kind: 'screen', stream: streams.screen, showVideo: true, look: p.look, micOn: true, speaking: false, self: false, megaphone: false });
    }
    // My own tile appears when my camera is on or when I am talking with someone.
    if (STATUSES[me.status].talk || me.status === 'focus') {
      if (this.localCam || others.length) {
        list.push({ key: `${me.id}:cam`, playerId: me.id, label: `${me.name}（じぶん）`, kind: 'cam', stream: this.localCam, showVideo: !!this.localCam, look: me.look, micOn: !!this.media.mic, speaking: speaking.has(me.id), self: true, megaphone: me.megaphone });
      }
      if (this.localScreen) list.push({ key: `${me.id}:screen`, playerId: me.id, label: 'あなたの画面', kind: 'screen', stream: this.localScreen, showVideo: true, look: me.look, micOn: true, speaking: false, self: true, megaphone: false });
    }
    this.videos.render([...list, ...others]);
  }

  // ---- keys ----------------------------------------------------------------

  private hotkey(e: KeyboardEvent): boolean {
    const i = EMOTE_KEYS.indexOf(e.key);
    if (i >= 0) {
      this.socket.emit('react', REACTIONS[i]!);
      return true;
    }
    switch (e.code) {
      case 'Digit7':
        this.socket.emit('action', 'wave');
        return true;
      case 'Digit8':
        this.socket.emit('action', 'spin');
        return true;
      case 'Space':
        this.socket.emit('action', 'jump');
        return true;
      case 'Digit0':
        this.toggleDance();
        return true;
      case 'KeyX':
        this.toggleSit();
        return true;
      case 'KeyE':
        this.interact();
        return true;
      case 'KeyN':
        this.addNote();
        return true;
      case 'KeyH':
        this.sendState({ hand: !this.model.me.hand });
        return true;
      case 'KeyM':
        void this.toggleMic();
        return true;
      case 'KeyP':
        this.openPanel(this.shell.current === 'members' ? null : 'members');
        return true;
      case 'KeyF':
        this.openPanel(this.shell.current === 'files' ? null : 'files');
        return true;
      case 'KeyG':
        this.openPanel(this.shell.current === 'map' ? null : 'map');
        return true;
      case 'Comma':
        this.openPanel(this.shell.current === 'settings' ? null : 'settings');
        return true;
      case 'Enter':
        this.openPanel('chat');
        return true;
      case 'Escape':
        if (this.input.following) this.input.follow(null);
        else this.openPanel(null);
        return true;
    }
    return false;
  }

  // ---- actions -------------------------------------------------------------

  private sendState(patch: PlayerStatePatch): void {
    this.model.setState(this.model.selfId, patch);
    this.socket.emit('state', patch);
  }

  /** Keeps my mic/cam/screen flags (seen by others) in line with the real devices. */
  private syncLocalMedia(): void {
    const me = this.model.me;
    this.localCam = this.media.cam ? (this.localCam?.getVideoTracks()[0] === this.media.cam ? this.localCam : new MediaStream([this.media.cam])) : null;
    this.localScreen = this.media.screen ? (this.localScreen?.getVideoTracks()[0] === this.media.screen ? this.localScreen : new MediaStream([this.media.screen])) : null;
    const patch: PlayerStatePatch = {};
    if (me.mic !== !!this.media.mic) patch.mic = !!this.media.mic;
    if (me.cam !== !!this.media.cam) patch.cam = !!this.media.cam;
    if (me.screen !== !!this.media.screen) patch.screen = !!this.media.screen;
    if (Object.keys(patch).length) this.sendState(patch);
    this.refreshVideos();
  }

  private async ensureAtDesk(): Promise<void> {
    const s = this.model.me.status;
    if (s === 'away' || s === 'lunch' || s === 'break') await this.setStatus('present');
  }

  private async toggleMic(): Promise<void> {
    try {
      if (!this.media.mic) await this.ensureAtDesk();
      await this.media.setMic(!this.media.mic);
    } catch {
      toast('マイクを使えませんでした。ブラウザの許可設定を確認してください', 'error', 6000);
    }
  }

  private async toggleCam(): Promise<void> {
    try {
      if (!this.media.cam) await this.ensureAtDesk();
      await this.media.setCam(!this.media.cam);
    } catch {
      toast('カメラを使えませんでした。ブラウザの許可設定を確認してください', 'error', 6000);
    }
  }

  private async toggleScreen(): Promise<void> {
    if (this.media.screen) return this.media.stopScreen();
    try {
      await this.ensureAtDesk();
      await this.media.startScreen();
    } catch {
      // the user closed the picker
    }
  }

  private toggleMegaphone(): void {
    const on = !this.model.me.megaphone;
    this.sendState({ megaphone: on });
    toast(on ? '📣 メガホン中：フロア全員に声が届きます（会議室・離席中の人を除く）' : 'メガホンを終えました');
  }

  private toggleDance(): void {
    const me = this.model.me;
    this.sendState({ dancing: !me.dancing, pose: 'stand' });
  }

  private toggleSit(): void {
    const me = this.model.me;
    if (me.pose === 'sit') return this.sendState({ pose: 'stand' });
    const seat = seatAt(me.x, me.y);
    if (!seat) {
      toast('近くにイスやソファがありません 🪑');
      return;
    }
    this.input.place(seat.x, seat.y, seat.dir);
    this.sendState({ pose: 'sit', dancing: false });
  }

  /** Statuses that mean "not at the desk" turn the mic, camera and screen share off. */
  private async setStatus(s: Status): Promise<void> {
    if (s === 'away' || s === 'lunch' || s === 'break') {
      await this.media.setMic(false);
      await this.media.setCam(false);
      this.media.stopScreen();
      this.sendState({ status: s, megaphone: false, hand: false });
    } else {
      this.sendState({ status: s });
    }
    if (s === 'focus') toast('🎧 集中モード：近くを通っても自動ではつながりません（会議室では話せます）');
  }

  private addNote(): void {
    openNoteEditor((text, color) => {
      const me = this.model.me;
      const front = { down: [0, 18], up: [0, -24], left: [-22, 0], right: [22, 0] }[me.dir];
      this.socket.emit('note:add', { x: me.x + front[0]!, y: me.y + front[1]!, text, color });
    });
  }

  /** E key: use the whiteboard / vending machine / photo spot in front of me. */
  private interact(): void {
    const o = this.near;
    if (!o) {
      const me = this.model.me;
      if (seatAt(me.x, me.y)) return this.toggleSit();
      toast('近くに使えるものがありません');
      return;
    }
    if (o.kind === 'whiteboard') return this.openBoard(o);
    if (o.kind === 'vending') {
      const drink = DRINKS[Math.floor(Math.random() * DRINKS.length)]!;
      this.sendState({ item: drink });
      this.sound('pop');
      toast(`${drink} ガコン！ドリンクを手に入れました`);
      clearTimeout(this.drinkTimer);
      this.drinkTimer = window.setTimeout(() => this.sendState({ item: '' }), 3 * 60 * 1000);
      return;
    }
    if (o.kind === 'photo') this.takePhoto();
  }

  private openBoard(o: MapObject): void {
    this.socket.timeout(5000).emit('wb:open', o.id, (err, strokes) => {
      if (err || !strokes) {
        toast(roomOfObject(o) ? 'この会議室のホワイトボードは、部屋の中から使えます' : 'ホワイトボードに近づいてください', 'error');
        return;
      }
      this.board?.close();
      this.board = new WhiteboardView(o.id, `🖍️ ${o.name}`, strokes, {
        stroke: (s) => this.socket.emit('wb:stroke', { board: o.id, stroke: s }),
        clear: () => this.socket.emit('wb:clear', o.id),
        close: () => {
          this.board = null;
          this.map.canvas.focus();
        },
      });
    });
  }

  /** Photo spot: 3-2-1 countdown, then saves the current view as a PNG. */
  private takePhoto(): void {
    let n = 3;
    const tick = () => {
      if (n > 0) {
        toast(`📸 ${n}…`, 'info', 900);
        n--;
        setTimeout(tick, 900);
        return;
      }
      this.socket.emit('react', '🎉');
      setTimeout(() => {
        this.map.canvas.toBlob((blob) => {
          if (!blob) return;
          const a = h('a', { href: URL.createObjectURL(blob), download: `pixel-office-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.png` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          this.shell.stage.classList.add('flash');
          setTimeout(() => this.shell.stage.classList.remove('flash'), 400);
          toast('📸 記念写真を保存しました');
        });
      }, 150);
    };
    tick();
  }

  private async copyInvite(): Promise<void> {
    const url = `${location.origin}/s/${this.model.spaceId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('🔗 招待リンクをコピーしました');
    } catch {
      window.prompt('このリンクを共有してください', url);
    }
  }

  private goNear(p: PlayerView): void {
    if (!this.input.walkTo(p.x + 28, p.y)) this.input.teleport(p.x + 28, p.y);
  }

  private intercom(p: PlayerView): void {
    this.socket.emit('intercom', p.id);
    toast(`🔔 ${p.name} さんを呼びました`);
  }

  private follow(p: PlayerView): void {
    this.input.follow(p.id);
    toast(`👣 ${p.name} さんについていきます（Esc か移動キーでやめる）`);
  }

  // ---- files ---------------------------------------------------------------

  private async upload(files: File[], to: ChatChannel | 'map'): Promise<void> {
    for (const f of files.slice(0, 10)) {
      if (f.size > MAX_FILE_BYTES) {
        toast(`「${f.name}」は大きすぎます（20MBまで）`, 'error');
        continue;
      }
      const me = this.model.me;
      const q = new URLSearchParams({ name: f.name, to });
      if (to === 'map') {
        // place it at my feet, spreading several files a little
        const n = this.model.files.filter((x) => x.x !== undefined && Math.hypot(x.x - me.x, (x.y ?? 0) - me.y) < TILE * 2).length;
        q.set('x', String(Math.round(me.x + ((n % 3) - 1) * 26)));
        q.set('y', String(Math.round(me.y + 22 + Math.floor(n / 3) * 20)));
      }
      toast(`⏫ 「${f.name}」をアップロード中…`, 'info', 2000);
      try {
        const res = await fetch(`/api/spaces/${encodeURIComponent(this.model.spaceId)}/files?${q}`, {
          method: 'POST',
          headers: { 'X-Upload-Token': this.model.uploadToken, 'Content-Type': 'application/octet-stream' },
          body: f,
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          toast(err.error ?? 'アップロードできませんでした', 'error');
        } else if (to === 'map') toast(`📦 「${f.name}」を足もとに置きました`);
      } catch {
        toast('アップロードできませんでした', 'error');
      }
    }
  }

  private openFile(f: FileMeta): void {
    if (!this.model.files.some((x) => x.id === f.id)) {
      toast('このファイルは削除されています', 'error');
      return;
    }
    openFile(f, this.model.fileUrl(f), this.model.fileUrl(f, true));
  }

  private download(f: FileMeta): void {
    h('a', { href: this.model.fileUrl(f, true), download: f.name }).click();
  }

  // ---- panels --------------------------------------------------------------

  private openPanel(name: PanelName | null): void {
    if (this.panel instanceof SettingsPanel) this.panel.dispose();
    this.panel = null;
    switch (name) {
      case 'members':
        this.panel = new MembersPanel(this.model, { goTo: (p) => this.goNear(p), follow: (p) => this.follow(p), intercom: (p) => this.intercom(p) });
        this.shell.openPanel(name, `メンバー（${this.model.players.size}）`, this.panel.el);
        break;
      case 'chat': {
        const chat = new ChatPanel(this.model, {
          send: (channel, text) => this.socket.emit('chat', { channel, text }),
          upload: (files, channel) => void this.upload(files, channel),
          openFile: (f) => this.openFile(f),
        });
        this.panel = chat;
        this.unread = 0;
        this.shell.openPanel(name, 'チャット', chat.el);
        chat.focus();
        break;
      }
      case 'files':
        this.panel = new FilesPanel(this.model, {
          open: (f) => this.openFile(f),
          download: (f) => this.download(f),
          remove: (f) => {
            if (confirm(`「${f.name}」を削除しますか？`)) this.socket.emit('file:remove', f.id);
          },
          goTo: (f) => {
            if (f.x === undefined || f.y === undefined) return;
            if (!this.input.walkTo(f.x, f.y + 20)) this.input.teleport(f.x, f.y + 20);
          },
          upload: (files, where) => void this.upload(files, where),
        });
        this.shell.openPanel(name, 'ファイル', this.panel.el);
        break;
      case 'map':
        this.panel = new MapPanel(this.model, {
          goArea: (a) => {
            const spot = areaEntry(a, occupiedBy(this.model.others(), 48));
            this.input.teleport(spot.x, spot.y);
          },
          goObject: (o) => {
            const x = (o.tx + o.w / 2) * TILE;
            const y = (o.ty + o.h) * TILE + TILE;
            if (!this.input.walkTo(x, y)) this.input.teleport(x, y);
          },
        });
        this.shell.openPanel(name, 'マップ', this.panel.el);
        break;
      case 'settings':
        this.panel = new SettingsPanel(this.settings, this.media, {
          saveProfile: (n, look) => {
            this.settings.name = n;
            this.settings.look = look;
            saveSettings(this.settings);
            this.socket.emit('profile', { name: n, look });
          },
          devices: (micId, camId, speakerId) => {
            this.media.speakerId = speakerId;
            Object.assign(this.settings, { micId, camId, speakerId });
            saveSettings(this.settings);
            void this.media.switchDevices(micId, camId).catch(() => toast('デバイスを切り替えられませんでした', 'error'));
            void this.rtc.setSpeaker(speakerId);
          },
          effects: (patch) => {
            Object.assign(this.settings, patch);
            saveSettings(this.settings);
            this.map.weather = this.settings.weather;
            this.map.daylight = this.settings.daylight;
            this.shell.minimapSlot.hidden = !this.settings.minimap;
          },
        });
        this.shell.openPanel(name, '設定', this.panel.el);
        break;
      default:
        this.shell.openPanel(null, '', null);
        this.map.canvas.focus();
    }
  }

  private refreshPanel(force: boolean): void {
    if (this.panel instanceof MembersPanel) {
      this.panel.refresh(force);
      this.shell.setPanelTitle(`メンバー（${this.model.players.size}）`);
    }
    if (this.panel instanceof MapPanel) this.panel.refresh(force);
  }

  private showPlayerPopup(p: PlayerView, x: number, y: number): void {
    this.popup?.remove();
    const self = p.id === this.model.selfId;
    const close = () => {
      this.popup?.remove();
      this.popup = null;
    };
    const st = STATUSES[p.status];
    const card = h(
      'div',
      { class: 'pop popup', role: 'dialog', 'aria-label': p.name },
      h('div', { class: 'popup-name' }, p.name),
      h('div', { class: 'popup-status' }, `${st.emoji} ${st.label}${p.statusNote ? `・${p.statusNote}` : ''}`),
      self
        ? h('button', { class: 'chip', onclick: () => (this.openPanel('settings'), close()) }, '🎨 見た目を変える')
        : h(
            'div',
            { class: 'popup-actions' },
            h('button', { class: 'chip', onclick: () => (this.intercom(p), close()) }, icon('bell', 14), '呼ぶ'),
            h('button', { class: 'chip', onclick: () => (this.goNear(p), close()) }, icon('walk', 14), '近くへ'),
            h('button', { class: 'chip', onclick: () => (this.follow(p), close()) }, '👣 ついていく'),
          ),
    );
    const r = this.shell.stage.getBoundingClientRect();
    card.style.left = `${Math.max(8, Math.min(x - r.left - 90, r.width - 260))}px`;
    card.style.top = `${Math.max(64, y - r.top - 140)}px`;
    this.shell.stage.append(card);
    this.popup = card;
    setTimeout(() => document.addEventListener('click', close, { once: true }), 0);
  }

  // ---- misc ----------------------------------------------------------------

  /** Small sounds made with WebAudio (no sound files). */
  private sound(kind: 'bell' | 'join' | 'pop'): void {
    if (!this.settings.sounds) return;
    try {
      const ctx = new AudioContext();
      const notes = kind === 'bell' ? [880, 660] : kind === 'join' ? [523, 784] : [660];
      notes.forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = kind === 'pop' ? 'square' : 'sine';
        o.frequency.value = f;
        const t = ctx.currentTime + i * 0.18;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === 'bell' ? 0.25 : 0.08, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'bell' ? 0.33 : 0.16));
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 0.35);
      });
      setTimeout(() => void ctx.close(), 1500);
    } catch {
      // audio not available
    }
  }

  private stop(): void {
    this.running = false;
    this.rtc.closeAll();
    this.input.dispose();
    this.media.stopAll();
    this.board?.close();
  }

  private exit(): void {
    this.leaving = true;
    this.stop();
    this.socket.disconnect();
    location.assign('/');
  }
}
