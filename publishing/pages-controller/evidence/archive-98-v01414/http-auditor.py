import concurrent.futures, datetime, hashlib, json, pathlib, threading, time, urllib.error, urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parent
INV=ROOT.parent/'work'/'expected-inventory.json'
EXPECTED_INV_SHA='1a61a082505eea0836b71ab7446aa41cd89cea1cb0445183aed2c8f107bee67a'
BASE='https://mekhovov.github.io/revealline-archive-98/'
COMMIT='91f3f76fe347fde44dd0ec6c854c272182423219'
RUN=36266012808
DEPLOYMENT=6683228670
WORKERS=4
MAX_ATTEMPTS=3
SOCKET_TIMEOUT=120
DEADLINE_SECONDS=1800
CHUNK=65536

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        raise urllib.error.HTTPError(req.full_url,code,'redirect refused',headers,fp)
raw=INV.read_bytes()
assert hashlib.sha256(raw).hexdigest()==EXPECTED_INV_SHA
data=json.loads(raw)
assert data['base']==BASE and len(data['files'])==1317 and sum(x['bytes'] for x in data['files'])==612091970
rows=data['files']
out=ROOT/'run-complete-1'; out.mkdir(exist_ok=False)
(out/'expected-inventory.json').write_bytes(raw)
(out/'auditor.py').write_bytes(pathlib.Path(__file__).read_bytes())
attempts=(out/'http-attempts.jsonl').open('x'); results=(out/'http-results.jsonl').open('x')
lock=threading.Lock(); start_mono=time.monotonic(); global_deadline=start_mono+DEADLINE_SECONDS
stats={'attempts':0,'attemptFailures':0}

def record(v):
    with lock:
        attempts.write(json.dumps(v,separators=(',',':'))+'\n'); attempts.flush(); stats['attempts']+=1; stats['attemptFailures']+=v['status']!='PASS'

def once(row,n):
    t=time.monotonic(); url=BASE+urllib.parse.quote(row['path'],safe='/')
    v={'path':row['path'],'url':url,'attempt':n,'at':now(),'expectedBytes':row['bytes'],'expectedSha256':row['sha256'],'requestStarted':False,'bytes':0}
    try:
        if t>=global_deadline: raise TimeoutError('global deadline before request')
        req=urllib.request.Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache','User-Agent':'RevealLine-archive98-byte-audit/1.0'})
        v['requestStarted']=True
        op=urllib.request.build_opener(NoRedirect())
        h=hashlib.sha256()
        with op.open(req,timeout=min(SOCKET_TIMEOUT,max(.1,global_deadline-time.monotonic()))) as resp:
            v.update(statusCode=resp.status,finalURL=resp.geturl(),contentType=resp.headers.get('Content-Type',''),contentEncoding=resp.headers.get('Content-Encoding','identity'),contentLength=resp.headers.get('Content-Length'))
            if resp.status!=200 or resp.geturl()!=url: raise ValueError('status/final URL mismatch')
            if v['contentEncoding'].strip().lower() not in ('','identity'): raise ValueError('unexpected content encoding')
            if v['contentLength'] is not None and int(v['contentLength'])!=row['bytes']: raise ValueError('content length mismatch')
            read=getattr(resp,'read1',resp.read)
            while True:
                if time.monotonic()>=global_deadline: raise TimeoutError('global deadline during body')
                b=read(min(CHUNK,row['bytes']-v['bytes']+1))
                if not b: break
                v['bytes']+=len(b)
                if v['bytes']>row['bytes']: raise ValueError('body exceeds pin')
                h.update(b)
        v['sha256']=h.hexdigest()
        if v['bytes']!=row['bytes'] or v['sha256']!=row['sha256']: raise ValueError('body size/hash mismatch')
        v['status']='PASS'
    except Exception as e:
        v['status']='FAIL'; v['errorType']=type(e).__name__; v['error']=str(e)
        if isinstance(e,urllib.error.HTTPError): v['statusCode']=e.code; e.close()
    v['elapsedSeconds']=round(time.monotonic()-t,3)
    return v

def work(row):
    last=None
    for n in range(1,MAX_ATTEMPTS+1):
        last=once(row,n); record(last)
        if last['status']=='PASS' or time.monotonic()>=global_deadline: break
        time.sleep(n)
    return last
started=now(); finished=[]
print(json.dumps({'status':'RUNNING','files':len(rows),'bytes':sum(x['bytes'] for x in rows),'workers':WORKERS,'directory':str(out)}),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
    futs=[pool.submit(work,r) for r in rows]
    for fut in concurrent.futures.as_completed(futs):
        v=fut.result(); finished.append(v); results.write(json.dumps(v,separators=(',',':'))+'\n'); results.flush()
        if len(finished)%50==0: print(json.dumps({'checked':len(finished),'total':len(rows),'failed':sum(x['status']!='PASS' for x in finished)}),flush=True)
attempts.close(); results.close()
failed=[x for x in finished if x['status']!='PASS']
paths={x['path'] for x in finished}
report={'format':'revealline-archive98-public-byte-audit.v1','status':'PASS' if not failed and len(paths)==len(rows) else 'FAIL','base':BASE,'archiveCommit':COMMIT,'runId':RUN,'deploymentId':DEPLOYMENT,'startedAt':started,'finishedAt':now(),'elapsedSeconds':round(time.monotonic()-start_mono,3),'inventorySha256':EXPECTED_INV_SHA,'expectedFiles':len(rows),'expectedBytes':sum(x['bytes'] for x in rows),'resultFiles':len(finished),'uniquePaths':len(paths),'passed':sum(x['status']=='PASS' for x in finished),'failed':len(failed),'attempts':stats['attempts'],'attemptFailures':stats['attemptFailures'],'failedPaths':[x['path'] for x in failed]}
(out/'report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
raise SystemExit(0 if report['status']=='PASS' else 1)
