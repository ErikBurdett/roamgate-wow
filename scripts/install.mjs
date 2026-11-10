import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {serviceUnit} from './unit.mjs';
import {bundleUI} from './bundle.mjs';
import {readConfig} from '../bridge/config.mjs';
import {atomicWrite} from '../bridge/files.mjs';
import {installOptions,HELP} from './options.mjs';
import {ownedInstallation,createSnapshot,readSnapshot,runtimeEntry,slotName,OWNER,exists} from './install-state.mjs';
import {companionAlive} from './lifecycle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.includes('--help')) {console.log(HELP);process.exit(0);}
let restore;
if(args[0]==='--restore') {
  if(args.length!==2)throw Error('Internal restore expects one verified installation ID.');
  restore=await readSnapshot(root,args[1]);
}
const options=restore ? {config:restore.manifest.config,install:true,service:!!restore.manifest.config.service,stage:false} : installOptions(args,await readConfig(root));
let {config,stage,install,service}=options;
const destination=config.addonDir,slots=config.slots,serviceFile=path.join(os.homedir(),'.config/systemd/user/roamgate-wow.service');
if(!stage && !install) {
  console.log(JSON.stringify({action:'install plan (no changes)',destination,source:root,slots,mode:config.mode,origin:config.origin,service:serviceFile,start:service,command:'Add --install to apply'},null,2));process.exit(0);
}
const system=args=>execFileSync('systemctl',['--user',...args],{stdio:'ignore'});
const active=()=>{try{system(['is-active','--quiet','roamgate-wow.service']);return true;}catch{return false;}};
let oldUnit;
if(await exists(serviceFile))oldUnit=await fs.readFile(serviceFile,'utf8');
const unitOwned=!!oldUnit?.includes(`# Owner: ${root}\n`);
if(service) {
  if(oldUnit && !unitOwned)throw Error('A service owned by another installation already exists');
  system(['show-environment']);
} else if(!stage && unitOwned)throw Error('Use --service to update this checkout’s managed service, or uninstall it before choosing foreground mode.');
if(stage)await fs.mkdir(destination,{recursive:true});
else if(!await fs.stat(destination).then(s=>s.isDirectory(),()=>false))throw Error('Addon directory not found. Pass --addon-dir /absolute/path/to/Interface/AddOns.');
const existing=await ownedInstallation(root,destination,{allowMissing:true});
for(let i=1;i<=slots;i++)if(await exists(path.join(destination,slotName(i))) && (!existing || i>existing.managedSlots))throw Error('An update directory is not owned by this installation.');
const wasActive=service && unitOwned && active();
let wasEnabled=false;
if(service && unitOwned)try{system(['is-enabled','--quiet','roamgate-wow.service']);wasEnabled=true;}catch {}
if(!wasActive && !stage && await companionAlive(root))throw Error('Stop the foreground WoW companion before changing the installation.');
let snapshot=restore;
if(!stage && !restore)snapshot=await createSnapshot(root,{...config,installation:undefined,service});
const contentRoot=snapshot?.contentRoot || root;
const {version}=JSON.parse(await fs.readFile(path.join(contentRoot,'package.json'),'utf8'));
const newConfig={...config,service,...(snapshot?{installation:snapshot.manifest.id}:{})};
const newUnit=service ? serviceUnit(root,process.execPath,runtimeEntry(root,snapshot.manifest.id)) : null;
if(service) {
  const prepared=path.join(root,'.local-data/prepared-roamgate-wow.service');await atomicWrite(prepared,newUnit);
  execFileSync('systemd-analyze',['--user','verify',prepared],{stdio:'inherit'});
}
const addon=path.join(destination,'Roamgate'),configFile=path.join(root,'.local-data/config.json');
const previousConfig=await fs.readFile(configFile,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
const backup=path.join(root,'.local-data/backups',new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8));
if(existing && !stage) {
  await fs.mkdir(backup,{recursive:true,mode:0o700});await fs.cp(addon,path.join(backup,'Roamgate'),{recursive:true});
  if(previousConfig)await atomicWrite(path.join(backup,'config.json'),previousConfig);
  if(unitOwned)await atomicWrite(path.join(backup,'roamgate-wow.service'),oldUnit);
}
const created=[];let changed=false;
try {
  if(wasActive)system(['stop','roamgate-wow.service']);
  if(!stage && await companionAlive(root))throw Error('Another foreground companion is still active; stop it before installing.');
  changed=true;
  // A complete owned code tree avoids leaving newer files behind on rollback.
  // Published data lives in the separate update directories and is preserved.
  if(existing && !stage)await fs.rm(addon,{recursive:true});
  await fs.cp(path.join(contentRoot,'addon/Roamgate'),addon,{recursive:true});
  await atomicWrite(path.join(addon,'UI.lua'),await bundleUI(path.join(contentRoot,'addon/Roamgate')));
  await atomicWrite(path.join(addon,'Config.lua'),`local _, RG = ...\nRG.SLOT_COUNT = ${slots}\nRG.VERSION = "${version}"\n`);
  const toc=(await fs.readFile(path.join(addon,'Roamgate.toc'),'utf8')).replace(/^## Version:.*$/m,`## Version: ${version}`);await atomicWrite(path.join(addon,'Roamgate.toc'),toc);
  for(let i=1;i<=slots;i++) {
    const name=slotName(i),dir=path.join(destination,name);
    if(!await exists(dir)){await fs.mkdir(dir);created.push(dir);}
    await atomicWrite(path.join(dir,`${name}.toc`),`## Interface: 16001\n## Title: |cff777777Roamgate update ${i}|r\n## Notes: Local companion data. Keep enabled.\n## LoadOnDemand: 1\n## Dependencies: Roamgate\nData.lua\n`);
    try{await fs.writeFile(path.join(dir,'Data.lua'),'-- Filled atomically by the local companion.\n',{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  await atomicWrite(path.join(addon,OWNER),JSON.stringify({source:root,slots,managedSlots:Math.max(slots,existing?.managedSlots || 0),version,...(snapshot?{installation:snapshot.manifest.id}:{})},null,2));
  if(!stage)await atomicWrite(configFile,JSON.stringify(newConfig,null,2));
  if(service) {
    await atomicWrite(serviceFile,newUnit);system(['daemon-reload']);system(['enable','--now','roamgate-wow.service']);
    if(!wasActive && unitOwned)system(['restart','roamgate-wow.service']);
  }
} catch(e) {
  if(changed && !stage) {
    if(service)try{system(['stop','roamgate-wow.service']);}catch {}
    if(existing){await fs.rm(addon,{recursive:true,force:true});await fs.cp(path.join(backup,'Roamgate'),addon,{recursive:true});}
    else await fs.rm(addon,{recursive:true,force:true});
    for(const dir of created)await fs.rm(dir,{recursive:true,force:true});
    if(previousConfig)await atomicWrite(configFile,previousConfig);else await fs.rm(configFile,{force:true});
    if(service) {
      if(oldUnit)await atomicWrite(serviceFile,oldUnit);else {try{system(['disable','roamgate-wow.service']);}catch{}await fs.rm(serviceFile,{force:true});}
      system(['daemon-reload']);
      if(oldUnit)system([wasEnabled?'enable':'disable','roamgate-wow.service']);
      if(wasActive)system(['start','roamgate-wow.service']);
    }
  } else if(wasActive && !active())system(['start','roamgate-wow.service']);
  throw e;
}
console.log(`${stage?'Staged':restore?'Restored':'Installed'} Roamgate ${version} with ${slots} slots in ${destination}`);
if(!stage)console.log(existing && existing.slots===slots?'Use /reload out of combat after pending delivery completes.':'Fully relaunch WoW to discover the addon/update slots, then /rg.');
