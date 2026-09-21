import {readFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const mapping=JSON.parse(await readFile(process.env.REVEALLINE_FIXTURE_MAP));
export async function load(url,context,nextLoad){
 const entry=mapping[url]; let result;
 if(entry){
  const source=await readFile(new URL(entry.file));
  if(createHash('sha256').update(source).digest('hex')!==entry.sha256)throw new Error('Changed committed fixture '+url);
  result={format:'module',source,shortCircuit:true};
 }else result=await nextLoad(url,context);
 if(result.source&&url.startsWith('file:'))await appendFile(process.env.REVEALLINE_FIXTURE_MODULES,JSON.stringify({url,candidate:!!entry,sha256:createHash('sha256').update(result.source).digest('hex')})+'\n');
 return result;
}
