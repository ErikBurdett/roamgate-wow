import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {readConfig,localOrigin} from '../bridge/config.mjs';
import {installOptions} from '../scripts/options.mjs';
const saved={addonDir:'/games/My Wine Prefix/Interface/AddOns',slots:128,mode:'read-only',origin:'http://localhost:9876'};
test('updates preserve custom install settings unless explicitly overridden',()=>{
  assert.deepEqual(installOptions(['--install'],saved).config,saved);
  const changed=installOptions(['--install','--interactive','--origin','http://127.0.0.1:8888'],saved);
  assert.deepEqual(changed.config,{...saved,mode:'interactive',origin:'http://127.0.0.1:8888'});
  const staged=installOptions(['--stage','dist/test','--slots','16'],saved);assert.equal(staged.stage,true);assert.equal(staged.service,false);
});
test('invalid or ambiguous install options fail before changes',()=>{
  for(const args of [['--instal'],['--addon-dir'],['--addon-dir','relative/path'],['--slots','8'],['--slots','NaN'],['--read-only','--interactive'],['--stage','x','--service'],['--stage','x','--install'],['--slots','16','--slots','32']])assert.throws(()=>installOptions(args,saved));
  for(const url of ['https://localhost','http://example.com','http://user:pass@localhost','http://localhost/path','http://localhost?token=example'])assert.throws(()=>localOrigin(url));
  assert.equal(localOrigin('http://[::1]:8787'),'http://[::1]:8787');
});
test('config migration fills missing defaults without rewriting the original file',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-config-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.mkdir(path.join(dir,'.local-data'));const file=path.join(dir,'.local-data/config.json');
  const original=JSON.stringify({addonDir:saved.addonDir,slots:256,mode:'read-only'});await fs.writeFile(file,original);
  const c=await readConfig(dir);assert.equal(c.origin,'http://127.0.0.1:8787');assert.equal(c.slots,256);assert.equal(await fs.readFile(file,'utf8'),original);
});
test('help and install plans make no destination directories; a mistyped install path fails',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-plan-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const target=path.join(dir,'missing','Interface','AddOns');
  const help=execFileSync(process.execPath,['scripts/install.mjs','--help'],{encoding:'utf8'});assert.match(help,/--addon-dir/);
  const plan=JSON.parse(execFileSync(process.execPath,['scripts/install.mjs','--addon-dir',target],{encoding:'utf8'}));assert.equal(plan.destination,target);
  assert.throws(()=>execFileSync(process.execPath,['scripts/install.mjs','--addon-dir',target,'--install'],{stdio:'pipe'}));
  await assert.rejects(fs.stat(path.join(dir,'missing')),e=>e.code==='ENOENT');
});
