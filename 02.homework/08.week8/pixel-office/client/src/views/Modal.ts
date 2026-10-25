// View: a centered dialog. Closes with Esc, the × button, or a click outside.

import { h, icon } from './dom.ts';

export class Modal {
  readonly card: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly onKey: (e: KeyboardEvent) => void;
  onClose: () => void = () => undefined;

  constructor(title: string, body: HTMLElement, size: 'small' | 'large' = 'small') {
    this.card = h(
      'div',
      { class: `modal-card modal-${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', { class: 'modal-head' }, h('h2', null, title), h('button', { class: 'icon-btn', 'aria-label': '閉じる', onclick: () => this.close() }, icon('close', 20))),
      body,
    );
    this.overlay = h('div', { class: 'modal' }, this.card);
    this.overlay.addEventListener('pointerdown', (e) => {
      if (e.target === this.overlay) this.close();
    });
    this.onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        this.close();
      }
    };
    document.addEventListener('keydown', this.onKey, true);
    document.body.append(this.overlay);
  }

  close(): void {
    if (!this.overlay.isConnected) return;
    document.removeEventListener('keydown', this.onKey, true);
    this.overlay.remove();
    this.onClose();
  }
}
