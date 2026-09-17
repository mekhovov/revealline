from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, unquote
from collections import OrderedDict
import subprocess, hashlib, json, mimetypes, threading, os, argparse, re, time
from datetime import datetime, timezone
ROOT=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test')
OUT=Path(__file__).resolve().parent
parser=argparse.ArgumentParser()
parser.add_argument('--commit', required=True)
COMMIT=parser.parse_args().commit
assert re.fullmatch('[0-9a-f]{40}', COMMIT), 'Use the actual committed source'

def git(*args):
    return subprocess.check_output(['git','--no-optional-locks',*args],cwd=ROOT)
TREE=git('rev-parse',COMMIT+'^{tree}').decode().strip()
paths={}
for row in git('ls-tree','-r','-z',COMMIT).split(b'\0'):
    if not row: continue
    info,name=row.split(b'\t',1)
    mode,kind,oid=info.decode().split()
    name=name.decode()
    if mode in ('100644','100755') and kind=='blob' and name.startswith(('game/','authoring/','docs/')): paths[name]=oid
override_spec=json.loads((OUT/'runtime-overrides.json').read_text())
overrides={}
for name,row in override_spec['files'].items():
    body=Path(row['file']).read_bytes()
    assert len(body)==row['bytes'] and hashlib.sha256(body).hexdigest()==row['sha256']
    overrides[name]=body; paths[name]='PINNED_OVERRIDE'

cache=OrderedDict(); lock=threading.Lock(); budget=32*1024*1024
log=(OUT/'requests.jsonl').open('x')
def blob(path):
    if path in overrides: return overrides[path]
    with lock:
        if path in cache:
            body=cache.pop(path); cache[path]=body; return body
        oid=paths[path]
        size=int(git('cat-file','-s',oid))
        if size>64*1024*1024: raise ValueError('file exceeds review budget')
        body=git('cat-file','blob',oid)
        if len(body)!=size or hashlib.sha1(b'blob '+str(size).encode()+b'\0'+body).hexdigest()!=oid: raise ValueError('Git bytes differ')
        while cache and sum(map(len,cache.values()))+size>budget: cache.popitem(last=False)
        if size<=budget: cache[path]=body
        return body
class Handler(BaseHTTPRequestHandler):
    def do_HEAD(self): self.serve(False)
    def do_GET(self): self.serve(True)
    def log_message(self,*args): pass
    def serve(self,send):
        if self.headers.get('Host')!='127.0.0.1:'+str(self.server.server_port): self.send_error(403); return
        name=unquote(urlsplit(self.path).path).lstrip('/')
        if not name: name='game/'
        if name.endswith('/'): name+='index.html'
        if name not in paths: self.send_error(404); return
        faults=json.loads((OUT/'faults.json').read_text())
        delay=float(faults.get('delay',{}).get(name,0))
        if delay:
            assert 0 < delay <= 30
            with lock:
                log.write(json.dumps({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'delaySeconds':delay,'source':'explicit-server-delay'})+'\n'); log.flush()
            time.sleep(delay)
        if name in faults.get('fail',[]):
            with lock:
                log.write(json.dumps({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'method':self.command,'status':503,'source':'explicit-server-fault'})+'\n'); log.flush()
            self.send_error(503,'Explicit native verification fault'); return
        try: body=blob(name)
        except (ValueError,subprocess.CalledProcessError): self.send_error(413); return
        kind='text/javascript' if name.endswith('.mjs') else mimetypes.guess_type(name)[0] or 'application/octet-stream'
        self.send_response(200); self.send_header('Content-Type',kind); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store'); self.end_headers()
        with lock:
            log.write(json.dumps({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'method':self.command,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'source':'candidate-override' if name in overrides else 'exact-git'})+'\n'); log.flush()
        if send:
            try: self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError): pass
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
server.daemon_threads=True
binding={'commit':COMMIT,'tree':TREE,'pid':os.getpid(),'port':server.server_port,'url':'http://127.0.0.1:'+str(server.server_port)+'/game/','scope':override_spec['scope'],'runtimeOverrides':override_spec['files']}
(OUT/'binding.json').write_text(json.dumps(binding,indent=2)+'\n')
print(json.dumps(binding),flush=True)
try: server.serve_forever()
finally: server.server_close(); log.close()
