import json,hashlib,datetime
from pathlib import Path
p=Path(__file__).resolve().parent
load=lambda name:json.loads((p/name).read_text())
checks=[]
def check(name,value,evidence):
 checks.append({'name':name,'passed':bool(value),'evidence':evidence})
 if not value:raise AssertionError(name)
expected=load('expected-public-identity.json')
install=load('06-install-state.json');verify=load('24-offline-verified.json');terminal=json.loads(verify['offline']['details'])
check('real terminal verifies608files55383385bytes',terminal['status']=='ready' and terminal['count']==terminal['verified']==608 and terminal['bytes']==55383385 and terminal['missing']==terminal['corrupt']==[],['24-offline-verified.json'])
check('exact frozen build',terminal['buildId']=='8b7ab11efc3be749f519b50f4d4299dc2a203a61d4fd970bd3a62278bda7402b' and verify['build']['sourceRevision']=='b7db0134d4ede3452dc90b5d3f7ffb1491a0579b',['24-offline-verified.json'])
stop=load('02-stopped.json');join=load('03-rejoined.json')
check('Stop returns keyboard focus and Check progress rejoins',stop['stopHidden'] and stop['focus']=='offline-button' and stop['button']=='Check progress' and not join['stopHidden'] and '23 / 608' in join['text'],['02-stopped.json','03-rejoined.json'])
online=load('online-direct-1-launch.json');offline=load('refused-direct-1-launch.json');restored=load('restored-online-1-launch.json')
check('three distinct browser processes same retained profile',len({x['pid'] for x in [online,offline,restored]})==3 and len({x['endpoint'] for x in [online,offline,restored]})==3 and len({x['profile'] for x in [online,offline,restored]})==1,['online-direct-1-launch.json','refused-direct-1-launch.json','restored-online-1-launch.json'])
for f in ['17-online-direct-exit-check.json','34-refused-direct-exit-check.json','36-restored-exit-check.json']:
 x=load(f);check(f,not x['pidAlive'] and not x['listening'],[f])
events=[json.loads(l) for l in (p/'refused-cdp.jsonl').read_text().splitlines()]
proxy=[json.loads(l) for l in (p/'refusal-attempt-1.jsonl').read_text().splitlines()]
identity=next(x for x in events if x['event']=='browser-identity');args=identity['arguments']
check('actual refused browser argv', '--proxy-server=http://127.0.0.1:64855' in args and '--proxy-bypass-list=<-loopback>' in args and '--disable-quic' in args and '--no-proxy-server' not in args,['refused-cdp.jsonl'])
check('actual HTTP and CONNECT canaries refused',all(any(x.get('host')=='p01-refusal.invalid' and x.get('method')==method and x.get('status')==502 for x in proxy) for method in ['GET','CONNECT']),['18-http-canary.txt','18-https-canary.txt','refusal-attempt-1.jsonl'])
for f in ['20-uncached-public-probe.json','30-after-team-uncached-probe.json','33-final-uncached-probe.json']:
 x=load(f);t=datetime.datetime.fromisoformat(x['time'].replace('Z','+00:00'))
 matching=[z for z in proxy if z.get('host')=='mekhovov.github.io' and z.get('method')=='CONNECT' and z.get('status')==502 and abs((datetime.datetime.fromisoformat(z['time'])-t).total_seconds())<2]
 check('fresh public-origin uncached refusal '+f,x['outcome']=='rejected' and bool(matching),[f,'refusal-attempt-1.jsonl'])
sw=[x for x in events if x['event']=='response' and x['fromServiceWorker']]
check('cold Solo document served by actual worker',any(x['type']=='Document' and x['url'].endswith('/site/game/') and x['status']==200 for x in sw),['refused-cdp.jsonl'])
# Team attribution is unavailable: this observer explicitly disconnected after cold boot.
a=load('15-solo-cut-paused.json');b=load('20-refused-cold-state.json')
check('whole-process restart preserves exact sampled Solo raw bytes',a['storage']==b['storage'],['15-solo-cut-paused.json','20-refused-cold-state.json'])
saved=json.loads(a['storage']['suspended']['raw']);cold=load('22-continue-paused.json');later=load('22-continue-paused-later.json');cut=load('23-offline-cut-paused.json')
check('Continue paused with no implicit resume',cold['flightState']==later['flightState']=='paused' and cold['hud']==later['hud'] and cold['hud']['coverage']=='4.3%' and cold['hud']['score']=='01000',['22-continue-paused.json','22-continue-paused-later.json'])
check('explicit resumed native cut advances coverage and score',cut['flightState']=='paused' and cut['hud']['coverage']=='11.5%' and cut['hud']['score']=='02700',['23-offline-cut-paused.json'])
check('saved exact picture pins preserved across continued cut',json.loads(cut['storage']['suspended']['raw'])['presentationPins']==saved['presentationPins'],['15-solo-cut-paused.json','23-offline-cut-paused.json'])
for start,support,paused,later,resumed,goal in [('26-team-first-start.json','26-team-first-support.json','27-team-first-paused.json','27-team-first-paused-later.json','27-team-first-resumed-paused.json','Capture the shield anchors'),('32-first-actual-start.json','32-first-actual-support.json','32-first-actual-paused.json','32-first-actual-paused-later.json','32-first-actual-resumed-paused.json','Reveal 65% together')]:
 s,u,a,b,r=[load(f) for f in [start,support,paused,later,resumed]]
 check('real arena start '+start,s['text']['coop-clock']=='0:00' and goal in s['text']['coop-objective'] and s['menuHidden'] and not s['playHidden'],[start])
 check('both players steer and use Support '+support,all(u['text']['coop-state-'+str(i)]=='Line exposed' and 'recharging' in u['text']['coop-support-'+str(i)] for i in [0,1]),[support])
 check('Team paused stable then explicit Resume '+paused,not a['overlayHidden'] and not b['overlayHidden'] and a['text']==b['text'] and r['text']['coop-charge-0']!=b['text']['coop-charge-0'],[paused,later,resumed])
a=load('25-team-entry-baseline.json');b=load('32-first-actual-resumed-paused.json')
changes=[x for x in events if x['event']=='storage-event' and a['observedAt']<=x['time']<=b['observedAt']]
check('Solo sampled raw bytes unchanged during Team',a['storage']==b['storage'],['25-team-entry-baseline.json','32-first-actual-resumed-paused.json','refused-cdp.jsonl'])
check('online restoration preserves Team baseline save',a['storage']==load('35-restored-online-state.json')['storage'],['25-team-entry-baseline.json','35-restored-online-state.json'])
r=[json.loads(l) for l in (p/'restored-cdp.jsonl').read_text().splitlines()];args=next(x for x in r if x['event']=='browser-identity')['arguments']
check('online restored proxy-free actual argv and uncached404','--no-proxy-server' in args and not any(x.startswith('--proxy-server=') for x in args) and load('35-restored-network-probe.json')['outcome']=='response-received' and load('35-restored-network-probe.json')['status']==404,['restored-cdp.jsonl','35-restored-network-probe.json'])
check('proxy cleaned after refused browser exit',not load('34-proxy-exit-check.json')['listening'],['34-proxy-exit-check.json'])
result={'format':'p01-public-bounded-browser-review.v1','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'release':'v0.57.0','source':'b7db0134d4ede3452dc90b5d3f7ffb1491a0579b','releaseAccepted':False,'result':'worker/gameplay/storage scoped checks passed; confirmed P01 portrait control-displacement blocks acceptance','checks':checks,'workerResponseCount':len(sw),'workerObservationEndedAt':'2026-09-15T12:09:38.681Z','teamWorkerResponseAttribution':False,'proxyEvents':len(proxy),'teamStorageWindow':{'start':a['observedAt'],'end':b['observedAt'],'events':None,'observerCoveredInterval':False,'reason':'collector disconnected at12:09:38.681Z before Team entry; absence of events is not zero-write evidence','domains':['suspended','library','packs'],'idbWriteAudit':False},'pin':saved['presentationPins'],'failedAttemptsRetained':True,'physicalDeviceClaim':False}
(p/'review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'passedChecks':len(checks),'workerResponses':len(sw),'releaseAccepted':False}))
