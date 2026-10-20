from pathlib import Path
import json,subprocess,hashlib,urllib.request,urllib.error,urllib.parse,http.client,datetime,time,ssl
root=Path('/tmp/fpv-library-archive-preservation-20261016')
pre=json.loads((root/'preflight-reviewed.json').read_text());assert pre['allPassed'] and len(pre['archives'])==17
repo='mekhovov/revealline';releaseID=414505790
token=subprocess.check_output(['gh','auth','token'],text=True).strip()
headers={'Authorization':'Bearer '+token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'FPV-Library-Preservation'}
def api(path):
 req=urllib.request.Request('https://api.github.com/repos/'+repo+'/'+path,headers=headers)
 with urllib.request.urlopen(req,timeout=60) as response:return json.load(response)
release=api('releases/'+str(releaseID))
assert release['id']==releaseID and release['draft'] and release['tag_name']=='fpv-development-preservation-20261016'
def assets():
 rows=[];page=1
 while True:
  batch=api(f'releases/{releaseID}/assets?per_page=100&page={page}')
  rows+=batch
  if len(batch)<100:return rows
  page+=1
def sha_file(path):
 before=path.stat();h=hashlib.sha256();size=0
 with path.open('rb',buffering=4*1024*1024) as file:
  while chunk:=file.read(1024*1024):h.update(chunk);size+=len(chunk)
 after=path.stat()
 assert before.st_size==after.st_size==size and before.st_mtime_ns==after.st_mtime_ns,str(path)
 return h.hexdigest(),size,after.st_mtime_ns
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self, req, fp, code, msg, hdrs, newurl):return None
def readback(asset):
 h=hashlib.sha256();count=0
 request=urllib.request.Request('https://api.github.com/repos/'+repo+'/releases/assets/'+str(asset['id'])+'?preservation_readback='+str(time.time_ns()),headers={**headers,'Accept':'application/octet-stream'})
 try:response=urllib.request.build_opener(NoRedirect).open(request,timeout=60)
 except urllib.error.HTTPError as error:
  if error.code not in (301,302,303,307,308):raise RuntimeError('Asset readback initial HTTP '+str(error.code)) from None
  location=error.headers['Location']
  assert urllib.parse.urlparse(location).scheme=='https'
  response=urllib.request.urlopen(urllib.request.Request(location,headers={'User-Agent':'FPV-Library-Preservation'}),timeout=120)
 with response:
  assert response.status==200
  assert 'json' not in response.headers.get('Content-Type','')
  while chunk:=response.read(1024*1024):h.update(chunk);count+=len(chunk)
 return {'bytes':count,'sha256':h.hexdigest(),'method':'Full authenticated GitHub release asset download streamed and hashed without disk duplicate'}
recordPath=root/'release-assets-progress.json'
if recordPath.exists():
 record=json.loads(recordPath.read_text());assert record['releaseID']==releaseID
else:record={'format':'fpv-original-release-preservation.v1','releaseID':releaseID,'tag':release['tag_name'],'draft':True,'releaseURL':release['html_url'],'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'archives':[],'complete':False}
def save():
 record['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
 recordPath.write_text(json.dumps(record,indent=2)+'\n')
done={row['originalPath']:row for row in record['archives']}
for index,row in enumerate(pre['archives'],1):
 if row['originalPath'] in done:
  print(json.dumps({'resumedVerified':index,'total':17,'assetID':done[row['originalPath']]['assetID']}),flush=True);continue
 path=Path(row['originalPath']);current=path.stat()
 assert current.st_size==row['bytes'] and current.st_mtime_ns==row['sourceBefore']['mtimeNs'],str(path)
 existing=assets();matches=[asset for asset in existing if asset.get('digest')=='sha256:'+row['sha256'] and asset['size']==row['bytes'] and asset['state']=='uploaded']
 reused=bool(matches)
 if reused:asset=matches[0]
 else:
  name=row['qualifierDirectory']+'--'+Path(row['originalName']).stem+'--'+row['sha256'][:12]+'.zip'
  assert not any(asset['name']==name for asset in existing),'Asset name collision preserved; no clobber: '+name
  query=urllib.parse.urlencode({'name':name,'label':'Original immutable package archive; preservation only'})
  conn=http.client.HTTPSConnection('uploads.github.com',timeout=300,context=ssl.create_default_context())
  conn.blocksize=1024*1024
  try:
   with path.open('rb',buffering=4*1024*1024) as file:
    conn.request('POST',f'/repos/{repo}/releases/{releaseID}/assets?'+query,body=file,headers={**headers,'Content-Type':'application/zip','Content-Length':str(row['bytes'])})
    response=conn.getresponse();body=response.read()
   if response.status!=201:raise RuntimeError('Release asset upload HTTP '+str(response.status)+'; existing assets preserved')
   asset=json.loads(body)
  finally:conn.close()
 assert asset['state']=='uploaded' and asset['size']==row['bytes'] and asset.get('digest')=='sha256:'+row['sha256'],asset['id']
 actual=api('releases/assets/'+str(asset['id']))
 assert actual['size']==row['bytes'] and actual.get('digest')=='sha256:'+row['sha256'] and actual['state']=='uploaded'
 back=readback(actual)
 assert back['bytes']==row['bytes'] and back['sha256']==row['sha256'],actual['id']
 afterDigest,afterBytes,afterMtime=sha_file(path)
 assert afterDigest==row['sha256'] and afterBytes==row['bytes'] and afterMtime==row['sourceBefore']['mtimeNs'],str(path)
 saved={**row,'releaseID':releaseID,'assetID':actual['id'],'assetName':actual['name'],'assetURL':actual['browser_download_url'],'assetAPIURL':actual['url'],'serverDigest':actual['digest'],'serverBytes':actual['size'],'reusedExistingAssetByDigest':reused,'fullReadback':back,'sourceAfter':{'bytes':afterBytes,'mtimeNs':afterMtime,'sha256':afterDigest},'sourceStableBeforeAndAfterUpload':True,'preserved':True,'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 record['archives'].append(saved);save()
 print(json.dumps({'verified':len(record['archives']),'total':17,'assetID':actual['id'],'name':actual['name'],'bytes':actual['size'],'sha256':row['sha256'],'fullReadback':True,'sourceStable':True,'reused':reused}),flush=True)
record['complete']=len(record['archives'])==17
record['totalOriginalPathBytes']=sum(row['bytes'] for row in record['archives'])
record['uniqueAssetIDs']=len({row['assetID'] for row in record['archives']})
record['remainingOriginalPaths']=[row['originalPath'] for row in pre['archives'] if row['originalPath'] not in {done['originalPath'] for done in record['archives']}]
record['completedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat();save()
(root/'release-assets-manifest.json').write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({'complete':record['complete'],'paths':len(record['archives']),'uniqueAssets':record['uniqueAssetIDs'],'bytes':record['totalOriginalPathBytes'],'remaining':record['remainingOriginalPaths']}),flush=True)

