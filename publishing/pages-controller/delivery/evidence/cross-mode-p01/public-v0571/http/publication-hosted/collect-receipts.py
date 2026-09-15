#!/usr/bin/env python3
"""Receive only the completed hosted tiny receipt ZIP; never the Pages payload."""
import sys,json,subprocess,hashlib,zipfile,io,datetime
from pathlib import Path
P=Path(sys.argv[1]);r=json.loads((P/'run.json').read_bytes());a=json.loads((P/'artifacts.json').read_bytes());assert r['status']=='completed' and r['conclusion']=='success'
items=[x for x in a['artifacts'] if x['name']=='frozen-pages-receipts'];assert len(items)==1
item=items[0];assert not item['expired'] and 0<item['size_in_bytes']<2000000 and item['workflow_run']['id']==r['id']
raw=subprocess.check_output(['gh','api',f"repos/mekhovov/revealline/actions/artifacts/{item['id']}/zip"],stderr=subprocess.PIPE,timeout=90)
sha=hashlib.sha256(raw).hexdigest();assert len(raw)==item['size_in_bytes'] and item['digest']=='sha256:'+sha
with (P/'original-receipts.zip').open('xb') as f:f.write(raw)
z=zipfile.ZipFile(io.BytesIO(raw));assert sorted(z.namelist())==['artifact-receipt.json','zip-receipt.json'];assert sum(i.file_size for i in z.infolist())<4000000
files=[]
for name in z.namelist():
 data=z.read(name)
 with (P/name).open('xb') as f:f.write(data)
 files.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
x=json.loads((P/'artifact-receipt.json').read_bytes());preview=r['event']=='pull_request';assert x['publishable']==(not preview) and x['currentVersion']=='v0.57.1' and x['gameSourceRevision']=='4c85277ac7393eeeabab035387d4d4ae8734aba1' and x['qualifiedSourceTree']=='d3549d0efd15529f71f4cff9a940bdda5e84f3a6'
assert len(x['files'])==len({v['path'] for v in x['files']}) and sum(v['bytes'] for v in x['files'])==x['totalBytes']
result={'status':'PASS','runId':r['id'],'event':r['event'],'observedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'artifactId':item['id'],'receiptZipBytes':len(raw),'receiptZipSha256':sha,'files':files,'controllerCommit':x['controllerCommit'],'controllerTree':x['controllerTree'],'currentVersion':x['currentVersion'],'gameSourceRevision':x['gameSourceRevision'],'hostedArtifactFileCount':len(x['files']),'hostedArtifactBytes':x['totalBytes'],'publishable':x['publishable'],'scope':'Original hosted tiny receipt bytes. Preview cannot authorize production or public claims.'}
with (P/'receipt-reception.json').open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result,indent=2))
