import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {uninstall,uninstallPlan} from './lifecycle.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.includes('--help')){console.log('npm run uninstall -- [--apply]\nWithout --apply, prints the owned paths and preservation plan.\nWith --apply, stops only the owned companion and moves its addon files to a private recovery directory. Drafts, history and settings are retained.');process.exit(0);}
if(args.some(a=>a!=='--apply'))throw Error('Unknown option. Use --help.');
if(args.includes('--apply'))console.log(JSON.stringify(await uninstall(root),null,2));
else {const {unit,...plan}=await uninstallPlan(root);console.log(JSON.stringify(plan,null,2));}
