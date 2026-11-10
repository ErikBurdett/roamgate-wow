import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const defaultAddonDir = path.join(os.homedir(), 'Games/battlenet/drive_c/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns');
export function localOrigin(value = 'http://127.0.0.1:8787') {
  const url = new URL(value);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw Error('Use a local HTTP Roamgate origin, for example http://127.0.0.1:8787');
  }
  return url.origin;
}
export async function readConfig(root) {
  let saved = {};
  try { saved = JSON.parse(await fs.readFile(path.join(root, '.local-data/config.json'), 'utf8')); }
  catch (e) { if (e.code !== 'ENOENT') throw e; }
  return validateConfig({addonDir:defaultAddonDir, slots:2048, mode:'interactive', origin:'http://127.0.0.1:8787', ...saved});
}
export function validateConfig(config) {
  if (!path.isAbsolute(config.addonDir) || /[\r\n\0]/.test(config.addonDir)) throw Error('The addon directory must be an absolute path');
  if (!['interactive','read-only'].includes(config.mode)) throw Error('Choose interactive or read-only mode');
  if (!Number.isInteger(config.slots) || config.slots < 16 || config.slots > 4096) throw Error('Use 16–4096 data slots');
  return {...config, origin:localOrigin(config.origin)};
}
