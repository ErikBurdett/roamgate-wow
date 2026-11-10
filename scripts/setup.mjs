import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readConfig} from '../bridge/config.mjs';
import {installOptions} from './options.mjs';
import {preflight} from './preflight.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.includes('--help')){console.log('npm run setup -- [--addon-dir PATH] [--origin URL] [--slots N] [--read-only|--interactive] [--foreground] [--json] [--install]\nWithout --install, checks prerequisites and prints a plan without changes.\n--foreground skips service requirements; use npm start after installation.\nLua and development tools are not required for normal installation.');process.exit(0);}
const foreground=args.includes('--foreground'),json=args.includes('--json');
const filtered=args.filter(a=>!['--foreground','--json'].includes(a));
if(filtered.some(a=>['--stage','--service','--restore'].includes(a)))throw Error('Use --foreground to select a terminal companion; setup does not stage or restore releases.');
const {config,install}=installOptions(filtered,await readConfig(root));
const result=await preflight({root,config,foreground});
const installArgs=['scripts/install.mjs','--addon-dir',config.addonDir,'--origin',config.origin,'--slots',String(config.slots),config.mode==='read-only'?'--read-only':'--interactive',...(!foreground?['--service']:[])];
result.plan={executable:process.execPath,args:installArgs};
if(install && result.ready) {
  try{result.installation={state:'installed',summary:execFileSync(process.execPath,[...installArgs,'--install'],{cwd:root,encoding:'utf8',maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']})};}
  catch{result.installation={state:'failed',detail:'Installer failed. Run the printed plan directly for details; existing backups and state are retained.'};process.exitCode=1;}
}
if(!result.ready)process.exitCode=1;
if(json)console.log(JSON.stringify(result,null,2));
else {
  for(const c of result.checks)console.log(`${c.status.toUpperCase()} ${c.id}: ${c.detail}${c.fix?' — '+c.fix:''}`);
  const quote=s=>"'"+s.replaceAll("'","'\"'\"'")+"'";
  console.log('\nPlan: '+[process.execPath,...installArgs].map(quote).join(' '));
  console.log(result.installation?.summary || result.installation?.detail || (result.ready?'Ready. Re-run setup with --install to apply this plan.':'Resolve failed checks, then run setup again.'));
}
