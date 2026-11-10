// Optical transport: 4 physical pixel cells, two calibrated nibble channels.
// No keyboard injection, networking in Lua, or WoW process access.
export const COLS = 128, ROWS = 5, CELL = 4, HEADER = 24, CHUNK = 600;
export const WIDTH = COLS * CELL, HEIGHT = ROWS * CELL;
export const MAX_BODY = 12000, MAX_PARTS = Math.ceil(MAX_BODY / CHUNK);
export function checksum(bytes) {
  let a = 1, b = 0;
  for (const n of bytes) { a = (a + n) % 65521; b = (b + a) % 65521; }
  return ((b * 65536) + a) >>> 0;
}
export function fields(values) {
  return Buffer.concat(values.map(v => { const s = Buffer.from(String(v)); return Buffer.concat([Buffer.from(`${s.length}:`), s]); }));
}
export function parseFields(body) {
  if (body.length > MAX_BODY) throw Error('Command too large');
  const result = [];
  for (let p = 0; p < body.length;) {
    const end = body.indexOf(58, p);
    if (end < p || end - p > 5 || !/^\d+$/.test(body.subarray(p, end).toString())) throw Error('Invalid field');
    const len = Number(body.subarray(p, end).toString());
    p = end + 1;
    if (p + len > body.length || result.length > 12) throw Error('Invalid field length');
    const bytes = body.subarray(p, p + len), value = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    result.push(value); p += len;
  }
  if (result.length !== 10) throw Error('Invalid command fields');
  const [nonce, slot, id, op, pane, terminal, proof, text, extra, visible] = result;
  if (!/^[a-f0-9]{16}$/.test(nonce) || !/^\d{1,6}$/.test(slot) || !/^\d{1,9}$/.test(id)) throw Error('Invalid command identity');
  if (!['view', 'message', 'key', 'answer', 'stop', 'new'].includes(op)) throw Error('Unknown command');
  return { nonce, slot: Number(slot), id: Number(id), op, pane, terminal, proof, text, extra, visible: visible === '1' };
}
export function encodeFrame(body, part, serial = 1) {
  const count = Math.ceil(body.length / CHUNK), data = body.subarray(part * CHUNK, (part + 1) * CHUNK);
  const frame = Buffer.alloc(COLS * ROWS);
  frame.write('RGW1'); frame.writeUInt32BE(serial, 4); frame[8] = part; frame[9] = count;
  frame.writeUInt16BE(data.length, 10); frame.writeUInt32BE(checksum(body), 12);
  frame.writeUInt32BE(checksum(data), 16); frame.writeUInt32BE(body.length, 20); data.copy(frame, HEADER);
  return frame;
}
export class Assembler {
  accept(frame, now = Date.now()) {
    if (frame.length < HEADER || frame.subarray(0, 4).toString() !== 'RGW1') return null;
    const part = frame[8], count = frame[9], len = frame.readUInt16BE(10), sum = frame.readUInt32BE(12), size = frame.readUInt32BE(20);
    if (!count || count > MAX_PARTS || part >= count || len > CHUNK || size > MAX_BODY || !size || count !== Math.ceil(size / CHUNK)) return null;
    if (len !== Math.min(CHUNK, size - part * CHUNK)) return null;
    const data = frame.subarray(HEADER, HEADER + len);
    if (data.length !== len || checksum(data) !== frame.readUInt32BE(16)) return null;
    const key = `${frame.readUInt32BE(4)}:${sum}:${size}`;
    if (this.key !== key || now - this.at > 20000) { this.key = key; this.parts = new Map(); this.at = now; }
    this.parts.set(part, data);
    if (this.parts.size !== count) return null;
    const body = Buffer.concat(Array.from({ length: count }, (_, i) => this.parts.get(i)));
    if (checksum(body) !== sum) return null;
    try { return parseFields(body); } catch { return null; }
  }
}
export function decodePixels(rgb, width, height, cell = CELL, dx = 0, dy = 0) {
  if (width < Math.ceil(COLS * cell + dx) || height < Math.ceil(ROWS * cell + dy) || rgb.length !== width * height * 3) return null;
  const bytes = Buffer.alloc(COLS * ROWS);
  for (let i = 0; i < bytes.length; i++) {
    const x = Math.floor(dx + ((i % COLS) + 0.5) * cell), y = Math.floor(dy + (Math.floor(i / COLS) + 0.5) * cell), p = (y * width + x) * 3;
    const hi = Math.round((rgb[p] - 16) / 14), lo = Math.round((rgb[p + 1] - 16) / 14);
    if (hi < 0 || hi > 15 || lo < 0 || lo > 15 || Math.abs(rgb[p + 2] - 180) > 18 || Math.abs(rgb[p] - (16 + 14 * hi)) > 6 || Math.abs(rgb[p + 1] - (16 + 14 * lo)) > 6) return null;
    bytes[i] = hi * 16 + lo;
  }
  return bytes;
}
export function decodeMonoPixels(rgb, width, height, cell = 2, dx = 0, dy = 0) {
  const bytes = Buffer.alloc(COLS * ROWS);
  let needed = HEADER;
  for (let i = 0; i < needed; i++) {
    let value = 0;
    for (let half = 0; half < 2; half++) {
      const x = Math.floor(dx + ((i % COLS) * 2 + half + 0.5) * cell);
      const y = Math.floor(dy + (Math.floor(i / COLS) + 0.5) * cell);
      if (x >= width || y >= height) return null;
      const p = (y * width + x) * 3, level = Math.round((rgb[p] - 16) / 14);
      if (level < 0 || level > 15 || Math.abs(rgb[p] - (16 + level * 14)) > 5 || Math.abs(rgb[p] - rgb[p+1]) > 3 || Math.abs(rgb[p] - rgb[p+2]) > 3) return null;
      value = value * 16 + level;
    }
    bytes[i] = value;
    if (i === 3 && bytes.subarray(0,4).toString() !== 'RGW1') return null;
    if (i === 11) { const len = bytes.readUInt16BE(10); if (len > CHUNK) return null; needed = HEADER + len; }
  }
  return bytes;
}
export function parsePPM(buffer) {
  let p = 0;
  function token() {
    while (p < buffer.length) {
      if (buffer[p] === 35) { while (p < buffer.length && buffer[p] !== 10) p++; }
      else if (buffer[p] <= 32) p++; else break;
    }
    const start = p; while (p < buffer.length && buffer[p] > 32) p++;
    return buffer.subarray(start, p).toString();
  }
  const magic = token(), width = Number(token()), height = Number(token()), depth = token();
  if (magic !== 'P6' || depth !== '255' || width <= 0 || height <= 0 || width * height > 2000000 || buffer[p] > 32) throw Error('Invalid screen capture');
  p++; // exactly one separator: the first pixel may itself be whitespace.
  const rgb = buffer.subarray(p);
  if (rgb.length !== width * height * 3) throw Error('Truncated screen capture');
  return { rgb, width, height };
}
