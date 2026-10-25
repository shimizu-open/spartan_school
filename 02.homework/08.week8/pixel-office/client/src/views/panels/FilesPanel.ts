// View: every file shared in this space (from chat or placed on the map).

import type { FileMeta } from '../../../../shared/types.ts';
import type { SpaceModel } from '../../models/SpaceModel.ts';
import { clear, h, icon } from '../dom.ts';
import { fileEmoji } from '../MapView.ts';
import { formatBytes } from './ChatPanel.ts';

export interface FileActions {
  open: (f: FileMeta) => void;
  download: (f: FileMeta) => void;
  remove: (f: FileMeta) => void;
  goTo: (f: FileMeta) => void;
  upload: (files: File[], where: 'space' | 'map') => void;
}

export class FilesPanel {
  readonly el = h('div', { class: 'files' });
  private readonly model: SpaceModel;
  private readonly actions: FileActions;
  private readonly list = h('div', { class: 'file-list' });

  constructor(model: SpaceModel, actions: FileActions) {
    this.model = model;
    this.actions = actions;
    const pick = (where: 'space' | 'map') => {
      const input = h('input', { type: 'file', multiple: true });
      input.addEventListener('change', () => {
        if (input.files?.length) actions.upload([...input.files], where);
      });
      input.click();
    };
    this.el.append(
      h(
        'div',
        { class: 'file-upload' },
        h('button', { class: 'btn btn-primary', onclick: () => pick('space') }, icon('attach', 18), 'チャットに送る'),
        h('button', { class: 'btn', onclick: () => pick('map') }, '📦 足もとに置く'),
      ),
      h('p', { class: 'note' }, '画面にドラッグ＆ドロップしてもOK。1ファイル20MBまで。ファイルはスペースに保存され、次に来たときも残っています。'),
      this.list,
    );
    this.refresh();
  }

  refresh(): void {
    clear(this.list);
    const files = [...this.model.files].sort((a, b) => b.at - a.at);
    if (files.length === 0) this.list.append(h('p', { class: 'empty' }, 'まだファイルはありません'));
    for (const f of files) {
      const mine = f.by === this.model.selfUid;
      const thumb = f.image ? h('img', { src: this.model.fileUrl(f), alt: '', loading: 'lazy' }) : h('span', { class: 'file-emoji' }, fileEmoji(f));
      this.list.append(
        h(
          'div',
          { class: 'file-row' },
          h('button', { class: 'file-thumb', title: '開く', onclick: () => this.actions.open(f) }, thumb),
          h(
            'div',
            { class: 'file-info' },
            h('div', { class: 'file-name' }, f.name),
            h('div', { class: 'file-meta' }, `${formatBytes(f.size)}・${f.byName}・${new Date(f.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}${f.x !== undefined ? '・📍マップ' : ''}`),
          ),
          h(
            'div',
            { class: 'file-actions' },
            f.x !== undefined ? h('button', { class: 'icon-btn', title: '置いてある場所へ', 'aria-label': '置いてある場所へ', onclick: () => this.actions.goTo(f) }, icon('walk', 18)) : null,
            h('button', { class: 'icon-btn', title: 'ダウンロード', 'aria-label': 'ダウンロード', onclick: () => this.actions.download(f) }, icon('download', 18)),
            mine ? h('button', { class: 'icon-btn danger', title: '削除', 'aria-label': '削除', onclick: () => this.actions.remove(f) }, icon('trash', 18)) : null,
          ),
        ),
      );
    }
  }
}
