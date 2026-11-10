// Per-invocation choices only. Never write provider settings or issue /model.
// Codex IDs verified against the installed model catalog; Claude uses CLI aliases.
export const MODEL_CHOICES = [
  {kind:'codex', label:'Codex', defaultModel:'gpt-6-astra', models:[
    ['gpt-6-astra','GPT-6 Astra'], ['gpt-6.1-sol','GPT-6.1 Sol'],
    ['gpt-6.1-terra','GPT-6.1 Terra'], ['gpt-6-sol','GPT-6 Sol'],
    ['gpt-6-luna','GPT-6 Luna'], ['', 'Installed default'],
  ]},
  {kind:'claude', label:'Claude', defaultModel:'sonnet', models:[
    ['sonnet','Sonnet'], ['haiku','Haiku'], ['opus','Opus'], ['fable','Fable'], ['', 'Installed default'],
  ]},
  {kind:'hermes', label:'Hermes', defaultModel:'', models:[['','Installed default']]},
  {kind:'opencode', label:'OpenCode', defaultModel:'', models:[['','Installed default']]},
];
export function modelSelection(kind, model = '') {
  const provider = MODEL_CHOICES.find(p => p.kind === kind);
  if (!provider || !provider.models.some(([id]) => id === model)) throw Error('Choose a supported provider and model for this new chat.');
  return {kind, model};
}
export function modelArgs(kind, model = '') {
  modelSelection(kind, model);
  return model ? ['--', '--model', model] : [];
}
