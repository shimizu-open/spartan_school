// View: a shared whiteboard. Everyone near the board draws on the same canvas.

import { WB_COLORS } from '../../../shared/constants.ts';
import type { Stroke } from '../../../shared/types.ts';
import { h } from './dom.ts';
import { Modal } from './Modal.ts';

const W = 1200;
const H = 800;
const WIDTHS = [3, 6, 12, 28];

export interface BoardActions {
  stroke: (s: Omit<Stroke, 'id' | 'by'>) => void;
  clear: () => void;
  close: () => void;
}

export class WhiteboardView {
  readonly board: string;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly modal: Modal;
  private strokes: Stroke[] = [];
  private color = 0;
  private width = 1;
  private current: number[] | null = null;

  constructor(board: string, title: string, strokes: Stroke[], a: BoardActions) {
    this.board = board;
    this.strokes = strokes;
    this.canvas = h('canvas', { width: W, height: H, class: 'wb-canvas', 'aria-label': 'ホワイトボード' });
    this.ctx = this.canvas.getContext('2d')!;
    const colors = h('div', { class: 'wb-tools', role: 'group', 'aria-label': '色' });
    WB_COLORS.forEach((c, i) => {
      const b = h('button', { class: 'swatch', 'aria-label': i === WB_COLORS.length - 1 ? '消しゴム' : `色 ${i + 1}`, title: i === WB_COLORS.length - 1 ? '消しゴム' : '', 'aria-pressed': String(i === 0), onclick: () => {
        this.color = i;
        colors.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      } });
      b.style.background = c;
      if (i === WB_COLORS.length - 1) b.textContent = '⌫';
      colors.append(b);
    });
    const widths = h('div', { class: 'wb-tools', role: 'group', 'aria-label': '太さ' });
    WIDTHS.forEach((_wd, i) => {
      const b = h('button', { class: 'chip', 'aria-pressed': String(i === 1), onclick: () => {
        this.width = i;
        widths.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true');
      } }, ['細', '中', '太', '極太'][i]!);
      widths.append(b);
    });
    this.width = 1;
    const body = h(
      'div',
      { class: 'modal-body wb' },
      h('div', { class: 'wb-bar' }, colors, widths, h('button', { class: 'btn btn-small', onclick: () => confirm('みんなのボードを全部消します。よろしいですか？') && a.clear() }, '🧽 全部消す')),
      this.canvas,
      h('p', { class: 'note' }, '近くにいる人と同じボードに描けます。描いたものはスペースが消えるまで残ります。'),
    );
    this.modal = new Modal(title, body, 'large');
    this.modal.onClose = a.close;

    const pos = (e: PointerEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))] as const;
    };
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      const [x, y] = pos(e);
      this.current = [x, y, x, y];
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.current) return;
      const [x, y] = pos(e);
      const n = this.current.length;
      if (Math.hypot(x - this.current[n - 2]!, y - this.current[n - 1]!) < 0.002) return;
      this.current.push(x, y);
      this.drawLine(this.current.slice(-4), this.color, WIDTHS[this.width]!);
      // long strokes are sent in pieces so others see them while drawing
      if (this.current.length >= 120) this.flush(a, true);
    });
    const end = () => this.flush(a, false);
    this.canvas.addEventListener('pointerup', end);
    this.canvas.addEventListener('pointercancel', end);
    this.redraw();
  }

  private flush(a: BoardActions, continuing: boolean): void {
    if (!this.current) return;
    const pts = this.current;
    a.stroke({ color: this.color, width: WIDTHS[this.width]!, points: pts });
    this.current = continuing ? pts.slice(-2) : null;
  }

  get isOpen(): boolean {
    return this.canvas.isConnected;
  }

  add(s: Stroke): void {
    this.strokes.push(s);
    this.drawLine(s.points, s.color, s.width);
  }

  clear(): void {
    this.strokes = [];
    this.redraw();
  }

  close(): void {
    this.modal.close();
  }

  private redraw(): void {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, W, H);
    for (const s of this.strokes) this.drawLine(s.points, s.color, s.width);
  }

  private drawLine(points: number[], color: number, width: number): void {
    const c = this.ctx;
    c.strokeStyle = WB_COLORS[color] ?? '#000';
    c.lineWidth = width;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(points[0]! * W, points[1]! * H);
    for (let i = 2; i < points.length; i += 2) c.lineTo(points[i]! * W, points[i + 1]! * H);
    c.stroke();
  }
}
