import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {atomicWrite} from '../bridge/files.mjs';
import {validateConfig} from '../bridge/config.mjs';
export const OWNER='.roamgate-wow-owner.json';
export const slotName=n=>`RoamgateData${String(n).padStart(4,'0')}`;
export async function exists(file) {return fs.lstat(file).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});}
export async function assertTree(directory) {
  const stat=await fs.lstat(directory);
  if(stat.isSymbolicLink())throw Error('Refusing a symlink in an installation or recovery tree.');
  if(stat.isDirectory())for(const item of await fs.readdir(directory))await assertTree(path.join(directory,item));
  else if(!stat.isFile())throw Error('Refusing a special file in an installation tree.');
}
export async function ownedInstallation(root,addonDir,{allowMissing=false}={}) {
  const addon=path.join(addonDir,'Roamgate');
  if(!await exists(addon)) {if(allowMissing)return null;throw Error('No owned Roamgate installation exists at this path.');}
  await assertTree(addon);
  let owner;try{owner=JSON.parse(await fs.readFile(path.join(addon,OWNER),'utf8'));}catch{throw Error('The addon has no readable ownership marker.');}
  if(owner.source!==root)throw Error('This addon belongs to another checkout.');
  const managed=owner.managedSlots || owner.slots;
  if(!Number.isInteger(managed) || managed<16 || managed>4096 || !Number.isInteger(owner.slots) || owner.slots<16 || owner.slots>managed)throw Error('Invalid installed slot ownership.');
  for(let i=1;i<=managed;i++) {
    const name=slotName(i),dir=path.join(addonDir,name);
    if(!await exists(dir))continue;
    await assertTree(dir);
    const files=await fs.readdir(dir);
    if(files.some(f=>![`${name}.toc`,'Data.lua'].includes(f)))throw Error(`${name} contains unexpected files; refusing to modify it.`);
    const toc=await fs.readFile(path.join(dir,`${name}.toc`),'utf8');
    if(!/^## Dependencies: Roamgate\s*$/m.test(toc) || !/^## LoadOnDemand: 1\s*$/m.test(toc))throw Error(`${name} is not an owned update addon.`);
  }
  return {...owner,managedSlots:managed};
}
export async function copyRuntimeDependencies(source,target) {
  const lock=JSON.parse(await fs.readFile(path.join(source,'package-lock.json'),'utf8'));
  for(const [relative,pkg] of Object.entries(lock.packages || {})) {
    if(!relative || pkg.dev)continue;
    if(!relative.startsWith('node_modules/') || relative.split('/').includes('..') || pkg.link)throw Error('Unsupported dependency layout. Use a clean npm ci installation.');
    const from=path.join(source,relative);
    await assertTree(from);
    const installed=JSON.parse(await fs.readFile(path.join(from,'package.json'),'utf8'));
    if(installed.version!==pkg.version)throw Error('Runtime dependencies differ from the lockfile. Run npm ci --ignore-scripts.');
    await fs.mkdir(path.dirname(path.join(target,relative)),{recursive:true});await fs.cp(from,path.join(target,relative),{recursive:true});
  }
}
export async function hashes(directory,prefix='') {
  const result={};
  for(const item of (await fs.readdir(path.join(directory,prefix),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const relative=path.posix.join(prefix,item.name);
    if(item.isSymbolicLink())throw Error('Snapshots cannot contain symlinks.');
    if(item.isDirectory())Object.assign(result,await hashes(directory,relative));
    else if(item.isFile())result[relative]=crypto.createHash('sha256').update(await fs.readFile(path.join(directory,relative))).digest('hex');
    else throw Error('Unsupported snapshot file.');
  }
  return result;
}
export async function createSnapshot(root,config) {
  const id=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomUUID().slice(0,8);
  const directory=path.join(root,'.local-data/installations',id),source=path.join(directory,'source');
  await fs.mkdir(source,{recursive:true,mode:0o700});
  try {
    for(const name of ['bridge','addon','package.json','package-lock.json']) {await assertTree(path.join(root,name));await fs.cp(path.join(root,name),path.join(source,name),{recursive:true});}
    await copyRuntimeDependencies(root,source);
    const pkg=JSON.parse(await fs.readFile(path.join(source,'package.json'),'utf8'));
    const manifest={schema:1,id,source:root,version:pkg.version,config,createdAt:new Date().toISOString(),hashes:await hashes(source)};
    await atomicWrite(path.join(directory,'manifest.json'),JSON.stringify(manifest,null,2));
    return {directory,contentRoot:source,manifest};
  } catch(e) {await fs.rm(directory,{recursive:true,force:true});throw e;}
}
export async function readSnapshot(root,id) {
  if(!/^[0-9TZ.-]+-[a-f0-9]{8}$/.test(id || ''))throw Error('Choose an installation ID from npm run rollback -- --list.');
  const directory=path.join(root,'.local-data/installations',id),contentRoot=path.join(directory,'source');
  await assertTree(directory);
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'manifest.json'),'utf8'));
  if(manifest.schema!==1 || manifest.source!==root || manifest.id!==id)throw Error('Snapshot ownership mismatch.');
  validateConfig(manifest.config);
  const actual=await hashes(contentRoot);
  if(!manifest.hashes || Object.keys(actual).length!==Object.keys(manifest.hashes).length || Object.entries(actual).some(([file,sum])=>manifest.hashes[file]!==sum))throw Error('Installation snapshot checksum mismatch; refusing rollback.');
  return {directory,contentRoot,manifest};
}
export async function listSnapshots(root) {
  const directory=path.join(root,'.local-data/installations');if(!await exists(directory))return [];
  const result=[];
  for(const id of (await fs.readdir(directory)).sort().reverse()) {
    try {const m=JSON.parse(await fs.readFile(path.join(directory,id,'manifest.json'),'utf8'));if(m.source===root)result.push({id,version:m.version,createdAt:m.createdAt,slots:m.config.slots});}catch {}
  }
  return result;
}
export function runtimeEntry(root,id) {return path.join(root,'.local-data/installations',id,'source/bridge/main.mjs');}
