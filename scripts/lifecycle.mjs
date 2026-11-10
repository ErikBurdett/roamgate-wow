import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {readConfig} from '../bridge/config.mjs';
import {atomicWrite} from '../bridge/files.mjs';
import {ownedInstallation,exists,slotName} from './install-state.mjs';
export async function companionAlive(root) {
  let pid;try{pid=Number(await fs.readFile(path.join(root,'.local-data/bridge.pid'),'utf8'));}catch(e){if(e.code==='ENOENT')return false;throw e;}
  if(!Number.isInteger(pid) || pid<1)throw Error('Invalid companion PID file; inspect it before changing the installation.');
  try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;return true;}
}
const system=args=>execFileSync('systemctl',['--user',...args],{stdio:'ignore'});
function probe(run,args){try{run(args);return true;}catch{return false;}}
export async function uninstallPlan(root,{home=os.homedir(),run=system}={}) {
  const config=await readConfig(root),owner=await ownedInstallation(root,config.addonDir);
  const unitFile=path.join(home,'.config/systemd/user/roamgate-wow.service');
  const unit=await fs.readFile(unitFile,'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  const unitOwned=!!unit?.includes(`# Owner: ${root}\n`);
  const paths=[path.join(config.addonDir,'Roamgate')];
  for(let i=1;i<=owner.managedSlots;i++){const dir=path.join(config.addonDir,slotName(i));if(await exists(dir))paths.push(dir);}
  return {action:'uninstall plan (no changes)',root,config,owner,paths,unitFile,unitOwned,unit:unitOwned?unit:null,
    active:unitOwned && probe(run,['is-active','--quiet','roamgate-wow.service']),enabled:unitOwned && probe(run,['is-enabled','--quiet','roamgate-wow.service']),
    preserves:['WoW saved variables and drafts','guide history','action journal','local configuration','versioned installation snapshots'],
    recoveryParent:path.dirname(await fs.realpath(config.addonDir))};
}
export async function uninstall(root,options={}) {
  const run=options.run || system,plan=await uninstallPlan(root,options);
  if(!plan.active && await companionAlive(root))throw Error('Stop the foreground companion before uninstalling.');
  if(plan.active)run(['stop','roamgate-wow.service']);
  const moved=[];let recovery;
  try {
    if(await companionAlive(root))throw Error('A foreground companion is still active.');
    await ownedInstallation(root,plan.config.addonDir); // Recheck after stopping.
    if(plan.unitOwned && await fs.readFile(plan.unitFile,'utf8')!==plan.unit)throw Error('Service definition changed; review it before uninstalling.');
    recovery=await fs.mkdtemp(path.join(plan.recoveryParent,'.roamgate-recovery-'));await fs.chmod(recovery,0o700);
    for(const original of plan.paths) {const saved=path.join(recovery,path.basename(original));await fs.rename(original,saved);moved.push({original,saved});}
    if(plan.unitOwned) {run(['disable','roamgate-wow.service']);await fs.rm(plan.unitFile);run(['daemon-reload']);}
    const receipt={schema:1,at:new Date().toISOString(),source:root,recovery,moved,unitFile:plan.unitFile,unit:plan.unit,installation:plan.owner.installation || null};
    await atomicWrite(path.join(root,'.local-data/uninstall-receipt.json'),JSON.stringify(receipt,null,2));
    await atomicWrite(path.join(recovery,'receipt.json'),JSON.stringify(receipt,null,2));
    return {action:'uninstalled',recovery,preserves:plan.preserves};
  } catch(e) {
    for(const {original,saved} of moved.reverse())await fs.rename(saved,original);
    if(plan.unitOwned){await atomicWrite(plan.unitFile,plan.unit);run(['daemon-reload']);if(plan.enabled)run(['enable','roamgate-wow.service']);if(plan.active)run(['start','roamgate-wow.service']);}
    if(recovery)await fs.rm(recovery,{recursive:true,force:true});throw e;
  }
}
