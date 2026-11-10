import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const ID=/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;
const DEFAULT=['','Installed default'];
export const MODEL_CHOICES = [
  {kind:'codex',label:'Codex',defaultModel:'',models:[DEFAULT]},
  {kind:'claude',label:'Claude',defaultModel:'',models:[DEFAULT,['sonnet','Sonnet'],['opus','Opus'],['haiku','Haiku']]},
  {kind:'hermes',label:'Hermes',defaultModel:'',models:[DEFAULT]},
  {kind:'opencode',label:'OpenCode',defaultModel:'',models:[DEFAULT]},
];
function add(provider,id,label) {
  if(!ID.test(id) || typeof label!=='string' || !label || label.length>100 || /[\x00-\x1f\x7f]/.test(label))throw Error('Model entries require a plain model ID and label of at most 100 characters.');
  const existing=provider.models.find(entry=>entry[0]===id);
  if(existing){existing[1]=label;return;}
  if(provider.models.length>=100)throw Error('Limit each provider catalog to 99 named models.');
  provider.models.push([id,label]);
}
// Discovery is read-only and performed once at companion startup. Catalog entries
// are hints, not proof of account entitlement. Missing/stale caches never pick a model.
export async function loadModelChoices({codexCache=path.join(process.env.CODEX_HOME || path.join(os.homedir(),'.codex'),'models_cache.json'),overrideFile,claudeHelp}={}) {
  const choices=structuredClone(MODEL_CHOICES), warnings=[];
  try {
    const cached=JSON.parse(await fs.readFile(codexCache,'utf8'));
    for(const m of cached.models || [])if(m.visibility==='list' && ID.test(m.slug || ''))add(choices[0],m.slug,String(m.display_name || m.slug).slice(0,100));
  } catch(e) {if(e.code!=='ENOENT')warnings.push('Codex model cache could not be read; using installed default and configured choices.');}
  if(claudeHelp===undefined) {
    try {claudeHelp=(await exec('claude',['--help'],{timeout:5000,maxBuffer:256*1024})).stdout;}catch {claudeHelp='';}
  }
  if(/\bfable\b/i.test(claudeHelp))add(choices[1],'fable','Fable');
  if(overrideFile) {
    try {
      const custom=JSON.parse(await fs.readFile(overrideFile,'utf8'));
      if(!custom || typeof custom!=='object' || Array.isArray(custom))throw Error('Model configuration must be an object.');
      for(const [kind,models] of Object.entries(custom)) {
        const provider=choices.find(p=>p.kind===kind);
        if(!provider || !['codex','claude'].includes(kind) || !Array.isArray(models))throw Error('Configure codex or claude as arrays of {id,label} entries.');
        for(const model of models)add(provider,model.id,model.label || model.id);
      }
    } catch(e) {if(e.code!=='ENOENT')throw Error('Invalid local model catalog: '+e.message);}
  }
  return {choices,warnings};
}
export function modelSelection(kind, model = '', choices = MODEL_CHOICES) {
  const provider = choices.find(p => p.kind === kind);
  if (!provider || !provider.models.some(([id]) => id === model)) throw Error('Choose an available provider/model, use Installed default, or add this ID to .local-data/models.json.');
  return {kind, model};
}
export function modelArgs(kind, model = '', choices = MODEL_CHOICES) {
  modelSelection(kind, model,choices);
  return model ? ['--', '--model', model] : [];
}
