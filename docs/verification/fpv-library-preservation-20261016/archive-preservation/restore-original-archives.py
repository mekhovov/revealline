#!/usr/bin/env python3
"""Restore preserved originals into a NEW chosen folder; never extracts or replaces files."""
from pathlib import Path
import argparse,json,subprocess,hashlib,urllib.request,urllib.error,urllib.parse
parser=argparse.ArgumentParser()
parser.add_argument('--manifest',type=Path,default=Path(__file__).with_name('release-assets-manifest-21.json'))
parser.add_argument('--destination',type=Path,required=True)
args=parser.parse_args()
manifest=json.loads(args.manifest.read_text())
assert manifest['complete'] and not manifest['remainingOriginalPaths']
assert not manifest.get('remainingCloudArtifactIDs',[])
destination=args.destination.expanduser().resolve()
destination.mkdir(parents=False,exist_ok=False)
token=subprocess.check_output(['gh','auth','token'],text=True).strip()
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):return None
def response_for(assetID):
 request=urllib.request.Request(f'https://api.github.com/repos/mekhovov/revealline/releases/assets/{assetID}?preservation_restore=1',headers={'Authorization':'Bearer '+token,'Accept':'application/octet-stream','X-GitHub-Api-Version':'2022-11-28','User-Agent':'FPV-Original-Restore'})
 try:return urllib.request.build_opener(NoRedirect).open(request,timeout=60)
 except urllib.error.HTTPError as error:
  if error.code not in (301,302,303,307,308):raise RuntimeError('Asset API returned HTTP '+str(error.code)) from None
  location=error.headers['Location']
  assert urllib.parse.urlparse(location).scheme=='https'
  return urllib.request.urlopen(urllib.request.Request(location,headers={'User-Agent':'FPV-Original-Restore'}),timeout=120)
receipts=[]
for row in manifest['archives']:
 qualifier=row['qualifierDirectory'];name=row['originalName']
 assert Path(qualifier).name==qualifier and qualifier not in ('.','..')
 assert Path(name).name==name and name not in ('.','..')
 directory=destination/qualifier
 directory.mkdir(exist_ok=True)
 output=directory/name
 partial=output.with_name(output.name+'.downloading')
 assert not output.exists() and not partial.exists()
 h=hashlib.sha256();count=0
 with response_for(row['assetID']) as response,partial.open('xb') as file:
  assert response.status==200 and 'json' not in response.headers.get('Content-Type','')
  while chunk:=response.read(1024*1024):
   file.write(chunk);h.update(chunk);count+=len(chunk)
 assert count==row['bytes'] and h.hexdigest()==row['sha256'], 'Downloaded bytes do not match; partial preserved'
 partial.rename(output)
 receipt={'path':str(output),'assetID':row['assetID'],'bytes':count,'sha256':h.hexdigest(),'verified':True}
 receipts.append(receipt)
 print(json.dumps(receipt),flush=True)
with (destination/'restore-receipt.json').open('x') as file:
 json.dump({'sourceManifest':str(args.manifest.resolve()),'archives':receipts,'files':len(receipts),'extracted':False,'originalAlexPathsTouched':False},file,indent=2)

