// View: profile (name + avatar), devices and effects.

import { MAX_NAME, cleanText } from '../../../../shared/constants.ts';
import type { AvatarLook } from '../../../../shared/types.ts';
import type { MediaController } from '../../controllers/MediaController.ts';
import type { Daylight, Settings, Weather } from '../../models/SettingsModel.ts';
import { AvatarEditor } from '../AvatarEditor.ts';
import { DevicePicker } from '../DevicePicker.ts';
import { h, toast } from '../dom.ts';

export interface SettingsActions {
  saveProfile: (name: string, look: AvatarLook) => void;
  devices: (micId: string, camId: string, speakerId: string) => void;
  effects: (patch: Partial<Pick<Settings, 'weather' | 'daylight' | 'sounds' | 'minimap'>>) => void;
}

const WEATHER: [Weather, string][] = [['none', 'なし'], ['sakura', '🌸 桜'], ['snow', '❄️ 雪'], ['rain', '☔ 雨'], ['leaves', '🍁 紅葉']];
const DAYLIGHT: [Daylight, string][] = [['auto', '🕒 時刻どおり'], ['day', '☀️ 昼'], ['evening', '🌇 夕方'], ['night', '🌙 夜']];

export class SettingsPanel {
  readonly el = h('div', { class: 'settings' });
  private readonly editor: AvatarEditor;
  private readonly devices: DevicePicker;

  constructor(settings: Settings, media: MediaController, actions: SettingsActions) {
    const nameInput = h('input', { class: 'input', maxlength: MAX_NAME, value: settings.name, 'aria-label': '表示名' });
    this.editor = new AvatarEditor(settings.look);
    const save = () => {
      const n = cleanText(nameInput.value, MAX_NAME);
      if (!n) return toast('表示名を入力してください', 'error');
      actions.saveProfile(n, this.editor.look);
      toast('プロフィールを保存しました ✨');
    };
    this.devices = new DevicePicker(media, (c) => actions.devices(c.micId, c.camId, c.speakerId));

    const choice = <T extends string>(list: [T, string][], current: T, set: (v: T) => void) => {
      const box = h('div', { class: 'choice-row' });
      for (const [v, label] of list) {
        const b = h('button', { class: 'chip', 'aria-pressed': String(v === current), onclick: () => {
          box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
          b.setAttribute('aria-pressed', 'true');
          set(v);
        } }, label);
        box.append(b);
      }
      return box;
    };
    const toggle = (label: string, on: boolean, set: (v: boolean) => void) => {
      const input = h('input', { type: 'checkbox', checked: on });
      input.addEventListener('change', () => set(input.checked));
      return h('label', { class: 'toggle' }, input, label);
    };

    this.el.append(
      h('section', { class: 'set-sec' }, h('h3', { class: 'group-title' }, 'プロフィール'), h('label', { class: 'field' }, h('span', null, '表示名'), nameInput), this.editor.el, h('button', { class: 'btn btn-primary', onclick: save }, 'この見た目で保存')),
      h(
        'section',
        { class: 'set-sec' },
        h('h3', { class: 'group-title' }, '演出'),
        h('div', { class: 'field' }, h('span', null, '天気'), choice(WEATHER, settings.weather, (v) => actions.effects({ weather: v }))),
        h('div', { class: 'field' }, h('span', null, '明るさ'), choice(DAYLIGHT, settings.daylight, (v) => actions.effects({ daylight: v }))),
        toggle('効果音（入室・呼び出し）', settings.sounds, (v) => actions.effects({ sounds: v })),
        toggle('ミニマップを表示', settings.minimap, (v) => actions.effects({ minimap: v })),
      ),
      h('section', { class: 'set-sec' }, h('h3', { class: 'group-title' }, 'カメラ・マイク・スピーカー'), this.devices.el),
    );
  }

  dispose(): void {
    this.editor.dispose();
    this.devices.dispose();
  }
}
