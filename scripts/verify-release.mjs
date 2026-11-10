import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hashes} from './install-state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'release-manifest.json'),'utf8'));
if(manifest.schemaVersion!==1 || manifest.name!=='roamgate-wow' || !manifest.files || typeof manifest.files!=='object')throw Error('Invalid release manifest.');
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
if(pkg.version!==manifest.version)throw Error('Release version mismatch.');
// Run on the fresh extraction, before setup creates private local state.
const actual=await hashes(root);delete actual['release-manifest.json'];
if(Object.keys(actual).length!==Object.keys(manifest.files).length || Object.entries(actual).some(([file,sum])=>manifest.files[file]!==sum))throw Error('Release contents differ from the manifest. Verify a fresh extraction.');
console.log(`Verified ${manifest.name} ${manifest.version}: ${Object.keys(actual).length} files.`);
