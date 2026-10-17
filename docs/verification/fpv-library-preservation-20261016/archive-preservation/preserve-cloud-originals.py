"""Preserve exact Actions wrappers without extracting or qualifying player packages."""
from pathlib import Path, PurePosixPath
import base64, datetime, hashlib, http.client, io, json, re, ssl, subprocess
import time, urllib.error, urllib.parse, urllib.request, zipfile

ROOT = Path('/tmp/fpv-library-archive-preservation-20261016')
REPO = 'mekhovov/revealline'
RELEASE = 414505790
HEAD = 'b65d80f716b8db646bfdf5f714892f1c0f6409b0'
MANUAL_RUN = 38844826436
PR_RUN = 38844752667
ORIGINALS = [12022193739, 12022169497, 12022404306]
VARIANTS = [12022893240, 12023586313]
EXPECTED = {
 12022193739: (23157773, '90dd794fa64e7601f4909f1b19f0e124f0459b0b9d35d8852b78ff4e5f0ec6f5'),
 12022169497: (78418143, '5b58b6edad94eda3dc092f068f29a71553c8218bd931dddc45d78db28368889b'),
 12022404306: (61617, '5c609f93f64c4aef0875ad40ac62d5c9db9d6932ac70712e4f3ede4efa3637c3'),
 12022893240: (23157773, '389197ca7c679550e71638d7bf2e70b007883c5af1dbffd3f0c8ead8f871bf56'),
 12023586313: (996291, '50314e05aafc0863e6be34781c779a5bef3aabed56620be73f7ddcb330929cb2'),
}
TOKEN = subprocess.check_output(['gh', 'auth', 'token'], text=True).strip()
HEADERS = {'Authorization': 'Bearer '+TOKEN, 'Accept': 'application/vnd.github+json',
 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'FPV-Preservation'}
VENDOR_SHA = '02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0'
SECRET = re.compile(rb'(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----)')
BAD_NAMES = {'.env', '.npmrc', '.pypirc', 'credentials', 'credentials.json', 'id_rsa', 'id_ed25519', 'auth.json', 'token.json', 'key.pem'}
TEXT_SUFFIXES = {'.mjs', '.js', '.cjs', '.json', '.map', '.css', '.html', '.md', '.txt', '.svg', '.yml', '.yaml', '.toml', '.lock', '.py', '.sh'}

def now(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def digest(data): return hashlib.sha256(data).hexdigest()
def save(path, value): path.write_text(json.dumps(value, indent=2)+'\n')
def api(path):
 with urllib.request.urlopen(urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path, headers=HEADERS), timeout=90) as response:
  return json.load(response)

class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self, req, fp, code, msg, headers, newurl): return None

def binary(path, keep=False):
 accept = 'application/vnd.github+json' if path.startswith('actions/') else 'application/octet-stream'
 request = urllib.request.Request('https://api.github.com/repos/'+REPO+'/'+path+'?preservation_readback='+str(time.time_ns()), headers={**HEADERS, 'Accept':accept})
 try: response = urllib.request.build_opener(NoRedirect).open(request, timeout=90)
 except urllib.error.HTTPError as error:
  if error.code not in (301,302,303,307,308): raise RuntimeError('Binary API HTTP '+str(error.code)) from None
  location = error.headers['Location']
  assert urllib.parse.urlparse(location).scheme == 'https'
  # Signed storage URLs receive no authorization token.
  response = urllib.request.urlopen(urllib.request.Request(location, headers={'User-Agent':'FPV-Preservation'}), timeout=180)
 h = hashlib.sha256(); count = 0; content = io.BytesIO() if keep else None
 with response:
  assert response.status == 200 and 'json' not in response.headers.get('Content-Type','')
  while chunk := response.read(1024*1024):
   count += len(chunk); h.update(chunk)
   if content is not None: content.write(chunk)
 return {'bytes':count, 'sha256':h.hexdigest()}, content.getvalue() if content is not None else None

def inspect(raw, label, artifact_dir):
 result = {'members':[], 'forbiddenNames':[], 'unmatchedSecretPatternMembers':[], 'knownVendorWasmPatternOccurrences':[], 'nestedArchives':0}
 def walk(data, prefix='', depth=0):
  assert depth <= 4
  with zipfile.ZipFile(io.BytesIO(data)) as archive:
   names = archive.namelist(); assert len(names) == len(set(names)), label
   for entry in archive.infolist():
    if entry.is_dir(): continue
    name = entry.filename; p = PurePosixPath(name); base = p.name.lower(); where = prefix+name
    assert not p.is_absolute() and '..' not in p.parts and '\\' not in name
    forbidden = base in BAD_NAMES or (base.startswith('.env.') and base not in {'.env.example','.env.sample','.env.template'}) or any(part in {'.git','.ssh','.aws'} for part in p.parts) or base.endswith(('.p12','.pfx'))
    if forbidden: result['forbiddenNames'].append(where)
    body = archive.read(entry); sha = digest(body)
    result['members'].append({'path':where, 'bytes':len(body), 'sha256':sha, 'compressedBytes':entry.compress_size, 'crc32':f'{entry.CRC:08x}', 'depth':depth})
    if depth == 0 and p.suffix.lower() == '.json':
     out = artifact_dir/'payloads'/name; out.parent.mkdir(parents=True, exist_ok=True)
     if out.exists(): assert out.read_bytes() == body
     else: out.write_bytes(body)
    if p.suffix.lower() == '.zip':
     result['nestedArchives'] += 1; walk(body, where+'!', depth+1)
    elif p.suffix.lower() in TEXT_SUFFIXES or base in {'license','readme','dockerfile'}:
     hits = list(SECRET.finditer(body))
     if hits:
      known = where.endswith('optional-practice/civilian-fpv/vendor/rapier/rapier.mjs') and sha == VENDOR_SHA and len(body) == 4340292 and len(hits) == 2
      if known:
       quote = body.rfind(b'"', 0, hits[0].start()); end = body.find(b'"', hits[-1].end())
       wasm = base64.b64decode(body[quote+1:end], validate=True)
       known = wasm[:8] == b'\x00asm\x01\x00\x00\x00' and all(hit.group().startswith(b'AKIA') for hit in hits)
      if known:
       result['knownVendorWasmPatternOccurrences'].append({'member':where, 'vendorSHA256':sha, 'decodedWasmMagicVersion':'0061736d01000000', 'hitOffsets':[hit.start() for hit in hits], 'hitSHA256':[digest(hit.group()) for hit in hits], 'review':'Exact public vendor hash and decoded WASM string; same narrow exception as preserved prior preflight.'})
      else: result['unmatchedSecretPatternMembers'].append(where)
 walk(raw)
 result['memberCountIncludingNested'] = len(result['members'])
 result['uncompressedBytesIncludingNested'] = sum(row['bytes'] for row in result['members'])
 assert result['uncompressedBytesIncludingNested'] < 1024**3
 result['inspectionPassed'] = not result['forbiddenNames'] and not result['unmatchedSecretPatternMembers']
 assert result['inspectionPassed'], label+' requires member review'
 save(artifact_dir/'member-manifest.json', result)
 return result

def all_assets():
 rows=[]; page=1
 while True:
  batch=api(f'releases/{RELEASE}/assets?per_page=100&page={page}'); rows += batch
  if len(batch)<100: return rows
  page += 1

def preserve(raw, metadata, inspection):
 size, sha = EXPECTED[metadata['id']]; existing=all_assets()
 matches=[row for row in existing if row.get('digest')=='sha256:'+sha and row['size']==size and row['state']=='uploaded']
 reused=bool(matches)
 if reused: asset=matches[0]
 else:
  name=f"actions-b65d80f7-{metadata['id']}--{metadata['name'].split('-b65d80f7')[0]}--{sha[:12]}.zip"
  assert not any(row['name']==name for row in existing), 'Existing name preserved; no clobber'
  query=urllib.parse.urlencode({'name':name,'label':'Original b65 Actions archive; backup only; not package or native qualification'})
  conn=http.client.HTTPSConnection('uploads.github.com',timeout=300,context=ssl.create_default_context());conn.blocksize=1024*1024
  try:
   conn.request('POST', f'/repos/{REPO}/releases/{RELEASE}/assets?'+query, body=io.BytesIO(raw), headers={**HEADERS,'Content-Type':'application/zip','Content-Length':str(size)})
   response=conn.getresponse(); body=response.read()
   if response.status!=201:raise RuntimeError('Asset upload HTTP '+str(response.status))
   asset=json.loads(body)
  finally:conn.close()
 asset=api('releases/assets/'+str(asset['id']))
 assert asset['state']=='uploaded' and asset['size']==size and asset['digest']=='sha256:'+sha
 readback,_=binary('releases/assets/'+str(asset['id']))
 assert readback=={'bytes':size,'sha256':sha}
 after=api('actions/artifacts/'+str(metadata['id']))
 assert all(after[key]==metadata[key] for key in ['id','name','size_in_bytes','digest','expired','workflow_run'])
 save(ROOT/'cloud-provenance'/str(metadata['id'])/'artifact-metadata-after.json',after)
 assert digest(raw)==sha and len(raw)==size
 return {'sourceKind':'GitHub Actions original archive','sourceArtifactID':metadata['id'],'sourceArtifactAPI':metadata['archive_download_url'],'sourceWorkflowRunID':metadata['workflow_run']['id'],'sourceHeadSHA':HEAD,'qualifierDirectory':'actions-b65d80f7-run'+str(metadata['workflow_run']['id']),'originalName':metadata['name']+'.zip','bytes':size,'sha256':sha,'releaseID':RELEASE,'assetID':asset['id'],'assetName':asset['name'],'assetURL':asset['browser_download_url'],'assetAPIURL':asset['url'],'serverDigest':asset['digest'],'serverBytes':asset['size'],'reusedExistingAssetByDigest':reused,'fullReadback':{**readback,'method':'Full authenticated release asset download streamed and hashed without disk duplicate'},'sourceMetadataStableBeforeAndAfterUpload':True,'sourceArchiveHashStableBeforeAndAfterUpload':True,'memberManifest':'cloud-provenance/'+str(metadata['id'])+'/member-manifest.json','memberManifestSHA256':digest((ROOT/'cloud-provenance'/str(metadata['id'])/'member-manifest.json').read_bytes()),'inspectionPassed':inspection['inspectionPassed'],'preserved':True,'verifiedAt':now(),'scope':'Backup integrity only. No package, native, player, device, public or performance qualification.'}

release=api('releases/'+str(RELEASE))
assert release['draft'] and release['tag_name']=='fpv-development-preservation-20261016'
base=json.loads((ROOT/'release-assets-manifest.json').read_text());assert base['complete'] and len(base['archives'])==17
manual_run=api('actions/runs/'+str(MANUAL_RUN));pr_run=api('actions/runs/'+str(PR_RUN))
assert manual_run['head_sha']==pr_run['head_sha']==HEAD and manual_run['conclusion']=='success'
save(ROOT/'cloud-workflow-runs.json', {'capturedAt':now(),'scope':'Provenance only; workflow success does not qualify original packages or native behavior.','manual':manual_run,'pullRequest':pr_run})
progress=ROOT/'cloud-originals-progress.json'
record=json.loads(progress.read_text()) if progress.exists() else {'format':'fpv-cloud-original-preservation.v1','releaseID':RELEASE,'sourceHeadSHA':HEAD,'startedAt':now(),'archives':[],'complete':False}
record.setdefault('supplementalDistinctEvidenceArchives',[])
top_members={}
for artifact_id in ORIGINALS+VARIANTS:
 directory=ROOT/'cloud-provenance'/str(artifact_id);directory.mkdir(parents=True,exist_ok=True)
 metadata=api('actions/artifacts/'+str(artifact_id));size,sha=EXPECTED[artifact_id]
 assert not metadata['expired'] and metadata['size_in_bytes']==size and metadata['digest']=='sha256:'+sha
 assert metadata['workflow_run']['head_sha']==HEAD and metadata['workflow_run']['id']==(MANUAL_RUN if artifact_id in ORIGINALS else PR_RUN)
 save(directory/'artifact-metadata-before.json', metadata)
 found=next((row for row in record['archives']+record['supplementalDistinctEvidenceArchives'] if row['sourceArtifactID']==artifact_id),None)
 if found:
  inspection=json.loads((directory/'member-manifest.json').read_text())
  top_members[artifact_id]={row['path']:(row['bytes'],row['sha256']) for row in inspection['members'] if row['depth']==0}
  print(json.dumps({'resumedVerifiedOriginalArtifactID':artifact_id,'assetID':found['assetID']}),flush=True);continue
 origin,raw=binary('actions/artifacts/'+str(artifact_id)+'/zip',keep=True)
 assert origin=={'bytes':size,'sha256':sha}
 inspection=inspect(raw,metadata['name'],directory)
 top_members[artifact_id]={row['path']:(row['bytes'],row['sha256']) for row in inspection['members'] if row['depth']==0}
 save(directory/'original-download-receipt.json',{'capturedAt':now(),**origin,'sourceArtifactID':artifact_id,'memberInspectionPassed':True,'method':'Full authenticated original Actions ZIP downloaded to memory and hashed. No local large copy, extraction or package execution.'})
 if artifact_id in ORIGINALS:
  saved=preserve(raw,metadata,inspection);record['archives'].append(saved);record['updatedAt']=now();save(progress,record)
  print(json.dumps({'verifiedCloudOriginals':len(record['archives']),'total':3,'artifactID':artifact_id,'assetID':saved['assetID'],'bytes':size,'sha256':sha,'fullReadback':True}),flush=True)
 else:
  after=api('actions/artifacts/'+str(artifact_id));assert all(after[key]==metadata[key] for key in ['id','name','size_in_bytes','digest','expired','workflow_run'])
  save(directory/'artifact-metadata-after.json',after)
  if artifact_id==12023586313:
   saved=preserve(raw,metadata,inspection);record['supplementalDistinctEvidenceArchives'].append(saved);record['updatedAt']=now();save(progress,record)
   print(json.dumps({'verifiedSupplementalDistinctOriginalArtifactID':artifact_id,'assetID':saved['assetID'],'bytes':size,'sha256':sha,'fullReadback':True}),flush=True)
  print(json.dumps({'preservedVariantProvenance':artifact_id,'bytes':size,'sha256':sha,'topLevelMembers':len(top_members[artifact_id]),'payloadJSONsSaved':len(list((directory/'payloads').rglob('*.json')))}),flush=True)
 del raw
record['complete']=len(record['archives'])==3 and len(record['supplementalDistinctEvidenceArchives'])==1;record['completedAt']=now();save(progress,record)
assert record['complete']
comparison={'capturedAt':now(),'sourceHeadSHA':HEAD,'manualRunID':MANUAL_RUN,'pullRequestRunID':PR_RUN,'optional':{'manualArtifactID':12022193739,'pullRequestArtifactID':12022893240,'sameEveryTopLevelMemberBytesAndSHA256':top_members[12022193739]==top_members[12022893240],'manualTopLevelMemberCount':len(top_members[12022193739]),'pullRequestTopLevelMemberCount':len(top_members[12022893240]),'wrapperDigestDiffers':EXPECTED[12022193739][1]!=EXPECTED[12022893240][1],'releaseAssetUploadedForPRVariant':False},'capacity':{'manualArtifactID':12022404306,'pullRequestArtifactID':12023586313,'sameEveryTopLevelMemberBytesAndSHA256':top_members[12022404306]==top_members[12023586313],'manualTopLevelMemberCount':len(top_members[12022404306]),'pullRequestTopLevelMemberCount':len(top_members[12023586313]),'pullRequestAllTopLevelMembersPreservedAsExactJSONPayloads':all(name.endswith('.json') for name in top_members[12023586313]),'releaseAssetUploadedForPRVariant':True,'scope':'Distinct original PR wrapper preserved as supplemental21st release asset, plus all exact JSON payloads and member provenance in Git.'}}
assert comparison['optional']['sameEveryTopLevelMemberBytesAndSHA256']
def recursive_members(artifact_id):
 data=json.loads((ROOT/'cloud-provenance'/str(artifact_id)/'member-manifest.json').read_text())
 return {row['path']:(row['bytes'],row['sha256']) for row in data['members']}
comparison['optional']['sameEveryRecursiveMemberBytesAndSHA256']=recursive_members(12022193739)==recursive_members(12022893240)
comparison['optional']['recursiveMemberCount']=len(recursive_members(12022193739))
assert comparison['optional']['sameEveryRecursiveMemberBytesAndSHA256']
assert comparison['capacity']['pullRequestAllTopLevelMembersPreservedAsExactJSONPayloads']
save(ROOT/'cloud-pr-variant-comparison.json',comparison)
combined={**base,'format':'fpv-original-release-preservation.v2','archives':base['archives']+record['archives'],'externalOriginalPathCount':17,'cloudOriginalArtifactCount':3,'complete':True,'completedAt':now(),'remainingOriginalPaths':[],'remainingCloudArtifactIDs':[],'totalOriginalPathBytes':sum(row['bytes'] for row in base['archives']),'totalPreservedOriginalBytes':sum(row['bytes'] for row in base['archives']+record['archives']),'uniqueAssetIDs':len({row['assetID'] for row in base['archives']+record['archives']}),'cloudVariantProvenance':'cloud-pr-variant-comparison.json','scope':'Exact archive preservation and restore integrity. Backup status does not grant package/native/public/physical/performance qualification.'}
save(ROOT/'release-assets-manifest-20.json',combined)
combined21={**combined,'format':'fpv-original-release-preservation.v3','archives':combined['archives']+record['supplementalDistinctEvidenceArchives'],'cloudOriginalArtifactCount':4,'requestedTwentyOriginalCohortComplete':True,'supplementalDistinctPRCapacityArtifactID':12023586313,'totalPreservedOriginalBytes':sum(row['bytes'] for row in combined['archives']+record['supplementalDistinctEvidenceArchives']),'uniqueAssetIDs':len({row['assetID'] for row in combined['archives']+record['supplementalDistinctEvidenceArchives']})}
save(ROOT/'release-assets-manifest-21.json',combined21)
print(json.dumps({'complete':True,'originalArchives':21,'uniqueAssets':combined21['uniqueAssetIDs'],'bytes':combined21['totalPreservedOriginalBytes'],'remaining':[]}),flush=True)
