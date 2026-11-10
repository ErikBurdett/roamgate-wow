import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { serviceUnit } from './unit.mjs';
import { bundleUI } from './bundle.mjs';
import { readConfig } from '../bridge/config.mjs';
import { installOptions, HELP } from './options.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const {version} = JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const args = process.argv.slice(2);
if(args.includes('--help')) { console.log(HELP);process.exit(0); }
const {config,stage,install,service}=installOptions(args,await readConfig(root));
const home = os.homedir();
const destination=config.addonDir, slots=config.slots;
const serviceFile=path.join(home,'.config/systemd/user/roamgate-wow.service');
if (!stage && !install) {
  console.log(JSON.stringify({ action: 'install plan (no changes)', destination, source: root, slots, mode:config.mode, origin:config.origin, service: serviceFile, start: service, command: 'Add --install to apply' }, null, 2));
  process.exit(0);
}
let oldUnit;
if(service) {
  try {oldUnit=await fs.readFile(serviceFile,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(oldUnit && !oldUnit.includes(`# Owner: ${root}\n`))throw Error('A service owned by another installation already exists');
  // Check availability before writing the addon, not halfway through installation.
  execFileSync('systemctl',['--user','show-environment'],{stdio:'ignore'});
}
if(stage) await fs.mkdir(destination,{recursive:true});
else {
  try {if(!(await fs.stat(destination)).isDirectory())throw Error('not a directory');}
  catch {throw Error('Addon directory not found. Locate your WoW client’s Interface/AddOns directory and pass --addon-dir /absolute/path/to/Interface/AddOns.');}
}
const addon = path.join(destination, 'Roamgate'), ownerFile = path.join(addon, '.roamgate-wow-owner.json');
let existing;
try { existing = JSON.parse(await fs.readFile(ownerFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
if (existing && existing.source !== root) throw Error('An addon owned by another checkout exists; refusing to replace it');
if (!existing) {
  try { await fs.access(addon); throw Error('An unowned Roamgate addon already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
// Preflight every destination before changing the installed addon.
for (let i = 1; i <= slots; i++) {
  const dir = path.join(destination, `RoamgateData${String(i).padStart(4, '0')}`);
  try { await fs.access(dir); if (!existing || i > existing.slots) throw Error(`Unowned slot directory: ${dir}`); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
if (existing && !stage) {
  const backup = path.join(root, '.local-data/backups', new Date().toISOString().replaceAll(':', '-'));
  await fs.mkdir(backup, { recursive: true }); await fs.cp(addon, path.join(backup, 'Roamgate'), { recursive: true });
}
await fs.cp(path.join(root, 'addon/Roamgate'), addon, { recursive: true });
// Keep the already-discovered UI.lua entry point: new modules need only /reload.
await fs.writeFile(path.join(addon,'UI.lua'),await bundleUI(path.join(root,'addon/Roamgate')));
await fs.writeFile(path.join(addon, 'Config.lua'), `local _, RG = ...\nRG.SLOT_COUNT = ${slots}\nRG.VERSION = "${version}"\n`);
for (let i = 1; i <= slots; i++) {
  const name = `RoamgateData${String(i).padStart(4, '0')}`, dir = path.join(destination, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${name}.toc`), `## Interface: 16001\n## Title: |cff777777Roamgate update ${i}|r\n## Notes: Local companion data. Keep enabled.\n## LoadOnDemand: 1\n## Dependencies: Roamgate\nData.lua\n`);
  // Do not blank a running game's next snapshot during a code update.
  try { await fs.writeFile(path.join(dir, 'Data.lua'), '-- Filled atomically by the local Roamgate companion.\n', { flag: 'wx' }); }
  catch (e) { if (e.code !== 'EEXIST') throw e; }
}
await fs.writeFile(ownerFile, JSON.stringify({ source: root, slots, version }, null, 2));
if (!stage) {
  const state = path.join(root, '.local-data'); await fs.mkdir(state, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(state, 'config.json'), JSON.stringify(config, null, 2), { mode: 0o600 });
  if (service) {
    const file = serviceFile;
    if (oldUnit) await fs.writeFile(file + '.bak', oldUnit);
    const unit = serviceUnit(root, process.execPath);
    const stagedUnit = path.join(state, 'roamgate-wow.service');
    await fs.writeFile(stagedUnit, unit);
    execFileSync('systemd-analyze', ['--user', 'verify', stagedUnit], { stdio: 'inherit' });
    await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, unit);
    execFileSync('systemctl', ['--user', 'daemon-reload'], { stdio: 'inherit' });
    execFileSync('systemctl', ['--user', 'enable', '--now', 'roamgate-wow.service'], { stdio: 'inherit' });
    if (existing) execFileSync('systemctl', ['--user', 'restart', 'roamgate-wow.service'], { stdio: 'inherit' });
  }
}
console.log(`${stage ? 'Staged' : 'Installed'} Roamgate ${version} and ${slots} update slots in ${destination}`);
if (!stage) console.log(existing && existing.slots === slots ? 'Update installed. Use /reload out of combat, then /rg.' : 'Restart WoW completely once to discover the new addons. Then type /rg.');
