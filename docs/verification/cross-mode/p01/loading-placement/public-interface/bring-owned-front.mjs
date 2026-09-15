import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),label=process.argv[2];
if(!/^[a-z0-9-]+$/.test(label))throw Error('Explicit receipt name required');
const launch=JSON.parse(fs.readFileSync(path.join(dir,'online-1-launch.json'))),target='42A5C65D96BC4675CC1BDCBEE6C2FB9A';
if(launch.profile!==path.join(dir,'profile')||launch.pid!==6209||launch.port!==51866)throw Error('Wrong own profile');
const socket=new WebSocket(launch.endpoint);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
let n=0;const pending=new Map();socket.addEventListener('message',e=>{const v=JSON.parse(String(e.data)),p=pending.get(v.id);if(p){clearTimeout(p.t);pending.delete(v.id);v.error?p.j(Error(v.error.message)):p.r(v.result);}});
const call=(method,params={},sessionId)=>new Promise((r,j)=>{const id=++n,t=setTimeout(()=>{pending.delete(id);j(Error('timeout '+method));},4000);pending.set(id,{r,j,t});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
try{const args=(await call('Browser.getBrowserCommandLine')).arguments;if(!args.includes('--user-data-dir='+launch.profile))throw Error('Actual profile mismatch');const ti=(await call('Target.getTargetInfo',{targetId:target})).targetInfo;if(ti.type!=='page'||ti.url!=='https://mekhovov.github.io/revealline/releases/v0.57.1/site/game/')throw Error('Wrong exact page');const {sessionId}=await call('Target.attachToTarget',{targetId:target,flatten:true});await call('Page.bringToFront',{},sessionId);const state=await call('Runtime.evaluate',{expression:'({url:location.href,visibilityState:document.visibilityState,hasFocus:document.hasFocus()})',returnByValue:true},sessionId);fs.writeFileSync(path.join(dir,label+'.json'),JSON.stringify({at:new Date().toISOString(),action:'Page.bringToFront',target,profile:launch.profile,state:state.result.value},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(state.result.value));await call('Target.detachFromTarget',{sessionId});}finally{socket.close();}
