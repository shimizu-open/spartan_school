// View: the check-in screen before entering a space
// (camera preview, device choice, avatar and name).

import { MAX_NAME, cleanText } from '../../../shared/constants.ts';
import type { MediaController } from '../controllers/MediaController.ts';
import type { Settings } from '../models/SettingsModel.ts';
import { AvatarEditor } from './AvatarEditor.ts';
import { DevicePicker } from './DevicePicker.ts';
import { clear, h, icon, toast } from './dom.ts';

export interface LobbyHandlers {
  enter: () => void;
  back: () => void;
}

export class LobbyView {
  private readonly media: MediaController;
  private readonly settings: Settings;
  private readonly video: HTMLVideoElement;
  private readonly editor: AvatarEditor;
  private readonly micBtn: HTMLButtonElement;
  private readonly camBtn: HTMLButtonElement;
  private readonly devices: DevicePicker;
  private readonly enterBtn: HTMLButtonElement;
  private readonly nameInput: HTMLInputElement;

  constructor(root: HTMLElement, spaceId: string, media: MediaController, settings: Settings, on: LobbyHandlers) {
    this.media = media;
    this.settings = settings;
    this.video = h('video', { class: 'mirror', autoplay: true, playsinline: true, muted: true });
    this.micBtn = h('button', { class: 'round-btn', type: 'button', onclick: () => void this.toggle('mic') });
    this.camBtn = h('button', { class: 'round-btn', type: 'button', onclick: () => void this.toggle('cam') });
    media.micId = settings.micId;
    media.camId = settings.camId;
    media.speakerId = settings.speakerId;
    this.devices = new DevicePicker(media, (c) => void this.pickDevices(c.micId, c.camId, c.speakerId));
    this.nameInput = h('input', { class: 'input name-input', maxlength: MAX_NAME, 'aria-label': '名前', value: settings.name });
    this.editor = new AvatarEditor(settings.look);
    this.editor.onChange = (look) => {
      settings.look = look;
    };
    this.enterBtn = h('button', { class: 'btn btn-primary btn-lg enter-btn', onclick: () => this.submit(on.enter) }, icon('check', 20), 'スペースに入る');

    root.append(
      h(
        'main',
        { class: 'lobby' },
        h(
          'section',
          { class: 'lobby-card' },
          h('div', { class: 'lobby-top' }, h('button', { class: 'link', onclick: on.back }, '← ホームに戻る'), h('span', { class: 'lobby-space' }, `スペース: ${spaceId}`)),
          h(
            'div',
            { class: 'lobby-body' },
            h(
              'div',
              { class: 'lobby-devices' },
              h('div', { class: 'preview' }, this.video, h('span', { class: 'preview-off' }, 'カメラはオフです'), h('div', { class: 'preview-btns' }, this.micBtn, this.camBtn)),
              this.devices.el,
            ),
            h(
              'div',
              { class: 'lobby-profile' },
              h('label', { class: 'field' }, h('span', null, '表示名'), this.nameInput),
              this.editor.el,
            ),
          ),
          this.enterBtn,
          h('p', { class: 'note' }, 'カメラとマイクは入室後にいつでもオン/オフできます'),
        ),
      ),
    );
    this.refreshButtons();
    void this.start();
  }

  /** Warns when the server cannot be reached (e.g. the page came from the offline copy). */
  private async checkServer(): Promise<void> {
    try {
      const r = await fetch('/healthz', { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      if (r.ok) return;
    } catch {
      // unreachable
    }
    this.enterBtn.disabled = true;
    this.enterBtn.parentElement?.insertBefore(
      h('div', { class: 'offline-banner', role: 'alert' }, '⚠️ サーバーにつながっていません。サーバーを起動してから、ページを再読み込みしてください。'),
      this.enterBtn,
    );
  }

  private async start(): Promise<void> {
    void this.checkServer();
    // Turn on what the user had on last time. Permission is asked here.
    try {
      if (this.settings.camOnJoin) await this.media.setCam(true);
      if (this.settings.micOnJoin) await this.media.setMic(true);
    } catch {
      toast('カメラかマイクを使えませんでした。ブラウザの許可設定を確認してください', 'error', 6000);
    }
    this.refreshButtons();
    await this.devices.refresh();
  }

  private async toggle(kind: 'mic' | 'cam'): Promise<void> {
    try {
      if (kind === 'mic') await this.media.setMic(!this.media.mic);
      else await this.media.setCam(!this.media.cam);
    } catch {
      toast(`${kind === 'mic' ? 'マイク' : 'カメラ'}を使えませんでした。ブラウザの許可設定を確認してください`, 'error', 6000);
    }
    this.refreshButtons();
    await this.devices.refresh(); // device names become visible after permission
  }

  private async pickDevices(micId: string, camId: string, speakerId: string): Promise<void> {
    this.media.speakerId = speakerId;
    await this.media.switchDevices(micId, camId).catch(() => toast('デバイスを切り替えられませんでした', 'error'));
    this.refreshButtons();
  }

  private refreshButtons(): void {
    const mic = !!this.media.mic;
    const cam = !!this.media.cam;
    clear(this.micBtn);
    clear(this.camBtn);
    this.micBtn.append(icon(mic ? 'mic' : 'micOff', 20));
    this.camBtn.append(icon(cam ? 'cam' : 'camOff', 20));
    this.micBtn.classList.toggle('off', !mic);
    this.camBtn.classList.toggle('off', !cam);
    this.micBtn.setAttribute('aria-label', mic ? 'マイクをオフ' : 'マイクをオン');
    this.camBtn.setAttribute('aria-label', cam ? 'カメラをオフ' : 'カメラをオン');
    this.video.srcObject = this.media.camStream;
    this.video.hidden = !cam;
  }

  private submit(enter: () => void): void {
    const name = cleanText(this.nameInput.value, MAX_NAME);
    if (!name) {
      toast('表示名を入力してください', 'error');
      this.nameInput.focus();
      return;
    }
    this.settings.name = name;
    this.settings.look = this.editor.look;
    this.settings.micId = this.media.micId;
    this.settings.camId = this.media.camId;
    this.settings.speakerId = this.media.speakerId;
    this.settings.micOnJoin = !!this.media.mic;
    this.settings.camOnJoin = !!this.media.cam;
    this.enterBtn.disabled = true;
    enter();
  }

  /** Called if joining failed, so the user can try again. */
  enable(): void {
    this.enterBtn.disabled = false;
  }

  dispose(): void {
    this.devices.dispose();
    this.editor.dispose();
    this.video.srcObject = null;
  }
}
