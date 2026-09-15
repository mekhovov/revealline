#!/usr/bin/env python3
"""Named attached-session actions only; connect to the exact owned endpoint first."""
import os,subprocess,sys
from pathlib import Path
folder=Path(__file__).resolve().parent
removed={'HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','NO_PROXY','http_proxy','https_proxy','all_proxy','no_proxy'}
env={k:v for k,v in os.environ.items() if not k.startswith('AGENT_BROWSER_') and k not in removed}
args=['/Users/oleksandr.mekhovov/.local/share/mise/installs/node/20.19.5/bin/agent-browser','--config',str(folder/'agent-browser.json'),'--session','p01-library-placement-v0570',*sys.argv[1:]]
if len(sys.argv)<2:raise SystemExit('Explicit action required; never auto-connect or default session')
raise SystemExit(subprocess.run(args,env=env).returncode)
