import fs from 'node:fs';
const [file,out]=process.argv.slice(2), launch=JSON.parse(fs.readFileSync(file));
if(!launch.profile.endsWith('/.cache/cross-mode/p01/v0572/craft-heading-row-preparation/run/profile')||!launch.endpoint.startsWith('ws://127.0.0.1:'))throw Error('Wrong owned browser');
const socket=new WebSocket(launch.endpoint);await new Promise((yes,no)=>{socket.addEventListener('open',yes,{once:true});socket.addEventListener('error',no,{once:true});});
let id=0;const pending=new Map();socket.addEventListener('message',e=>{const v=JSON.parse(String(e.data));const p=pending.get(v.id);if(p){pending.delete(v.id);v.error?p.reject(Error(v.error.message)):p.resolve(v.result);}});
function call(method){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});socket.send(JSON.stringify({id:n,method}));});}
const args=(await call('Browser.getBrowserCommandLine')).arguments;if(!args.includes('--user-data-dir='+launch.profile))throw Error('Actual browser profile mismatch');
fs.writeFileSync(out,JSON.stringify({time:new Date().toISOString(),pid:launch.pid,endpoint:launch.endpoint,profile:launch.profile,actualArguments:args,action:'Browser.close',profileReset:false},null,2)+'\n',{flag:'wx'});
socket.send(JSON.stringify({id:++id,method:'Browser.close'}));await new Promise(resolve=>{socket.addEventListener('close',resolve,{once:true});setTimeout(resolve,5000);});socket.close();
