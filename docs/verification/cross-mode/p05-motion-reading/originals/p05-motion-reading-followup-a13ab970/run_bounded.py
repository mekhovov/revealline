from pathlib import Path
import subprocess, hashlib, json, datetime, time, sys, os, signal
root = Path(__file__).resolve().parent
label, version, *requested = sys.argv[1:]
assert label and '/' not in label and version in ('20.19.5', '22.22.2')
cwd = root / 'proposal'
dest = root / 'runs' / label
dest.mkdir()
node = Path('/Users/oleksandr.mekhovov/.local/share/mise/installs/node') / version / 'bin/node'
cohort = json.loads((root / 'cohort.json').read_text())
files = requested or cohort['files']
def pins():
    return {str(p.relative_to(cwd)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(cwd.rglob('*')) if p.is_file()}
before = pins()
(dest / 'inputs.json').write_text(json.dumps(before, indent=2) + '\n')
argv = [str(node), '--max-old-space-size=1024', '--test', '--test-concurrency=1', *files]
started = datetime.datetime.now(datetime.timezone.utc).isoformat()
at = time.monotonic()
timed_out = False
with (dest / 'output.log').open('wb') as log:
    proc = subprocess.Popen(argv, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        code = proc.wait(timeout=cohort['limits']['timeoutSeconds'])
    except subprocess.TimeoutExpired:
        timed_out = True
        os.killpg(proc.pid, signal.SIGKILL)
        proc.wait()
        code = 124
after = pins()
receipt = {'label': label, 'startedAt': started, 'elapsedSeconds': time.monotonic() - at, 'argv': argv, 'cwd': str(cwd), 'nodeVersion': subprocess.check_output([str(node), '--version']).decode().strip(), 'nodeSha256': hashlib.sha256(node.read_bytes()).hexdigest(), 'exitCode': code, 'timeout': timed_out, 'inputCount': len(before), 'inputsUnchanged': before == after, 'changed': sorted(n for n in set(before) | set(after) if before.get(n) != after.get(n)), 'outputSha256': hashlib.sha256((dest / 'output.log').read_bytes()).hexdigest()}
(dest / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps(receipt, indent=2))
print('\n'.join((dest / 'output.log').read_text().splitlines()[-12:]))
sys.exit(code if before == after else 125)
