"""Qualify whole Team files against pinned composed source; never build a release."""
import argparse
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--runtime', choices=['20.19.5', '22.22.2'], required=True)
parser.add_argument('--label', required=True)
args = parser.parse_args()
assert re.fullmatch(r'[a-z0-9-]+', args.label)
out = Path(__file__).resolve().parent
request = json.loads((out / 'cohort.json').read_bytes())
worktree = Path(request['worktree'])
assert worktree.name == 'p08a-team-composed-d245'
assert shutil.disk_usage(worktree).free >= 512 * 1024**2
node = Path('/Users/oleksandr.mekhovov/.local/share/mise/installs/node') / args.runtime / 'bin/node'
target = out / 'runs' / args.label
target.mkdir(parents=True, exist_ok=False)

def digest(path):
    body = path.read_bytes()
    return {'bytes': len(body), 'sha256': hashlib.sha256(body).hexdigest()}

inputs = {
    p.relative_to(worktree).as_posix(): digest(p)
    for p in sorted(worktree.rglob('*'))
    if p.is_file() and not p.is_symlink() and p.name != '.git'
    and '.cache' not in p.relative_to(worktree).parts
}
argv = [str(node), '--max-old-space-size=1024', '--test', '--test-concurrency=1', *request['files']]
start = datetime.datetime.now(datetime.timezone.utc).isoformat()
began = time.monotonic()
stopped = None
with (target / 'stdout').open('wb') as stdout, (target / 'stderr').open('wb') as stderr:
    process = subprocess.Popen(argv, cwd=worktree, stdout=stdout, stderr=stderr, start_new_session=True)
    while process.poll() is None:
        if time.monotonic() - began > 300:
            stopped = '300-second complete-file deadline'
        elif stdout.tell() + stderr.tell() > 4 * 1024**2:
            stopped = '4 MiB output guard'
        elif shutil.disk_usage(worktree).free < 512 * 1024**2:
            stopped = '512 MiB free reserve'
        if stopped:
            os.killpg(process.pid, signal.SIGKILL)
            break
        time.sleep(0.1)
    code = process.wait()
after = {p: digest(worktree / p) for p in inputs}
text = (target / 'stdout').read_text()
counts = {k: int(v) for k, v in re.findall(r'^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$', text, re.M)}
record = {
    'base': request['base'], 'sourceScope': 'Uncommitted composed Team source; not a release gate',
    'label': args.label, 'runtime': subprocess.check_output([str(node), '--version'], text=True).strip(),
    'argv': argv, 'cwd': str(worktree), 'startedAt': start,
    'elapsedSeconds': round(time.monotonic() - began, 3), 'exitCode': code,
    'stoppedByGuard': stopped, 'counts': counts, 'inputsUnchanged': inputs == after,
    'inputCount': len(inputs), 'inputBytes': sum(row['bytes'] for row in inputs.values()),
    'stdout': digest(target / 'stdout'), 'stderr': digest(target / 'stderr'),
}
(target / 'inputs.json').write_text(json.dumps(inputs, indent=2) + '\n')
(target / 'receipt.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record), flush=True)
assert inputs == after
assert stopped is None and code == 0, (stopped, code)
