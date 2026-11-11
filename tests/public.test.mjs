import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync,spawnSync} from 'node:child_process';

test('history publication check rejects personal author and committer addresses without disclosing them',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-public-'));
  t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  await fs.copyFile('scripts/check-public.mjs',path.join(dir,'check.mjs'));
  const git=args=>execFileSync('git',args,{cwd:dir,stdio:'pipe'});
  git(['init','-q']);git(['config','user.name','Example Maintainer']);
  const safe='12345+example@users.noreply.github.com',personal='maintainer@example.org';
  const commit=(author,committer)=>execFileSync('git',['-c','commit.gpgSign=false','commit','--allow-empty','-qm','Fixture'],{
    cwd:dir,stdio:'pipe',env:{...process.env,GIT_AUTHOR_NAME:'Example Maintainer',GIT_COMMITTER_NAME:'Example Maintainer',GIT_AUTHOR_EMAIL:author,GIT_COMMITTER_EMAIL:committer},
  });
  const check=()=>spawnSync(process.execPath,['check.mjs','--history'],{cwd:dir,encoding:'utf8'});
  commit(safe,safe);assert.equal(check().status,0);
  commit(personal,safe);let result=check();assert.equal(result.status,1);assert.match(result.stderr,/author email/);assert.ok(!result.stderr.includes(personal));
  commit(safe,personal);result=check();assert.equal(result.status,1);assert.match(result.stderr,/committer email/);assert.ok(!result.stderr.includes(personal));
});
