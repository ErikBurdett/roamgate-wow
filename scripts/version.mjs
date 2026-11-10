import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw Error('Invalid release version.');
const config=`local _, RG = ...\nRG.SLOT_COUNT = 2048\nRG.VERSION = "${version}"\n`;
const tocFile=path.join(root,'addon/Roamgate/Roamgate.toc');
const toc=(await fs.readFile(tocFile,'utf8')).replace(/^## Version:.*$/m,`## Version: ${version}`);
const lockFile=path.join(root,'package-lock.json'),lock=JSON.parse(await fs.readFile(lockFile,'utf8'));
const staleLock=lock.version!==version || lock.packages[''].version!==version;lock.version=version;lock.packages[''].version=version;
let stale=staleLock;
for(const [file,text] of [[path.join(root,'addon/Roamgate/Config.lua'),config],[tocFile,toc]]) {
  if(await fs.readFile(file,'utf8')!==text){stale=true;if(!process.argv.includes('--check'))await fs.writeFile(file,text);}
}
if(process.argv.includes('--check') && stale)throw Error('Generated versions differ from package.json. Run npm run version:sync.');
if(staleLock && !process.argv.includes('--check'))await fs.writeFile(lockFile,JSON.stringify(lock,null,2)+'\n');
console.log(`Version ${version}: ${stale && !process.argv.includes('--check')?'synchronized':'consistent'}`);
