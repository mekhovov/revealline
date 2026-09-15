"""Owned ordinary-build server: hold a declared body without replacing any bytes."""
import hashlib,json,os,threading,time
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent/'preview-build'
assert ROOT.is_dir()
LOCK=threading.Lock()
def event(row):
 with LOCK:
  with (HERE/'requests.jsonl').open('a') as f:f.write(json.dumps({'at':time.time(),**row})+'\n')
class Handler(SimpleHTTPRequestHandler):
 extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.mjs':'text/javascript'}
 def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
 def end_headers(self):
  self.send_header('Cache-Control','no-store')
  super().end_headers()
 def do_GET(self):
  route=urlsplit(self.path).path
  event({'event':'request','path':route})
  held=False
  while True:
   control=json.loads((HERE/'control.json').read_text())
   if route not in control.get('hold',[]):break
   if not held:
    p=ROOT/route.lstrip('/');b=p.read_bytes();event({'event':'held','path':route,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});held=True
   time.sleep(.05)
  if held:event({'event':'released','path':route})
  try:super().do_GET()
  except (BrokenPipeError,ConnectionResetError):event({'event':'client-disconnected','path':route})
 def log_message(self,fmt,*args):event({'event':'response','message':fmt%args})
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
r={'root':str(ROOT),'pid':os.getpid(),'url':'http://127.0.0.1:'+str(server.server_port),'port':server.server_port,'controlledPath':'/authoring/asset-studio/operation.mjs'}
(HERE/'server.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
server.serve_forever()
