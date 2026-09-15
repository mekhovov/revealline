from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote, urlsplit
import subprocess, mimetypes, hashlib, json
ROOT=Path.cwd(); BASE='4700120adbc670cb6632eca00b151080d73aa1ad'
class Handler(BaseHTTPRequestHandler):
 def do_GET(self):
  path=unquote(urlsplit(self.path).path).lstrip('/')
  if not path or path.endswith('/'): path+='index.html'
  if any(p in ('.','..','.git','node_modules') for p in Path(path).parts) or not path.startswith(('game/','authoring/','docs/')):
   self.send_error(404); return
  local=ROOT/path
  try:
   if local.is_file(): body=local.read_bytes()
   else:
    size=int(subprocess.check_output(['git','cat-file','-s',BASE+':'+path],stderr=subprocess.DEVNULL))
    if size>64*1024*1024: raise ValueError('Bounded preview file limit')
    body=subprocess.check_output(['git','show',BASE+':'+path],stderr=subprocess.DEVNULL)
   kind=mimetypes.guess_type(path)[0] or 'application/octet-stream'
   if path.endswith('.mjs'): kind='text/javascript'
   self.send_response(200); self.send_header('Content-Type',kind); self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store'); self.end_headers(); self.wfile.write(body)
  except (OSError,ValueError,subprocess.CalledProcessError): self.send_error(404)
 def log_message(self, format, *args):
  print(format % args, flush=True)
server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
(ROOT/'.cache/p05a-browser/server.json').write_text(json.dumps({'port':server.server_port,'base':BASE,'overlay':str(ROOT)}))
print('P05-A candidate preview: http://127.0.0.1:'+str(server.server_port)+'/game/',flush=True)
server.serve_forever()
