"""Refresh original live authorities after a fully verified, explicitly bound audit."""
from pathlib import Path
import argparse
import concurrent.futures
import datetime
import json
import subprocess

from wrapper_contract import (VERSION, api, encode, identity, observation, published,
                              read_pin, read_request, require, sha, stamp)

KEYS = {'binding', 'report', 'rowReview', 'hostedObservation', 'publishedRelease'}


def refresh(home, request_path, request_sha, runner=subprocess.run):
    request, request_body = read_request(home, request_path, request_sha,
                                        'revealline-public-refresh-request.v1', KEYS)
    binding_body = read_pin(home, request['binding'], 64_000)
    binding = json.loads(binding_body)
    identity(binding)
    require(binding['format'] == 'revealline-final-main-public-binding.v1' and
            binding['reviewed'] is True, 'Final independently reviewed binding required')
    input_dir = Path(request['binding']['path']).parent.as_posix()
    originals = {}
    for name, pin in binding['pins'].items():
        originals[name] = read_pin(home, dict(pin, path=input_dir + '/' + pin['path']))
    require(set(originals) == {'receipt', 'deployment', 'statuses', 'run', 'manifest', 'record',
                              'qualification', 'catalog', 'configuration'}, 'Nine original inputs required')
    report_body = read_pin(home, request['report'])
    report = json.loads(report_body)
    require(report['status'] == 'PASS' and report['mode'] == 'full' and
            report['bindingSha256'] == sha(binding_body) and report['allArtifactBodiesVerified'] is True and
            report['expectedInventorySha256'] == binding['inventorySha256'] and
            report['sourcePinsUnchanged'] is True and report['failedFiles'] == report['uninspectedFiles'] == 0 and
            report['files'] == report['completedFiles'] == report['fullInventoryFiles'] and
            report['verifiedBytes'] == report['expectedBytes'] and
            report['failures'] == report['skipped'] == report['changedAuthorities'] == [],
            'A passing complete audit with unchanged authorities is required')
    for key in ['base', 'currentVersion', 'gameSourceRevision', 'qualifiedSourceTree',
                'controllerCommit', 'controllerTree', 'deploymentId', 'runId']:
        require(report[key] == binding[key], 'Report belongs to another binding')
    review = json.loads(read_pin(home, request['rowReview']))
    require(review['status'] == 'PASS_ALL_PUBLIC_RESULT_ROWS_RECONCILED' and
            review['reportSha256'] == sha(report_body) and review['controllerCommit'] == binding['controllerCommit']
            and review['files'] == report['files'] and review['bytes'] == report['verifiedBytes'],
            'Independent complete row reconciliation required')
    status_id = json.loads(originals['statuses'])[0]['id']
    observed = observation(home, request['hostedObservation'], binding, status_id)
    parse_time = lambda value: datetime.datetime.fromisoformat(value.replace('Z', '+00:00'))
    require(parse_time(observed['_observedAt']) >= parse_time(report['finishedAt']),
            'Hosted observation must be collected after the full audit')
    release, _, release_body = published(home, request['publishedRelease'])
    catalog = json.loads(originals['catalog'])
    entries = [entry for entry in catalog['releases'] if entry['version'] == VERSION]
    require(len(entries) == 1, 'Current catalog entry required')
    tag_object = entries[0]['tagObject']
    output = home / ('after-http-authorities-' + request['outputLabel'])
    output.mkdir()
    (output / 'request.original.json').write_bytes(request_body)
    (output / 'original-published-release.json').write_bytes(release_body)
    queries = {'latest': 'releases/latest', 'release': 'releases/tags/' + VERSION,
               'tag': 'git/ref/tags/' + VERSION, 'tag-object': 'git/tags/' + tag_object,
               'all-deployments': 'deployments?environment=github-pages&per_page=10',
               'source': 'git/commits/' + binding['gameSourceRevision']}
    (output / 'collection-started.json').write_bytes(encode({'at': stamp(), 'queries': queries,
                                                          'afterFullAuditReportSha256': sha(report_body)}))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        values = dict(pool.map(lambda pair: (pair[0], api(output, pair[0], pair[1], runner)), queries.items()))
    project = lambda item: {key: item[key] for key in ['id', 'name', 'size', 'digest', 'state', 'browser_download_url']}
    old_assets = {item['name']: project(item) for item in release['assets']}
    for value in [values['latest'], values['release']]:
        require(value['id'] == release['id'] and value['tag_name'] == VERSION and value['draft'] is False and
                value['prerelease'] is False and value['published_at'] == release['published_at'] and
                len(value['assets']) == 9 and
                {item['name']: project(item) for item in value['assets']} == old_assets,
                'Latest stable release or any original asset changed')
    require(values['tag']['object']['type'] == 'tag' and
            values['tag']['object']['sha'] == tag_object == values['tag-object']['sha'] and
            values['tag-object']['object']['type'] == 'commit' and
            values['tag-object']['object']['sha'] == binding['gameSourceRevision'], 'Annotated tag changed')
    require(values['source']['sha'] == binding['gameSourceRevision'] and
            values['source']['tree']['sha'] == binding['qualifiedSourceTree'], 'Frozen source tree changed')
    require(values['all-deployments'] and values['all-deployments'][0]['id'] == binding['deploymentId'] and
            values['all-deployments'][0]['sha'] == binding['controllerCommit'], 'Latest deployment changed')
    read_request(home, request_path, request_sha, 'revealline-public-refresh-request.v1', KEYS)
    for key in ['binding', 'report', 'rowReview', 'publishedRelease']:
        read_pin(home, request[key])
    observation(home, request['hostedObservation'], binding, status_id)
    pins = [{'path': path.relative_to(home).as_posix(), 'bytes': path.stat().st_size,
             'sha256': sha(path.read_bytes())} for path in sorted(output.iterdir()) if path.is_file()]
    result = {'status': 'PASS_LIVE_AUTHORITIES_UNCHANGED_AFTER_FULL_AUDIT', 'at': stamp(),
              'controllerCommit': binding['controllerCommit'], 'controllerTree': binding['controllerTree'],
              'deploymentId': binding['deploymentId'], 'runId': binding['runId'],
              'latestSuccessStatusId': observed['statuses'][0]['id'], 'latestStableVersion': VERSION,
              'releaseId': release['id'], 'assets': list(old_assets.values()), 'pins': pins,
              'requestSha256': request_sha, 'phaseAccepted': False,
              'scope': 'Fresh bounded API originals after full byte audit and independent row reconciliation; '
                       'browser, offline and physical-device acceptance remain separate.'}
    (output / 'result.json').write_bytes(encode(result))
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request', type=Path)
    parser.add_argument('request_sha256')
    args = parser.parse_args()
    print(json.dumps(refresh(Path(__file__).resolve().parent, args.request, args.request_sha256), indent=2))
