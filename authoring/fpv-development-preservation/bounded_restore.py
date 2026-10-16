#!/usr/bin/env python3
"""Restore every logical path in bounded fresh partitions; never claim one-shot restore."""
import argparse
import copy
import hashlib
import json
from pathlib import Path, PurePosixPath
import os
import shutil
import time

from github_dependencies import validate_dependency
from pack import safe_relative
from restore import link_target, restore
from restore_paths import mkdir_safe, real_directory
from verify_upload import validate_header


def canonical_sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def integer(value, name):
    if type(value) is not int or value < 0:
        raise ValueError('Invalid nonnegative integer: ' + name)
    return value


def graph(index):
    """Check the whole path graph without downloading or opening app payloads."""
    if index.get('format') != 'FPVPreservationIndex.v1':
        raise ValueError('Unsupported preservation index')
    files, links, directories = {}, {}, {''}
    for row in index['files']:
        path = str(safe_relative(row['path']))
        if path == '.' or path != row['path'] or path in files:
            raise ValueError('Duplicate or noncanonical logical path')
        integer(row['bytes'], 'file bytes')
        integer(row['mtime_ns'], 'mtime')
        integer(row['mode'], 'mode')
        if len(row['sha256']) != 64 or any(c not in '0123456789abcdef' for c in row['sha256']):
            raise ValueError('Invalid logical file digest')
        files[path] = row
    for row in index.get('symlinks', []):
        path = str(safe_relative(row['path']))
        if path == '.' or path != row['path'] or path in links or path in files:
            raise ValueError('Duplicate or conflicting link path')
        links[path] = row['target']
    for dep in index.get('githubLinkDependencies', []):
        validate_dependency(dep)
        if links.get(dep['linkPath']) != dep['originalTargetExact']:
            raise ValueError('Reviewed dependency does not match captured link')
        links[dep['linkPath']] = dep['targetWithinRoot']  # Distinguished from source-relative below.
        for row in dep['files']:
            path = dep['targetWithinRoot'] + '/' + row['path']
            if path in files or path in links:
                raise ValueError('Dependency destination collides with captured paths')
            files[path] = row
    for path in [*files, *links]:
        parent = PurePosixPath(path).parent
        while str(parent) != '.':
            directories.add(str(parent))
            parent = parent.parent
    if (set(files) & directories) or (set(links) & directories):
        raise ValueError('A file or link is used as a write parent')
    mapped = {dep['linkPath']: dep['targetWithinRoot'] for dep in index.get('githubLinkDependencies', [])}
    targets = {}
    for path, target in links.items():
        if path in mapped:
            targets[path] = mapped[path]
        else:
            target, reason = link_target(path, target, index['sourceRoot'])
            if reason:
                raise ValueError('Unresolved outside-root dependency: ' + path)
            targets[path] = target

    def resolve(path):
        seen = set()
        for _ in range(40):
            if path in seen:
                raise ValueError('Looping logical link: ' + path)
            seen.add(path)
            parts = PurePosixPath(path).parts if path else ()
            replaced = False
            for n in range(1, len(parts) + 1):
                prefix = '/'.join(parts[:n])
                if prefix in targets:
                    path = '/'.join(x for x in [targets[prefix], *parts[n:]] if x)
                    replaced = True
                    break
            if not replaced:
                if path not in files and path not in directories:
                    raise ValueError('Dangling logical link target: ' + path)
                return path
        raise ValueError('Logical link exceeds the portable resolution limit')

    dispositions = [{'path': path, 'targetWithinRoot': target, 'terminalPath': resolve(target)}
                    for path, target in sorted(targets.items())]
    return {'logicalFilePaths': len(index['files']), 'logicalBytes': sum(r['bytes'] for r in index['files']),
            'symlinks': len(links), 'dependencyFiles': len(files) - len(index['files']),
            'pathAndLinkGraphSHA256': canonical_sha(dispositions), 'linkDispositions': dispositions}


def assets(index):
    objects = {}
    def check_asset(asset):
        if type(asset.get('assetId')) is not int or asset['assetId'] <= 0:
            raise ValueError('Unsafe asset identity')
        integer(asset['bytes'], 'asset bytes')
        sha = asset['sha256']
        if len(sha) != 64 or any(c not in '0123456789abcdef' for c in sha):
            raise ValueError('Unsafe asset digest')
    for sha, part in sorted(index['parts'].items()):
        check_asset(part)
        if sha != part['sha256']:
            raise ValueError('Contradictory part digest')
        validate_header(part['partManifest'])
        integer(part['bytes'], 'compressed bytes')
        for row in part['partManifest']['objects']:
            if row['sha256'] in objects and objects[row['sha256']]['bytes'] != row['bytes']:
                raise ValueError('Contradictory object size')
            objects.setdefault(row['sha256'], {'bytes': row['bytes'], 'key': 'part:' + sha})
    for sha, asset in index.get('directAssets', {}).items():
        check_asset(asset)
        if sha != asset['sha256']:
            raise ValueError('Contradictory direct asset digest')
        integer(asset['bytes'], 'asset bytes')
        objects.setdefault(sha, {'bytes': asset['bytes'], 'key': 'direct:' + sha})
    return objects


def required(index, row, objects):
    components = index.get('compositeObjects', {}).get(row['sha256'], [row['sha256']])
    if not components or sum(objects[x]['bytes'] for x in components) != row['bytes']:
        raise ValueError('Missing or contradictory logical source')
    return tuple(sorted({objects[x]['key'] for x in components}))


def estimate(index, keys, rows):
    compressed, extracted, members = 0, 0, 0
    for key in keys:
        kind, sha = key.split(':', 1)
        if kind == 'part':
            part = index['parts'][sha]
            compressed += part['bytes']
            extracted += sum(x['bytes'] for x in part['partManifest']['objects'])
            members += len(part['partManifest']['objects'])
        else:
            compressed += index['directAssets'][sha]['bytes']
    logical = sum(r['bytes'] for r in rows)
    allowance = 256 * 1024 ** 2 + 8192 * (len(rows) + members)
    return {'compressedBytes': compressed, 'extractedObjectBytes': extracted,
            'logicalCopyBytes': logical, 'metadataAllowanceBytes': allowance,
            'estimatedPeakBytes': compressed + extracted + logical + allowance}


def plan(index, index_sha, max_peak=8 * 1024 ** 3):
    integer(max_peak, 'maximum peak')
    whole_graph, objects = graph(index), assets(index)
    grouped = {}
    for row in sorted(index['files'], key=lambda x: x['path']):
        grouped.setdefault(required(index, row, objects), []).append(row)
    partitions = []
    for keys, rows in sorted(grouped.items()):
        batch, current_peak = [], estimate(index, keys, [])['estimatedPeakBytes']
        for row in rows:
            cost = row['bytes'] + 8192
            if batch and current_peak + cost > max_peak:
                partitions.append({'assetKeys': list(keys), 'paths': [r['path'] for r in batch],
                                   **estimate(index, keys, batch)})
                batch, current_peak = [], estimate(index, keys, [])['estimatedPeakBytes']
            batch.append(row)
            current_peak += cost
            if current_peak > max_peak:
                raise ValueError('A single path cannot fit the bounded restore budget')
        if batch:
            partitions.append({'assetKeys': list(keys), 'paths': [r['path'] for r in batch],
                               **estimate(index, keys, batch)})
    positions = {r['path']: n for n, r in enumerate(index['files'])}
    rows_by_path = {r['path']: r for r in index['files']}
    for n, partition in enumerate(partitions):
        partition['id'] = f'partition-{n:04d}'
        partition['selectedRowsSHA256'] = canonical_sha([rows_by_path[p] for p in sorted(partition['paths'], key=positions.get)])
    assigned = [p for part in partitions for p in part['paths']]
    if len(assigned) != len(set(assigned)) or set(assigned) != {r['path'] for r in index['files']}:
        raise ValueError('Partition assignment is not an exact logical path cover')
    return {'format': 'FPVBoundedRestorePlan.v1', 'indexSHA256': index_sha,
            'maximumEstimatedPeakBytes': max_peak, 'graph': whole_graph, 'partitions': partitions,
            'allLogicalPathsAssignedExactlyOnce': True,
            'inventoryCoverageComplete': index.get('coverageComplete') is True,
            'oneShotMaterializationPerformed': False, 'overallDisconnectSafetyClaimed': False}


def run(index, index_sha, sealed_plan, partition_id, work, receipt_path, reserve=2 * 1024 ** 3):
    expected = plan(index, index_sha, sealed_plan['maximumEstimatedPeakBytes'])
    if sealed_plan != expected:
        raise ValueError('Partition plan differs from the exact index')
    selected = next((p for p in expected['partitions'] if p['id'] == partition_id), None)
    if selected is None:
        raise ValueError('Unknown restore partition')
    integer(reserve, 'free disk reserve')
    work = real_directory(work)
    if work.exists():
        raise FileExistsError('Bounded restore work directory must be fresh')
    free = shutil.disk_usage(work.parent).free
    if selected['estimatedPeakBytes'] + reserve > free:
        raise ValueError('Insufficient fresh runner disk space before download')
    work.mkdir()
    subset = copy.deepcopy(index)
    paths = set(selected['paths'])
    subset['files'] = [r for r in index['files'] if r['path'] in paths]
    subset['parts'] = {key[5:]: index['parts'][key[5:]] for key in selected['assetKeys'] if key.startswith('part:')}
    subset['directAssets'] = {key[7:]: index['directAssets'][key[7:]] for key in selected['assetKeys'] if key.startswith('direct:')}
    subset['symlinks'], subset['githubLinkDependencies'], subset['coverageComplete'] = [], [], False
    result = restore(subset, work / 'cache', work / 'logical-files', work / 'member-receipt.json')
    # Confirm applied file metadata as well as the existing byte checks.
    for row in subset['files']:
        st = (work / 'logical-files' / row['path']).stat()
        if st.st_mode & 0o777 != row['mode'] & 0o777 or st.st_mtime_ns != row['mtime_ns']:
            raise ValueError('Restored logical file metadata differs')
    receipt = {'format': 'FPVBoundedRestoreReceipt.v1', 'indexSHA256': index_sha,
               'planSHA256': canonical_sha(sealed_plan), 'partitionId': partition_id,
               'selectedRowsSHA256': selected['selectedRowsSHA256'], 'selectedFilePaths': result['files'],
               'logicalBytes': result['logicalBytes'], 'allSelectedFileHashesMatch': result['allFileHashesMatch'],
               'allSelectedModesAndTimesMatch': True, 'estimatedPeakBytes': selected['estimatedPeakBytes'],
               'freeDiskBytesBeforeDownload': free, 'freeDiskReserveBytes': reserve,
               'freeDiskBytesAfterRestore': shutil.disk_usage(work).free,
               'oneShotMaterializationPerformed': False, 'overallDisconnectSafetyClaimed': False,
               'createdAtUnix': time.time()}
    with receipt_path.open('x') as out:
        json.dump(receipt, out, indent=2)
        out.write('\n')
    return receipt


def collect(index, index_sha, sealed_plan, receipts):
    if sealed_plan != plan(index, index_sha, sealed_plan['maximumEstimatedPeakBytes']):
        raise ValueError('Partition plan differs from the exact index')
    expected = {p['id']: p for p in sealed_plan['partitions']}
    seen = set()
    for receipt in receipts:
        key = receipt.get('partitionId')
        if key not in expected or key in seen:
            raise ValueError('Unexpected or duplicate partition receipt')
        part = expected[key]
        if (receipt.get('format') != 'FPVBoundedRestoreReceipt.v1'
                or receipt.get('indexSHA256') != index_sha
                or receipt.get('planSHA256') != canonical_sha(sealed_plan)
                or receipt.get('selectedRowsSHA256') != part['selectedRowsSHA256']
                or receipt.get('selectedFilePaths') != len(part['paths'])
                or receipt.get('logicalBytes') != part['logicalCopyBytes']
                or receipt.get('estimatedPeakBytes') != part['estimatedPeakBytes']
                or receipt.get('allSelectedFileHashesMatch') is not True
                or receipt.get('allSelectedModesAndTimesMatch') is not True
                or receipt.get('oneShotMaterializationPerformed') is not False
                or receipt.get('freeDiskBytesBeforeDownload', -1) < part['estimatedPeakBytes'] +
                   max(2 * 1024 ** 3, receipt.get('freeDiskReserveBytes', -1))):
            raise ValueError('Partition receipt is incomplete or differs from its sealed plan')
        seen.add(key)
    if seen != set(expected):
        raise ValueError('Missing logical restore partitions')
    return {'format': 'FPVBoundedRestoreCollection.v1', 'indexSHA256': index_sha,
            'planSHA256': canonical_sha(sealed_plan), 'partitions': len(seen),
            'logicalFilePaths': len(index['files']), 'logicalBytes': sum(r['bytes'] for r in index['files']),
            'everyIndexedLogicalFileRestoredAndRehashed': True,
            'inventoryCoverageComplete': index.get('coverageComplete') is True,
            'oneShotMaterializationPerformed': False, 'actualGlobalLinkLayoutRequiresSeparateReceipt': True,
            'overallDisconnectSafetyClaimed': False}


def probe_links(index, index_sha, work):
    """Recreate the full directory/link layout using empty markers, never payload substitutes."""
    checked = graph(index)
    work = real_directory(work)
    if work.exists():
        raise FileExistsError('Link-layout probe must use a fresh directory')
    markers = [r['path'] for r in index['files']]
    for dep in index.get('githubLinkDependencies', []):
        markers += [dep['targetWithinRoot'] + '/' + r['path'] for r in dep['files']]
    estimate_bytes = 256 * 1024 ** 2 + len(markers) * 8192
    free = shutil.disk_usage(work.parent).free
    if estimate_bytes + 2 * 1024 ** 3 > free:
        raise ValueError('Insufficient disk for the full link-layout probe')
    work.mkdir()
    for path in markers:
        relative = safe_relative(path)
        parent = work if len(relative.parts) == 1 else mkdir_safe(work, str(relative.parent))
        with (parent / relative.name).open('xb'):
            pass
    for row in checked['linkDispositions']:
        relative = safe_relative(row['path'])
        parent = work if len(relative.parts) == 1 else mkdir_safe(work, str(relative.parent))
        (parent / relative.name).symlink_to(os.path.relpath(work / row['targetWithinRoot'], parent))
    for row in checked['linkDispositions']:
        path = work / row['path']
        if not path.exists() or path.resolve() != work / row['terminalPath']:
            raise ValueError('Actual relative link layout differs from the closed graph')
    return {'format': 'FPVGlobalLinkLayoutProbe.v1', 'indexSHA256': index_sha,
            'pathAndLinkGraphSHA256': checked['pathAndLinkGraphSHA256'],
            'emptyFileMarkers': len(markers), 'actualRelativeLinksVerified': checked['symlinks'],
            'allLinksResolveWithinChosenRoot': True, 'payloadBytesVerifiedByThisProbe': False,
            'freeDiskBytesBeforeProbe': free, 'oneShotPayloadMaterializationPerformed': False,
            'overallDisconnectSafetyClaimed': False}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--index', required=True)
    parser.add_argument('--plan')
    parser.add_argument('--create-plan', action='store_true')
    parser.add_argument('--maximum-peak-bytes', type=int, default=8 * 1024 ** 3)
    parser.add_argument('--partition')
    parser.add_argument('--work')
    parser.add_argument('--receipt')
    parser.add_argument('--collect-receipt', action='append', default=[])
    parser.add_argument('--probe-links', action='store_true')
    a = parser.parse_args()
    if not a.probe_links and not a.plan:
        parser.error('A plan path is required outside the link-layout probe')
    index_path = Path(a.index)
    before = index_path.stat()
    raw = index_path.read_bytes()
    after = index_path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_ino, before.st_dev) != (
            after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev):
        raise ValueError('Index changed while reading')
    index, index_sha = json.loads(raw), hashlib.sha256(raw).hexdigest()
    if sum([a.create_plan, a.probe_links, bool(a.collect_receipt)]) > 1:
        parser.error('Choose a single planning, link-probe, collection or partition operation')
    if a.create_plan:
        result = plan(index, index_sha, a.maximum_peak_bytes)
        with Path(a.plan).open('x') as out:
            json.dump(result, out, indent=2)
            out.write('\n')
        print(json.dumps({'partitions': len(result['partitions']),
                          'graph': {k: v for k, v in result['graph'].items() if k != 'linkDispositions'},
                          'oneShotMaterializationPerformed': False}))
    elif a.probe_links or a.collect_receipt:
        if not a.receipt or (a.probe_links and not a.work):
            parser.error('Fresh receipt, and fresh work for the link probe, are required')
        if a.probe_links:
            result = probe_links(index, index_sha, Path(a.work))
        else:
            result = collect(index, index_sha, json.loads(Path(a.plan).read_text()),
                             [json.loads(Path(p).read_text()) for p in a.collect_receipt])
        with Path(a.receipt).open('x') as out:
            json.dump(result, out, indent=2)
            out.write('\n')
        print(json.dumps(result))
    else:
        if not all([a.partition, a.work, a.receipt]):
            parser.error('Partition, fresh work and receipt are required for restoration')
        print(json.dumps(run(index, index_sha, json.loads(Path(a.plan).read_text()),
                             a.partition, Path(a.work), Path(a.receipt))))


if __name__ == '__main__':
    main()
