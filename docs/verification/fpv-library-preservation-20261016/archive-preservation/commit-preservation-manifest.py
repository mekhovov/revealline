"""Append exact small preservation files to the owned backup branch, without a local checkout."""
from pathlib import Path
import datetime, hashlib, json, subprocess, urllib.request

ROOT=Path('/tmp/fpv-library-archive-preservation-20261016')
REPO='mekhovov/revealline'
BRANCH='codex/fpv-library-evidence-preservation-20261016'
PREFIX='docs/verification/fpv-library-preservation-20261016/archive-preservation'
EXPECTED_PARENT='2fa8b421f2ac89fd990addec895c90f20fd4858b'
token=subprocess.check_output(['gh','auth','token'],text=True).strip()
headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'FPV-Backup-Manifest'}
def api(path,method='GET',payload=None):
 data=json.dumps(payload).encode() if payload is not None else None
 request=urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path,headers={**headers,**({'Content-Type':'application/json'} if data else {})},data=data,method=method)
 with urllib.request.urlopen(request,timeout=180) as response:return json.load(response)
def git_blob(raw):return hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()

manifest=json.loads((ROOT/'release-assets-manifest-21.json').read_text())
assert manifest['complete'] and len(manifest['archives'])==21 and not manifest['remainingOriginalPaths'] and not manifest['remainingCloudArtifactIDs']
assert len({row['assetID'] for row in manifest['archives']})==21
assert all(row['preserved'] and row['fullReadback']['sha256']==row['sha256'] and row['fullReadback']['bytes']==row['bytes'] and row['serverDigest']=='sha256:'+row['sha256'] for row in manifest['archives'])
ref=api('git/ref/heads/'+BRANCH);assert ref['object']['sha']==EXPECTED_PARENT
parent=api('git/commits/'+EXPECTED_PARENT)
entries=[];inventory=[]
excluded={'github-final-receipt.json','github-checkpoint-receipt.json','preservation-pr-body.md'}
for path in sorted(ROOT.rglob('*')):
 if not path.is_file() or path.name in excluded or '__pycache__' in path.parts:continue
 raw=path.read_bytes();relative=path.relative_to(ROOT).as_posix();destination=PREFIX+'/'+relative
 content=raw.decode('utf-8')
 assert '\x00' not in content
 entries.append({'path':destination,'mode':'100644','type':'blob','content':content})
 inventory.append({'path':destination,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlobSHA1':git_blob(raw)})
tree=api('git/trees','POST',{'base_tree':parent['tree']['sha'],'tree':entries})
commit=api('git/commits','POST',{'message':'Preserve 21 original FPV archives with verified durable restore records','tree':tree['sha'],'parents':[EXPECTED_PARENT]})
api('git/refs/heads/'+BRANCH,'PATCH',{'sha':commit['sha'],'force':False})
assert api('git/ref/heads/'+BRANCH)['object']['sha']==commit['sha']
remote_tree=api('git/trees/'+tree['sha']+'?recursive=1');assert not remote_tree.get('truncated')
remote={row['path']:row for row in remote_tree['tree']}
assert all(remote[row['path']]['sha']==row['gitBlobSHA1'] and remote[row['path']]['size']==row['bytes'] for row in inventory)
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'branch':BRANCH,'parent':EXPECTED_PARENT,'commit':commit['sha'],'tree':tree['sha'],'releaseID':manifest['releaseID'],'originalArchiveCount':21,'uniqueAssetCount':21,'fullReadbackVerifiedCount':21,'remaining':[],'files':inventory,'allRemoteGitBlobIdentitiesVerified':True,'url':'https://github.com/'+REPO+'/tree/'+commit['sha']+'/'+PREFIX}
(ROOT/'github-final-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({key:receipt[key] for key in ['commit','parent','originalArchiveCount','uniqueAssetCount','fullReadbackVerifiedCount','remaining','allRemoteGitBlobIdentitiesVerified','url']}))
