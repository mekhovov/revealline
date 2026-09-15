#!/usr/bin/env python3
import argparse,datetime,http.client,json,os,subprocess,time
from pathlib import Path
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('--attempt',required=True);p.add_argument('--proxy-ready',type=Path);a=p.parse_args()
if not a.attempt.replace('-','').isalnum():p.error('Bounded attempt name required')
folder=Path(__file__).resolve().parent;profile=folder/'profile';receipt=folder/(a.attempt+'-launch.json');ended=folder/(a.attempt+'-exit.json')
if receipt.exists() or ended.exists():p.error('Attempt receipt exists')
args=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--remote-debugging-port=0','--enable-automation','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-default-apps','--disable-sync','--enable-unsafe-swiftshader','--password-store=basic','--use-mock-keychain','--disable-quic','--disable-extensions','--disk-cache-size=16777216','--media-cache-size=8388608','--window-size=390,844','--user-data-dir='+str(profile)]
if a.proxy_ready:
 proxy=json.loads(a.proxy_ready.read_text())['proxy'];url=urlsplit(proxy)
 if url.scheme!='http' or url.hostname!='127.0.0.1' or url.username or not url.port:p.error('Owned unauthenticated loopback proxy required')
 args+=['--proxy-server='+proxy,'--proxy-bypass-list=<-loopback>']
else:args+=['--no-proxy-server']
args+=['about:blank'];started=time.time();proc=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 deadline=time.monotonic()+20;portfile=profile/'DevToolsActivePort'
 while True:
  if proc.poll() is not None:raise RuntimeError('Owned Chrome exited before endpoint receipt')
  if portfile.exists() and portfile.stat().st_mtime>=started:
   try:
    lines=portfile.read_text().splitlines();port=int(lines[0]);c=http.client.HTTPConnection('127.0.0.1',port,timeout=1);c.request('GET','/json/version');version=json.loads(c.getresponse().read());c.close();break
   except (OSError,ValueError,IndexError):pass
  if time.monotonic()>deadline:raise RuntimeError('New owned Chrome endpoint not observed')
  time.sleep(.1)
 r={'attempt':a.attempt,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':proc.pid,'profile':str(profile),'arguments':args,'endpoint':version['webSocketDebuggerUrl'],'port':port,'version':version,'proxyMode':'refused' if a.proxy_ready else 'online','profileReset':False}
 receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
 code=proc.wait();ended.write_text(json.dumps({'attempt':a.attempt,'pid':proc.pid,'exitCode':code,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
except BaseException:
 if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
 raise
