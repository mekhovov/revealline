from pathlib import Path
import json,hashlib,shutil,datetime
repo=Path.cwd();evidence=repo/'docs/verification/demo-qualification-2026-09-29/packaging/integrated-c5e3419ee';locations=json.loads((evidence/'locations.json').read_text());root=Path(locations['editionOutput']);report=json.loads((root/'verification.json').read_text());before=json.loads((evidence/'source-before.json').read_text());after=json.loads((evidence/'source-after.json').read_text());old={x['path']:x for x in before['files']};new={x['path']:x for x in after['files']};changes=[name for name in sorted(old.keys()|new.keys()) if old.get(name)!=new.get(name)];assert not changes,changes
catalog=json.loads((repo/'game/demo-data/catalog.json').read_text());recordings=[('game/'+url.removeprefix('./')) for clip in catalog['clips'] for url in [clip['replayURL'],*clip['replayVariants']]];assert len(recordings)==12
required=['game/demo-bot-worker.mjs','game/demo-bot-player.mjs','game/demo-catalog.mjs','game/demo-library.mjs','game/demo-sources.mjs','game/demo-director.mjs','game/demo-experience.mjs','game/ui/demo-audio.mjs','game/ui/demo-clock.mjs','game/ui/demo-input.mjs','game/ui/demo-host.mjs','game/ui/demo-picture.mjs','game/ui/demo-fullscreen.mjs','game/ui/demo.css','game/ui/analog-signal.mjs','game/ui/signal-reception.mjs','game/ui/jammer-picture.mjs','game/ui/music-credit.mjs','game/ui/soundtrack-player.mjs','game/ui/menu-scene-motion.mjs','game/ui/menu-signal-loss.mjs','game/ui/art/menu-scenes/analog-noise-atlas.png','game/demo-data/catalog.json','game/demo-data/variant-provenance.json',*recordings]
rows=[];inventories=evidence/'edition-inventories';inventories.mkdir(exist_ok=True)
for item in report['editions']:
 site=root/item['site'];raw=(site/'offline-cache.json').read_bytes();inventory=json.loads(raw);files={f['path']:f for f in inventory['files']};checks=[]
 assert 'game/ui/art/menu-scenes/droneaid-main-background.png' not in files
 active_derivative='game/ui/art/menu-scenes/droneaid-main-background.webp'
 assert (active_derivative in files)==(item['id']=='droneaid-nl-community')
 selected_assets=[active_derivative,'game/ui/art/menu-scenes/droneaid-wordmark-light.svg'] if item['id']=='droneaid-nl-community' else []
 for name in required+selected_assets:
  assert name in files,(item['id'],name,'missing offline record');payload=(site/name).read_bytes();digest=hashlib.sha256(payload).hexdigest();assert digest==files[name]['sha256'] and len(payload)==files[name]['bytes'],(item['id'],name,'inventory mismatch');assert digest==old[name]['sha256'] and len(payload)==old[name]['bytes'],(item['id'],name,'source mismatch');checks.append({'path':name,'bytes':len(payload),'sha256':digest})
 assert inventory['totalBytes']==sum(f['bytes'] for f in inventory['files'])
 assert inventory['totalBytes']<=67108864
 assert not any(name.startswith('game/test/') for name in files)
 shutil.copyfile(site/'offline-cache.json',inventories/(item['id']+'.offline-cache.json'));shutil.copyfile(site/'edition-build.json',inventories/(item['id']+'.edition-build.json'))
 rows.append({'id':item['id'],'offlineBytes':inventory['totalBytes'],'offlineFiles':len(files),'offlineManifestSha256':hashlib.sha256(raw).hexdigest(),'requiredExactChecks':checks,'testHarnessExcluded':True})
assert len(rows)==14
shutil.copyfile(root/'verification.json',evidence/'edition-compilation.json')
summary={'kind':'current-development-edition-packaging-qualification','verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'version':report['version'],'releaseAdmitted':False,'published':False,'nativeStagingPerformed':False,'sourceFiles':len(old),'sourceChanges':changes,'editionCount':len(rows),'requiredPathsPerEdition':len(required),'exactSourceOfflineReadbacks':sum(len(r['requiredExactChecks']) for r in rows),'byteLimit':67108864,'largest':max(rows,key=lambda x:x['offlineBytes'])['id'],'largestOfflineBytes':max(r['offlineBytes'] for r in rows),'editions':rows}
(evidence/'edition-audit.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps({k:v for k,v in summary.items() if k!='editions'}))
