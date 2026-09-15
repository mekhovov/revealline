#!/usr/bin/env python3
from pathlib import Path
import json,subprocess,datetime,time,shutil,http.client
P=Path(__file__).resolve().parent
profile=P/'profile';art=P.parent/'qualified-artifact-original.zip';part=art.with_suffix('.zip.part')
expected=1136547026;limit=60*1024**2;reserve=512*1024**2
def disk(stage):
 received=(part if part.exists() else art).stat().st_size
 profile_bytes=sum(p.stat().st_size for p in profile.rglob('*') if p.is_file()) if profile.exists() else 0
 free=shutil.disk_usage(P).free
 r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'stage':stage,'freeBytes':free,'artifactReceivedBytes':received,'artifactRemainingBytes':max(0,expected-received),'projectedFreeAfterArtifact':free-max(0,expected-received),'profileBytes':profile_bytes,'profileLimit':limit,'reserveBytes':reserve}
 with (P/'capacity-2.jsonl').open('a') as out:out.write(json.dumps(r)+'\n')
 assert profile_bytes<=56*1024**2,'Owned profile exceeds56MiB protective threshold within60MiB cap'
 assert r['projectedFreeAfterArtifact']-max(0,limit-profile_bytes)-16*1024**2>=reserve,'Insufficient projected reserve'
 return r
disk('before-launch')
args=['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome','--headless=new','--remote-debugging-port=0','--enable-automation','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-features=OptimizationGuideModelDownloading,OptimizationHintsFetching,OptimizationTargetPrediction,OptimizationHints','--disable-gpu-shader-disk-cache','--disable-default-apps','--disable-sync','--enable-unsafe-swiftshader','--password-store=basic','--use-mock-keychain','--disable-quic','--disable-extensions','--disk-cache-size=4194304','--media-cache-size=1048576','--window-size=390,844','--user-data-dir='+str(profile),'--no-proxy-server','about:blank']
started=time.time();proc=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
try:
 deadline=time.monotonic()+20
 while time.monotonic()<deadline:
  pf=profile/'DevToolsActivePort'
  if pf.exists() and pf.stat().st_mtime>=started:
   port=int(pf.read_text().splitlines()[0]);c=http.client.HTTPConnection('127.0.0.1',port,timeout=1);c.request('GET','/json/version');v=json.loads(c.getresponse().read());c.close();break
  assert proc.poll() is None;time.sleep(.1)
 else:raise RuntimeError('No owned endpoint')
 receipt={'pid':proc.pid,'profile':str(profile),'arguments':args,'endpoint':v['webSocketDebuggerUrl'],'port':port,'version':v,'scope':'Explicit root-authorized v0.57.0 Library placement repro only; not v0.57.1 public acceptance.'}
 (P/'launch-2.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
 while proc.poll() is None:
  disk('running');time.sleep(3)
 (P/'exit-2.json').write_text(json.dumps({'pid':proc.pid,'exitCode':proc.returncode,'capacity':disk('after-exit')},indent=2)+'\n')
except BaseException as e:
 (P/'launch-failure-2.json').write_text(json.dumps({'type':type(e).__name__,'message':str(e)},indent=2)+'\n')
 if proc.poll() is None:proc.terminate();proc.wait(timeout=10)
 raise
