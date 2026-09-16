from pathlib import Path
import subprocess, json, hashlib, time, datetime, shutil, resource, sys

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).resolve().parent
FILES = json.loads((OUT / 'test-scope.json').read_bytes())
assert len(FILES) == 17 and len(set(FILES)) == 17
HOLD = json.loads((OUT / 'source-held-01.json').read_bytes())
for row in HOLD['files']:
    body = (ROOT / row['path']).read_bytes()
    assert len(body) == row['bytes'] and hashlib.sha256(body).hexdigest() == row['sha256'], row['path']
names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
PATHS = sorted(ROOT / name for name in names if name and (ROOT / name).is_file() and not (ROOT / name).is_symlink())

def pins():
    return [dict(path=str(p.relative_to(ROOT)), bytes=p.stat().st_size,
                 sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in PATHS]

def save(name, value):
    with (OUT / name).open('x') as f:
        json.dump(value, f, indent=2)
        f.write('\n')

def limit_log():
    resource.setrlimit(resource.RLIMIT_FSIZE, (8 * 1024**2, 8 * 1024**2))

assert shutil.disk_usage(ROOT).free > 256 * 1024**2
before = pins()
save('union-inputs-before.json', before)
runs = []
for version in ['22.22.2', '20.19.5']:
    node = f'/Users/oleksandr.mekhovov/.local/share/mise/installs/node/{version}/bin/node'
    assert subprocess.check_output([node, '--version'], text=True).strip() == 'v' + version
    command = [node, '--test', '--test-concurrency=2', *FILES]
    log = OUT / f'union-node{version[:2]}.log'
    started = time.monotonic()
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    with log.open('xb') as f:
        run = subprocess.run(command, cwd=ROOT, stdout=f, stderr=subprocess.STDOUT, preexec_fn=limit_log)
    row = dict(node=version, argv=command, startedAt=timestamp,
               wallSeconds=round(time.monotonic() - started, 6), exitCode=run.returncode,
               log=str(log.relative_to(ROOT)), logBytes=log.stat().st_size,
               logSha256=hashlib.sha256(log.read_bytes()).hexdigest())
    runs.append(row)
    print(json.dumps(row), flush=True)
    if run.returncode:
        break
after = pins()
save('union-inputs-after.json', after)
save('union-execution.json', dict(scope='Seventeen complete files, finite materialized input inventory including preserved evidence; not native/full-release qualification or a claim of complete import discovery.',
    files=FILES, sourceHoldSha256=hashlib.sha256((OUT / 'source-held-01.json').read_bytes()).hexdigest(),
    runs=runs, inputsUnchanged=before == after, inputCount=len(before), inputBytes=sum(r['bytes'] for r in before),
    allRuntimesAttempted=len(runs) == 2))
sys.exit(0 if len(runs) == 2 and all(r['exitCode'] == 0 for r in runs) and before == after else 1)
