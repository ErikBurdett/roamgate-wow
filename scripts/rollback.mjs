import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {listSnapshots,readSnapshot} from './install-state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length===0 || args[0]==='--list'){console.log(JSON.stringify(await listSnapshots(root),null,2));process.exit(0);}
if(args[0]==='--help'){console.log('npm run rollback -- --list\nnpm run rollback -- --to ID [--apply]\nPlans restore a verified companion/addon pair, prior slot count, mode and origin. Chat history, drafts and journals are preserved. Legacy addon-only backups cannot restore a complete runtime.');process.exit(0);}
if(args[0]!=='--to' || !args[1] || args.length>3 || (args[2] && args[2]!=='--apply'))throw Error('Use --to ID [--apply].');
const {manifest}=await readSnapshot(root,args[1]);
if(args[2]!=='--apply')console.log(JSON.stringify({action:'rollback plan (no changes)',id:manifest.id,version:manifest.version,config:manifest.config,preserves:['chat history','drafts','action journal'],command:'Add --apply to restore this verified version.'},null,2));
else execFileSync(process.execPath,[path.join(root,'scripts/install.mjs'),'--restore',manifest.id],{stdio:'inherit'});
