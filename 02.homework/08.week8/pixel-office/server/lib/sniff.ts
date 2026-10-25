// Decides how a file may be shown, from its first bytes (not from the name or
// the browser's claim). Only PNG/JPEG/GIF/WebP are shown inline as images;
// everything else is a download. SVG is never inline (it can contain scripts).

export interface Sniffed {
  type: string;
  image: boolean;
}

function starts(buf: Buffer, bytes: number[], offset = 0): boolean {
  return bytes.every((b, i) => buf[offset + i] === b);
}

export function sniff(buf: Buffer): Sniffed {
  if (starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: 'image/png', image: true };
  if (starts(buf, [0xff, 0xd8, 0xff])) return { type: 'image/jpeg', image: true };
  if (starts(buf, [0x47, 0x49, 0x46, 0x38])) return { type: 'image/gif', image: true };
  if (starts(buf, [0x52, 0x49, 0x46, 0x46]) && starts(buf, [0x57, 0x45, 0x42, 0x50], 8)) return { type: 'image/webp', image: true };
  if (starts(buf, [0x25, 0x50, 0x44, 0x46])) return { type: 'application/pdf', image: false };
  return { type: 'application/octet-stream', image: false };
}
