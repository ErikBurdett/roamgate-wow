import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {assertTree,hashes} from './install-state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.includes('--help')){console.log('npm run package\nBuilds a complete versioned Linux source/runtime tar.gz under dist/, including locked production dependencies, docs and licenses.\nNo credentials, installation snapshots or game data are included. Requires npm, network access for npm ci, and GNU tar.');process.exit(0);}
if(args.length)throw Error('Unknown release option. Use --help.');
execFileSync(process.execPath,['scripts/version.mjs','--check'],{cwd:root,stdio:'inherit'});
execFileSync(process.execPath,['scripts/check-public.mjs'],{cwd:root,stdio:'inherit'});
const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
const name=`roamgate-wow-${pkg.version}`,out=path.join(root,'dist');await fs.mkdir(out,{recursive:true});
const staging=await fs.mkdtemp(path.join(out,'.release-')),folder=path.join(staging,name);
try {
  await fs.mkdir(folder);
  for(const file of ['addon','bridge','scripts','docs','tests','.github','.gitignore','.gitattributes','AGENTS.md','README.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY_NOTICES.md','CHANGELOG.md','LICENSE','package.json','package-lock.json']) {
    await assertTree(path.join(root,file));await fs.cp(path.join(root,file),path.join(folder,file),{recursive:true});
  }
  execFileSync('npm',['ci','--omit=dev','--ignore-scripts','--no-audit','--no-fund'],{cwd:folder,stdio:'inherit'});
  const files=await hashes(folder);
  const manifest={schemaVersion:1,name:pkg.name,version:pkg.version,platform:'linux-hyprland-wine',node:pkg.engines.node,files};
  await fs.writeFile(path.join(folder,'release-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const archive=path.join(out,`${name}.tar.gz`),temporary=path.join(staging,'release.tar.gz');
  execFileSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','-czf',temporary,'-C',staging,name],{stdio:'inherit'});
  await fs.rename(temporary,archive);
  const sum=crypto.createHash('sha256').update(await fs.readFile(archive)).digest('hex');
  await fs.writeFile(path.join(out,`${name}.sha256`),`${sum}  ${name}.tar.gz\n`);
  console.log(`Complete release: ${archive}\nSHA-256: ${sum}\nIncludes companion, addon sources, installer, production dependencies, docs and licenses.`);
} finally {await fs.rm(staging,{recursive:true,force:true});}
