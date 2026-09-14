"""Artifact-only exact-source freeze. No tag, release, deployment, or source mutation."""
from pathlib import Path
import datetime, hashlib, json, os, re, shutil, subprocess, sys
BASE = Path(__file__).resolve().parent

def sha(data):
    return hashlib.sha256(data).hexdigest()

def require(value, message):
    if not value:
        raise ValueError(message)

def check_receipts(pin, q, r):
    require(q['format'] == 'revealline-source-qualification.v1' and q['passed'] is True, 'Source qualification is not passed')
    require(r['format'] == 'revealline-hosted-sharded-qualification.v1' and r['qualifiedExactSourceContent'] is True, 'Exact source receipt is not qualified')
    require(q['version'] == pin['version'], 'Version mismatch')
    for document, keys in [(q, ['sourceRevision', 'actualCheckoutCommit']), (r, ['candidateCommit', 'actualCheckoutCommit'])]:
        require(all(document[k] == pin['sourceRevision'] for k in keys), 'Source commit mismatch')
    for document, keys in [(q, ['sourceTree', 'actualCheckoutTree']), (r, ['candidateTree', 'actualCheckoutTree'])]:
        require(all(document[k] == pin['sourceTree'] for k in keys), 'Source tree mismatch')
    require(q['workflowBlob'] == r['actualWorkflowBlob'] == pin['workflowBlob'], 'Workflow mismatch')
    require(q['node'] == r['resolvedNodeVersion'] == pin['node'] == 'v20.19.6', 'Node mismatch')
    require(q['qualificationReceiptSha256'] == pin['receiptSha256'], 'Qualification receipt hash mismatch')
    require(r['runId'] == pin['runId'] and r['runAttempt'] == 1 and r['runStatus'] == 'completed' and r['runConclusion'] == 'success' and r['failures'] == [], 'Hosted source run is not a clean completed pass')
    require({g['gate'] for g in q['gates']} == {'validate', 'lint', 'test', 'format', 'native-format', 'motion-syntax'} and len(q['gates']) == 6, 'Six source gates are required')
    require(all(g['step']['status'] == 'completed' and g['step']['conclusion'] == 'success' for g in q['gates']), 'Failed source gate')
    for summary in [q['tests'], r['testSummary']]:
        require(summary['tests'] == summary['pass'] == pin['tests'] and all(summary[k] == 0 for k in ['fail', 'cancelled', 'skipped', 'todo']), 'Incomplete tests')
    require(q['testCoverage']['eachSourceTestFileExactlyOnce'] is True and r['coverage']['eachSourceTestFileExactlyOnce'] is True, 'Incomplete test coverage')
    require(len(r['jobs']) == 5 and all(j['status'] == 'completed' and j['conclusion'] == 'success' and j['actualCheckoutCommit'] == pin['sourceRevision'] for j in r['jobs']), 'Incomplete exact-source jobs')

def main():
    version, source_arg, export_arg = sys.argv[1:]
    source = Path(source_arg).resolve(); export = Path(export_arg).resolve()
    config = json.loads((BASE / 'sources.json').read_text())
    require(config['repository'] == 'mekhovov/revealline', 'Wrong repository')
    matches = [x for x in config['sources'] if x['version'] == version]
    require(len(matches) == 1 and re.fullmatch(r'v0\.(49|50|51)\.0', version), 'Unlisted source')
    pin = matches[0]; proof = BASE / 'qualifications' / version
    require(not export.exists(), 'Existing artifact output')
    export.mkdir(parents=True); meta = export / 'metadata'; meta.mkdir()
    (meta / 'freeze-request.json').write_text(json.dumps({'version': version, 'sourceRevision': pin['sourceRevision'], 'controllerRevision': os.environ.get('GITHUB_SHA'), 'artifactOnly': True}, indent=2) + '\n')
    qbytes = (proof / 'source-qualification.json').read_bytes(); rbytes = (proof / 'receipt-qualified.json').read_bytes()
    require(sha(qbytes) == pin['qualificationSha256'] and sha(rbytes) == pin['receiptSha256'], 'Changed qualification bytes')
    q, r = json.loads(qbytes), json.loads(rbytes); check_receipts(pin, q, r)
    def git(*args): return subprocess.check_output(['git', '-C', str(source), *args], text=True).strip()
    require(git('rev-parse', 'HEAD') == pin['sourceRevision'] and git('rev-parse', 'HEAD^{tree}') == pin['sourceTree'], 'Wrong source checkout')
    require(git('rev-parse', 'HEAD:.github/workflows/qualify-release-source.yml') == pin['workflowBlob'], 'Wrong source workflow')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'Modified source checkout')
    require(subprocess.check_output(['node', '--version'], text=True).strip() == pin['node'], 'Wrong freeze Node')
    require(shutil.disk_usage(source).free >= 8 * 1024**3, 'Hosted freeze requires at least 8 GiB free')
    require(not (source / 'releases' / version).exists() , 'Existing immutable output')
    def api(path, raw=False):
        data = subprocess.check_output(['gh', 'api', 'repos/mekhovov/revealline/' + path])
        return data if raw else json.loads(data)
    run = api(f"actions/runs/{pin['runId']}")
    require(run['head_sha'] == pin['sourceRevision'] and run['event'] == 'push' and run['path'] == '.github/workflows/qualify-release-source.yml' and run['status'] == 'completed' and run['conclusion'] == 'success' and run['run_attempt'] == 1, 'Live source run differs')
    jobs = api(f"actions/runs/{pin['runId']}/attempts/1/jobs?per_page=100")
    by_id = {j['id']: j for j in jobs['jobs']}
    require(set(by_id) == {j['jobId'] for j in r['jobs']}, 'Live source job set differs')
    for job in r['jobs']:
        live = by_id[job['jobId']]
        require(live['status'] == 'completed' and live['conclusion'] == 'success', 'Live source job failed')
        require(sha(api(f"actions/jobs/{job['jobId']}/logs", raw=True)) == job['logSha256'], 'Live source log changed')
    controller = BASE.parents[1]
    controller_sha = subprocess.check_output(['git', '-C', str(controller), 'rev-parse', 'HEAD'], text=True).strip()
    require(controller_sha == os.environ['GITHUB_SHA'], 'Wrong controller checkout')
    invocation = {'format': 'revealline-hosted-freeze-invocation.v1', 'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'version': version, 'sourceRevision': pin['sourceRevision'], 'sourceTree': pin['sourceTree'], 'controllerRevision': controller_sha, 'runId': int(os.environ['GITHUB_RUN_ID']), 'runAttempt': int(os.environ['GITHUB_RUN_ATTEMPT']), 'node': pin['node'], 'qualificationSha256': pin['qualificationSha256'], 'sourceRunId': pin['runId'], 'freeBytesBefore': shutil.disk_usage(source).free, 'artifactOnly': True}
    (meta / 'freeze-invocation.json').write_text(json.dumps(invocation, indent=2) + '\n')
    (meta / 'source-qualification.json').write_bytes(qbytes)
    (meta / 'receipt-qualified.json').write_bytes(rbytes)
    expression = "import('./scripts/game-cli.mjs').then(async ({releaseSnapshot})=>console.log(JSON.stringify(await releaseSnapshot(" + json.dumps({'root': str(source), 'ref': pin['sourceRevision'], 'version': version}) + "),null,2)))"
    with (meta / 'freeze.log').open('wb') as log:
        result = subprocess.run(['node', '--input-type=module', '-e', expression], cwd=source, stdout=log, stderr=subprocess.STDOUT)
    require(result.returncode == 0, 'Exact-source snapshot failed; retain freeze.log')
    subprocess.run([sys.executable, str(BASE / 'verify-frozen.py'), str(source), version, pin['sourceRevision'], str(meta / 'frozen-integrity.json')], check=True)
    frozen = source / 'releases' / version
    for name, path in [('release.json', frozen / 'release.json'), ('manifest.json', frozen / 'site/manifest.json'), ('.xonix-build.json', frozen / 'site/.xonix-build.json'), ('distribution.zip.sha256', frozen / 'site/distribution.zip.sha256')]:
        shutil.copyfile(path, meta / name)
    assets = {}
    for name, path in [('source.tar', frozen / 'source.tar'), ('distribution.zip', frozen / 'site/distribution.zip')]:
        h = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b''): h.update(chunk)
        assets[name] = {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}
    (meta / 'artifact-bodies.json').write_text(json.dumps({'format': 'revealline-frozen-artifact-bodies.v1', 'version': version, 'sourceRevision': pin['sourceRevision'], 'assets': assets}, indent=2) + '\n')
    require(not git('status', '--porcelain', '--untracked-files=no'), 'Freeze changed tracked source')
    print(json.dumps({'version': version, 'passed': True, 'assets': assets}))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        if len(sys.argv) == 4:
            metadata = Path(sys.argv[3]).resolve() / 'metadata'
            if metadata.is_dir():
                (metadata / 'freeze-failure.json').write_text(json.dumps({'passed': False, 'errorType': type(error).__name__, 'message': str(error), 'at': datetime.datetime.now(datetime.timezone.utc).isoformat()}, indent=2) + '\n')
        raise
