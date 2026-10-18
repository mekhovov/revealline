from pathlib import Path,PurePosixPath
import subprocess,json,hashlib,zipfile,io,re,datetime,os,sys,traceback
N=Path(__file__).resolve().parent;sha=lambda b:hashlib.sha256(b).hexdigest()
assert len(sys.argv)==3
planRaw=(N/'presentation-verification-plan.json').read_bytes();assert sha(planRaw)==sys.argv[1];P=json.loads(planRaw)
approvalRaw=(N/'ROOT-ONCE-PRESENTATION-APPROVAL.json').read_bytes();assert sha(approvalRaw)==sys.argv[2];approval=json.loads(approvalRaw)
assert approval['status']=='APPROVED_ONCE' and approval['planSHA256']==sys.argv[1] and approval['helperSHA256']==sha(Path(__file__).read_bytes()) and approval['head']==P['head'] and approval['artifact']==P['artifact']
for key in ['TMPDIR','TMP','TEMP']:assert os.environ[key]==str(N)
H=P['head'];TREE=P['tree'];RUN=P['run'];AID=P['artifact'];JOB=P['job']
def reserve(extra=0):
 s=os.statvfs(N);assert s.f_bavail*s.f_frsize>=3*1024**3+65*1024**2+256*1024+extra
def api(p):
 reserve()
 return json.loads(subprocess.check_output(['/opt/homebrew/bin/gh','api','repos/mekhovov/revealline/'+p],cwd='/'))
def put(p,b):
 reserve(len(b))
 with p.open('xb')as f:f.write(b);f.flush();os.fsync(f.fileno())
def record(name,obj):put(OUT/name,(json.dumps(obj,indent=2)+'\n').encode())
reserve();OUT=N/'presentation-actual-once';OUT.mkdir(exist_ok=False)
record('actual-intent.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':H,'tree':TREE,'run':RUN,'artifact':AID,'planSHA256':sys.argv[1],'approvalSHA256':sys.argv[2],'helperSHA256':sha(Path(__file__).read_bytes()),'oneInvocation':True,'scope':'One original current presentation artifact read and receipt/TAP validation; no tests rerun.'})
try:
 canonicalPath=Path(P['canonicalCommit']['path']);canonicalRaw=canonicalPath.read_bytes()
 assert len(canonicalRaw)==P['canonicalCommit']['bytes'] and sha(canonicalRaw)==P['canonicalCommit']['SHA256']
 canonical=json.loads(canonicalRaw);assert canonical['sha']==H and canonical['tree']['sha']==TREE and [x['sha']for x in canonical['parents']]==P['parents']
 manifestPath=Path(P['manifest']['path']);manifestBytes=manifestPath.read_bytes()
 assert len(manifestBytes)==P['manifest']['bytes'] and sha(manifestBytes)==P['manifest']['SHA256']
 assert hashlib.sha1(b'blob '+str(len(manifestBytes)).encode()+b'\0'+manifestBytes).hexdigest()==P['manifest']['gitBlob']
 manifest=json.loads(manifestBytes);expectedFiles=next(x['files']for x in manifest['phases']if x['id']=='presentation')
 assert len(expectedFiles)==41 and len(set(expectedFiles))==41 and P['expectedFiles']==expectedFiles
 job=api('actions/jobs/'+str(JOB));assert job['run_id']==RUN and job['head_sha']==H and job['conclusion']=='success' and job['name']=='feature (presentation)'
 m=api('actions/artifacts/'+str(AID));assert m['workflow_run']['head_sha']==H and m['workflow_run']['id']==RUN and m['name']=='industrial-presentation-'+H and not m['expired'] and m['size_in_bytes']==P['artifactBytes'] and m['digest']=='sha256:'+P['artifactSHA256']
 record('presentation-original-artifact-metadata.json',m)
 reserve(P['artifactBytes'])
 r=subprocess.run(['/opt/homebrew/bin/gh','api','--allow-escape-sequences','repos/mekhovov/revealline/actions/artifacts/'+str(AID)+'/zip'],capture_output=True,cwd='/')
 record('presentation-download-terminal.json',{'exitCode':r.returncode,'stderr':r.stderr.decode(),'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 assert r.returncode==0 and len(r.stdout)==m['size_in_bytes'] and 'sha256:'+sha(r.stdout)==m['digest']
 put(OUT/'presentation-original-receipts.zip',r.stdout)
 with zipfile.ZipFile(io.BytesIO(r.stdout))as z:
  rows=z.infolist();assert len(rows)==len({x.filename for x in rows})==3 and sum(x.file_size for x in rows)<256*1024
  for x in rows:
   path=PurePosixPath(x.filename);assert x.filename and not path.is_absolute() and '..'not in path.parts and '\\'not in x.filename and not x.is_dir() and ((x.external_attr>>16)&0o170000)!=0o120000 and not(x.flag_bits&1)
  bodies={x.filename:z.read(x)for x in rows}
  receiptNames=[x for x in bodies if x.endswith('/presentation.json')];tapNames=[x for x in bodies if x.endswith('/presentation.tap')];assert len(receiptNames)==len(tapNames)==1
  p=json.loads(bodies[receiptNames[0]]);tap=bodies[tapNames[0]]
 assert p['source']['revision']==H and p['source']['tree']==TREE and not p['source']['dirty']
 assert p['passed'] and p['sourceUnchanged'] and p['testedFilesUnchanged'] and not p['timedOut'] and not p['interrupted'] and p['executionError']is None and p['logSha256']==sha(tap)
 summary={k:int(re.findall(r'^# '+k+r' (\d+)$',tap.decode(),re.M)[-1])for k in['tests','pass','fail','cancelled','skipped','todo']}
 assert summary['tests']==summary['pass']>0 and all(summary[k]==0 for k in ['fail','cancelled','skipped','todo'])
 assert p['summary']['exitCode']==0 and p['summary']['passed'] and all(p['summary'][k]==v for k,v in summary.items())
 assert p['manifestSha256']==sha(manifestBytes) and p['phase']=='presentation' and p['logReadError']is None and p['sourceVerificationError']is None
 assert p['command']==['node','--test','--test-reporter=tap','--test-concurrency=2',*expectedFiles]
 assert [x['file']for x in p['files']]==expectedFiles
 for file,pin in P['libraryTests'].items():assert file in p['command'] and next(x for x in p['files']if x['file']==file)['sha256']==pin['sha256']
 out={'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':H,'tree':TREE,'run':RUN,'job':JOB,'artifactId':AID,'archiveBytes':len(r.stdout),'archiveSHA256':sha(r.stdout),'artifactExpiresAt':m['expires_at'],'canonicalCommitReadbackSHA256':sha(canonicalRaw),'allThreeMembersCRC':True,'sourceBoundReceipt':p,'summary':summary,'scope':'Actual current isolated-head presentation software execution with canonical source tree, exact manifest/files/command and original TAP hash. Actual counts only, no inherited405, no synthetic or common-tree-only relabeling. No native/player/public or later-main acceptance.'}
 record('presentation-exact-head-verification.json',out)
 record('actual-terminal.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualExitCode':0,'head':H,'run':RUN,'receiptSHA256':sha((OUT/'presentation-exact-head-verification.json').read_bytes())})
 print(json.dumps({'head':H,'artifactId':AID,'summary':summary,'receiptSHA256':sha((OUT/'presentation-exact-head-verification.json').read_bytes())},indent=2))
except BaseException as e:
 record('actual-negative.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'type':type(e).__name__,'message':str(e),'traceback':traceback.format_exc(),'noRetry':True})
 record('actual-terminal.json',{'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualExitCode':1,'head':H,'run':RUN})
 raise
