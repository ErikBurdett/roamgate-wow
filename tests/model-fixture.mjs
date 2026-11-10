import {MODEL_CHOICES} from '../bridge/models.mjs';
export const testModels=structuredClone(MODEL_CHOICES);
testModels[0].models.push(['gpt-6-astra','Test Astra']);
testModels[1].models.push(['fable','Test Fable']);
