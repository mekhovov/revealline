#!/usr/bin/env python3
"""Verify a sealed, server-published CAS plan on a fresh cloud runner."""
import argparse
import json
from pathlib import Path
import time
from pack import digest, safe_relative
from verify_upload import REPO, RELEASE_ID, TAG, gh_json, readback, restore_part, validate_header


def verify_plan(plan):
    if (plan.get('format') != 'FPVCASPartPublished.v1' or plan.get('repo') != REPO
            or plan.get('releaseId') != RELEASE_ID):
        raise ValueError('Unsupported published preservation plan')
    validate_header(plan['partManifest'])
    expected = {x['sha256']: x['bytes'] for x in plan['partManifest']['objects']}
    checks = plan['sourceChecks']
    seen = set()
    for check in checks:
        safe_relative(check['path'])
        if (not check.get('sourceBeforeAndAfterSHA256Match') or check['sha256'] in seen
                or expected.get(check['sha256']) != check['bytes']):
            raise ValueError('Missing, duplicate or contradictory source verification')
        seen.add(check['sha256'])
    if seen != set(expected):
        raise ValueError('Source verification does not cover all part objects')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--plan', required=True)
    p.add_argument('--work', required=True)
    p.add_argument('--receipt', required=True)
    a = p.parse_args()
    plan = json.loads(Path(a.plan).read_text())
    verify_plan(plan)
    work = Path(a.work)
    work.mkdir()
    # The sealed plan binds this immutable asset ID to the approved draft release.
    # Direct asset reads avoid the separate push-access requirement for draft listings.
    asset = gh_json('api', f'repos/{REPO}/releases/assets/{plan["assetId"]}')
    if (asset['id'] != plan['assetId'] or asset['state'] != 'uploaded' or asset['name'] != plan['assetName']
            or asset['size'] != plan['bytes'] or asset.get('digest') != 'sha256:' + plan['sha256']):
        raise ValueError('Published asset no longer matches its sealed source plan')
    print(json.dumps({'event': 'cloud-server-digest-pass', 'assetId': asset['id']}), flush=True)
    archive = work / 'authenticated-readback.tar.zst'
    readback(asset, archive, plan)
    print(json.dumps({'event': 'cloud-full-readback-pass', 'assetId': asset['id']}), flush=True)
    result = restore_part(archive, work / 'restored', plan['partManifest'])
    receipt = {'format': 'FPVCASPartVerified.v1', 'repo': REPO, 'releaseId': RELEASE_ID,
               'tag': TAG, 'assetId': asset['id'], 'assetName': asset['name'],
               'assetURL': asset['browser_download_url'], 'bytes': plan['bytes'], 'sha256': plan['sha256'],
               'serverDigestMatch': True, 'authenticatedFullReadbackSHA256Match': True,
               'restoredMembers': result, 'partManifest': plan['partManifest'],
               'sourceBeforeAfterChecks': len(plan['sourceChecks']), 'sourceChecks': plan['sourceChecks'],
               'localSourceReceiptSHA256': plan['localSourceReceiptSHA256'],
               'publishedPlanSHA256': digest(a.plan), 'executionEnvironment': 'fresh GitHub Actions runner',
               'verifiedAtUnix': time.time()}
    with Path(a.receipt).open('x') as f:
        json.dump(receipt, f, indent=2)
        f.write('\n')
    print(json.dumps({'event': 'cloud-part-verified', 'assetId': asset['id'], **result}), flush=True)


if __name__ == '__main__':
    main()
