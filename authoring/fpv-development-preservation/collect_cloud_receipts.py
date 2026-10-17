#!/usr/bin/env python3
"""Collect only small verified JSON receipts from an exact successful cloud run."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
import zipfile
from pack import digest
from verify_upload import REPO, gh_json


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--run-id', required=True, type=int)
    p.add_argument('--head', required=True)
    p.add_argument('--plans', required=True)
    p.add_argument('--output', required=True)
    a = p.parse_args()
    run = gh_json('api', f'repos/{REPO}/actions/runs/{a.run_id}')
    if run['conclusion'] != 'success' or run['head_sha'] != a.head or run['name'] != 'FPV preservation readback':
        raise ValueError('Cloud run is not successful at the expected exact head')
    meta = gh_json('api', f'repos/{REPO}/actions/runs/{a.run_id}/artifacts?per_page=100')
    out = Path(a.output)
    out.mkdir()
    receipts = []
    for artifact in meta['artifacts']:
        if artifact['expired'] or artifact['size_in_bytes'] > 16_000_000:
            raise ValueError('Unexpected expired or large receipt artifact')
        endpoint = f'repos/{REPO}/actions/artifacts/{artifact["id"]}/zip'
        raw = subprocess.check_output(['gh', 'api', endpoint])
        sha = hashlib.sha256(raw).hexdigest()
        if artifact.get('digest') not in (None, 'sha256:' + sha):
            raise ValueError('Receipt artifact archive digest differs')
        archive = zipfile.ZipFile(io.BytesIO(raw))
        members = archive.infolist()
        if len(members) != 1 or members[0].file_size > 16_000_000:
            raise ValueError('Receipt artifact has unexpected members')
        member = members[0]
        if not re.fullmatch(r'part-[0-9a-f]{64}-verified.json', member.filename):
            raise ValueError('Unexpected receipt artifact member path')
        data = archive.read(member)
        receipt = json.loads(data)
        plan_path = Path(a.plans) / ('part-' + receipt['sha256'] + '.json')
        plan = json.loads(plan_path.read_text())
        if (receipt.get('format') != 'FPVCASPartVerified.v1' or not receipt.get('serverDigestMatch')
                or not receipt.get('authenticatedFullReadbackSHA256Match')
                or not receipt.get('restoredMembers', {}).get('allRestoredMemberSHA256Match')
                or receipt['partManifest'] != plan['partManifest'] or receipt['sourceChecks'] != plan['sourceChecks']
                or receipt['publishedPlanSHA256'] != digest(plan_path)
                or receipt['assetId'] != plan['assetId'] or receipt['bytes'] != plan['bytes']):
            raise ValueError('Cloud receipt differs from its sealed source plan')
        with (out / member.filename).open('xb') as f:
            f.write(data)
        receipts.append({'artifactId': artifact['id'], 'artifactArchiveSHA256': sha,
                         'receipt': member.filename, 'receiptSHA256': hashlib.sha256(data).hexdigest(),
                         'assetId': receipt['assetId'], 'partSHA256': receipt['sha256'],
                         'objects': len(receipt['partManifest']['objects']),
                         'rawBytes': receipt['restoredMembers']['bytes'], 'compressedBytes': receipt['bytes']})
    if not receipts or len(receipts) != meta['total_count']:
        raise ValueError('Receipt artifact collection is empty or incomplete')
    summary = {'format': 'FPVCloudPartReceiptCollection.v1', 'runId': a.run_id, 'head': a.head,
               'parts': receipts, 'verifiedObjects': sum(r['objects'] for r in receipts),
               'verifiedRawBytes': sum(r['rawBytes'] for r in receipts),
               'verifiedCompressedBytes': sum(r['compressedBytes'] for r in receipts),
               'overallCoverageClaimed': False}
    with (out / 'collection.json').open('x') as f:
        json.dump(summary, f, indent=2)
        f.write('\n')
    print(json.dumps({k: v for k, v in summary.items() if k != 'parts'}), flush=True)


if __name__ == '__main__':
    main()
