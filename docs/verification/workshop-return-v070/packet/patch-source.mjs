import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const manifest=JSON.parse(readFileSync(new URL('./source-manifest.json',import.meta.url)));
const patch=gunzipSync(readFileSync(new URL('./source.patch.gz',import.meta.url)), { maxOutputLength: 1024*1024 }).toString();
const root=fileURLToPath(new URL('../../',import.meta.url));
const cache=new Map();
const hash=b=>createHash('sha256').update(b).digest('hex');
export function sourceFor(name){
 if(cache.has(name))return Buffer.from(cache.get(name));
 if(!name||name.startsWith('/')||name.split('/').some(x=>x==='..'||!x))throw Error('Invalid source path');
 const spec=manifest.files[name];
 const before=spec?.new?Buffer.alloc(0):execFileSync('git',['--no-optional-locks','show',`${manifest.base}:${name}`],{cwd:root,maxBuffer:8*1024*1024,env:{...process.env,GIT_NO_LAZY_FETCH:'1',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});
 if(!spec){cache.set(name,before);return Buffer.from(before);}
 if(hash(before)!==spec.before)throw Error('Base bytes changed: '+name);
 const old=before.toString().split('\n');if(old.at(-1)==='')old.pop();
 const lines=patch.split('\n'), start=lines.indexOf('+++ b/'+name);if(start<0)throw Error('Missing patch: '+name);
 const out=[];let cursor=0;
 for(let i=start+1;i<lines.length;i++){
  const line=lines[i];if(line.startsWith('diff --git '))break;
  if(line.startsWith('@@')){const match=/^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@/.exec(line);if(!match)throw Error('Invalid hunk');const at=Math.max(0,Number(match[1])-1);if(at<cursor)throw Error('Overlapping hunk');out.push(...old.slice(cursor,at));cursor=at;}
  else if(line.startsWith('+'))out.push(line.slice(1));
  else if(line.startsWith('-')||line.startsWith(' ')){if(old[cursor]!==line.slice(1))throw Error('Hunk mismatch: '+name);if(line[0]===' ')out.push(old[cursor]);cursor++;}
  else if(line)throw Error('Unsupported patch marker');
 }
 out.push(...old.slice(cursor));const result=Buffer.from(out.join('\n')+'\n');
 if(result.length!==spec.bytes||hash(result)!==spec.after)throw Error('Postimage mismatch: '+name);
 cache.set(name,result);return Buffer.from(result);
}
