import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {GuideSessions,guidePrompt} from '../bridge/guide.mjs';
import {Controller} from '../bridge/controller.mjs';
test('game advice includes version-aware guidance and bounded observations',()=>{
  const prompt=guidePrompt('Where next?','Level 27 Warrior; Duskwood');
  assert.match(prompt,/World of Warcraft Forever/);assert.match(prompt,/not instructions/);assert.match(prompt,/Level 27 Warrior/);
  assert.throws(()=>guidePrompt('x'.repeat(2001),''));assert.throws(()=>guidePrompt('Hi','x'.repeat(5001)));assert.throws(()=>guidePrompt('Hi\x1b',''));
});
test('guide creation uses a dedicated unfocused workspace and persists character routing before startup',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'rg-guide-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const commands=[], prompts=[];let workspaceExists=false;
  const herdr={workspaces:async()=>workspaceExists?[{workspace_id:'wG'}]:[],command:async args=>{
    commands.push(args);
    if(args[0]==='workspace'){workspaceExists=true;return{workspace:{workspace_id:'wG'},root_pane:{pane_id:'wG:p1',terminal_id:'t1'}};}
    if(args[0]==='tab')return{tab:{workspace_id:'wG'},root_pane:{pane_id:'wG:p2',terminal_id:'t2'}};
    const registry=JSON.parse(await fs.readFile(path.join(directory,'sessions.json'),'utf8'));assert.ok(registry['Player-1-abc'].pane);
    return{};
  },prompt:async(...args)=>prompts.push(args)};
  const guide=new GuideSessions({herdr,directory});await guide.init();await guide.create('Player-1-abc','Help with this quest','Quest 123');
  assert.ok(commands[0].includes('--no-focus'));assert.ok(commands[0].includes(directory));assert.equal(prompts[0][0],'wG:p1');
  const restored=new GuideSessions({herdr,directory});await restored.init();assert.equal(restored.binding('Player-1-abc').pane,'wG:p1');
  await restored.create('Player-1-abc','A fresh guide chat','');assert.equal(restored.binding('Player-1-abc').pane,'wG:p2');assert.equal(commands[2][0],'tab');
  assert.equal(restored.binding('__proto__'),undefined);
});
test('guide start and question actions cannot target a work chat or another character',async t=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'rg-guide-controller-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const game={pane_id:'wG:p1',terminal_id:'tg',agent:'codex',agent_status:'idle',cwd:'/guide',workspace_id:'wG',state_change_seq:1};
  const work={...game,pane_id:'wW:p1',terminal_id:'tw',cwd:'/work',workspace_id:'wW'};const prompts=[],created=[];
  const herdr={agents:async()=>[game,work],workspaces:async()=>[],get:async p=>p===game.pane_id?game:work,read:async()=> 'Current screen',prompt:async(...args)=>prompts.push(args)};
  const guide={binding:key=>key==='Player-1-abc'?{pane:game.pane_id,terminal:game.terminal_id}:null,create:async(...args)=>{created.push(args);return{pane:game.pane_id,message:'Created'};}};
  const c=new Controller({herdr,guide,roamgate:{history:async()=>({entries:[]})},journal:path.join(directory,'journal.json')});await c.init();
  const view={nonce:'0123456789abcdef',id:0,slot:1,op:'view',scope:'guide',character:'Player-1-abc',pane:work.pane_id,text:'terminal',extra:'',visible:true};
  const data=await c.handle(view);assert.equal(data.selected.pane,game.pane_id);
  const send={...view,id:1,op:'guide_message',pane:game.pane_id,terminal:game.terminal_id,proof:data.selected.proof,text:'What next?',extra:'Quest details'};
  assert.equal((await c.handle(send)).ack.state,'ok');assert.equal(prompts[0][0],game.pane_id);assert.match(prompts[0][1],/Quest details/);
  const bad=await c.handle({...send,id:2,pane:work.pane_id,terminal:work.terminal_id});assert.equal(bad.ack.state,'error');assert.equal(prompts.length,1);
  const other=await c.handle({...send,id:3,character:'Player-2-other'});assert.equal(other.ack.state,'error');assert.equal(prompts.length,1);
  const fresh=await c.handle(view);const start={...view,id:4,op:'guide_new',pane:'',terminal:'',proof:fresh.guideStartProof,text:'Tell me about my character'};
  await c.handle(start);await c.handle(start);assert.equal(created.length,1);
  const wrong=await c.handle({...start,id:5,character:'Player-2-other'});assert.equal(wrong.ack.state,'error');assert.equal(created.length,1);
});
