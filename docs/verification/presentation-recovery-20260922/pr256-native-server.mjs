import http from 'node:http';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source='3563ef77344de3b7fa27263cefd90a38a4326be1', cache=new Map(), requests=[];
const sha=b=>createHash('sha256').update(b).digest('hex');
const mime={html:'text/html',mjs:'text/javascript',js:'text/javascript',json:'application/json',css:'text/css',png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml',woff2:'font/woff2',wav:'audio/wav',mp3:'audio/mpeg'};
const server=http.createServer((req,res)=>{let path;try{
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 path=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).slice(1);
 if(path==='__evidence'){res.writeHead(200,{'content-type':'application/json'}).end(JSON.stringify({source,requests}));return;}
 if(path.endsWith('/'))path+='index.html';
 if(!/^(game|authoring|site)\//.test(path)||path.split('/').includes('..')||path==='game/build-info.json'){res.writeHead(404).end();return;}
 let entry=cache.get(path);if(!entry){let bytes,origin;
 if(path==='game/vendor/phaser-4.2.1.min.js'){bytes=readFileSync('.cache/toolchain-v065-45f4/node_modules/phaser/dist/phaser.min.js');origin='installed-phaser-4.2.1';}
 else{bytes=execFileSync('git',['show',source+':'+path],{maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']});origin='exact-git-source';}
 entry={bytes,origin,sha256:sha(bytes)};cache.set(path,entry);}
 requests.push({path,status:200,bytes:entry.bytes.length,sha256:entry.sha256,origin:entry.origin});res.writeHead(200,{'content-type':mime[path.split('.').at(-1)]??'application/octet-stream','cache-control':'no-store'}).end(req.method==='HEAD'?undefined:entry.bytes);
 }catch(e){requests.push({path,status:404,error:'source unavailable'});res.writeHead(404).end();}});
server.listen(0,'127.0.0.1',()=>console.log(JSON.stringify({port:server.address().port,pid:process.pid,source})));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));