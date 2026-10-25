// View: shows a shared image large, or offers a download for other files.

import type { FileMeta } from '../../../shared/types.ts';
import { h, icon } from './dom.ts';
import { fileEmoji } from './MapView.ts';
import { formatBytes } from './panels/ChatPanel.ts';
import { Modal } from './Modal.ts';

export function openFile(f: FileMeta, url: string, downloadUrl: string): void {
  const view = f.image
    ? h('img', { class: 'lightbox-img', src: url, alt: f.name })
    : h('div', { class: 'file-big' }, h('span', { class: 'file-emoji big' }, fileEmoji(f)), h('p', null, 'このファイルはダウンロードして開いてください。'));
  const body = h(
    'div',
    { class: 'modal-body lightbox' },
    view,
    h(
      'div',
      { class: 'lightbox-bar' },
      h('div', null, h('div', { class: 'file-name' }, f.name), h('div', { class: 'file-meta' }, `${formatBytes(f.size)}・${f.byName}`)),
      h('a', { class: 'btn btn-primary', href: downloadUrl, download: f.name }, icon('download', 18), 'ダウンロード'),
    ),
  );
  new Modal(f.image ? '画像' : 'ファイル', body, f.image ? 'large' : 'small');
}
