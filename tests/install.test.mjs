import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { serviceUnit } from '../scripts/unit.mjs';
test('generated systemd unit passes the systemd parser',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-unit-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const file=path.join(dir,'roamgate-wow.service');await fs.writeFile(file,serviceUnit(process.cwd(),process.execPath));
  execFileSync('systemd-analyze',['--user','verify',file],{stdio:'pipe'});
});
test('staging creates valid load-on-demand addons and preserves a published snapshot on update',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-stage-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  execFileSync(process.execPath,['scripts/install.mjs','--stage',dir,'--slots','16']);
  const file=path.join(dir,'RoamgateData0001/Data.lua');await fs.writeFile(file,'RoamgateInbox={nonce="example"}\n');
  execFileSync(process.execPath,['scripts/install.mjs','--stage',dir,'--slots','16']);
  assert.match(await fs.readFile(file,'utf8'),/example/);
  assert.match(await fs.readFile(path.join(dir,'RoamgateData0016/RoamgateData0016.toc'),'utf8'),/## LoadOnDemand: 1/);
  const ui=path.join(dir,'Roamgate/UI.lua');assert.match(await fs.readFile(ui,'utf8'),/function RoamgateGuideToggle/);
  execFileSync('lua5.1',['-e',`assert(loadfile(${JSON.stringify(ui)}))`]);
  execFileSync('lua5.1',['-e',`assert(loadfile(${JSON.stringify(file)}))()`]);
});
test('staging refuses to overwrite an unowned addon',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-owned-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'Roamgate'));
  assert.throws(()=>execFileSync(process.execPath,['scripts/install.mjs','--stage',dir,'--slots','16'],{stdio:'pipe'}));
});
