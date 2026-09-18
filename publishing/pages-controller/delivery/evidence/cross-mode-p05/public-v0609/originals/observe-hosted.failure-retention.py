from pathlib import Path
import subprocess,json,hashlib,concurrent.futures,sys,datetime,re
assert len(sys.argv)==5, 'Use: observe-hosted.py UNIQUE_LABEL ACTUAL_PUBLISHER_COMMIT ACTUAL_PUBLISHER_TREE ACTUAL_RUN_ID'
label,publisher,tree,run=sys.argv[1:];assert re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,47}',label) and re.fullmatch(r'[a-f0-9]{40}',publisher) and re.fullmatch(r'[a-f0-9]{40}',tree) and re.fullmatch(r'[1-9][0-9]{0,19}',run)
home=Path(__file__).resolve().parent;out=home/('hosted-observation-'+label);out.mkdir();queries={'run':f'actions/runs/{run}','jobs':f'actions/runs/{run}/jobs','artifacts':f'actions/runs/{run}/artifacts','main':'git/ref/heads/main','wrapper':f'git/commits/{publisher}','deployments':f'deployments?sha={publisher}&per_page=10'}
def get(pair):
 n,s=pair
 command=['gh','api','repos/mekhovov/revealline/'+s]
 timeout=False
 failure=None
 try:
  r=subprocess.run(command,capture_output=True,timeout=35)
  stdout,stderr,returncode=r.stdout,r.stderr,r.returncode
 except subprocess.TimeoutExpired as error:
  timeout=True
  failure=error
  stdout,stderr,returncode=error.output,error.stderr,None
 # Keep the existing strict <2,000,000-byte response limit. Retention is
 # bounded too; timeout bytes are only the captured prefix, never a full reply.
 streams={}
 for name,raw in [('stdout',stdout),('stderr',stderr)]:
  available=raw is not None
  if available and not isinstance(raw,bytes):
   raise TypeError('Expected binary subprocess output; no text conversion allowed')
  captured=raw if available else b''
  truncated=len(captured)>=2_000_000
  kept=captured[:1_999_999]
  complete=available and not timeout and not truncated
  suffix=('.json' if name=='stdout' else '.stderr') if complete else '.'+name+'.partial'
  destination=out/(n+suffix)
  with destination.open('xb') as f:f.write(kept)
  streams[name]={
   'path':destination.name,'captureAvailable':available,
   'capturedBytes':len(captured) if available else None,
   'capturedSha256':hashlib.sha256(captured).hexdigest() if available else None,
   'retainedBytes':len(kept),'retainedSha256':hashlib.sha256(kept).hexdigest(),
   'completeCapture':available and not timeout,'completeOriginalRetained':complete,
   'retentionTruncated':truncated,
   'scope':'Complete subprocess stream' if available and not timeout else
           'Only subprocess bytes available at timeout; final stream size and hash are unknown'
  }
 reasons=[]
 if timeout:reasons.append('subprocess-timeout')
 if streams['stdout']['retentionTruncated']:reasons.append('stdout-size-limit')
 if streams['stderr']['retentionTruncated']:reasons.append('stderr-size-limit')
 if not timeout and returncode!=0:reasons.append('nonzero-exit')
 value=None
 if not reasons:
  try:value=json.loads(stdout)
  except (UnicodeDecodeError,json.JSONDecodeError) as error:
   failure=error
   reasons.append('invalid-json')
 receipt={
  'format':'revealline-bounded-api-attempt.v1','requestName':n,'command':command,
  'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
  'status':'FAIL' if reasons else 'COMPLETE_API_RESPONSE',
  'returnCode':returncode,'timedOut':timeout,'timeoutSeconds':35,
  'acceptedStreamBytesLessThan':2_000_000,'streams':streams,
  'failures':reasons,'usableJson':not reasons,'attempts':1,
  'publicationAcceptance':False
 }
 receipt_path=out/(n+'.attempt.json')
 with receipt_path.open('x') as f:json.dump(receipt,f,indent=2);f.write('\n')
 if reasons:
  raise RuntimeError(n+': '+', '.join(reasons)+'; retained '+str(receipt_path)) from failure
 return n,value
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:result=dict(pool.map(get,queries.items()))
assert result['main']['object']['sha']==result['wrapper']['sha']==result['run']['head_sha']==publisher;assert result['wrapper']['tree']['sha']==tree
for d in result['deployments']:
 if d['environment']=='github-pages':
  assert d['sha']==publisher
  for name,suffix in [('deployment','deployments/'+str(d['id'])),('statuses','deployments/'+str(d['id'])+'/statuses')]:
   n,value=get((name,suffix));result[n]=value
  break
pins=[]
for p in sorted(out.iterdir()):
 if p.is_file():b=p.read_bytes();pins.append({'path':p.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
record={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Bounded read-only GitHub API observation','pins':pins};(out/'record.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'directory':str(out),'run':{k:result['run'][k] for k in ['id','status','conclusion','head_sha']},'jobs':[{k:j[k] for k in ['id','name','status','conclusion']} for j in result['jobs']['jobs']],'artifacts':[{k:a[k] for k in ['id','name','size_in_bytes','digest']} for a in result['artifacts']['artifacts']],'deployment':{k:result.get('deployment',{}).get(k) for k in ['id','sha','environment']},'latestStatus':{k:result.get('statuses',[{}])[0].get(k) for k in ['id','state','log_url','environment_url']}},indent=2))
