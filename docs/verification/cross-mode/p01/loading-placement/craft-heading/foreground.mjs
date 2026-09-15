/** Exact owned foreground only. Prepared helper; does nothing until actual launch/server receipts exist. */
import fs from 'node:fs';
import path from 'node:path';
const P=path.dirname(new URL(import.meta.url).pathname),R=path.join(P,'run');
const [mode,label='explicit']=process.argv.slice(2);
if(!['bind','bring','check'].includes(mode))throw Error('Explicit bind/bring/check only');
const launch=JSON.parse(fs.readFileSync(path.join(R,'launch.json'))),server=JSON.parse(fs.readFileSync(path.join(R,'server.json')));
process.kill(launch.pid,0);
const socket=new WebSocket(launch.endpoint);let next=0;const pending=new Map();
const timer=setTimeout(()=>{socket.close();console.error('Bounded foreground check timed out');process.exitCode=1;},4000);
await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j});
socket.onmessage=({data})=>{const e=JSON.parse(data),p=pending.get(e.id);if(p){pending.delete(e.id);e.error?p.reject(Error(JSON.stringify(e.error))):p.resolve(e.result);}};
const call=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++next;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
try {
 const args=(await call('Browser.getBrowserCommandLine')).arguments;
 if(!args.includes('--user-data-dir='+launch.profile))throw Error('Owned profile differs');
 const targets=(await call('Target.getTargets')).targetInfos;
 let owned;
 if(mode==='bind'){
  const exact=targets.filter(t=>t.type==='page'&&t.url===server.url+'/game/');
  if(exact.length!==1)throw Error('Exact owned URL not unique');
  owned={targetId:exact[0].targetId,url:exact[0].url,profile:launch.profile,endpoint:launch.endpoint};
  fs.writeFileSync(path.join(R,'owned-target.json'),JSON.stringify(owned,null,2)+'\n',{flag:'wx'});
 }else owned=JSON.parse(fs.readFileSync(path.join(R,'owned-target.json')));
 if(owned.profile!==launch.profile||owned.endpoint!==launch.endpoint)throw Error('Bound target launch differs');
 const otherPages=targets.filter(t=>t.type==='page'&&t.targetId!==owned.targetId);
 if(otherPages.length){fs.appendFileSync(path.join(R,'foreground-checks.jsonl'),JSON.stringify({at:new Date().toISOString(),mode,label,owned,unexpectedPages:otherPages})+'\n');throw Error('Unexpected page target in owned browser; stop without activating another page');}
 const target=targets.find(t=>t.targetId===owned.targetId&&t.url===owned.url&&t.type==='page');
 if(!target)throw Error('Bound target changed or closed');
 const sid=(await call('Target.attachToTarget',{targetId:owned.targetId,flatten:true})).sessionId;
 if(mode==='bring'||mode==='bind')await call('Page.bringToFront',{},sid);
 const r=await call('Runtime.evaluate',{expression:'({url:location.href,visibility:document.visibilityState,hasFocus:document.hasFocus(),active:document.activeElement?.id,at:Date.now()})',returnByValue:true},sid);
 const state=r.result?.value;
 const record={at:new Date().toISOString(),mode,label,owned,state,targets};
 fs.appendFileSync(path.join(R,'foreground-checks.jsonl'),JSON.stringify(record)+'\n');
 if(state?.url!==owned.url||state.visibility!=='visible'||state.hasFocus!==true)throw Error('Bound page not foreground-visible; stop, preserve, no automatic retry');
 await call('Target.detachFromTarget',{sessionId:sid});
 console.log(JSON.stringify({passed:true,mode,label,targetId:owned.targetId,state}));
} finally {clearTimeout(timer);socket.close();}
