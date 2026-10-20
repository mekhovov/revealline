"""Join preserved exact origin metadata and emit a compact global-backup reuse index."""
from pathlib import Path
import datetime, hashlib, json
ROOT=Path('/tmp/fpv-library-archive-preservation-20261016')
origins=json.loads((ROOT/'external-original-origin-mapping.json').read_text())
head_map={'81c0d658':'81c0d6587cdb582835a64e3d69c4c130460fb11a','8ab04b8d':'8ab04b8d948203090b9ae32da3b2d4e7c1f16bf3'}
for name in ['release-assets-manifest.json','release-assets-manifest-20.json','release-assets-manifest-21.json']:
 path=ROOT/name;record=json.loads(path.read_text())
 assert record['complete']
 for row in record['archives']:
  if row.get('sourceKind')=='GitHub Actions original archive':continue
  qualifier=row['qualifierDirectory']
  if qualifier=='library-metadata-bc9bc71f':
   row['sourceHeadSHA']='bc9bc71f192729f0661a0483d7d64609c1973343'
   assert row['sha256']=='90d2cabcebd8c4647f6abced993dfb5c40f4a19bd5829a0e15c0b5bfc321f692'
   row['sourceIdentityBasis']='Exact original distribution file and SHA256 supplied by root; source commit independently resolved through GitHub API.'
   continue
  short=qualifier.removeprefix('regional-family-library-');head=head_map[short]
  kind='company' if row['originalName']=='company-original-artifact.zip' else 'optional'
  metadata=origins[short][kind]
  assert metadata['workflow_run']['head_sha']==head
  row['sourceHeadSHA']=head
  row['sourceContainerArtifactID']=metadata['id']
  row['sourceContainerArtifactDigest']=metadata['digest']
  row['sourceWorkflowRunID']=metadata['workflow_run']['id']
  row['sourceOriginalMetadataGitRef']='7bf44e7235a5f44fd9de1ade796f5f3ce5af26f6'
  row['sourceOriginalMetadataGitPath']='docs/verification/fpv-library-preservation-20261016/qualification-'+short+'/'+('github-company-artifact-metadata.json' if kind=='company' else 'github-artifact-metadata.json')
  if row['originalName'] in {'company-original-artifact.zip','github-artifact.zip'}:
   assert metadata['digest']=='sha256:'+row['sha256'] and metadata['size_in_bytes']==row['bytes']
   row['sourceArtifactID']=metadata['id'];row['sourceArtifactAPI']=metadata['archive_download_url']
 record['originProvenanceJoinedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 path.write_text(json.dumps(record,indent=2)+'\n')

comparison_path=ROOT/'cloud-pr-variant-comparison.json';comparison=json.loads(comparison_path.read_text())
def members(artifact_id):
 data=json.loads((ROOT/'cloud-provenance'/str(artifact_id)/'member-manifest.json').read_text())
 return {row['path']:(row['bytes'],row['sha256']) for row in data['members']}
manual=members(12022193739);variant=members(12022893240)
assert manual==variant
comparison['optional'].update({'sameEveryRecursiveMemberBytesAndSHA256':True,'recursiveMemberCount':len(manual),'postTransferRecursiveEqualityVerifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
comparison_path.write_text(json.dumps(comparison,indent=2)+'\n')
final=ROOT/'release-assets-manifest-21.json';record=json.loads(final.read_text())
assert len(record['archives'])==21 and len({row['sha256'] for row in record['archives']})==21
index={row['sha256']:{'bytes':row['bytes'],'releaseID':row['releaseID'],'assetID':row['assetID'],'name':row['assetName'],'assetAPIURL':row['assetAPIURL'],'assetURL':row['assetURL'],'originalPath':row.get('originalPath'),'sourceArtifactID':row.get('sourceArtifactID'),'sourceHeadSHA':row['sourceHeadSHA'],'fullReadbackVerified':True} for row in record['archives']}
(ROOT/'release-asset-digest-index.json').write_text(json.dumps({'format':'fpv-library-owned-original-durable-digest-index.v1','manifest':'release-assets-manifest-21.json','manifestSHA256':hashlib.sha256(final.read_bytes()).hexdigest(),'complete':True,'remaining':[],'archives':index},indent=2)+'\n')
print(json.dumps({'originalArchives':len(record['archives']),'recursiveOptionalMembersEqual':len(manual),'compactDigestIndexEntries':len(index),'manifestSHA256':hashlib.sha256(final.read_bytes()).hexdigest()}))
