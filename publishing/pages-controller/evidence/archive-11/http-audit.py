import concurrent.futures
import datetime
import hashlib
import json
from pathlib import Path
import sys
import time
import urllib.request
from urllib.parse import quote

root=Path(__file__).resolve().parent
inventory_path=root/'archive-11-repository/expected-inventory.json'
raw=inventory_path.read_bytes();inventory=json.loads(raw);base=inventory['base']
out=root/('archive11-http-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
out.mkdir(exist_ok=False)
(out/'expected-inventory.json').write_bytes(raw)
mimes={'.html':{'text/html'},'.mjs':{'text/javascript','application/javascript'},'.js':{'text/javascript','application/javascript'},'.css':{'text/css'},'.json':{'application/json'},'.webmanifest':{'application/manifest+json','application/json'},'.png':{'image/png'},'.jpg':{'image/jpeg'},'.jpeg':{'image/jpeg'},'.svg':{'image/svg+xml'},'.woff2':{'font/woff2'},'.woff':{'font/woff'},'.mp3':{'audio/mpeg'},'.ogg':{'audio/ogg'},'.wav':{'audio/wav','audio/x-wav'}}

def check(row):
 attempts=[];url=base+quote(row['path'],safe='/')
 for attempt in range(1,4):
  result={'path':row['path'],'url':url,'attempt':attempt,'expectedBytes':row['bytes'],'expectedSha256':row['sha256'],'at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:
   req=urllib.request.Request(url,headers={'Accept-Encoding':'identity','Cache-Control':'no-cache','User-Agent':'RevealLine-archive-byte-audit/1.0'})
   with urllib.request.urlopen(req,timeout=45) as response:
    result['statusCode']=response.status;result['contentType']=response.headers.get('Content-Type','');result['finalURL']=response.url
    if response.headers.get('Content-Encoding','identity') not in ['identity','']:raise ValueError('Unexpected transfer encoding')
    h=hashlib.sha256();count=0
    while block:=response.read(1024*1024):
     count+=len(block)
     if count>row['bytes']:raise ValueError('Body exceeds expected size')
     h.update(block)
    result['bytes']=count;result['sha256']=h.hexdigest()
    if response.status!=200 or response.url!=url or count!=row['bytes'] or h.hexdigest()!=row['sha256']:raise ValueError('HTTP identity/body mismatch')
    suffix=Path(row['path']).suffix.lower();allowed=mimes.get(suffix)
    if allowed and result['contentType'].split(';')[0].strip().lower() not in allowed:raise ValueError('Unexpected MIME for '+suffix)
    result['status']='PASS'
  except Exception as error:result['status']='FAIL';result['error']=str(error)
  attempts.append(result)
  if result['status']=='PASS':break
  if attempt<3:time.sleep(attempt)
 return result,attempts

rows=[]
with (out/'http-results.jsonl').open('x') as results,(out/'http-attempts.jsonl').open('x') as attempts:
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  futures=[pool.submit(check,row) for row in inventory['files']]
  for future in concurrent.futures.as_completed(futures):
   result,tries=future.result();rows.append(result)
   results.write(json.dumps(result)+'\n');results.flush()
   for trial in tries:attempts.write(json.dumps(trial)+'\n')
   attempts.flush()
   if len(rows)%50==0:print(json.dumps({'checked':len(rows),'total':len(inventory['files']),'failed':sum(r['status']!='PASS' for r in rows),'directory':str(out)}),flush=True)
failed=[r for r in rows if r['status']!='PASS'];expected=sum(r['bytes'] for r in inventory['files']);verified=sum(r.get('bytes',0) for r in rows if r['status']=='PASS')
report={'status':'PASS' if not failed else 'FAIL','base':base,'files':len(rows),'expectedBytes':expected,'verifiedBytes':verified,'failedFiles':len(failed),'skipped':[],'expectedInventorySha256':hashlib.sha256(raw).hexdigest(),'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'attempts':sum(r['attempt'] for r in rows),'retriedFiles':sum(r['attempt']>1 for r in rows),'failures':failed,'scope':'Every canonical decoded HTTP body and applicable browser MIME; independent of workflow integrity and browser/offline acceptance.'}
(out/'http-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'report':report,'directory':str(out)}),flush=True)
sys.exit(1 if failed else 0)
