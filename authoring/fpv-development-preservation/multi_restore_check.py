#!/usr/bin/env python3
"""Restore two explicitly approved public payload indexes in separate strict namespaces."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import time

from bounded_restore import graph
from portable_restore_check import verify
from restore_paths import real_directory
from verify_upload import REPO, validate_header


EXPECTED = {
    'staging': ('preservation-index.json', '/Volumes/alex/CodexMigrationStaging'),
    'extra-volume-app': ('extra-volume-app-index.json', '/Volumes/alex'),
}


def read_stable(path):
    path = real_directory(path.parent) / path.name
    if path.is_symlink() or not path.is_file():
        raise ValueError('Approved restore metadata must be a real file')
    before = path.stat()
    raw = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_ino, before.st_dev) != (
            after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev):
        raise ValueError('Approved restore metadata changed while reading')
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def load_set(path):
    rollup, rollup_sha = read_stable(path)
    if (rollup.get('format') != 'FPVPublicPayloadRestoreSet.v1'
            or rollup.get('rootConfirmedPublicInputSet') is not True):
        raise ValueError('The public input set has not been explicitly confirmed')
    result, seen = [], set()
    for row in rollup['indexes']:
        name = row.get('name')
        if name not in EXPECTED or name in seen:
            raise ValueError('Unexpected or duplicate restore namespace')
        filename, source_root = EXPECTED[name]
        if row.get('file') != filename or row.get('sourceRoot') != source_root:
            raise ValueError('Restore namespace has an unexpected index path or source root')
        index, sha = read_stable(path.parent / filename)
        if (sha != row.get('sha256') or index.get('repo') != REPO
                or index.get('sourceRoot') != source_root
                or any(index.get(k) is not True for k in ['coverageComplete', 'inventoryComplete', 'inventorySetFinal'])
                or any(index.get(k) for k in ['held', 'uncovered', 'inventoryConflicts', 'inventoryErrorsOrUnstable'])):
            raise ValueError('Index is not the exact approved complete public input')
        result.append({'name': name, 'index': index, 'sha256': sha, 'graph': graph(index)})
        seen.add(name)
    if seen != set(EXPECTED):
        raise ValueError('Both approved public payload indexes are required')
    result.sort(key=lambda r: list(EXPECTED).index(r['name']))
    return result, rollup_sha


def estimate_set(entries):
    archives, extracted, blobs, identities = {}, {}, {}, {}
    logical, paths, dependency_files = 0, 0, 0

    def asset(row):
        if type(row.get('assetId')) is not int or row['assetId'] <= 0:
            raise ValueError('Invalid asset identity')
        if type(row.get('bytes')) is not int or row['bytes'] < 0:
            raise ValueError('Invalid asset byte count')
        sha = row['sha256']
        if len(sha) != 64 or any(c not in '0123456789abcdef' for c in sha):
            raise ValueError('Invalid asset digest')
        key = (row['assetId'], sha)
        if row['assetId'] in identities and identities[row['assetId']] != (sha, row['bytes']):
            raise ValueError('One asset ID has contradictory content identities')
        identities[row['assetId']] = (sha, row['bytes'])
        if key in archives and archives[key] != row['bytes']:
            raise ValueError('Contradictory shared asset size')
        archives[key] = row['bytes']

    for entry in entries:
        index = entry['index']
        logical += sum(row['bytes'] for row in index['files'])
        paths += len(index['files'])
        for sha, part in index['parts'].items():
            if sha != part['sha256']:
                raise ValueError('Contradictory part identity')
            asset(part)
            validate_header(part['partManifest'])
            if sha in extracted and extracted[sha] != part['partManifest']:
                raise ValueError('Shared part headers differ')
            extracted[sha] = part['partManifest']
        for sha, direct in index.get('directAssets', {}).items():
            if sha != direct['sha256']:
                raise ValueError('Contradictory direct asset identity')
            asset(direct)
        for dep in index.get('githubLinkDependencies', []):
            for row in dep['files']:
                key = (row['gitBlobSHA1'], row['sha256'])
                if key in blobs and blobs[key] != row['bytes']:
                    raise ValueError('Shared Git blob sizes differ')
                blobs[key] = row['bytes']
                logical += row['bytes']
                dependency_files += 1
    members = [row for header in extracted.values() for row in header['objects']]
    cache = sum(archives.values()) + sum(row['bytes'] for row in members) + sum(blobs.values())
    allowance = 256 * 1024 ** 2 + 8192 * (paths + len(members) + dependency_files * 2 + len(archives))
    return {'uniqueAssetCacheFiles': len(archives), 'sharedCASParts': len(extracted),
            'cacheEstimatedBytes': cache, 'logicalCopyEstimatedBytes': logical,
            'metadataAllowanceBytes': allowance, 'estimatedPeakBytes': cache + logical + allowance}


def verify_set(entries, rollup_sha, work, receipt_path):
    # Recheck supplied in-memory entries too: callers cannot skip the final-index graph gate.
    if [e['name'] for e in entries] != list(EXPECTED):
        raise ValueError('Restore set is incomplete or out of canonical order')
    for entry in entries:
        index = entry['index']
        if (index.get('repo') != REPO or index.get('sourceRoot') != EXPECTED[entry['name']][1]
                or any(index.get(k) is not True for k in ['coverageComplete', 'inventoryComplete', 'inventorySetFinal'])
                or any(index.get(k) for k in ['held', 'uncovered', 'inventoryConflicts', 'inventoryErrorsOrUnstable'])):
            raise ValueError('The public restore set contains incomplete input')
        graph(index)
    estimate = estimate_set(entries)
    work = real_directory(work)
    if work.exists():
        raise FileExistsError('Full public restore set requires a fresh work directory')
    reserve = 2 * 1024 ** 3
    free_before = shutil.disk_usage(work.parent).free
    if estimate['estimatedPeakBytes'] + reserve > free_before:
        raise ValueError('Insufficient fresh disk for both public payload trees before download')
    work.mkdir()
    receipts = []
    for entry in entries:
        receipt = verify(entry['index'], entry['sha256'], work / entry['name'],
                         work / (entry['name'] + '-verified.json'), shared_cache=work / 'shared-cache')
        receipts.append({'name': entry['name'], **receipt})
    result = {'format': 'FPVPublicPayloadRestoreSetVerification.v1', 'rollupSHA256': rollup_sha,
              'indexes': receipts, 'diskEstimate': estimate, 'freeDiskBytesBeforeDownload': free_before,
              'freeDiskReserveBytes': reserve, 'freeDiskBytesAfterRestore': shutil.disk_usage(work).free,
              'allApprovedPublicPayloadIndexesRestored': True, 'separateNamespaces': list(EXPECTED),
              'oneShotPublicPayloadMaterializationPerformed': True,
              'privateCompanionAndGitSourceRecoveryRequireSeparateReceipts': True,
              'overallDisconnectSafetyClaimed': False, 'createdAtUnix': time.time()}
    with receipt_path.open('x') as out:
        json.dump(result, out, indent=2)
        out.write('\n')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--rollup', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--receipt', required=True)
    a = parser.parse_args()
    entries, sha = load_set(Path(a.rollup))
    print(json.dumps(verify_set(entries, sha, Path(a.work), Path(a.receipt))))


if __name__ == '__main__':
    main()
