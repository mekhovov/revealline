import {execFileSync} from 'node:child_process';
import {appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='/Users/oleksandr.mekhovov/work/my_projects/go_test';
const prefix=new URL('./source/',import.meta.url).href;
const cache=new Map();
export async function resolve(specifier,context,next){
 if(specifier.startsWith(prefix))return {url:specifier,shortCircuit:true};
 if(specifier.startsWith('.')&&context.parentURL?.startsWith(prefix))return {url:new URL(specifier,context.parentURL).href,shortCircuit:true};
 return next(specifier,context);
}
export async function load(url,context,next){
 if(!url.startsWith(prefix))return next(url,context);
 const name=decodeURIComponent(url.slice(prefix.length).split('?')[0]);
 if(!cache.has(name))cache.set(name,execFileSync('git',['show','851a21005ba9bae3d2846a31b5edf31101c832bd:'+name],{cwd:root,maxBuffer:16*1024*1024}));
 const source=cache.get(name);appendFileSync(process.env.RL_COMBAT_READS,JSON.stringify({path:name,bytes:source.length,sha256:createHash('sha256').update(source).digest('hex')})+'\n');
 return {format:name.endsWith('.json')?'json':'module',source,shortCircuit:true};
}
