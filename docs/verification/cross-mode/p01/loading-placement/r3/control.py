#!/usr/bin/env python3
"""Named attached-session actions only; connect to the exact owned endpoint first."""
import os,subprocess,sys,json,http.client
from pathlib import Path
folder=Path(__file__).resolve().parent
run=folder/'run'
removed={'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'}
env={k:v for k,v in os.environ.items() if not k.startswith('AGENT_BROWSER_') and k not in removed}
args=['/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/agent-browser','--config',str(folder/'agent-browser.json'),'--session','p01-library-rail-r3',*sys.argv[1:]]
if len(sys.argv)<2:raise SystemExit('Explicit action required; never auto-connect or default session')
def verify():
 r=json.loads((run/'launch.json').read_text());os.kill(r['pid'],0)
 c=http.client.HTTPConnection('127.0.0.1',r['port'],timeout=1);c.request('GET','/json/version');v=json.loads(c.getresponse().read());c.close()
 if v['webSocketDebuggerUrl']!=r['endpoint']:raise RuntimeError('Owned browser endpoint differs')
if sys.argv[1]=='connect':
 expected=json.loads((run/'launch.json').read_text())['endpoint']
 if sys.argv[2:]!=[expected]:raise SystemExit('Connect must name the exact owned WebSocket endpoint')
verify()
result=subprocess.run(args,env=env)
if sys.argv[1]!='close':verify()
raise SystemExit(result.returncode)
