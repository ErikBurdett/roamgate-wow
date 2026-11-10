import fs from 'node:fs/promises';
import path from 'node:path';
export async function atomicWrite(file, text, mode = 0o600) {
  const temp = `${file}.${process.pid}.tmp`;
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  try { await fs.writeFile(temp, text, { mode }); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
export function lua(value) {
  if (value === null || value === undefined) return 'nil';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') { if (!Number.isFinite(value)) throw Error('Invalid Lua number'); return String(value); }
  if (typeof value === 'string') return '"' + [...Buffer.from(value)].map(c => c >= 32 && c <= 126 && c !== 34 && c !== 92 ? String.fromCharCode(c) : `\\${String(c).padStart(3, '0')}`).join('') + '"';
  if (Array.isArray(value)) return '{' + value.map(lua).join(',') + '}';
  return '{' + Object.entries(value).map(([k, v]) => `[${lua(k)}]=${lua(v)}`).join(',') + '}';
}
export async function publish(addons, request, snapshot, slots) {
  // Two slots ahead tolerate an occasional missed desktop frame. Nonce checks
  // keep a previous UI session's cached files from authorizing anything.
  const text = `RoamgateInbox=${lua({ ...snapshot, nonce: request.nonce })}\n`;
  for (let n = request.slot; n <= Math.min(request.slot + 1, slots); n++) {
    const dir = path.join(addons, `RoamgateData${String(n).padStart(4, '0')}`);
    await atomicWrite(path.join(dir, 'Data.lua'), text);
  }
}
