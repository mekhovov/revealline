#!/usr/bin/env python3
"""Upload a completed CAS part, authenticate full readback, and restore every member."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile
import time
from pack import digest

REPO = 'mekhovov/revealline'
RELEASE_ID = 414505790
TAG = 'fpv-development-preservation-20261016'


def validate_header(header):
    if header.get('format') != 'FPVCASPart.v1' or not isinstance(header.get('objects'), list):
        raise ValueError('Unsupported content part manifest')
    seen = set()
    for obj in header['objects']:
        sha = obj.get('sha256', '')
        if (not re.fullmatch(r'[0-9a-f]{64}', sha) or obj.get('member') != 'objects/' + sha
                or not isinstance(obj.get('bytes'), int) or obj['bytes'] < 0 or sha in seen):
            raise ValueError('Unsafe or duplicate content part manifest object')
        seen.add(sha)


def gh_json(*args):
    return json.loads(subprocess.check_output(['gh', *args], text=True))


def assets():
    pages = gh_json('api', '--paginate', '--slurp', f'repos/{REPO}/releases/{RELEASE_ID}/assets?per_page=100')
    return [a for page in pages for a in page]


def readback(asset, destination, expected):
    with destination.open('xb') as f:
        p = subprocess.run(['gh', 'api', '-H', 'Accept: application/octet-stream',
                            f'repos/{REPO}/releases/assets/{asset["id"]}'], stdout=f)
    if p.returncode:
        raise RuntimeError('Authenticated readback request failed; partial file preserved')
    if destination.stat().st_size != expected['bytes'] or digest(destination) != expected['sha256']:
        raise ValueError('Authenticated readback digest/size mismatch')


def restore_part(archive, destination, expected_header):
    validate_header(expected_header)
    destination.mkdir()
    expected = {x['member']: x for x in expected_header['objects']}
    seen, header, raw_bytes = set(), None, 0
    process = subprocess.Popen(['zstd', '-q', '-d', '-c', str(archive)], stdout=subprocess.PIPE)
    try:
        with tarfile.open(fileobj=process.stdout, mode='r|') as tar:
            for member in tar:
                if not member.isfile() or member.linkname:
                    raise ValueError('Unexpected link/device/directory in content part')
                if member.name == 'part-manifest.json':
                    if header is not None or seen or member.size > 16 * 1024 * 1024:
                        raise ValueError('Invalid part header ordering or size')
                    header = json.load(tar.extractfile(member))
                    if header != expected_header:
                        raise ValueError('Part header differs from sealed local plan')
                    continue
                if header is None or member.name not in expected or member.name in seen:
                    raise ValueError('Unexpected, missing-header or duplicate content member')
                x = expected[member.name]
                if not re.fullmatch(r'objects/[0-9a-f]{64}', member.name) or member.size != x['bytes']:
                    raise ValueError('Unsafe content member name or size')
                path = destination / member.name
                path.parent.mkdir(parents=True, exist_ok=True)
                h, size = hashlib.sha256(), 0
                with tar.extractfile(member) as source, path.open('xb') as output:
                    while data := source.read(4 * 1024 * 1024):
                        output.write(data)
                        h.update(data)
                        size += len(data)
                if size != x['bytes'] or h.hexdigest() != x['sha256'] or digest(path) != x['sha256']:
                    raise ValueError('Restored member bytes differ')
                seen.add(member.name)
        # Drain tar padding and force successful decompressor completion.
        while process.stdout.read(4 * 1024 * 1024):
            pass
        process.stdout.close()
        if process.wait() != 0:
            raise RuntimeError('zstd readback restore failed')
    except BaseException:
        process.stdout.close()
        process.terminate()
        process.wait()
        raise
    if header is None or seen != set(expected):
        raise ValueError('Part omitted planned members')
    return {'members': len(seen), 'bytes': sum(x['bytes'] for x in expected.values()),
            'allRestoredMemberSHA256Match': True, 'destination': str(destination)}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--local-receipt', required=True)
    p.add_argument('--work', required=True)
    p.add_argument('--receipt-output', required=True)
    p.add_argument('--verify-only', action='store_true')
    a = p.parse_args()
    local = json.loads(Path(a.local_receipt).read_text())
    archive, work = Path(local['archive']), Path(a.work)
    work.mkdir()
    if archive.stat().st_size != local['bytes'] or digest(archive) != local['sha256']:
        raise ValueError('Completed local part changed')
    if a.verify_only:
        result = restore_part(archive, work / 'restored', local['partManifest'])
        print(json.dumps(result), flush=True)
        return
    name = 'fpv-cas-' + local['sha256'] + '.tar.zst'
    candidates = [x for x in assets() if x['name'] == name]
    if not candidates:
        alias = work / name
        alias.symlink_to(archive)
        result = subprocess.run(['gh', 'release', 'upload', TAG, str(alias), '--repo', REPO])
        candidates = [x for x in assets() if x['name'] == name]
        if result.returncode and not candidates:
            raise RuntimeError('Upload failed; local part preserved')
    if len(candidates) != 1:
        raise ValueError('Unexpected duplicate release asset names')
    asset = candidates[0]
    if asset['size'] != local['bytes'] or asset.get('digest') != 'sha256:' + local['sha256']:
        raise ValueError('Server digest/size differ from local sealed part')
    print(json.dumps({'event': 'server-digest-pass', 'assetId': asset['id'], 'bytes': asset['size']}), flush=True)
    download = work / name.replace('.tar.zst', '.authenticated-readback.tar.zst')
    readback(asset, download, local)
    print(json.dumps({'event': 'readback-pass', 'assetId': asset['id']}), flush=True)
    result = restore_part(download, work / 'restored', local['partManifest'])
    receipt = {'format': 'FPVCASPartVerified.v1', 'repo': REPO, 'releaseId': RELEASE_ID,
               'tag': TAG, 'assetId': asset['id'], 'assetName': asset['name'],
               'assetURL': asset['browser_download_url'], 'bytes': local['bytes'], 'sha256': local['sha256'],
               'serverDigestMatch': True, 'authenticatedFullReadbackSHA256Match': True,
               'restoredMembers': result, 'partManifest': local['partManifest'],
               'sourceBeforeAfterChecks': len(local['sources']),
               'localSourceReceipt': str(Path(a.local_receipt)), 'verifiedAtUnix': time.time()}
    with Path(a.receipt_output).open('x') as f:
        json.dump(receipt, f, indent=2)
        f.write('\n')
    print(json.dumps({'event': 'verified', 'assetId': asset['id'], **result}), flush=True)


if __name__ == '__main__':
    main()
