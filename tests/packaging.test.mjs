import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {loadModelChoices} from '../bridge/models.mjs';
import {preflight} from '../scripts/preflight.mjs';
import {uninstall,uninstallPlan} from '../scripts/lifecycle.mjs';
import {readSnapshot,copyRuntimeDependencies,ownedInstallation} from '../scripts/install-state.mjs';
async function fixture(t) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-package-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const root=path.join(dir,'Source Copy'),addonDir=path.join(dir,'Wine Prefix','Interface','AddOns'),home=path.join(dir,'fake-user');
  await fs.mkdir(root,{recursive:true});await fs.mkdir(addonDir,{recursive:true});
  for(const name of ['bridge','addon','scripts','package.json','package-lock.json'])await fs.cp(name,path.join(root,name),{recursive:true});
  await copyRuntimeDependencies(process.cwd(),root);
  const cli=(script,args=[])=>execFileSync(process.execPath,[`scripts/${script}.mjs`,...args],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const config=()=>fs.readFile(path.join(root,'.local-data/config.json'),'utf8').then(JSON.parse);
  return {dir,root,addonDir,home,cli,config};
}

test('catalog discovery is local, excludes hidden models, and permits validated custom entries',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-models-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const cache=path.join(dir,'models.json'),custom=path.join(dir,'custom.json');
  await fs.writeFile(cache,JSON.stringify({models:[{slug:'model-a',display_name:'Model A',visibility:'list'},{slug:'hidden',visibility:'hide'},{slug:'bad --arg',visibility:'list'}]}));
  await fs.writeFile(custom,JSON.stringify({codex:[{id:'my-model',label:'My choice'},{id:'model-a',label:'My A'}],claude:[{id:'fable',label:'Fable'}]}));
  const before=await fs.readFile(cache,'utf8');
  const {choices}=await loadModelChoices({codexCache:cache,overrideFile:custom,claudeHelp:''});
  assert.deepEqual(choices[0].models,[['','Installed default'],['model-a','My A'],['my-model','My choice']]);
  assert.equal(choices[0].defaultModel,'');assert.equal(await fs.readFile(cache,'utf8'),before);
  assert.ok(choices[1].models.some(([id])=>id==='fable'));
  await fs.writeFile(custom,JSON.stringify({codex:[{id:'--bad'}]}));await assert.rejects(loadModelChoices({codexCache:cache,overrideFile:custom,claudeHelp:''}),/Invalid local model/);
  const missing=await loadModelChoices({codexCache:path.join(dir,'missing'),claudeHelp:''});assert.deepEqual(missing.choices[0].models,[['','Installed default']]);
});

test('preflight returns actionable JSON data without starting agents or requiring Lua in foreground mode',async t=>{
  const f=await fixture(t),calls=[];
  const args={root:f.root,config:{addonDir:f.addonDir,origin:'http://localhost:8787'},foreground:true,platform:'linux',node:'22.0.0',find:async name=>'/tools/'+name,discover:async()=>({HYPRLAND_INSTANCE_SIGNATURE:'discovered'}),run:async(file,args,options)=>{if(file.endsWith('/hyprctl'))assert.equal(options.env.HYPRLAND_INSTANCE_SIGNATURE,'discovered');calls.push([file,...args]);return {stdout:''};},connect:async()=>{calls.push(['roamgate-read']);}};
  const good=await preflight(args);assert.equal(good.ready,true);assert.ok(!good.checks.some(c=>['lua5.1','systemctl'].includes(c.id)));
  assert.ok(calls.every(c=>!c.includes('start') && !c.includes('prompt')));
  const bad=await preflight({...args,platform:'win32',node:'20.0.0',find:async()=>null,connect:async()=>{throw Error('private credential detail');}});
  assert.equal(bad.ready,false);assert.ok(bad.checks.filter(c=>c.status==='fail').every(c=>c.fix));assert.ok(!JSON.stringify(bad).includes('private credential detail'));
});

test('install snapshots restore matching code/addon versions without replacing checkout or chat history',async t=>{
  const f=await fixture(t);
  f.cli('install',['--addon-dir',f.addonDir,'--slots','32','--read-only','--origin','http://127.0.0.1:9981','--install']);
  const first=await f.config();assert.ok(first.installation);
  await fs.mkdir(path.join(f.root,'.local-data/adventurer'),{recursive:true});await fs.writeFile(path.join(f.root,'.local-data/adventurer/sessions.json'),'private history');
  const pkg=JSON.parse(await fs.readFile(path.join(f.root,'package.json'),'utf8'));const originalVersion=pkg.version;pkg.version='0.4.0-alpha.2';await fs.writeFile(path.join(f.root,'package.json'),JSON.stringify(pkg));
  f.cli('version');await fs.writeFile(path.join(f.root,'bridge/new-version-marker.mjs'),'// next version\n');
  await fs.writeFile(path.join(f.root,'addon/Roamgate/new-version-marker.lua'),'-- next version\n');
  f.cli('install',['--slots','16','--install']);const second=await f.config();assert.notEqual(second.installation,first.installation);assert.equal(second.mode,'read-only');assert.equal(second.origin,first.origin);
  assert.equal((await ownedInstallation(f.root,f.addonDir)).managedSlots,32);
  const plan=JSON.parse(f.cli('rollback',['--to',first.installation]));assert.equal(plan.version,originalVersion);assert.equal((await f.config()).installation,second.installation);
  f.cli('rollback',['--to',first.installation,'--apply']);assert.equal((await f.config()).installation,first.installation);
  await assert.rejects(fs.stat(path.join(f.addonDir,'Roamgate/new-version-marker.lua')),e=>e.code==='ENOENT');
  const restored=await readSnapshot(f.root,first.installation);assert.equal(restored.manifest.version,originalVersion);
  assert.match(await fs.readFile(path.join(f.addonDir,'Roamgate/Config.lua'),'utf8'),new RegExp(originalVersion.replaceAll('.','\\.')));
  assert.equal(JSON.parse(await fs.readFile(path.join(f.root,'package.json'),'utf8')).version,'0.4.0-alpha.2');
  assert.equal(await fs.readFile(path.join(f.root,'.local-data/adventurer/sessions.json'),'utf8'),'private history');
  await fs.appendFile(path.join(restored.contentRoot,'bridge/main.mjs'),'// tamper\n');assert.throws(()=>f.cli('rollback',['--to',first.installation,'--apply']),/checksum mismatch/);
});

test('uninstall is planned, ownership checked, reversible on failure, and retains private records',async t=>{
  const f=await fixture(t);f.cli('install',['--addon-dir',f.addonDir,'--slots','16','--install']);
  const unitFile=path.join(f.home,'.config/systemd/user/roamgate-wow.service');await fs.mkdir(path.dirname(unitFile),{recursive:true});const unit=`# Owner: ${f.root}\n[Service]\n`;await fs.writeFile(unitFile,unit);
  await fs.writeFile(path.join(f.root,'.local-data/actions.json'),'journal');await fs.writeFile(path.join(f.addonDir,'RoamgateData0001/Data.lua'),'private saved view');
  const calls=[],run=args=>{calls.push(args);};
  const plan=await uninstallPlan(f.root,{home:f.home,run});assert.equal(plan.paths.length,17);assert.equal(await fs.readFile(unitFile,'utf8'),unit);
  await assert.rejects(uninstall(f.root,{home:f.home,run:args=>{if(args[0]==='disable')throw Error('simulated service failure');}}),/simulated/);
  assert.equal(await fs.readFile(path.join(f.addonDir,'RoamgateData0001/Data.lua'),'utf8'),'private saved view');
  const result=await uninstall(f.root,{home:f.home,run});assert.equal((await fs.readdir(f.addonDir)).length,0);
  assert.equal(await fs.readFile(path.join(f.root,'.local-data/actions.json'),'utf8'),'journal');assert.equal(await fs.readFile(path.join(result.recovery,'RoamgateData0001/Data.lua'),'utf8'),'private saved view');
  await assert.rejects(fs.stat(unitFile),e=>e.code==='ENOENT');assert.ok(calls.some(c=>c[0]==='stop'));assert.ok(calls.every(c=>!c.includes('herdr.service') && !c.includes('roamgate.service')));
  const config=await f.config();f.cli('rollback',['--to',config.installation,'--apply']);assert.ok(await ownedInstallation(f.root,f.addonDir));
});

test('uninstall refuses symlinks and unexpected slot contents before any service or file mutation',async t=>{
  const f=await fixture(t);f.cli('install',['--addon-dir',f.addonDir,'--slots','16','--install']);
  const extra=path.join(f.addonDir,'RoamgateData0001/unrelated.txt');await fs.writeFile(extra,'keep');
  await assert.rejects(uninstallPlan(f.root,{home:f.home}),/unexpected files/);assert.equal(await fs.readFile(extra,'utf8'),'keep');
  await fs.rm(extra);const sentinel=path.join(f.dir,'other-files');await fs.mkdir(sentinel);await fs.writeFile(path.join(sentinel,'keep.txt'),'keep');
  await fs.rm(path.join(f.addonDir,'RoamgateData0001'),{recursive:true});await fs.symlink(sentinel,path.join(f.addonDir,'RoamgateData0001'));
  await assert.rejects(uninstall(f.root,{home:f.home}),/symlink/);assert.equal(await fs.readFile(path.join(sentinel,'keep.txt'),'utf8'),'keep');
});
