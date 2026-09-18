"""Run a named complete-file cohort under bounded time/heap; retain every result."""
import argparse, datetime, hashlib, json, os, re, signal, subprocess, time
from pathlib import Path

parser=argparse.ArgumentParser()
parser.add_argument('--label',required=True)
parser.add_argument('--runtime',default='22.22.2')
parser.add_argument('--expect',type=int,default=0)
parser.add_argument('--new-only',action='store_true')
parser.add_argument('--timeout',type=int,default=180)
args=parser.parse_args()
OUT=Path(__file__).resolve().parent
FIXTURE=Path(json.loads((OUT/'cohort.json').read_text())['worktree'])
request=json.loads((OUT/'cohort.json').read_text())
pins=json.loads((OUT/'candidate-inputs.initial.json').read_text())
files=['game/test/coop-victory-picture.test.mjs'] if args.new_only else request['cohort']
node=Path('/Users/oleksandr.mekhovov/.local/share/mise/installs/node')/args.runtime/'bin/node'
dest=OUT/'runs'/args.label
dest.mkdir(parents=True,exist_ok=False)
def actual():
    result={}
    for path in pins:
        b=(FIXTURE/path).read_bytes()
        result[path]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
    return result
before=actual()
assert all(before[p]=={k:pins[p][k] for k in ['bytes','sha256']} for p in pins)
argv=[str(node),'--max-old-space-size=1024','--test','--test-concurrency=1',*files]
start=datetime.datetime.now(datetime.timezone.utc).isoformat();at=time.monotonic();timeout=False
with (dest/'stdout').open('wb') as so,(dest/'stderr').open('wb') as se:
    process=subprocess.Popen(argv,cwd=FIXTURE,stdout=so,stderr=se,start_new_session=True)
    try: code=process.wait(timeout=args.timeout)
    except subprocess.TimeoutExpired:
        os.killpg(process.pid,signal.SIGKILL)
        process.wait()
        code=None;timeout=True
after=actual()
log=(dest/'stdout').read_text()
counts={k:int(v) for k,v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$',log,re.M)}
receipt={'source':request['source'],'sourceTree':request['sourceTree'],'label':args.label,
         'runtime':subprocess.check_output([str(node),'--version'],text=True).strip(),
         'argv':argv,'cwd':str(FIXTURE),'startedAt':start,'elapsedSeconds':round(time.monotonic()-at,3),
         'exitCode':code,'expectedExitCode':args.expect,'timeoutSeconds':args.timeout,'timedOut':timeout,'counts':counts,
         'inputCount':len(before),'inputBytes':sum(v['bytes'] for v in before.values()),
         'inputsUnchanged':before==after,'stdoutSha256':hashlib.sha256((dest/'stdout').read_bytes()).hexdigest(),
         'stderrSha256':hashlib.sha256((dest/'stderr').read_bytes()).hexdigest()}
(dest/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
(dest/'inputs.json').write_text(json.dumps(before,indent=2)+'\n')
print(json.dumps(receipt),flush=True)
assert before==after
assert code==args.expect,(code,args.expect)
