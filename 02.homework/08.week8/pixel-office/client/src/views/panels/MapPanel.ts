// View: places on the map, how many people are in each, and things to use.

import { TILE } from '../../../../shared/constants.ts';
import { AREAS, OBJECTS, areaAt, type Area, type MapObject } from '../../../../shared/map.ts';
import type { SpaceModel } from '../../models/SpaceModel.ts';
import { clear, h } from '../dom.ts';

export interface MapActions {
  goArea: (a: Area) => void;
  goObject: (o: MapObject) => void;
}

const KIND_LABEL: Record<string, string> = { whiteboard: '🖍️ ホワイトボード', vending: '🥤 自販機', photo: '📸 撮影スポット' };

export class MapPanel {
  readonly el = h('div', { class: 'mapinfo' });
  private readonly model: SpaceModel;
  private readonly actions: MapActions;
  private lastKey = '';

  constructor(model: SpaceModel, actions: MapActions) {
    this.model = model;
    this.actions = actions;
    this.refresh(true);
  }

  refresh(force = false): void {
    const count = new Map<string, number>();
    for (const p of this.model.players.values()) {
      const a = areaAt(p.x, p.y);
      if (a) count.set(a.id, (count.get(a.id) ?? 0) + 1);
    }
    const here = areaAt(this.model.me.x, this.model.me.y)?.id;
    const key = `${here}|${[...count].join(',')}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    clear(this.el);
    const badge = (a: Area) => (a.private ? '🔒 この部屋の人とだけ話せる' : a.quiet ? '🤫 声は出せない（チャットのみ）' : a.stage ? '🎤 広場の全員に声が届く' : '');
    const row = (a: Area) =>
      h(
        'div',
        { class: `room${a.id === here ? ' here' : ''}` },
        h('div', null, h('div', { class: 'room-name' }, a.name), h('div', { class: 'room-count' }, `${count.get(a.id) ?? 0}人${badge(a) ? `・${badge(a)}` : ''}`)),
        a.id === here ? h('span', { class: 'chip on' }, 'いまここ') : h('button', { class: 'btn btn-small', onclick: () => this.actions.goArea(a) }, a.private ? '入室' : '行く'),
      );
    this.el.append(
      h('h3', { class: 'group-title' }, '会議室'),
      ...AREAS.filter((a) => a.private).map(row),
      h('h3', { class: 'group-title' }, 'エリア'),
      ...AREAS.filter((a) => !a.private).map(row),
      h('h3', { class: 'group-title' }, 'つかえるもの（近くで E キー）'),
      ...OBJECTS.map((o) =>
        h(
          'div',
          { class: 'room' },
          h('div', null, h('div', { class: 'room-name' }, KIND_LABEL[o.kind] ?? o.name), h('div', { class: 'room-count' }, `${o.name}・${areaAt((o.tx + 0.5) * TILE, (o.ty + o.h + 0.5) * TILE)?.name ?? ''}`)),
          h('button', { class: 'btn btn-small', onclick: () => this.actions.goObject(o) }, '行く'),
        ),
      ),
    );
  }
}
