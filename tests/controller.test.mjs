import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Controller } from '../bridge/controller.mjs';
async function fixture(t, status='idle') {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'rg-wow-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
  const agent={pane_id:'w1:p1',terminal_id:'t1',agent:'codex',agent_status:status,state_change_seq:12,cwd:'/project',workspace_id:'w1',terminal_title:'A project'};
  let screen='Approve command?\n> 1. Allow once\n  2. Decline', now=100000;
  const calls=[];
  const herdr={agents:async()=>[{...agent}],workspaces:async()=>[{workspace_id:'w1',label:'Project'}],get:async()=>({...agent}),read:async()=>screen,
    prompt:async(...a)=>{calls.push(['prompt',...a]);},key:async(...a)=>{calls.push(['key',...a]);},answer:async(...a)=>{calls.push(['answer',...a]);},newChat:async(...a)=>{calls.push(['new',...a]);return 'w1:p2';}};
  const opts={herdr,roamgate:{history:async()=>({entries:[{role:'assistant',text:'Ready.'}]})},journal:path.join(dir,'journal.json'),clock:()=>now};
  const controller=new Controller(opts);await controller.init();
  const view={nonce:'0123456789abcdef',slot:1,id:0,op:'view',pane:agent.pane_id,terminal:agent.terminal_id,visible:true};
  const snapshot=await controller.handle(view);
  const command={...view,id:1,op:'message',text:'Do the task.',proof:snapshot.selected.proof,extra:''};
  return {controller,agent,calls,opts,view,command,screen:s=>screen=s,time:n=>now=n};
}
test('message goes to the selected agent exactly once across duplicate captures and restart',async t=>{
  const f=await fixture(t);assert.equal((await f.controller.handle(f.command)).ack.state,'ok');
  await f.controller.handle(f.command);const restarted=new Controller(f.opts);await restarted.init();await restarted.handle(f.command);
  assert.deepEqual(f.calls,[['prompt','w1:p1','Do the task.']]);
});
test('uncertain journal from a crash is not replayed',async t=>{
  const f=await fixture(t);await fs.writeFile(f.opts.journal,JSON.stringify({nonce:f.view.nonce,id:1,state:'uncertain',message:'Inspect before retrying'}));
  const c=new Controller(f.opts);await c.init();const s=await c.handle(f.command);assert.equal(s.ack.state,'uncertain');assert.equal(f.calls.length,0);
});
test('read-only companion rejects mutations',async t=>{
  const f=await fixture(t);f.controller.mode='read-only';const s=await f.controller.handle(f.command);assert.equal(s.ack.state,'error');assert.equal(f.calls.length,0);
});
test('a pane replaced by another agent cannot receive stale input',async t=>{
  const f=await fixture(t);f.agent.terminal_id='replacement';const s=await f.controller.handle(f.command);assert.match(s.ack.message,/session changed/);assert.equal(f.calls.length,0);
});
test('a changed question cannot receive Enter',async t=>{
  const f=await fixture(t,'blocked');f.screen('Approve a completely different command?');const s=await f.controller.handle({...f.command,op:'key',text:'enter'});assert.match(s.ack.message,/question changed/);assert.equal(f.calls.length,0);
});
test('a resolved question cannot receive Enter',async t=>{
  const f=await fixture(t,'blocked');f.agent.agent_status='idle';const s=await f.controller.handle({...f.command,op:'key',text:'enter'});assert.match(s.ack.message,/no longer waiting/);assert.equal(f.calls.length,0);
});
test('user-selected question controls and paste are separate operations',async t=>{
  const f=await fixture(t,'blocked');await f.controller.handle({...f.command,op:'answer',text:'My answer'});assert.deepEqual(f.calls,[['answer','w1:p1','My answer']]);
});
const queuedScreen='Working on your task\nQueued follow-up inputs\n ? 1 question\n shift+← to answer';
const followupScreen='• Queued follow-up inputs\n\n  1 of 2\n  Which quest should we inspect?\n\n  › 1. First quest\n    2. Other\n\n  enter submit   ^] skip   shift+→ main prompt   shift+← next question';
test('displayed follow-up answers tolerate only changes outside the exact question tray',async t=>{
  for (const action of [{op:'answer',text:'A quest name'},{op:'key',text:'enter'}]) {
    const f=await fixture(t,'blocked');f.screen('Working (3m 05s)\n\n'+followupScreen);f.controller.screens.clear();
    const before=await f.controller.handle(f.view);assert.equal(before.selected.questionMode,'visible');
    f.screen('More work output\nWorking (3m 08s)\n\n'+followupScreen);f.agent.state_change_seq++;
    const refreshed=await f.controller.handle(f.view);
    assert.equal(refreshed.selected.proof,before.selected.proof);assert.equal(refreshed.selected.questionScreen,followupScreen);
    const result=await f.controller.handle({...f.command,proof:before.selected.proof,...action});
    assert.equal(result.ack.state,'ok');assert.equal(f.calls.length,1);
  }
});
test('changed follow-up question, selected choice, or dismissed tray rejects Enter',async t=>{
  for (const changed of [followupScreen.replace('First quest','A different quest'),followupScreen.replace('1 of 2','2 of 2'),followupScreen.replace('› 1.','  1.').replace('  2.','› 2.'),'Ask Codex to do anything']) {
    const f=await fixture(t,'blocked');f.screen(followupScreen);f.controller.screens.clear();
    const before=await f.controller.handle(f.view);f.screen(changed);
    const result=await f.controller.handle({...f.command,proof:before.selected.proof,op:'key',text:'enter'});
    assert.equal(result.ack.state,'error');assert.equal(f.calls.length,0);
  }
});
test('the question shortcut opens queued prompts despite changing work output without submitting Enter',async t=>{
  const f=await fixture(t,'blocked');f.screen(queuedScreen);f.controller.screens.clear();
  const before=await f.controller.handle(f.view);assert.equal(before.selected.questionMode,'queued');
  f.screen('More work output\n'+queuedScreen);f.agent.state_change_seq++;
  await f.controller.handle({...f.command,proof:before.selected.proof,op:'key',text:'shift+left'});
  assert.deepEqual(f.calls,[['key','w1:p1','shift+left']]);
});
test('opening the question tray requires a currently queued question',async t=>{
  const f=await fixture(t,'blocked');const s=await f.controller.handle({...f.command,op:'key',text:'shift+left'});
  assert.match(s.ack.message,/no queued question/);assert.equal(f.calls.length,0);
});
test('queued questions cannot receive paste or Enter even with an exact view proof',async t=>{
  for (const action of [{op:'answer',text:'A work task'},{op:'key',text:'enter'}]) {
    const f=await fixture(t,'blocked');f.screen(queuedScreen);f.controller.screens.clear();
    const before=await f.controller.handle(f.view);
    const s=await f.controller.handle({...f.command,proof:before.selected.proof,...action});
    assert.match(s.ack.message,/Open Questions first/);assert.equal(f.calls.length,0);
  }
});
test('queued questions can be opened while the agent is still marked working',async t=>{
  const f=await fixture(t,'working');f.screen(queuedScreen);
  await f.controller.handle({...f.command,op:'key',text:'shift+left'});
  assert.deepEqual(f.calls,[['key','w1:p1','shift+left']]);
});
test('normal prompts never answer a blocked question',async t=>{
  const f=await fixture(t,'blocked');const s=await f.controller.handle(f.command);assert.match(s.ack.message,/current question/);assert.equal(f.calls.length,0);
});
test('expired view and wrong target proof are rejected',async t=>{
  const f=await fixture(t);f.time(200000);let s=await f.controller.handle(f.command);assert.match(s.ack.message,/stale/);
  s=await f.controller.handle({...f.command,id:2,pane:'w9:p9'});assert.equal(s.ack.state,'error');assert.equal(f.calls.length,0);
});
test('unknown controls, control-character injection, and oversized prompts are rejected',async t=>{
  for(const text of ['\x1b[2J','x'.repeat(6001),'\n ']) {
    const f=await fixture(t);await f.controller.handle({...f.command,text});assert.equal(f.calls.length,0);
  }
  const f=await fixture(t,'blocked');await f.controller.handle({...f.command,op:'key',text:'ctrl+c'});assert.equal(f.calls.length,0);
});
test('new sessions use selected project and chosen provider',async t=>{
  const f=await fixture(t);const s=await f.controller.handle({...f.command,op:'new',extra:'claude'});assert.equal(s.ack.pane,'w1:p2');assert.equal(f.calls[0][1].cwd,'/project');assert.equal(f.calls[0][3],'claude');
});
test('new nonce requires a view handshake, never an action',async t=>{
  const f=await fixture(t);await assert.rejects(f.controller.handle({...f.command,nonce:'fedcba9876543210'}),/fresh connection/);assert.equal(f.calls.length,0);
});
test('explicit new-chat model reaches only the creation adapter and invalid choices cannot create',async t=>{
  const f=await fixture(t);
  const result=await f.controller.handle({...f.command,op:'new',extra:'claude',provider:'claude',model:'fable'});
  assert.equal(result.ack.state,'ok');assert.equal(f.calls[0][3],'claude');assert.equal(f.calls[0][4],'fable');
  const fresh=await f.controller.handle(f.view);
  const invalid=await f.controller.handle({...f.command,id:2,op:'new',proof:fresh.selected.proof,provider:'codex',model:'fable'});
  assert.equal(invalid.ack.state,'error');assert.equal(f.calls.length,1);
});
test('history failure retains exact terminal output with explicit fallback',async t=>{
  const f=await fixture(t);f.controller.historyCache.clear();f.opts.roamgate.history=async()=>{throw Error('offline');};
  await f.controller.handle(f.view);await new Promise(r=>setImmediate(r));
  const s=await f.controller.handle(f.view);assert.match(s.selected.historyStatus,/unavailable/);assert.match(s.selected.screen,/Approve command/);
});
test('slow conversation history does not block a message acknowledgement and appears when ready',async t=>{
  const f=await fixture(t);let resolve;
  f.controller.historyCache.clear();f.opts.roamgate.history=()=>new Promise(r=>resolve=r);
  await f.controller.handle(f.view);
  const result=await f.controller.handle(f.command);
  assert.equal(result.ack.state,'ok');assert.match(result.selected.historyStatus,/Loading/);
  assert.equal(f.calls.length,1);
  resolve({entries:[{role:'assistant',text:'History ready'}]});await new Promise(r=>setImmediate(r));
  const next=await f.controller.handle(f.view);assert.equal(next.selected.entries[0].text,'History ready');
});
test('unavailable terminal scrollback cannot suppress delivery acknowledgement',async t=>{
  const f=await fixture(t);f.controller.historyCache.clear();f.controller.transcripts.clear();
  f.opts.roamgate.history=async()=>({entries:[]});
  f.opts.herdr.read=async(pane,visible=true)=>{if(!visible)throw Error('history requires idle');return 'Current live screen';};
  const s=await f.controller.handle(f.command);assert.equal(s.ack.state,'ok');assert.equal(s.selected.transcript,'Current live screen');
  f.agent.agent_status='working';f.controller.transcripts.clear();let historyReads=0;
  f.opts.herdr.read=async(pane,visible=true)=>{if(!visible)historyReads++;return 'Working';};
  await f.controller.handle(f.view);assert.equal(historyReads,0);
});
test('history cache expires despite frequent polling and is invalidated for a replacement session',async t=>{
  const f=await fixture(t);let count=0;f.controller.historyCache.clear();f.opts.roamgate.history=async()=>{count++;return {entries:[]};};
  for(const n of [100000,102000,104000,116000]) { f.time(n);await f.controller.handle(f.view); }
  assert.equal(count,2);f.agent.terminal_id='new-session';await f.controller.handle(f.view);assert.equal(count,3);
});
test('terminal view reuses recent captures and never fetches conversation history',async t=>{
  const f=await fixture(t);f.agent.agent_status='working';f.controller.screens.clear();f.controller.historyCache.clear();
  let reads=0,histories=0;f.opts.herdr.read=async()=>{reads++;return 'Live text';};f.opts.roamgate.history=async()=>{histories++;return {entries:[]};};
  const req={...f.view,text:'terminal'};
  for(const n of [100000,101000,104000]){f.time(n);await f.controller.handle(req);}
  assert.equal(reads,1);assert.equal(histories,0);
  f.time(105001);await f.controller.handle(req);assert.equal(reads,2);
  f.agent.state_change_seq++;await f.controller.handle(req);assert.equal(reads,3);
  await f.controller.handle({...req,visible:false});assert.equal(reads,3);
});
test('all workspaces and inactive panes remain navigable; terminal text is readable',async t=>{
  const f=await fixture(t);
  f.opts.herdr.panes=async()=>[f.agent,{pane_id:'w2:p2',terminal_id:'t2',workspace_id:'w2',tab_id:'w2:t2',cwd:'/other',agent_status:'unknown'}];
  f.opts.herdr.tabs=async()=>[{tab_id:'w2:t2',label:'Previous conversation'}];
  f.opts.herdr.workspaces=async()=>[{workspace_id:'w1',label:'Project',pane_count:1},{workspace_id:'w2',label:'Other',pane_count:1}];
  f.opts.herdr.readPane=async()=>'Resume this session with...';
  const s=await f.controller.handle({...f.view,pane:'w2:p2'});
  assert.equal(s.agents.length,2);assert.equal(s.workspaces.length,2);assert.equal(s.selected.title,'Previous conversation');assert.equal(s.selected.activeAgent,false);assert.match(s.selected.screen,/Resume/);
});
test('slow file views do not block capture or delay command acknowledgements',async t=>{
  const f=await fixture(t);let resolve,calls=0;f.opts.roamgate.browse=()=>{calls++;return new Promise(r=>resolve=r);};
  const req={...f.view,text:'files',extra:''};const first=await f.controller.handle(req);assert.equal(first.browser.loading,true);
  await f.controller.handle(req);assert.equal(calls,1);
  resolve({view:'files',path:'',entries:[{name:'docs'}]});await new Promise(r=>setImmediate(r));
  const next=await f.controller.handle(req);assert.equal(next.browser.entries[0].name,'docs');
});
