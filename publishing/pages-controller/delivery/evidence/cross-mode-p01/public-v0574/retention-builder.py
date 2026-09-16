#!/usr/bin/env python3
"""Closed evidence candidate only; no acceptance, profile read, network or source writes."""
import argparse, datetime, hashlib, json, os, re, stat, struct, zipfile, zlib
from pathlib import Path
R=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test_cross_mode')
B=R/'.cache/cross-mode/p01'; L=B/'v0574-recovery-layout'; O=L/'public-retention-pending'
M=B/'public-v0573-versioned-archive17-migration-preparation'
MAX_FILES=2000; MAX_BYTES=64*1024**2; MAX_NEW=20*1024**2; FLOOR=512*1024**2
OMIT_DIRS={'profile','node_modules','__pycache__','.git'}
OMIT_FILES={'serial-browser.lock'}
SENSITIVE=re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)')
ROOTS=[('native/r'+str(n),B/f'public-v0574-recovery-offline-execution-r{n}',set()) for n in range(3,8)]
for label,rel in [
 ('publication/production','publication-hosted/production'),('publication/preview','publication-hosted/preview'),
 ('public/current-authority','public-current-authority'),('public/http','public-audit/runs/complete-1'),
 ('public/http-inputs','public-audit/inputs/9c955f767b68a1d948e5db3a5c5fc42f2346c0c2'),
 ('release/publication','release-publication'),('release/qualification-independent','qualification-independent-execution'),
 ('release/package-independent','release-independent-execution'),('release/upload-reception','upload-reception'),
 ('release/inspection-reception','utility-reception'),('reviews/online','native-r7-online-independent-review'),
 ('reviews/online-offline-prepare','native-r7-offline-preparation-independent-review')]:
 ROOTS.append((label,L/rel,{'upload-evidence.zip'} if rel=='upload-reception' else set()))
SINGLES=['qualification/source-qualification.json','parent-independent-qualification-review.json','release-review.json',
 'release-attachment-pins.json','qualification-evidence-record.json','release-body-verified-draft.md',
 'production-independent-review.json','utility-reception-independent-result-review.json','upload-reception-root-review.json',
 'native-pending-cancel-independent-review.json','cold-continuation-helper-independent-review.json',
 'supplemental-cold-preparation-independent-review.json','release-copy-layout-review.json',
 'sealed-audit-deduplication.json','sealed-evidence-deduplication.json','capacity-own-checkout-sparse.json',
 'native-r7-cold-independent-manifest.json','native-r7-cold-independent-closure.json','root-cold-scope-review.json']
def read(p):return json.loads(p.read_text())
def regular(p):
 p=Path(p)
 for q in [p,*p.parents]:
  if q.is_symlink():raise ValueError('Refuse linked evidence: '+str(q))
 s=p.stat()
 if not stat.S_ISREG(s.st_mode):raise ValueError('Not regular: '+str(p))
 return s
def measure(p):
 a=regular(p);h=hashlib.sha256();z=zlib.compressobj(6,zlib.DEFLATED,-15);n=0;c=0;tail=b''
 with p.open('rb') as f:
  while b:=f.read(65536):
   if SENSITIVE.search(tail+b):raise ValueError('Sensitive-pattern refusal: '+str(p))
   tail=b[-256:];h.update(b);n+=len(b);c+=len(z.compress(b))
 c+=len(z.flush());e=regular(p)
 if (a.st_size,a.st_mtime_ns,a.st_ino)!=(e.st_size,e.st_mtime_ns,e.st_ino):raise ValueError('Source changed: '+str(p))
 return {'bytes':n,'sha256':h.hexdigest(),'deflateBytes':c}
def pin(p):return {'path':str(p),**{k:v for k,v in measure(p).items() if k!='deflateBytes'}}
def put(p,v):
 with p.open('x') as f:json.dump(v,f,indent=2,ensure_ascii=False);f.write('\n')
def walk(root,exclude):
 if root.is_symlink():raise ValueError('Linked root')
 for base,dirs,files in os.walk(root,followlinks=False):
  dirs[:]=sorted(d for d in dirs if d not in OMIT_DIRS)
  for d in dirs:
   if (Path(base)/d).is_symlink():raise ValueError('Linked directory outside excluded profile')
  for n in sorted(files):
   p=Path(base)/n;rel=p.relative_to(root).as_posix()
   if n in OMIT_FILES or rel in exclude:continue
   regular(p);yield p,rel

def inventory(cold):
 rows={}; exclusions=[]
 def add(p,member,expected=None):
  if member.startswith('/') or '..' in Path(member).parts or '\\' in member:raise ValueError('Unsafe member')
  if member in rows:raise ValueError('Duplicate member')
  m=measure(p)
  if expected and any(m[k]!=expected[k] for k in ['bytes','sha256']):raise ValueError('Original manifest mismatch '+str(p))
  rows[member]={'source':str(p),'member':member,**m}
 for label,root,excluded in ROOTS:
  for p,rel in walk(root,excluded):add(p,label+'/'+rel)
  exclusions.append({'root':str(root),'directoriesNeverTraversed':sorted(OMIT_DIRS),'filesExcluded':sorted(OMIT_FILES|excluded)})
 manifest=read(M/'run/manifest.json')
 assert manifest['profilesIncluded'] is False and manifest['count']==144 and manifest['bytes']==1385295
 for x in manifest['files']:
  rel=x['path'];assert not Path(rel).is_absolute() and '..' not in Path(rel).parts and 'profile' not in Path(rel).parts
  add(M/rel,'migration/'+rel,x)
 if 'migration/run/manifest.json' not in rows:add(M/'run/manifest.json','migration/run/manifest.json')
 for rel in SINGLES:add(L/rel,'authorities/'+rel)
 if cold:
  assert cold.is_absolute() and cold.is_relative_to(L)
  cj=read(cold)
  if cj.get('phaseAccepted') is True or cj.get('p01Accepted') is True:raise ValueError('Not an open-phase review')
  add(cold,'reviews/final-cold-independent-review.json')
  cm=read(L/'native-r7-cold-independent-manifest.json')
  assert cm['count']==67 and cm['bytes']==1334836 and cm['allFilesReadOnlyRehashed']
  bysource={x['source']:x for x in rows.values()}
  for x in cm['files']:
   p=Path(x['path']);assert p.is_absolute() and p.is_relative_to(B) and 'profile' not in p.parts
   if str(p) in bysource:
    assert all(bysource[str(p)][k]==x[k] for k in ['bytes','sha256']),str(p)
   else:add(p,'cold-originals/'+p.relative_to(B).as_posix(),x)
  closed=B/'public-v0574-recovery-offline-execution-r7/run/root-closure-pending.json'
  assert str(closed) in {x['source'] for x in rows.values()}
 for p in sorted((B/'retired-local-profile-archives').glob('retention*.json')):
  add(p,'capacity/local-profile-retention/'+p.name)

 rows=sorted(rows.values(),key=lambda x:x['member']);total=sum(x['bytes'] for x in rows)
 if len(rows)>MAX_FILES or total>MAX_BYTES:raise ValueError('Retention bound exceeded; ask root, omit nothing')
 # Source final old/profile-independent closure checks; no browser operations.
 closures=[]
 for n in range(3,8):
  for p in (B/f'public-v0574-recovery-offline-execution-r{n}'/'run').glob('*/exit.json'):
   j=read(p)
   if j.get('exitCode')!=0 or not j.get('pidExited') or not j.get('endpointClosed'):raise ValueError('Incomplete closure '+str(p))
   closures.append(pin(p))
 assets=read(L/'release-attachment-pins.json');sourcezip=next(x for x in assets if x['name']=='source-qualification-evidence.zip')
 estimate=sum(x['deflateBytes']+114+2*len(x['member'].encode()) for x in rows)+22
 obj={'format':'revealline-p01-pending-retention-selection.v1','status':'OPEN_COLD_VERIFY_AND_RESTORATION_PENDING','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'phaseAccepted':False,'nextPhaseAuthorized':False,'sourceRevision':'856850ce8d4597c1fb6e8bb28ddb8a63db337a8c','count':len(rows),'originalBytes':total,'estimatedZipBytes':estimate,'boundFiles':MAX_FILES,'boundOriginalBytes':MAX_BYTES,'maxNewOutputBytes':MAX_NEW,'requiredFreeBytes':FLOOR,'coldVerify':'NOT_EXECUTED','restored':'NOT_EXECUTED','finalColdReview':pin(cold) if cold else None,'assemblyReady':cold is not None,'files':rows,'closurePins':closures,'exclusions':exclusions,'references':[{'url':'https://github.com/mekhovov/revealline/releases/download/v0.57.4/source-qualification-evidence.zip','bytes':sourcezip['bytes'],'sha256':sourcezip['sha256'],'included':False,'reason':'Published 336-original source evidence; do not duplicate payload.'},{'path':str(L/'upload-reception/upload-evidence.zip'),'included':False,'reason':'Verified upload wrapper duplicates published small/source evidence. Its run/artifact/digest/reception and canonical nine-asset authorities are included.'},{'path':str(R/'publishing/pages-controller/delivery/evidence/cross-mode-p01/public-v0573/record.json'),'pin':pin(R/'publishing/pages-controller/delivery/evidence/cross-mode-p01/public-v0573/record.json'),'included':False,'reason':'552-member committed historical originals remain at their existing immutable source; do not duplicate.'}],'limits':['Cold saved Continue and explicit Resume observed by parent; final cold609 Verify and03 online restoration were unexecuted after guard stop. Final independent review supplies exact event disposition.','Actual final projected535304071 bytes was below536870912 floor with664772608 bytes free. Capacity stop is retained, not a product pass.','All earlier refused/helper/native/source outcomes retain their actual categories.','No profile data, runtime payload, physical-device or whole-phase acceptance.']}
 return obj

def assemble(inv,expected):
 if pin(inv)['sha256']!=expected:raise ValueError('Selection pin mismatch')
 j=read(inv)
 if not j['assemblyReady'] or not j['finalColdReview']:raise ValueError('Final independent cold review required')
 if pin(Path(j['finalColdReview']['path']))!=j['finalColdReview']:raise ValueError('Cold review changed')
 if len(j['files'])>MAX_FILES or sum(x['bytes'] for x in j['files'])>MAX_BYTES:raise ValueError('Bounds')
 budget=sum(p.stat().st_size for p in O.rglob('*') if p.is_file())
 reserve=j['estimatedZipBytes']+2*inv.stat().st_size+262144
 free=os.statvfs(O).f_bavail*os.statvfs(O).f_frsize
 if budget+reserve>MAX_NEW or free-reserve<FLOOR:raise ValueError('New output/free reserve guard; preserve originals, do not write ZIP')
 zpath=O/'evidence.candidate.zip'
 # No automatic retry or clobber. A failed partial is intentionally retained.
 with zipfile.ZipFile(zpath,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=False) as z:
  for row in j['files']:
   p=Path(row['source']); before=measure(p)
   if any(before[k]!=row[k] for k in ['bytes','sha256']):raise ValueError('Changed original '+str(p))
   info=zipfile.ZipInfo(row['member'],date_time=(1980,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
   h=hashlib.sha256();n=0
   with p.open('rb') as src,z.open(info,'w') as dst:
    while b:=src.read(65536):h.update(b);n+=len(b);dst.write(b)
   if n!=row['bytes'] or h.hexdigest()!=row['sha256']:raise ValueError('Write stream changed')
   after=measure(p)
   if any(after[k]!=row[k] for k in ['bytes','sha256']):raise ValueError('Original reread differs')
 with zipfile.ZipFile(zpath) as z:
  if z.namelist()!=[x['member'] for x in j['files']]:raise ValueError('Exact ZIP member set/order differs')
  for row in j['files']:
   i=z.getinfo(row['member']);h=hashlib.sha256();n=0
   with z.open(i) as f:
    while b:=f.read(65536):h.update(b);n+=len(b)
   if n!=row['bytes'] or i.file_size!=n or h.hexdigest()!=row['sha256']:raise ValueError('ZIP CRC/hash/size differs')
 record={'format':'revealline-p01-pending-retention-record.v1','status':'ASSEMBLED_VERIFIED_CANDIDATE_P01_OPEN','phaseAccepted':False,'nextPhaseAuthorized':False,'reason':'Capacity block; native cold609 Verify and03 restored unexecuted','inventory':pin(inv),'archive':pin(zpath),'members':len(j['files']),'originalBytes':j['originalBytes'],'allSourcesReread':True,'allCRCsAndMemberHashesVerified':True,'profilesIncluded':False,'rootSelectionAndFinalDecisionPending':True}
 put(O/'record.candidate.json',record);print(json.dumps(record,indent=2))
if __name__=='__main__':
 a=argparse.ArgumentParser();sub=a.add_subparsers(dest='command',required=True)
 i=sub.add_parser('inventory');i.add_argument('--cold-review',type=Path);i.add_argument('--output',type=Path,required=True)
 s=sub.add_parser('assemble');s.add_argument('--inventory',type=Path,required=True);s.add_argument('--inventory-sha256',required=True)
 args=a.parse_args()
 if args.command=='inventory':
  if args.output.parent.resolve()!=O:raise ValueError('Owned output only')
  j=inventory(args.cold_review);put(args.output,j);print(json.dumps({k:j[k] for k in ['status','count','originalBytes','estimatedZipBytes','assemblyReady']},indent=2));print(json.dumps(pin(args.output)))
 else:assemble(args.inventory,args.inventory_sha256)
