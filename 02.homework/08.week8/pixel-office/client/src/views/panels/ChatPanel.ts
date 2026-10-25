// View: text chat with file attachments.
// "# みんな" reaches everyone; "近くの人" only people you can talk to right now.

import { MAX_CHAT } from '../../../../shared/constants.ts';
import type { ChatChannel, ChatMessage, FileMeta } from '../../../../shared/types.ts';
import type { SpaceModel } from '../../models/SpaceModel.ts';
import { clear, h, icon } from '../dom.ts';
import { fileEmoji } from '../MapView.ts';

export interface ChatActions {
  send: (channel: ChatChannel, text: string) => void;
  upload: (files: File[], channel: ChatChannel) => void;
  openFile: (f: FileMeta) => void;
}

export class ChatPanel {
  readonly el = h('div', { class: 'chat' });
  channel: ChatChannel = 'space';
  private readonly model: SpaceModel;
  private readonly actions: ChatActions;
  private readonly list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite' });
  private readonly input = h('textarea', { class: 'input chat-input', rows: 2, maxlength: MAX_CHAT, placeholder: 'メッセージ（Enterで送信・Shift+Enterで改行）\n/dice /omikuji /janken グー も使えます' });
  private readonly tabs: Record<ChatChannel, HTMLButtonElement>;

  constructor(model: SpaceModel, actions: ChatActions) {
    this.model = model;
    this.actions = actions;
    this.tabs = {
      space: h('button', { class: 'tab', onclick: () => this.setChannel('space') }, '# みんな'),
      nearby: h('button', { class: 'tab', onclick: () => this.setChannel('nearby') }, '👂 近くの人'),
    };
    const fileInput = h('input', { type: 'file', multiple: true, hidden: true });
    fileInput.addEventListener('change', () => {
      if (fileInput.files?.length) actions.upload([...fileInput.files], this.channel);
      fileInput.value = '';
    });
    const submit = () => {
      const text = this.input.value.trim();
      if (!text) return;
      actions.send(this.channel, text);
      this.input.value = '';
    };
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        submit();
      }
      if (e.key === 'Escape') this.input.blur();
    });
    this.input.addEventListener('paste', (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        actions.upload(files, this.channel);
      }
    });
    this.el.append(
      h('div', { class: 'tabs' }, this.tabs.space, this.tabs.nearby),
      this.list,
      h(
        'div',
        { class: 'chat-form' },
        h('button', { class: 'icon-btn', 'aria-label': 'ファイルを添付', title: 'ファイルを添付（ドラッグ＆ドロップ・貼り付けでもOK）', onclick: () => fileInput.click() }, icon('attach', 20)),
        this.input,
        h('button', { class: 'icon-btn send', 'aria-label': '送信', onclick: submit }, icon('send', 20)),
        fileInput,
      ),
    );
    this.setChannel('space');
  }

  setChannel(c: ChatChannel): void {
    this.channel = c;
    this.tabs.space.classList.toggle('on', c === 'space');
    this.tabs.nearby.classList.toggle('on', c === 'nearby');
    this.refresh();
  }

  focus(): void {
    this.input.focus();
  }

  refresh(): void {
    clear(this.list);
    const msgs = this.model.chat.filter((m) => m.channel === this.channel);
    if (msgs.length === 0) {
      this.list.append(h('p', { class: 'empty' }, this.channel === 'space' ? 'まだメッセージはありません。最初のひとことをどうぞ 👋' : '近くにいる人（会議室なら同じ部屋の人）だけに届きます'));
    }
    for (const m of msgs) this.list.append(this.item(m));
    this.list.scrollTop = this.list.scrollHeight;
  }

  /** Adds one message without redrawing the whole list. */
  add(m: ChatMessage): void {
    if (m.channel !== this.channel) return;
    this.list.querySelector('.empty')?.remove();
    const nearBottom = this.list.scrollHeight - this.list.scrollTop - this.list.clientHeight < 80;
    this.list.append(this.item(m));
    if (nearBottom || m.uid === this.model.selfUid) this.list.scrollTop = this.list.scrollHeight;
  }

  /** Marks messages whose file was deleted. */
  refreshFiles(): void {
    for (const el of this.list.querySelectorAll<HTMLElement>('[data-file]')) {
      const gone = !this.model.files.some((f) => f.id === el.dataset.file);
      el.classList.toggle('gone', gone);
    }
  }

  private item(m: ChatMessage): HTMLElement {
    const time = new Date(m.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
    const mine = m.uid === this.model.selfUid;
    let body: HTMLElement;
    if (m.kind === 'file' && m.file) body = this.fileCard(m.file);
    else body = h('div', { class: `msg-text${m.kind === 'roll' ? ' roll' : ''}` }, m.text);
    return h('div', { class: `msg${mine ? ' mine' : ''}` }, h('div', { class: 'msg-head' }, h('b', null, m.name), h('time', null, time)), body);
  }

  private fileCard(f: FileMeta): HTMLElement {
    const gone = !this.model.files.some((x) => x.id === f.id);
    const card = h('button', { class: `file-card${gone ? ' gone' : ''}`, 'data-file': f.id, title: f.name, onclick: () => this.actions.openFile(f) });
    if (f.image) {
      const img = h('img', { alt: f.name, loading: 'lazy', src: this.model.fileUrl(f) });
      img.addEventListener('error', () => img.remove());
      card.append(img);
    } else {
      card.append(h('span', { class: 'file-emoji' }, fileEmoji(f)));
    }
    card.append(h('span', { class: 'file-name' }, f.name), h('span', { class: 'file-size' }, formatBytes(f.size)));
    return card;
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
