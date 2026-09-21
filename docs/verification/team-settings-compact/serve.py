from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
import os, subprocess, urllib.parse, mimetypes, hashlib, json
ROOT=Path(__file__).resolve().parents[2]
BASE=Path(__file__).resolve().parent
SOURCE="d166a45dca6d42585e385a765903dca826d60950"
WORK=ROOT/'.cache/worktrees/team-presentation-integration'
OVERRIDES={'game/couch/relay-rescue.css','game/couch/relay-rescue.html'}
FIXTURES={}
ENV={k:v for k,v in os.environ.items() if not k.startswith("GIT_")};ENV.update(GIT_NO_LAZY_FETCH="1",GIT_OPTIONAL_LOCKS="0")
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  p=urllib.parse.unquote(urllib.parse.urlsplit(self.path).path).lstrip('/')
  if any(v in ['..','.'] for v in p.split('/')):self.send_error(400);return
  if not p or p.endswith('/'):p+='index.html'
  if p in OVERRIDES:
   body=(WORK/p).read_bytes()
  else:
   r=subprocess.run(['git','--no-lazy-fetch','--no-optional-locks','show',SOURCE+':'+p],cwd=ROOT,env=ENV,capture_output=True)
   if r.returncode:self.send_error(404);return
   body=r.stdout
  if len(body)>32*1024**2:self.send_error(413);return
  mime=mimetypes.guess_type(p)[0] or 'application/octet-stream'
  if p.endswith('.mjs'):mime='text/javascript'
  self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(body)
  print(json.dumps({'path':p,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'override':p in OVERRIDES}),flush=True)
 def log_message(self,*args):pass
print('Exact source preview on http://127.0.0.1:18827/game/',flush=True)
ThreadingHTTPServer(('127.0.0.1',18827),Handler).serve_forever()
