import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Herdr } from './herdr.mjs';
import { Roamgate } from './roamgate.mjs';
import { Controller } from './controller.mjs';
import { Desktop } from './desktop.mjs';
import { Assembler } from './protocol.mjs';
import { atomicWrite, publish } from './files.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();
export const defaultAddonDir = path.join(home, 'Games/battlenet/drive_c/Program Files (x86)/World of Warcraft/_forever_/Interface/AddOns');
async function config() {
  let c = {};
  try { c = JSON.parse(await fs.readFile(path.join(root, '.local-data/config.json'), 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return { addonDir: defaultAddonDir, slots: 2048, mode: 'interactive', ...c };
}
async function doctor() {
  const c = await config(), herdr = new Herdr(), roamgate = new Roamgate(), desktop = new Desktop();
  const result = { addonDir: c.addonDir, mode: c.mode, slots: c.slots };
  try { const agents = await herdr.agents(); result.herdr = { connected: true, agents: agents.length }; }
  catch (e) { result.herdr = { connected: false, error: e.message }; }
  try { await roamgate.connect(); result.roamgate = { connected: true, connection: roamgate.connection }; }
  catch (e) { result.roamgate = { connected: false, error: e.message }; }
  finally { roamgate.close(); }
  try { await desktop.discover(); const w = await desktop.window(); result.desktop = { connected: true, wowFocused: !!w }; if (w) { result.desktop.protocolVisible = !!(await desktop.capture()); result.desktop.signal = desktop.lastFormat || 'not detected'; } }
  catch (e) { result.desktop = { connected: false, error: e.message }; }
  try { const owner = JSON.parse(await fs.readFile(path.join(c.addonDir, 'Roamgate/.roamgate-wow-owner.json'), 'utf8')); result.installed = owner.version; }
  catch { result.installed = false; }
  console.log(JSON.stringify(result, null, 2));
  if (!result.herdr.connected || !result.roamgate.connected || !result.desktop.connected) process.exitCode = 1;
}
async function run() {
  const c = await config();
  if (!['interactive', 'read-only'].includes(c.mode) || !Number.isInteger(c.slots) || c.slots < 16 || c.slots > 4096) throw Error('Invalid companion configuration');
  const owner = JSON.parse(await fs.readFile(path.join(c.addonDir, 'Roamgate/.roamgate-wow-owner.json'), 'utf8'));
  if (owner.source !== root || owner.slots !== c.slots) throw Error('Addon ownership or slot count differs from this installation');
  const stateDir = path.join(root, '.local-data'); await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const lockPath = path.join(stateDir, 'bridge.pid');
  try {
    const pid = Number(await fs.readFile(lockPath, 'utf8'));
    if (pid > 0) { try { process.kill(pid, 0); throw Error('Another companion is already running'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }
    await fs.unlink(lockPath);
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const lock = await fs.open(lockPath, 'wx', 0o600); await lock.writeFile(String(process.pid)); await lock.close();
  const herdr = new Herdr(), roamgate = new Roamgate(), desktop = new Desktop(), assembler = new Assembler();
  const controller = new Controller({ herdr, roamgate, journal: path.join(stateDir, 'actions.json'), mode: c.mode, slots: c.slots });
  let stopped = false, request = null, lastPublish = 0, lastId = '', errorAt = 0;
  const stop = () => { stopped = true; }; process.on('SIGINT', stop); process.on('SIGTERM', stop); process.on('SIGHUP', stop);
  try {
    await controller.init();
    console.log(`Roamgate WoW companion started (${c.mode}). Waiting for the in-game portal.`);
    while (!stopped) {
      const start = Date.now();
      try {
        const frame = await desktop.capture();
        if (frame) {
          const received = assembler.accept(frame);
          if (received) request = received;
        } else request = null;
        if (request && request.slot <= c.slots) {
          const id = `${request.nonce}:${request.id}:${request.slot}:${request.pane}:${request.visible}:${request.op === 'view' ? request.text + ':' + request.extra : ''}`;
          if (id !== lastId || start - lastPublish > 2000) {
            const snapshot = await controller.handle(request);
            await publish(c.addonDir, request, snapshot, c.slots);
            await atomicWrite(path.join(stateDir, 'status.json'), JSON.stringify({ at: new Date().toISOString(), mode: c.mode, nonce: request.nonce, nextSlot: request.slot, selectedPane: request.pane, agentCount: snapshot.agents.length, ackId: snapshot.ack.id, ackState: snapshot.ack.state }));
            lastPublish = Date.now(); lastId = id;
          }
        }
      } catch (e) {
        if (Date.now() - errorAt > 30000) { console.error(`Companion: ${e.message}`); errorAt = Date.now(); }
      }
      await new Promise(resolve => setTimeout(resolve, Math.max(30, 180 - (Date.now() - start))));
    }
  } finally {
    roamgate.close(); await fs.unlink(lockPath).catch(() => {});
    console.log('Roamgate WoW companion stopped.');
  }
}
const command = process.argv[2];
if (command === 'doctor') await doctor();
else if (command === 'run') await run();
else { console.log('Usage: node bridge/main.mjs doctor | run'); process.exitCode = 2; }
