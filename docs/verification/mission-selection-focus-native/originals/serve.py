from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path, PurePosixPath
from urllib.parse import urlsplit, unquote
import subprocess, os, json, hashlib, mimetypes, shutil, threading, time
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent.parent
BASE='595fdadddf3cf5c4240c430b78d27772915df83d'
VARIANT=os.environ.get('RL_FONT_VARIANT','baseline')
assert VARIANT in ['baseline','candidate']
PINS_PATH=HERE/('native-pins-'+VARIANT+'.json')
PINS=json.loads(PINS_PATH.read_text())
ENV={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_OPTIONAL_LOCKS':'0','GIT_TERMINAL_PROMPT':'0'}
for key in ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_COMMON_DIR','GIT_NAMESPACE']: ENV.pop(key,None)
def git(*args):return subprocess.check_output(['git','--no-optional-locks',*args],cwd=ROOT,env=ENV,timeout=20)
sha=lambda b:hashlib.sha256(b).hexdigest()
OBJECTS={}
for row in git('ls-tree','-r','-z',BASE).split(b'\0'):
 if row:
  meta,name=row.split(b'\t');OBJECTS[name.decode()]=meta.decode().split()
BATCH=subprocess.Popen(['git','--no-optional-locks','cat-file','--batch'],cwd=ROOT,env=ENV,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
def blob(oid):
 BATCH.stdin.write((oid+'\n').encode());BATCH.stdin.flush();head=BATCH.stdout.readline().decode().strip().split();assert len(head)==3 and head[0]==oid and head[1]=='blob';size=int(head[2]);assert size<20*1024**2;data=BATCH.stdout.read(size);assert len(data)==size and BATCH.stdout.read(1)==b'\n';return data
lock=threading.Lock(); cache={}; count=0; recorded=set()
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  global count
  try:
   name=unquote(urlsplit(self.path).path).lstrip('/')
   prefix='releases/v0.70.0/site/'
   if name.startswith(prefix):name=name[len(prefix):]
   if name.endswith('/'):name+='index.html'
   if self.headers.get('Host')!=f'127.0.0.1:{self.server.server_port}' or self.headers.get('Service-Worker') is not None: self.send_error(403);return
   if os.environ.get('RL_REPLAY_BLOCK_SCRIPTS') == '1' and name.endswith(('.mjs','.js')):
    self.send_error(503,'Intentional module-unavailable native fixture');return
   if name == 'game/content/scenarios/line-impact-demo.json' and (HERE/'fail-impact').exists():
    time.sleep(2)
    self.send_error(503,'Intentional unavailable lesson QA fixture');return
   parts=PurePosixPath(name).parts
   if '..' in parts or 'test' in parts or any(x.startswith('.') for x in parts) or not name.startswith(('game/','authoring/','site/','native/','releases/','optional/','assets/')):self.send_error(404);return
   with lock:
    assert shutil.disk_usage(HERE).free>=256*1024**2
    assert count<10000
    if name in PINS:
     override=HERE/'overrides'/name;b=(override if override.exists() else HERE/'candidate'/name).read_bytes();pin=PINS[name];assert len(b)==pin['bytes'] and sha(b)==pin['sha256'];origin='candidate'
    elif name in cache:b,origin=cache[name]
    else:
     if name not in OBJECTS:self.send_error(404);return
     mode,kind,oid=OBJECTS[name]
     assert kind=='blob' and mode in ['100644','100755']
     b=blob(oid);origin=oid
     assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest()==oid
     if sum(len(v[0]) for v in cache.values())+len(b)>64*1024**2:cache.clear()
     cache[name]=(b,origin)
    count+=1
    log=HERE/('native-served-'+VARIANT+'.jsonl');line=json.dumps({'path':name,'bytes':len(b),'sha256':sha(b),'origin':origin})+'\n'
    if name.endswith('.woff2'):
     with (HERE/('font-requests-'+VARIANT+'.jsonl')).open('a') as f:f.write(line)
    if line not in recorded:
     assert (log.stat().st_size if log.exists() else 0)+len(line)<300000
     with log.open('a') as f:f.write(line)
     recorded.add(line)
   mime='text/javascript' if name.endswith(('.js','.mjs')) else mimetypes.guess_type(name)[0] or 'application/octet-stream'
   self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(b)));self.send_header('Cache-Control','public, max-age=600' if name.endswith('.woff2') else 'no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Content-Security-Policy',"worker-src 'none'");self.end_headers();self.wfile.write(b)
  except (BrokenPipeError,ConnectionResetError):pass
  except Exception as error:print(type(error).__name__,name,flush=True);self.send_error(500)
server=ThreadingHTTPServer(('127.0.0.1',int(os.environ.get('RL_REPLAY_EXIT_PORT','0'))),Handler)
record={'port':server.server_port,'pid':os.getpid(),'base':BASE,'pinsSHA256':sha(PINS_PATH.read_bytes())}
(HERE/('native-server-'+VARIANT+'.json')).write_text(json.dumps(record)+'\n');print(json.dumps(record),flush=True)
try:server.serve_forever()
finally:BATCH.terminate()
