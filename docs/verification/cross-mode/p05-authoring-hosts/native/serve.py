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
PLAN=json.loads((OUT/'binding-proposal.json').read_text())
assert COMMIT==PLAN['commit'] and re.fullmatch('[0-9a-f]{40}', COMMIT), 'Use the exact reviewed base'
PORT=PLAN['port']
assert isinstance(PORT,int) and 1024 <= PORT <= 65535

def git(*args):
    return subprocess.check_output(['git','--no-optional-locks',*args],cwd=ROOT)
TREE=git('rev-parse',COMMIT+'^{tree}').decode().strip()
assert TREE==PLAN['tree']
paths={}
for row in git('ls-tree','-r','-z',COMMIT).split(b'\0'):
    if not row: continue
    info,name=row.split(b'\t',1)
    mode,kind,oid=info.decode().split()
    name=name.decode()
    if mode in ('100644','100755') and kind=='blob' and name.startswith(('game/','authoring/','docs/')): paths[name]=oid
override_bytes=(OUT/'runtime-overrides.json').read_bytes()
assert len(override_bytes)==PLAN['runtimeOverrides']['bytes'] and hashlib.sha256(override_bytes).hexdigest()==PLAN['runtimeOverrides']['sha256']
override_spec=json.loads(override_bytes)
assert override_spec['base']==COMMIT and override_spec['baseTree']==TREE
overrides={}
for name,row in override_spec['files'].items():
    body=Path(row['file']).read_bytes()
    assert len(body)==row['bytes'] and hashlib.sha256(body).hexdigest()==row['sha256']
    overrides[name]=body; paths[name]='PINNED_OVERRIDE'

cache=OrderedDict(); lock=threading.Lock(); budget=32*1024*1024
log=(OUT/'requests.jsonl').open('x')
log_bytes=0; log_events=0
FAULT_PATH='authoring/viewport-lab/browser.mjs'
def record(event):
    global log_bytes, log_events
    encoded=json.dumps(event)+'\n'; size=len(encoded.encode())
    with lock:
        if log_bytes+size>PLAN['limits']['requestLogBytes'] or log_events>=PLAN['limits']['requestEvents']:
            raise ValueError('Verification request log budget exhausted; stop and preserve this run')
        log.write(encoded); log.flush(); log_bytes+=size; log_events+=1

def read_faults():
    raw=(OUT/'faults.json').read_bytes()
    if len(raw)>1024: raise ValueError('Fault configuration too large')
    value=json.loads(raw)
    if not isinstance(value,dict) or set(value)-{'delay','fail'}: raise ValueError('Unknown fault setting')
    delays=value.get('delay',{}); failures=value.get('fail',[])
    if not isinstance(delays,dict) or set(delays)-{FAULT_PATH}: raise ValueError('Fault delay outside reviewed module')
    if not isinstance(failures,list) or len(failures)>1 or any(x!=FAULT_PATH for x in failures): raise ValueError('Fault failure outside reviewed module')
    for delay in delays.values():
        if isinstance(delay,bool) or not isinstance(delay,(int,float)) or not 0<delay<=30: raise ValueError('Invalid delay')
    return value,hashlib.sha256(raw).hexdigest()

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
        if len(self.path)>2048: self.send_error(414); return
        try:
            faults,fault_hash=read_faults()
            delay=faults.get('delay',{}).get(name,0)
            if delay:
                record({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'delaySeconds':delay,'source':'explicit-server-delay','faultConfigSha256':fault_hash})
                time.sleep(delay)
            if name in faults.get('fail',[]):
                record({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'method':self.command,'status':503,'source':'explicit-server-fault','faultConfigSha256':fault_hash})
                self.send_error(503,'Explicit native verification fault'); return
        except (ValueError,OSError): self.send_error(503,'Invalid or exhausted local verification control'); return
        try: body=blob(name)
        except (ValueError,subprocess.CalledProcessError): self.send_error(413); return
        kind='text/javascript' if name.endswith('.mjs') else mimetypes.guess_type(name)[0] or 'application/octet-stream'
        try:
            record({'path':name,'request':self.path,'at':datetime.now(timezone.utc).isoformat(),'method':self.command,'status':200,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'source':'candidate-override' if name in overrides else 'exact-git','faultConfigSha256':fault_hash})
        except ValueError: self.send_error(503,'Verification request log budget exhausted'); return
        self.send_response(200); self.send_header('Content-Type',kind); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store'); self.end_headers()
        if send:
            try: self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError): pass
server=ThreadingHTTPServer(('127.0.0.1',PORT),Handler)
server.daemon_threads=True
binding={'commit':COMMIT,'tree':TREE,'pid':os.getpid(),'port':server.server_port,'url':'http://127.0.0.1:'+str(server.server_port)+'/game/','scope':override_spec['scope'],'runtimeOverrides':override_spec['files'],'urls':PLAN['urls'],'faultPath':FAULT_PATH,'limits':PLAN['limits']}
with (OUT/'binding.json').open('x') as binding_file: binding_file.write(json.dumps(binding,indent=2)+'\n')
print(json.dumps(binding),flush=True)
try: server.serve_forever()
finally: server.server_close(); log.close()
