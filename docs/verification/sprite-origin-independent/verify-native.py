from pathlib import Path
import json,hashlib,subprocess,struct,copy
root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');out=Path(__file__).resolve().parent
pack=root/'.cache/p04-sprite-origin-native-packet-r1';native=pack/'candidate/docs/verification/p04-sprite-origin-native'
assert hashlib.sha256((pack/'source.patch').read_bytes()).hexdigest()=='e4c09f7fe89f59c9a9ea654d893245720f51cb0a83cb14cf6c84d7e461897dd7'
for name,r in json.loads((pack/'candidate-pins.json').read_text()).items():
 b=(pack/'candidate'/name).read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],name
cache={}
for origin in ['a','b']:
 rows=[json.loads(x) for x in (native/f'bindings-origin-{origin}.jsonl').read_text().splitlines()]
 for r in rows:
  name=r['path']; key=(name,r['sha256'])
  if key not in cache:
   b=(out/'candidate'/name).read_bytes() if r['origin']=='candidate' else subprocess.check_output(['git','show','8cffb36b29a38013eb9213845efd675c4864c9d8:'+name],cwd=root)
   assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256'],key
   cache[key]=True
 assert len(rows)==297 and sum(r['bytes'] for r in rows)==10042970
export=json.loads((native/'export-receipt.json').read_text());rt=json.loads((native/'roundtrip-receipt.json').read_text())
def parse(info):
 b=Path(info['path']).read_bytes();assert len(b)==info['bytes'] and hashlib.sha256(b).hexdigest()==info['sha256']
 assert b[:8]==b'RLTHM1\r\n';n=struct.unpack('>I',b[8:12])[0];m=json.loads(b[12:12+n]);pos=12+n;assets={}
 for r in m['assets']:
  data=b[pos:pos+r['bytes']];pos+=r['bytes'];assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'];assert r['sha256'] not in assets;assets[r['sha256']]=data
 assert pos==len(b)
 return m['document'],assets
before,first=parse(export);after,last=parse(rt['freshOriginReexport']);assert first==last and len(first)==134 and sum(map(len,first.values()))==4010515
mapping=rt['mapping'];lookup={str(r['id'])+'@'+str(r['revision']):r for r in after['assets']}
def remap(ref):
 key=ref['id']+'@'+str(ref['revision'])
 if key in mapping:
  ident,revision=mapping[key].rsplit('@',1);return {'id':ident,'revision':int(revision)}
 return ref
for record in before['assets']:
 owned=copy.deepcopy(record);owned.update(remap({'id':record['id'],'revision':record['revision']}))
 if owned['provenance']['parent']:owned['provenance']['parent']=remap(owned['provenance']['parent'])
 assert owned==lookup[owned['id']+'@'+str(owned['revision'])],owned['id']
assert len(before['assets'])==1354
report={'packetSha256':'e4c09f7fe89f59c9a9ea654d893245720f51cb0a83cb14cf6c84d7e461897dd7','uniqueSourceBindingsPerOrigin':297,'bytesPerOrigin':10042970,'sourceVerification':'All candidates matched freshly applied patches, every other observed blob matched exact8cff regardless of historical origin label.','downloadedBytes':[export['bytes'],rt['freshOriginReexport']['bytes']],'downloadedHashes':[export['sha256'],rt['freshOriginReexport']['sha256']],'exactPayloads':len(first),'exactPayloadBytes':sum(map(len,first.values())),'exactPriorRecordsAfterDeclaredRemapping':len(before['assets']),'namespaceMapping':mapping,'limitation':'Independent bytes/source/metadata review of owner native observations; no second native journey or physical-device acceptance.'}
(out/'native-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
