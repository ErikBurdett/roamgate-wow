import test from 'node:test';
import assert from 'node:assert/strict';
import {testModels} from './model-fixture.mjs';
import {Herdr} from '../bridge/herdr.mjs';
import {modelArgs,MODEL_CHOICES} from '../bridge/models.mjs';
test('new work chats pass the chosen model only to the new process',async()=>{
  for(const [kind,model] of [['codex','gpt-6-astra'],['claude','fable'],['claude','sonnet'],['codex','']]){
    const h=new Herdr({modelChoices:testModels}),calls=[];
    h.command=async args=>{calls.push(args);return args[0]==='tab'?{root_pane:{pane_id:'w1:p2'}}:{};};
    await h.newChat({pane_id:'w1:p1',workspace_id:'w1',cwd:'/project'},'A literal task $HOME',kind,model);
    assert.equal(calls.length,3);assert.ok(calls[0].includes('--no-focus'));
    assert.deepEqual(calls[1].slice(3),['--kind',kind,'--pane','w1:p2',...(model?['--','--model',model]:[])]);
    assert.deepEqual(calls[2],['agent','prompt','w1:p2','A literal task $HOME']);
    assert.ok(calls.every(c=>!c.includes('w1:p1')));
  }
});
test('unsupported provider/model combinations fail before creating a tab',async()=>{
  const h=new Herdr({modelChoices:testModels});h.command=async()=>assert.fail('must not create anything');
  for(const [kind,model] of [['codex','fable'],['claude','gpt-6-astra'],['claude','sonnet --settings evil'],['hermes','fable'],['shell','']])await assert.rejects(h.newChat({},'task',kind,model),/available/);
  for(const p of MODEL_CHOICES)for(const [id] of p.models)assert.doesNotThrow(()=>modelArgs(p.kind,id));
});
