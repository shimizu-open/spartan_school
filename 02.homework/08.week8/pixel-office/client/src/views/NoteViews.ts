// Views: write a sticky note, and read one.

import { MAX_NOTE_TEXT, NOTE_COLORS } from '../../../shared/constants.ts';
import type { Note } from '../../../shared/types.ts';
import { h } from './dom.ts';
import { Modal } from './Modal.ts';

export function openNoteEditor(onSave: (text: string, color: number) => void): void {
  let color = 0;
  const text = h('textarea', { class: 'input note-text', rows: 4, maxlength: MAX_NOTE_TEXT, placeholder: '例：今日のランチはカレー🍛 / 13時からここで勉強会' });
  const preview = h('div', { class: 'note-colors', role: 'group', 'aria-label': '色' });
  NOTE_COLORS.forEach((c, i) => {
    const b = h('button', { class: 'swatch', 'aria-label': `色 ${i + 1}`, 'aria-pressed': String(i === 0), onclick: () => {
      color = i;
      preview.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
      b.setAttribute('aria-pressed', 'true');
      text.style.background = c;
    } });
    b.style.background = c;
    preview.append(b);
  });
  text.style.background = NOTE_COLORS[0]!;
  const save = () => {
    if (!text.value.trim()) return text.focus();
    onSave(text.value, color);
    modal.close();
  };
  const body = h('div', { class: 'modal-body' }, text, preview, h('p', { class: 'note' }, '自分の足もとに貼ります。みんなに見えます（あとで自分だけがはがせます）。'), h('button', { class: 'btn btn-primary', onclick: save }, '📝 貼る'));
  const modal = new Modal('付箋を貼る', body);
  text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save();
  });
  text.focus();
}

export function openNoteViewer(n: Note, mine: boolean, onRemove: () => void): void {
  const card = h('div', { class: 'note-big' }, n.text);
  card.style.background = NOTE_COLORS[n.color] ?? NOTE_COLORS[0]!;
  const when = new Date(n.at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const body = h(
    'div',
    { class: 'modal-body' },
    card,
    h('p', { class: 'note' }, `${n.byName}・${when}`),
    mine ? h('button', { class: 'btn', onclick: () => (onRemove(), modal.close()) }, '🗑️ はがす') : null,
  );
  const modal = new Modal('付箋', body);
}
