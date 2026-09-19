"""Run the single reviewed archive30 public audit on a hosted runner."""
from pathlib import Path
import argparse,datetime,hashlib,json,os,shutil,subprocess,sys
HERE=Path(__file__).resolve().parent
CAP=32*1024**2
sha=lambda b:hashlib.sha256(b).hexdigest()
def strict(raw):
    def pairs(items):
        result={}
        for k,v in items:
            if k in result: raise ValueError('Duplicate binding key')
            result[k]=v
        return result
    return json.loads(raw,object_pairs_hook=pairs)
def validate_binding(raw):
    if len(raw.encode())>16384: raise ValueError('Binding exceeds limit')
    value=strict(raw);expected=strict((HERE/'binding.proposed.json').read_text());expected['reviewed']=True
    if value!=expected: raise ValueError('Exact reviewed archive30 binding required')
    return value
def guard(root):
    if sum(p.stat().st_size for p in root.rglob('*') if p.is_file())>CAP: raise ValueError('Evidence budget exceeded')
    if shutil.disk_usage(root).free<512*1024**2: raise ValueError('Free reserve required')
def git(source,*args):
    return subprocess.check_output(['git','-C',str(source),*args],env={**os.environ,'GIT_NO_LAZY_FETCH':'1','GIT_OPTIONAL_LOCKS':'0'},timeout=20)
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--source',required=True,type=Path);parser.add_argument('--out',required=True,type=Path);args=parser.parse_args()
    raw=os.environ['ARCHIVE_BINDING'];binding=validate_binding(raw);source=args.source.resolve();out=args.out.absolute()
    if out.exists() or source.is_symlink(): raise ValueError('Fresh evidence output and ordinary source required')
    if git(source,'rev-parse','HEAD').decode().strip()!=binding['archiveCommit'] or git(source,'rev-parse','HEAD^{tree}').decode().strip()!=binding['archiveTree'] or git(source,'status','--porcelain','--untracked-files=no'): raise ValueError('Frozen archive checkout changed')
    pins=json.loads((HERE/'payload-pins.json').read_bytes())
    for row in pins:
        p=HERE/'payload'/row['path'];body=p.read_bytes()
        if p.is_symlink() or len(body)!=row['bytes'] or sha(body)!=row['sha256']: raise ValueError('Audit payload changed')
    for name,key in [('expected-inventory.json','inventorySha256'),('source-lock.json','sourceLockSha256')]:
        if sha((source/name).read_bytes())!=binding[key] or (source/name).read_bytes()!=(HERE/'payload/http/inputs'/name).read_bytes(): raise ValueError('Archive input differs')
    shutil.copytree(HERE/'payload',out);guard(out);(out/'dispatch-binding.original.json').write_text(raw);(out/'utility-runner.py').write_bytes(Path(__file__).read_bytes());(out/'payload-pins.original.json').write_bytes((HERE/'payload-pins.json').read_bytes())
    identity={'archiveCommit':binding['archiveCommit'],'archiveTree':binding['archiveTree'],'utilityWorkflowSha':os.environ.get('UTILITY_WORKFLOW_SHA'),'hostedRunId':os.environ.get('GITHUB_RUN_ID'),'hostedRunAttempt':os.environ.get('GITHUB_RUN_ATTEMPT'),'sourcePath':str(source),'payloadFiles':len(pins),'payloadBytes':sum(x['bytes'] for x in pins)}
    (out/'hosted-identity.json').write_text(json.dumps(identity,indent=2)+'\n')
    env={**os.environ,'REVEALLINE_ARCHIVE_SOURCE':str(source),'PYTHONDONTWRITEBYTECODE':'1','PYTHONOPTIMIZE':'0','GIT_NO_LAZY_FETCH':'1','GIT_OPTIONAL_LOCKS':'0'}
    steps=[]
    for name,cmd,timeout in [('binding',[sys.executable,'-B','-c','from audit_binding import validate_execution_binding; print(validate_execution_binding()["requestSha256"])'],60),('audit',[sys.executable,'-B',str(out/'http/run-reviewed-operations.py')],2160),('reconcile',[sys.executable,'-B',str(out/'http/reconcile-completed-rows.py')],60)]:
        start=datetime.datetime.now(datetime.timezone.utc).isoformat();timed=False
        with (out/(name+'.stdout')).open('xb') as stdout,(out/(name+'.stderr')).open('xb') as stderr:
            try: result=subprocess.run(cmd,cwd=out/'http/http-tools',env=env,stdout=stdout,stderr=stderr,timeout=timeout);code=result.returncode
            except subprocess.TimeoutExpired: timed=True;code=None
        steps.append({'name':name,'command':cmd,'startedAt':start,'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exitCode':code,'timedOut':timed});guard(out)
        if code!=0: break
    passed=len(steps)==3 and all(s['exitCode']==0 for s in steps)
    if git(source,'rev-parse','HEAD').decode().strip()!=binding['archiveCommit'] or git(source,'status','--porcelain','--untracked-files=no'): passed=False
    report={'status':'PASS_HTTP_ROWS_ONLY' if passed else 'FAIL','steps':steps,'sourceUnchanged':git(source,'rev-parse','HEAD^{tree}').decode().strip()==binding['archiveTree'],'nativeAcceptance':False,'releaseAcceptance':False,'publicAdmission':False}
    (out/'hosted-result.json').write_text(json.dumps(report,indent=2)+'\n');guard(out);print(json.dumps(report));return 0 if passed else 1
if __name__=='__main__': raise SystemExit(main())
