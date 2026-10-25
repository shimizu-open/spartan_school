// View: the game-style frame around the map.
//   top bar    : space name + invite, clock, people online, video layout
//   right dock : members / chat / files / map / settings / leave
//   hotbar     : my card + status, mic / camera / screen, emotes (keys 1-0), actions
//   bottom-left: minimap and zoom
// Buttons only call the given actions; the controller decides what happens.

import { REACTIONS, STATUSES, STATUS_KEYS } from '../../../shared/constants.ts';
import type { AvatarLook, Status } from '../../../shared/types.ts';
import type { VideoLayout } from '../models/SettingsModel.ts';
import { drawPortrait } from './avatarSprite.ts';
import { clear, h, icon } from './dom.ts';

export type PanelName = 'members' | 'chat' | 'files' | 'map' | 'settings';

export interface ShellActions {
  setStatus: (s: Status) => void;
  setStatusNote: (note: string) => void;
  toggleMic: () => void;
  toggleCam: () => void;
  toggleScreen: () => void;
  toggleHand: () => void;
  toggleMegaphone: () => void;
  toggleDance: () => void;
  toggleSit: () => void;
  action: (kind: 'jump' | 'wave' | 'spin') => void;
  addNote: () => void;
  copyInvite: () => void;
  react: (emoji: string) => void;
  zoom: (step: number) => void;
  layout: (l: VideoLayout) => void;
  panel: (p: PanelName | null) => void;
  exit: () => void;
}

export interface ShellState {
  name: string;
  status: Status;
  statusNote: string;
  mic: boolean;
  cam: boolean;
  screen: boolean;
  hand: boolean;
  megaphone: boolean;
  dancing: boolean;
  sitting: boolean;
  members: number;
  unread: number;
  files: number;
  look: AvatarLook;
  zoom: number;
  layout: VideoLayout;
}

/** Keyboard shortcuts shown on the hotbar (handled by InputController). */
export const EMOTE_KEYS = ['1', '2', '3', '4', '5', '6'];

export class ShellView {
  readonly root: HTMLElement;
  readonly stage: HTMLElement;
  readonly panelBody: HTMLElement;
  readonly minimapSlot: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly panelTitle: HTMLElement;
  private readonly dockButtons = new Map<PanelName, HTMLButtonElement>();
  private readonly memberCount: HTMLElement;
  private readonly unreadBadge: HTMLElement;
  private readonly fileBadge: HTMLElement;
  private readonly meCanvas: HTMLCanvasElement;
  private readonly meName: HTMLElement;
  private readonly statusBtn: HTMLButtonElement;
  private readonly statusMenu: HTMLElement;
  private readonly noteInput: HTMLInputElement;
  private readonly micBtn: HTMLButtonElement;
  private readonly camBtn: HTMLButtonElement;
  private readonly screenBtn: HTMLButtonElement;
  private readonly handBtn: HTMLButtonElement;
  private readonly danceBtn: HTMLButtonElement;
  private readonly sitBtn: HTMLButtonElement;
  private readonly moreMenu: HTMLElement;
  private readonly megaphoneItem: HTMLButtonElement;
  private readonly zoomLabel: HTMLElement;
  private readonly layoutBtns: Record<VideoLayout, HTMLButtonElement>;
  private readonly megaphoneBanner: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly dropZone: HTMLElement;
  current: PanelName | null = null;
  private lookKey = '';

  constructor(parent: HTMLElement, spaceId: string, a: ShellActions) {
    // ---- top bar
    this.clock = h('span', { class: 'clock' });
    this.memberCount = h('span', { class: 'online' });
    this.layoutBtns = {
      map: h('button', { class: 'seg-btn', title: 'アバターの上に表示', onclick: () => a.layout('map') }, '頭上'),
      row: h('button', { class: 'seg-btn', title: '上に一列で表示', onclick: () => a.layout('row') }, '一列'),
      grid: h('button', { class: 'seg-btn', title: '大きく並べて表示', onclick: () => a.layout('grid') }, 'ならべる'),
    };
    const topbar = h(
      'header',
      { class: 'topbar' },
      h(
        'div',
        { class: 'chip-box brand-box' },
        h('span', { class: 'brand-dot', 'aria-hidden': 'true' }),
        h('span', { class: 'brand-name' }, 'Pixel Office'),
        h('span', { class: 'space-id', title: 'スペースID' }, spaceId),
        h('button', { class: 'mini-btn', title: '招待リンクをコピー', onclick: a.copyInvite }, icon('link', 16), h('span', null, '招待')),
      ),
      h('div', { class: 'chip-box center-box' }, this.clock, this.memberCount),
      h('div', { class: 'chip-box seg', role: 'group', 'aria-label': 'ビデオの表示' }, h('span', { class: 'seg-title' }, 'ビデオ'), this.layoutBtns.map, this.layoutBtns.row, this.layoutBtns.grid),
    );

    // ---- right dock
    const dock = (name: PanelName, ic: string, label: string, key: string, badge?: HTMLElement) => {
      const b = h(
        'button',
        { class: 'dock-btn', 'aria-label': label, title: `${label}（${key}）`, onclick: () => a.panel(this.current === name ? null : name) },
        icon(ic, 22),
        h('span', { class: 'dock-label' }, label),
        badge,
      );
      this.dockButtons.set(name, b);
      return b;
    };
    this.unreadBadge = h('span', { class: 'badge', hidden: true });
    this.fileBadge = h('span', { class: 'badge badge-soft', hidden: true });
    const dockEl = h(
      'nav',
      { class: 'dock', 'aria-label': 'メニュー' },
      dock('members', 'people', 'メンバー', 'P'),
      dock('chat', 'chat', 'チャット', 'Enter', this.unreadBadge),
      dock('files', 'folder', 'ファイル', 'F', this.fileBadge),
      dock('map', 'map', 'マップ', 'G'),
      dock('settings', 'settings', '設定', ','),
      h('div', { class: 'dock-spacer' }),
      h('button', { class: 'dock-btn exit', title: '退出', onclick: a.exit }, icon('exit', 22), h('span', { class: 'dock-label' }, '退出')),
    );

    // ---- side panel
    this.panelTitle = h('h2');
    this.panelBody = h('div', { class: 'panel-body' });
    this.panel = h(
      'aside',
      { class: 'panel', hidden: true },
      h('header', { class: 'panel-head' }, this.panelTitle, h('button', { class: 'icon-btn', 'aria-label': '閉じる', onclick: () => a.panel(null) }, icon('close', 20))),
      this.panelBody,
    );

    // ---- hotbar: my card
    this.meCanvas = h('canvas', { width: 64, height: 64, class: 'me-face' });
    this.meName = h('span', { class: 'me-name' });
    this.statusBtn = h('button', { class: 'status-btn', onclick: () => this.toggleStatusMenu() });
    this.noteInput = h('input', { class: 'input', maxlength: 40, placeholder: 'ひとこと（例：13時に戻ります）', 'aria-label': 'ステータスのひとこと' });
    this.noteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        a.setStatusNote(this.noteInput.value);
        this.statusMenu.hidden = true;
      }
    });
    this.statusMenu = h(
      'div',
      { class: 'pop status-menu', hidden: true, role: 'menu' },
      ...STATUS_KEYS.map((k) =>
        h('button', { class: 'pop-item', 'data-status': k, onclick: () => (a.setStatus(k), (this.statusMenu.hidden = true)) }, h('span', { class: 'pop-emoji' }, STATUSES[k].emoji), STATUSES[k].label, h('small', null, STATUSES[k].talk ? '近くの人と話せる' : '自動では話しかけられない')),
      ),
      h('div', { class: 'pop-row' }, this.noteInput, h('button', { class: 'btn btn-small', onclick: () => (a.setStatusNote(this.noteInput.value), (this.statusMenu.hidden = true)) }, '設定')),
    );
    const meCard = h(
      'div',
      { class: 'me-card' },
      h('button', { class: 'me-face-btn', title: 'アバターを変える', onclick: () => a.panel('settings') }, this.meCanvas),
      h('div', { class: 'me-text' }, this.meName, this.statusBtn),
      this.statusMenu,
    );

    // ---- hotbar: media
    const media = (ic: string, label: string, fn: () => void) =>
      h('button', { class: 'hot-btn media-btn', 'aria-label': label, title: label, onclick: fn }, h('span', { class: 'hot-ic' }, icon(ic, 22)));
    this.micBtn = media('micOff', 'マイク', a.toggleMic);
    this.camBtn = media('camOff', 'カメラ', a.toggleCam);
    this.screenBtn = media('screen', '画面共有', a.toggleScreen);
    this.screenBtn.classList.add('screen-btn');

    // ---- hotbar: emotes 1-6 and actions
    const emotes = REACTIONS.slice(0, 6).map((e, i) =>
      h('button', { class: 'hot-btn emote', 'aria-label': `リアクション ${e}`, title: `${e}（${EMOTE_KEYS[i]}）`, onclick: () => a.react(e) }, e, h('kbd', null, EMOTE_KEYS[i]!)),
    );
    this.danceBtn = h('button', { class: 'hot-btn act', title: 'おどる（0）', onclick: a.toggleDance }, '💃', h('kbd', null, '0'));
    this.sitBtn = h('button', { class: 'hot-btn act', title: '座る（X）。イスやソファの近くで', onclick: a.toggleSit }, '🪑', h('kbd', null, 'X'));
    const jumpBtn = h('button', { class: 'hot-btn act', title: 'ジャンプ（Space）', onclick: () => a.action('jump') }, '🦘', h('kbd', null, '␣'));
    const noteBtn = h('button', { class: 'hot-btn act', title: '付箋を貼る（N）', onclick: a.addNote }, '📝', h('kbd', null, 'N'));
    this.handBtn = h('button', { class: 'menu-item', onclick: () => (a.toggleHand(), this.closeMore()) }, '✋ 手を挙げる（H）');
    this.megaphoneItem = h('button', { class: 'menu-item', onclick: () => (a.toggleMegaphone(), this.closeMore()) }, '📣 メガホンを始める');
    this.moreMenu = h(
      'div',
      { class: 'pop more-menu', hidden: true, role: 'menu' },
      this.handBtn,
      h('button', { class: 'menu-item', onclick: () => (a.action('wave'), this.closeMore()) }, '👋 手をふる（7）'),
      h('button', { class: 'menu-item', onclick: () => (a.action('spin'), this.closeMore()) }, '🌀 くるっと回る（8）'),
      this.megaphoneItem,
      h('div', { class: 'menu-note' }, '歩く：矢印 / WASD・クリック　瞬間移動：ダブルクリック　使う：E'),
      h('div', { class: 'menu-note' }, 'チャットで /dice /omikuji /janken グー /coin'),
    );
    const moreBtn = h('button', { class: 'hot-btn act', title: 'そのほか', onclick: () => (this.moreMenu.hidden = !this.moreMenu.hidden) }, icon('more', 22));

    const hotbar = h(
      'div',
      { class: 'hotbar' },
      meCard,
      h('div', { class: 'hot-group' }, this.micBtn, this.camBtn, this.screenBtn),
      h('div', { class: 'hot-group emotes' }, ...emotes),
      h('div', { class: 'hot-group acts' }, jumpBtn, this.danceBtn, this.sitBtn, noteBtn, h('div', { class: 'more-wrap' }, moreBtn, this.moreMenu)),
    );

    // ---- minimap + zoom
    this.zoomLabel = h('span', { class: 'zoom-label' });
    this.minimapSlot = h('div', { class: 'minimap-slot' });
    const corner = h(
      'div',
      { class: 'corner' },
      this.minimapSlot,
      h(
        'div',
        { class: 'zoom' },
        h('button', { class: 'icon-btn', 'aria-label': '拡大', onclick: () => a.zoom(1) }, icon('plus', 18)),
        this.zoomLabel,
        h('button', { class: 'icon-btn', 'aria-label': '縮小', onclick: () => a.zoom(-1) }, icon('minus', 18)),
      ),
    );

    this.hint = h('div', { class: 'hint', hidden: true });
    this.megaphoneBanner = h('div', { class: 'megaphone-banner', hidden: true });
    this.dropZone = h('div', { class: 'drop-zone', hidden: true }, h('div', { class: 'drop-card' }, '📦 ここにドロップ', h('small', null, 'マップの上なら自分の足もとに置く・チャットを開いていればチャットに送る')));

    this.stage = h('main', { class: 'stage' }, topbar, corner, hotbar, this.hint, this.megaphoneBanner, this.dropZone);
    this.root = h('div', { class: 'space' }, this.stage, this.panel, dockEl);
    parent.append(this.root);
    document.addEventListener('click', (e) => {
      const t = e.target as Element;
      if (!this.moreMenu.hidden && !t.closest('.more-wrap')) this.closeMore();
      if (!this.statusMenu.hidden && !t.closest('.me-card')) this.statusMenu.hidden = true;
    });
    this.tickClock();
    setInterval(() => this.tickClock(), 15000);
  }

  private tickClock(): void {
    this.clock.textContent = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  }

  private closeMore(): void {
    this.moreMenu.hidden = true;
  }

  private toggleStatusMenu(): void {
    this.statusMenu.hidden = !this.statusMenu.hidden;
    if (!this.statusMenu.hidden) this.noteInput.focus();
  }

  openPanel(name: PanelName | null, title: string, content: HTMLElement | null): void {
    this.current = name;
    this.panel.hidden = name === null;
    this.root.classList.toggle('with-panel', name !== null);
    for (const [n, b] of this.dockButtons) b.classList.toggle('active', n === name);
    this.panelTitle.textContent = title;
    clear(this.panelBody);
    if (content) this.panelBody.append(content);
  }

  setPanelTitle(title: string): void {
    this.panelTitle.textContent = title;
  }

  /** The "press E to use" hint (null hides it). Only redraws when it changes. */
  setHint(key: string | null, text: string | null): void {
    const k = key && text ? `${key}|${text}` : '';
    if (this.hint.dataset.k === k) return;
    this.hint.dataset.k = k;
    this.hint.hidden = !k;
    clear(this.hint);
    if (key && text) this.hint.append(h('kbd', null, key), text);
  }

  showDropZone(on: boolean): void {
    this.dropZone.hidden = !on;
  }

  setMegaphoneBanner(name: string | null): void {
    this.megaphoneBanner.hidden = !name;
    this.megaphoneBanner.textContent = name ? `📣 ${name} さんの声がフロア全体に届いています` : '';
  }

  update(s: ShellState): void {
    const st = STATUSES[s.status];
    this.meName.textContent = s.name;
    this.statusBtn.textContent = `${st.emoji} ${st.label}${s.statusNote ? `・${s.statusNote}` : ''} ▾`;
    this.statusBtn.dataset.status = s.status;
    const setMedia = (b: HTMLButtonElement, on: boolean, icOn: string, icOff: string, label: string) => {
      const ic = b.querySelector('.hot-ic')!;
      const want = on ? icOn : icOff;
      if (ic.getAttribute('data-ic') !== want) {
        clear(ic);
        ic.append(icon(want, 22));
        ic.setAttribute('data-ic', want);
      }
      b.classList.toggle('on', on);
      b.classList.toggle('off', !on);
      b.setAttribute('aria-pressed', String(on));
      b.title = `${label}を${on ? 'オフ' : 'オン'}にする`;
    };
    setMedia(this.micBtn, s.mic, 'mic', 'micOff', 'マイク');
    setMedia(this.camBtn, s.cam, 'cam', 'camOff', 'カメラ');
    setMedia(this.screenBtn, s.screen, 'screen', 'screen', '画面共有');
    this.danceBtn.classList.toggle('on', s.dancing);
    this.sitBtn.classList.toggle('on', s.sitting);
    this.handBtn.textContent = s.hand ? '✋ 手を下ろす（H）' : '✋ 手を挙げる（H）';
    this.megaphoneItem.textContent = s.megaphone ? '📣 メガホンを終える' : '📣 メガホンを始める';
    this.memberCount.textContent = `👥 ${s.members}人`;
    this.unreadBadge.hidden = s.unread === 0;
    this.unreadBadge.textContent = s.unread > 99 ? '99+' : String(s.unread);
    this.fileBadge.hidden = s.files === 0;
    this.fileBadge.textContent = String(s.files);
    this.zoomLabel.textContent = `${Math.round(s.zoom * 100)}%`;
    for (const k of Object.keys(this.layoutBtns) as VideoLayout[]) this.layoutBtns[k].classList.toggle('on', s.layout === k);
    const lk = JSON.stringify(s.look);
    if (lk !== this.lookKey) {
      drawPortrait(this.meCanvas, s.look, '#fff6e5');
      this.lookKey = lk;
    }
  }
}
