// View: choose camera, microphone and speaker (used in the lobby and in Settings).
//
// Browsers hide device names until camera/microphone permission is given, so when
// the names are not available yet this shows a button that asks for permission.
// The lists refresh by themselves when a device is plugged in or out.

import { canPickSpeaker, type MediaController } from '../controllers/MediaController.ts';
import { clear, h, toast } from './dom.ts';

export interface DeviceChoice {
  micId: string;
  camId: string;
  speakerId: string;
}

export class DevicePicker {
  readonly el: HTMLElement;
  private readonly media: MediaController;
  private readonly onChange: (c: DeviceChoice) => void;
  private readonly cam = h('select', { class: 'input', 'aria-label': 'カメラ' });
  private readonly mic = h('select', { class: 'input', 'aria-label': 'マイク' });
  private readonly speaker = h('select', { class: 'input', 'aria-label': 'スピーカー' });
  private readonly allow: HTMLElement;
  private readonly meter = h('div', { class: 'meter', role: 'meter', 'aria-label': 'マイクの入力レベル', 'aria-valuemin': 0, 'aria-valuemax': 100 }, ...Array.from({ length: 20 }, () => h('i')));
  private readonly meterNote = h('span', { class: 'meter-note' }, 'マイクをオンにすると入力レベルが動きます');
  private readonly offs: (() => void)[] = [];

  constructor(media: MediaController, onChange: (c: DeviceChoice) => void) {
    this.media = media;
    this.onChange = onChange;
    this.allow = h(
      'div',
      { class: 'device-allow', hidden: true },
      h('p', null, '機器の名前は、カメラとマイクの使用を許可すると表示されます。'),
      h('button', { class: 'btn btn-small', type: 'button', onclick: () => void this.askPermission() }, '🎤📷 許可して機器を選ぶ'),
    );
    const changed = () => this.onChange(this.choice());
    this.cam.addEventListener('change', changed);
    this.mic.addEventListener('change', changed);
    this.speaker.addEventListener('change', changed);
    const test = h('button', { class: 'btn btn-small', type: 'button', onclick: () => void this.test() }, '🔊 テスト音');
    this.el = h(
      'div',
      { class: 'device-picker' },
      this.allow,
      h('label', { class: 'field' }, h('span', null, 'カメラ'), this.cam),
      h('label', { class: 'field' }, h('span', null, 'マイク'), this.mic),
      h('div', { class: 'meter-row' }, this.meter, this.meterNote),
      canPickSpeaker
        ? h('div', { class: 'field' }, h('span', null, 'スピーカー'), h('div', { class: 'speaker-row' }, this.speaker, test))
        : h('div', { class: 'field' }, h('span', null, 'スピーカー'), h('p', { class: 'note' }, 'このブラウザでは出力先を選べません。パソコンの音の設定で切り替えてください。'), test),
    );
    this.offs.push(media.on('devices', () => void this.refresh()));
    this.offs.push(media.on('level', (v) => this.showLevel(v)));
    void this.refresh();
  }

  choice(): DeviceChoice {
    return { micId: this.mic.value, camId: this.cam.value, speakerId: canPickSpeaker ? this.speaker.value : '' };
  }

  /** Re-reads the device lists (keeps the current choice when it still exists). */
  async refresh(): Promise<void> {
    let lists;
    try {
      lists = await this.media.listDevices();
    } catch {
      return;
    }
    const inUse = this.media.inUse();
    const fill = (sel: HTMLSelectElement, list: MediaDeviceInfo[], current: string, kind: string) => {
      clear(sel);
      sel.append(h('option', { value: '' }, `いつもの${kind}（既定）`));
      list.forEach((d, i) => {
        // Chrome adds "default"/"communications" entries that repeat a real device; they are still valid choices.
        sel.append(h('option', { value: d.deviceId, selected: d.deviceId === current }, d.label || `${kind} ${i + 1}`));
      });
      if (current && !list.some((d) => d.deviceId === current)) sel.value = '';
      sel.disabled = !lists.named && list.length === 0;
    };
    fill(this.cam, lists.cams, inUse.cam, 'カメラ');
    fill(this.mic, lists.mics, inUse.mic, 'マイク');
    fill(this.speaker, lists.speakers, this.media.speakerId, 'スピーカー');
    this.allow.hidden = lists.named;
    if (!lists.cams.length && lists.named) this.cam.title = 'カメラが見つかりません';
  }

  private async askPermission(): Promise<void> {
    const ok = await this.media.requestAccess();
    if (!ok.audio && !ok.video) {
      toast('カメラとマイクの使用が許可されませんでした。アドレスバーの🔒（またはカメラのマーク）から許可してください', 'error', 8000);
    } else if (!ok.audio || !ok.video) {
      toast(`${ok.audio ? 'カメラ' : 'マイク'}は使えませんでした（つながっていないか、許可されていません）`, 'error', 6000);
    }
    await this.refresh();
  }

  private async test(): Promise<void> {
    try {
      await this.media.testSpeaker(this.speaker.value);
    } catch {
      toast('テスト音を鳴らせませんでした', 'error');
    }
  }

  private showLevel(v: number): void {
    const bars = this.meter.children;
    const n = Math.round(v * bars.length);
    for (let i = 0; i < bars.length; i++) bars[i]!.classList.toggle('on', i < n);
    this.meter.setAttribute('aria-valuenow', String(Math.round(v * 100)));
    this.meterNote.hidden = !!this.media.mic;
  }

  dispose(): void {
    for (const off of this.offs) off();
  }
}
