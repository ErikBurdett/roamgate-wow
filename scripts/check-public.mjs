import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// A conservative release hygiene check, not a comprehensive secret scanner.
const git = args => execFileSync('git',args,{encoding:'utf8',maxBuffer:32*1024*1024});
const hasGit=await fs.stat('.git').then(()=>true,()=>false);
async function sourceFiles(directory='.') {
  const files=[];
  for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
    if(['.git','node_modules','.local-data','.cache','dist','WTF','Screenshots','SavedVariables'].includes(entry.name) || entry.name.startsWith('.env'))continue;
    const file=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...await sourceFiles(file));else if(entry.isFile())files.push(file);
  }
  return files;
}
const files=hasGit ? [...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean))] : await sourceFiles();
const failures=[];
const privatePath=/(^|\/)(\.local-data|node_modules|dist|\.cache|WTF|Screenshots|SavedVariables)(\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)RoamgateData\d+\//;
const credentials=[/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:ghp_|github_pat_)[a-zA-Z0-9_]{25,}/,/\bsk-(?:proj-|ant-)[a-zA-Z0-9_-]{30,}/,/\bAKIA[0-9A-Z]{16}\b/,/\bxox[baprs]-[a-zA-Z0-9-]{20,}/];
function inspect(name,buffer) {
  if(buffer.includes(0))return; // Font/binary content is reviewed via its license.
  const text=buffer.toString('utf8');
  if(credentials.some(re=>re.test(text)))failures.push(`${name}: possible credential (value withheld)`);
  if(/\/home\/[a-zA-Z0-9_-]+\//.test(text))failures.push(`${name}: machine-specific absolute home path`);
}
for(const file of files) {
  if(privatePath.test(file) && !file.endsWith('.env.example'))failures.push(`${file}: private/generated path`);
  let buffer;try{buffer=await fs.readFile(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
  inspect(file,buffer);
  if(file.endsWith('.md')) {
    for(const match of buffer.toString('utf8').matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      const target=match[1];if(/^(?:[a-z]+:|#)/i.test(target))continue;
      const local=decodeURIComponent(target.split('#')[0]);
      try{await fs.access(path.resolve(path.dirname(file),local));}catch{failures.push(`${file}: missing local link ${target}`);}
    }
  }
}
let historical=0;
if(process.argv.includes('--history')) {
  if(!hasGit)throw Error('History checks require a Git clone; this source copy has no .git metadata.');
  const seen=new Set();
  for(const line of git(['rev-list','--objects','--all']).split('\n')) {
    const split=line.indexOf(' ');if(split<0)continue;
    const oid=line.slice(0,split),name=line.slice(split+1);
    if(privatePath.test(name) && !name.endsWith('.env.example'))failures.push(`history ${oid.slice(0,8)} ${name}: private/generated path`);
    if(seen.has(oid) || git(['cat-file','-t',oid]).trim()!=='blob')continue;seen.add(oid);
    inspect(`history ${oid.slice(0,8)} ${name}`,execFileSync('git',['cat-file','blob',oid],{maxBuffer:32*1024*1024}));historical++;
  }
}
if(failures.length) {console.error([...new Set(failures)].join('\n'));process.exitCode=1;}
else console.log(`Public checks passed: ${files.length} paths${historical ? `; ${historical} historical blobs` : ''}. No flagged private paths, common credential patterns or broken local Markdown links. Manual review is still required.`);
