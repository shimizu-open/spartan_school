// View: people in the space, grouped by where they are.

import { STATUSES } from '../../../../shared/constants.ts';
import { areaAt } from '../../../../shared/map.ts';
import type { PlayerView, SpaceModel } from '../../models/SpaceModel.ts';
import { portraitCanvas } from '../avatarSprite.ts';
import { clear, h, icon } from '../dom.ts';

export interface MemberActions {
  goTo: (p: PlayerView) => void;
  follow: (p: PlayerView) => void;
  intercom: (p: PlayerView) => void;
}

export class MembersPanel {
  readonly el = h('div', { class: 'members' });
  private readonly model: SpaceModel;
  private readonly actions: MemberActions;
  private readonly search = h('input', { class: 'input', placeholder: '🔍 名前でさがす', 'aria-label': 'メンバーを検索' });
  private readonly list = h('div');
  private lastKey = '';

  constructor(model: SpaceModel, actions: MemberActions) {
    this.model = model;
    this.actions = actions;
    this.search.addEventListener('input', () => this.refresh(true));
    this.el.append(this.search, this.list);
    this.refresh(true);
  }

  /** Redraws only when something visible changed (called every second). */
  refresh(force = false): void {
    const q = this.search.value.trim().toLowerCase();
    const people = [...this.model.players.values()].filter((p) => !q || p.name.toLowerCase().includes(q));
    const key = people.map((p) => `${p.id}${p.name}${p.status}${p.statusNote}${p.mic}${p.cam}${p.hand}${areaAt(p.x, p.y)?.id}${JSON.stringify(p.look)}`).join('|');
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    clear(this.list);
    const groups = new Map<string, PlayerView[]>();
    for (const p of people) {
      const g = areaAt(p.x, p.y)?.name ?? 'みち';
      groups.set(g, [...(groups.get(g) ?? []), p]);
    }
    for (const [name, ps] of [...groups].sort((a, b) => a[0].localeCompare(b[0], 'ja'))) {
      this.list.append(h('h3', { class: 'group-title' }, `${name}（${ps.length}）`));
      for (const p of ps.sort((a, b) => a.name.localeCompare(b.name, 'ja'))) this.list.append(this.row(p));
    }
  }

  private row(p: PlayerView): HTMLElement {
    const self = p.id === this.model.selfId;
    const st = STATUSES[p.status];
    return h(
      'div',
      { class: `member st-${p.status}` },
      portraitCanvas(p.look, 40, '#fff6e5'),
      h(
        'div',
        { class: 'member-text' },
        h('div', { class: 'member-name' }, p.name, self ? h('span', { class: 'you' }, '（じぶん）') : null),
        h('div', { class: 'member-status' }, `${st.emoji} ${st.label}${p.statusNote ? `・${p.statusNote}` : ''}`),
      ),
      h('span', { class: 'member-icons' }, p.mic ? icon('mic', 14) : icon('micOff', 14), p.cam ? icon('cam', 14) : null, p.hand ? '✋' : null),
      self
        ? null
        : h(
            'div',
            { class: 'member-actions' },
            h('button', { class: 'chip', onclick: () => this.actions.goTo(p) }, icon('walk', 14), '近くへ'),
            h('button', { class: 'chip', onclick: () => this.actions.follow(p) }, '👣 ついていく'),
            h('button', { class: 'chip', onclick: () => this.actions.intercom(p) }, icon('bell', 14), '呼ぶ'),
          ),
    );
  }
}
