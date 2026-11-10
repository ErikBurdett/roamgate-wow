import test from 'node:test';
import assert from 'node:assert/strict';
import { Roamgate } from '../bridge/roamgate.mjs';
test('workspace browser uses only read RPCs and carries exact workspace/path',async()=>{
  const r=new Roamgate(),calls=[];r.connect=async()=>{};r.call=async(method,params)=>{calls.push([method,params]);return {root:'/project',entries:[{name:'docs',path:'docs',type:'directory'}],text:'Hello'};};
  await r.browse('w1','files','docs');await r.browse('w1','file','docs/readme.md');await r.browse('w1','changes');await r.browse('w1','diff:unstaged','README.md');
  assert.deepEqual(calls.map(c=>c[0]),['file.list','file.read','git.diff_summary','git.diff_file']);assert.equal(calls[1][1].workspace_id,'w1');assert.equal(calls[1][1].path,'docs/readme.md');
  for(const bad of ['/etc/passwd','../../secret','a/../secret','a\nfile']) await assert.rejects(r.browse('w1','file',bad));
  await assert.rejects(r.browse('w1','delete','README.md'));
});
