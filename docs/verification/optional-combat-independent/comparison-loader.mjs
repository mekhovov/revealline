import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='/Users/oleksandr.mekhovov/work/my_projects/go_test';
const prefix=new URL('./source/',import.meta.url).href;
const previous=new URL('./previous/',import.meta.url).href;
const cache=new Map();
export async function resolve(specifier,context,next){
 if((specifier.startsWith(prefix)||specifier.startsWith(previous)))return {url:specifier,shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL){const url=new URL(specifier,context.parentURL).href;if(url.startsWith(prefix)||url.startsWith(previous))return {url,shortCircuit:true};}
 return next(specifier,context);
}
export async function load(url,context,next){
 if(!url.startsWith(prefix)&&!url.startsWith(previous))return next(url,context);
 const prior=url.startsWith(previous), ref=prior?'6ff7e3a3b4a883004280479a97afec9bfdc1f4b0':'851a21005ba9bae3d2846a31b5edf31101c832bd';
 const name=decodeURIComponent(url.slice((prior?previous:prefix).length).split('?')[0]);
 const key=ref+':'+name;
 if(!cache.has(key))cache.set(key,execFileSync('git',['show',key],{cwd:root,maxBuffer:16*1024*1024}));
 const source=cache.get(key);appendFileSync(process.env.RL_COMBAT_READS,JSON.stringify({ref,path:name,bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')})+'\n');
 return {format:name.endsWith('.json')?'json':'module',source,shortCircuit:true};
}
