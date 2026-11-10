import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Desktop} from '../bridge/desktop.mjs';
const exec=promisify(execFile);
async function discoverDesktop(){const desktop=new Desktop();await desktop.discover();return desktop.env;}
export async function findProgram(name,searchPath=process.env.PATH || '') {
  for(const dir of searchPath.split(path.delimiter).filter(Boolean)) {
    const file=path.join(dir,name);try{await fs.access(file,fs.constants.X_OK);return file;}catch {}
  }
  return null;
}
export async function preflight({root,config,foreground=false,platform=process.platform,node=process.versions.node,find=findProgram,discover=discoverDesktop,run=(file,args,options={})=>exec(file,args,{timeout:6000,maxBuffer:512*1024,...options}),connect}={}) {
  const checks=[];
  const add=(id,ok,detail,fix)=>checks.push({id,status:ok?'pass':'fail',detail,...(!ok?{fix}:{})});
  add('platform',platform==='linux','Linux/Hyprland capture adapter','Use a supported Linux Hyprland desktop; other platforms require an adapter.');
  add('node',Number(node.split('.')[0])>=22,`Node ${node}`,'Install Node.js 22 or newer.');
  const programs={};
  for(const name of ['herdr','hyprctl','grim',...(!foreground?['systemctl','systemd-analyze']:[])]) {
    programs[name]=await find(name);add(name,!!programs[name],programs[name]?'Command found':'Command missing',`Install ${name} or add its directory to PATH.`);
  }
  const validDir=await fs.stat(config.addonDir).then(s=>s.isDirectory(),()=>false);
  add('addon-directory',validDir,validDir?'Existing addon directory':'Addon directory missing','Pass --addon-dir with the actual WoW Forever Interface/AddOns path.');
  try{if(!programs.hyprctl)throw Error();const env=await discover();await run(programs.hyprctl,['-j','version'],{env});add('hyprland-session',true,'Hyprland responds');}
  catch{add('hyprland-session',false,'Hyprland session unavailable','Run setup from the intended graphical session.');}
  try{if(!programs.herdr)throw Error();await run(programs.herdr,['agent','list']);add('herdr-connection',true,'Local Herdr responds; no input sent');}
  catch{add('herdr-connection',false,'Herdr unavailable','Start your existing Herdr server and check herdr agent list.');}
  if(!foreground) {
    try{if(!programs.systemctl)throw Error();await run(programs.systemctl,['--user','show-environment']);add('user-service-manager',true,'User service manager responds');}
    catch{add('user-service-manager',false,'User service manager unavailable','Use a graphical user session or --foreground for a terminal companion.');}
  }
  let dependencies=false;
  try {await fs.access(path.join(root,'node_modules/ws/package.json'));dependencies=true;}catch {}
  add('dependencies',dependencies,dependencies?'Runtime dependency present':'Runtime dependency missing','Run npm ci --omit=dev --ignore-scripts, or use the complete release bundle.');
  if(dependencies) {
    try {
      if(connect)await connect(config.origin);
      else {const {Roamgate}=await import('../bridge/roamgate.mjs');const r=new Roamgate({origin:config.origin});try{await r.connect();}finally{r.close();}}
      add('roamgate-connection',true,'Authenticated local Roamgate connection; no input sent');
    } catch {add('roamgate-connection',false,'Roamgate local connection unavailable','Check the existing Roamgate browser client, local origin and standard credential/socket locations. Do not paste credentials into setup.');}
  }
  checks.push({id:'game-build',status:'warn',detail:'Confirm WoW Forever interface 16001 in game. Directory detection does not verify the game build.'});
  return {schemaVersion:1,ready:checks.every(c=>c.status!=='fail'),checks,config,foreground};
}
