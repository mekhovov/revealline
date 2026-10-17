"""Read-only metadata verification for the completed original archive cohort."""
from pathlib import Path
import datetime, json, subprocess

ROOT=Path('/tmp/fpv-library-archive-preservation-20261016')
def api(path):return json.loads(subprocess.check_output(['gh','api','repos/mekhovov/revealline/'+path]))
manifest=json.loads((ROOT/'release-assets-manifest-21.json').read_text())
assert manifest['complete'] and len(manifest['archives'])==21
release=api('releases/414505790')
assert release['draft'] and release['tag_name']=='fpv-development-preservation-20261016' and release['published_at'] is None
assets=[];page=1
while True:
 batch=api(f'releases/414505790/assets?per_page=100&page={page}');assets+=batch
 if len(batch)<100:break
 page+=1
by_id={row['id']:row for row in assets};verified=[]
for row in manifest['archives']:
 actual=by_id[row['assetID']]
 assert actual['size']==row['bytes'] and actual['digest']=='sha256:'+row['sha256'] and actual['state']=='uploaded'
 assert row['fullReadback']['bytes']==row['bytes'] and row['fullReadback']['sha256']==row['sha256']
 verified.append({'assetID':actual['id'],'name':actual['name'],'bytes':actual['size'],'serverDigest':actual['digest'],'state':actual['state'],'fullReadbackBytes':row['fullReadback']['bytes'],'fullReadbackSHA256':row['fullReadback']['sha256']})
product=api('pulls/1540');preservation=api('pulls/1550')
assert product['draft'] and product['head']['sha']=='b65d80f716b8db646bfdf5f714892f1c0f6409b0' and product['auto_merge'] is None
assert preservation['draft'] and preservation['head']['ref']=='codex/fpv-library-evidence-preservation-20261016' and preservation['auto_merge'] is None
receipt={'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'release':{key:release[key] for key in ['id','tag_name','draft','published_at','html_url']},'ownedOriginalArchiveCount':21,'requestedTwentyOriginalCohortComplete':True,'supplementalDistinctPRCapacityOriginalCount':1,'remaining':[],'totalOwnedOriginalBytes':sum(row['bytes'] for row in manifest['archives']),'uniqueOwnedAssetIDs':len({row['assetID'] for row in manifest['archives']}),'allOwnedAssetServerDigestsAndFullReadbacksMatch':True,'assets':verified,'productPR':{'number':1540,'draft':True,'headSHA':product['head']['sha'],'autoMerge':None},'preservationPR':{'number':1550,'draft':True,'headRef':preservation['head']['ref'],'headAtPreCommitVerification':preservation['head']['sha'],'autoMerge':None},'scope':'Backup integrity only. Final preservation commit identity is recorded separately after these files are committed and remote Git blob identities are verified.'}
(ROOT/'final-server-verification.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({key:receipt[key] for key in ['ownedOriginalArchiveCount','remaining','totalOwnedOriginalBytes','allOwnedAssetServerDigestsAndFullReadbacksMatch']}))
