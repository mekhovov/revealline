from pathlib import Path
import json,subprocess,hashlib,zipfile,os,sys
HEAD=sys.argv[1];RUN=int(sys.argv[2])
assert len(HEAD)==40 and all(c in '0123456789abcdef' for c in HEAD)
temp=Path('/Volumes/alex/CodexMigrationStaging/fpv-temp')
env={**os.environ,'TMPDIR':str(temp),'TMP':str(temp),'TEMP':str(temp)}
api=lambda endpoint:json.loads(subprocess.check_output(['gh','api',endpoint],env=env))
run=api(f'repos/mekhovov/revealline/actions/runs/{RUN}')
assert run['head_sha']==HEAD
jobs=api(f'repos/mekhovov/revealline/actions/runs/{RUN}/jobs')['jobs']
job=next(row for row in jobs if row['name']=='optional-practice')
assert job['conclusion']=='success','Exact optional job not successful; no artifact download started'
artifacts=api(f'repos/mekhovov/revealline/actions/runs/{RUN}/artifacts')['artifacts']
row=next(row for row in artifacts if row['name']=='optional-flight-candidate-'+HEAD and not row['expired'])
metadata=api('repos/mekhovov/revealline/actions/artifacts/'+str(row['id']))
assert metadata['workflow_run']['head_sha']==HEAD and metadata['workflow_run']['id']==RUN
root=Path('/Volumes/alex/CodexMigrationStaging/fpv-package-qualification-20261014')/('regional-family-library-'+HEAD[:8])
root.mkdir(exist_ok=False)
(root/'github-artifact-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
partial=root/'github-artifact.downloading'
assert not partial.exists()
with partial.open('xb') as file:
 subprocess.run(['gh','api',f"repos/mekhovov/revealline/actions/artifacts/{row['id']}/zip"],stdout=file,check=True,env=env)
assert zipfile.is_zipfile(partial)
assert partial.stat().st_size==metadata['size_in_bytes']
assert metadata['digest']=='sha256:'+hashlib.sha256(partial.read_bytes()).hexdigest()
partial.rename(root/'github-artifact.zip')
subprocess.run(['python3','/tmp/fpv-library-combined-qualification-20261016/qualify-combined-optional.py',HEAD,str(RUN)],env=env,check=True)

