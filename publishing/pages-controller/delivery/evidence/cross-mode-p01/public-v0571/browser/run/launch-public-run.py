#!/usr/bin/env python3
import argparse,datetime,http.client,json,os,re,shutil,subprocess,time
from pathlib import Path
from urllib.parse import urlsplit
p=argparse.ArgumentParser();p.add_argument('--attempt',required=True);p.add_argument('--proxy-ready',type=Path);p.add_argument('--identity',required=True,type=Path);a=p.parse_args()
identity=json.loads(a.identity.read_text())
if identity.get('authorizedPublicRun') is not True or identity.get('version')!='v0.57.1' or not identity.get('publicIdentityVerifiedAt') or not re.fullmatch('[0-9a-f]{40}',identity.get('sourceRevision') or '') or not re.fullmatch('[0-9a-f]{64}',identity.get('buildId') or '') or not re.fullmatch('[0-9a-f]{64}',identity.get('publicIdentityReceiptSha256') or '') or type(identity.get('inventoryFiles')) is not int or type(identity.get('inventoryBytes')) is not int:p.error('Final verified public identity and explicit run authorization required')
if not a.attempt.replace('-','').isalnum():p.error('Bounded attempt name required')
folder=Path(__file__).resolve().parent;folder.mkdir(exist_ok=True);profile=folder/'profile';receipt=folder/(a.attempt+'-launch.json');ended=folder/(a.attempt+'-exit.json')
if receipt.exists() or ended.exists():p.error('Attempt receipt exists')
args=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--remote-debugging-port=0','--enable-automation','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationHints','--disable-gpu-shader-disk-cache','--disable-default-apps','--disable-sync','--enable-unsafe-swiftshader','--password-store=basic','--use-mock-keychain','--disable-quic','--disable-extensions','--disk-cache-size=16777216','--media-cache-size=8388608','--window-size=390,844','--user-data-dir='+str(profile)]
if a.proxy_ready:
 proxy=json.loads(a.proxy_ready.read_text())['proxy'];url=urlsplit(proxy)
 if url.scheme!='http' or url.hostname!='127.0.0.1' or url.username or not url.port:p.error('Owned unauthenticated loopback proxy required')
 args+=['--proxy-server='+proxy,'--proxy-bypass-list=<-loopback>']
else:args+=['--no-proxy-server']
if shutil.disk_usage(folder).free < 512*1024**2+128*1024**2:raise RuntimeError('Mandatory512MiB reserve plus128MiB launch allowance')
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
 r={'attempt':a.attempt,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':proc.pid,'profile':str(profile),'arguments':args,'endpoint':version['webSocketDebuggerUrl'],'port':port,'version':version,'proxyMode':'refused' if a.proxy_ready else 'online','profileReset':False,'identityFile':str(a.identity.resolve())}
 receipt.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
 
 while proc.poll() is None:
  free=shutil.disk_usage(folder).free
  with (folder/(a.attempt+'-capacity.jsonl')).open('a') as c:c.write(json.dumps({'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':proc.pid,'freeBytes':free,'reserveBytes':512*1024**2})+'\n')
  if free<512*1024**2+64*1024**2:raise RuntimeError('Protective stop64MiB above mandatory512MiB reserve')
  time.sleep(2)
 code=proc.returncode;ended.write_text(json.dumps({'attempt':a.attempt,'pid':proc.pid,'exitCode':code,'endedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2)+'\n')
except BaseException:
 if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
 raise
