from pathlib import Path
import json,hashlib,subprocess
root=Path('/Users/oleksandr.mekhovov/work/my_projects/go_test');here=Path(__file__).resolve().parent;base='8cffb36b29a38013eb9213845efd675c4864c9d8';src=here/'source'
sha=lambda b:hashlib.sha256(b).hexdigest()
inputs=json.loads((root/'.cache/p17-studio-compiler-8cff-r1/source-inputs.json').read_text());src.mkdir(exist_ok=True)
for name,pin in inputs['files'].items():
 b=subprocess.check_output(['git','show',base+':'+name],cwd=root);assert len(b)==pin['bytes'] and sha(b)==pin['sha256'];p=src/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(src/'package.json').write_text('{"type":"module"}\n')
bundle=root/'.cache/p17-studio-transfer-8cff-r1/compiled-cli.rltheme';data=bundle.read_bytes();assert sha(data)=='dd8d17b2227fef4d2e6b63a3f73253be1dbf4f870a4f74325fff24f7ce2371e3'
offset=12+int.from_bytes(data[8:12],'big');manifest=json.loads(data[12:offset]);payload={}
for row in manifest['assets']:
 b=data[offset:offset+row['bytes']];assert sha(b)==row['sha256'];payload[row['sha256']]=b;offset+=row['bytes']
assert offset==len(data)
bad=here/'invalid-header.rltheme';bad.write_bytes(b'not-a-theme-file')
receipts=[];outputs=[]
def invoke(argv):
 r=subprocess.run(argv,cwd=src,capture_output=True,text=True);return {'argv':argv,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr}
def inventory(path):return {str(p.relative_to(path)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in path.rglob('*') if p.is_file()}
for v in ['20.19.5','22.22.2']:
 node='/Users/oleksandr.mekhovov/.local/share/mise/installs/node/'+v+'/bin/node';cmd=[node,'scripts/compile-presentation.mjs','--bundle',str(bundle)];before=inventory(src)
 valid=invoke(cmd);assert valid['exit']==0 and json.loads(valid['stdout'])['output'] is None;assert inventory(src)==before
 target='.cache/review-node'+v[:2];out=src/target;made=invoke(cmd+['--out',target]);assert made['exit']==0,made
 files=inventory(out);index=json.loads((out/'manifest.json').read_text());assert len(files)==len(index['files'])+1
 for row in index['files']:
  b=(out/row['path']).read_bytes();assert files[row['path']]=={'bytes':row['bytes'],'sha256':row['sha256']}
  if row['path'].startswith('assets/'):
   assert b==payload[Path(row['path']).stem];assert b==subprocess.check_output(['git','show',base+':game/presentation/compiled/'+row['path']],cwd=root)
 assert json.loads((out/'studio.json').read_text())==manifest['document']
 for name in ['runtime.json','studio.json']:assert json.loads((out/name).read_text())==json.loads(subprocess.check_output(['git','show',base+':game/presentation/compiled/'+name],cwd=root))
 retry=invoke(cmd+['--out',target]);assert retry['exit']==1 and 'EEXIST' in retry['stderr'];assert inventory(out)==files
 invalidTarget='.cache/invalid-node'+v[:2];invalid=invoke([node,'scripts/compile-presentation.mjs','--bundle',str(bad),'--out',invalidTarget]);assert invalid['exit']==1 and 'Unsupported theme bundle' in invalid['stderr'] and not (src/invalidTarget).exists()
 receipts.append({'node':v,'validateOnly':valid,'compile':made,'existingOutput':retry,'existingOutputUnchanged':True,'invalidHeader':invalid,'invalidOutputAbsent':True,'files':len(files),'bytes':sum(x['bytes'] for x in files.values()),'payloads':len(payload),'exactGitPayloadsAndParsedDocuments':True});outputs.append(files);print(json.dumps({'node':v,'files':len(files),'bytes':sum(x['bytes'] for x in files.values()),'result':'pass'}),flush=True)
assert outputs[0]==outputs[1]
(here/'review.json').write_text(json.dumps({'source':base,'sourceFiles':len(inputs['files']),'sourceBytes':sum(x['bytes'] for x in inputs['files'].values()),'localConfig':'package.json type:module only','bundle':{'bytes':len(data),'sha256':sha(data)},'results':receipts,'crossRuntimeOutputsEqual':True,'nativeInput':False,'publicAcceptance':False},indent=2)+'\n')
(here/'output-inventory.json').write_text(json.dumps(outputs[0],indent=2)+'\n');(here/'source-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
