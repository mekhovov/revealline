#!/usr/bin/env python3
"""Verify one full final logical-path restore on a fresh, adequately sized disk."""
import argparse
import hashlib
import json
from pathlib import Path
import time

from bounded_restore import graph
from restore import restore
from restore_paths import real_directory


def verify(index, index_sha, work, receipt_path, shared_cache=None):
    if (index.get('coverageComplete') is not True or index.get('inventorySetFinal') is not True
            or index.get('inventoryComplete') is not True or index.get('held') or index.get('uncovered')
            or index.get('inventoryConflicts') or index.get('inventoryErrorsOrUnstable')):
        raise ValueError('Full qualification requires the root-confirmed complete final index')
    checked = graph(index)
    work = real_directory(work)
    work.mkdir()
    cache = real_directory(shared_cache) if shared_cache is not None else work / 'cache'
    # restore() measures fresh free space before creating cache/output or performing any GET.
    result = restore(index, cache, work / 'logical-files', work / 'restore-details.json')
    if (not result['complete'] or result['files'] != checked['logicalFilePaths']
            or result['logicalBytes'] != checked['logicalBytes']
            or result['githubDependencyFileCount'] != checked['dependencyFiles']
            or len(result['symlinksRecreated']) != checked['symlinks']):
        raise ValueError('Full restore counts or completion differ from the exact path graph')
    target = work / 'logical-files'
    for row in checked['linkDispositions']:
        path = target / row['path']
        if (not path.is_symlink() or path.readlink().is_absolute() or not path.exists()
                or path.resolve() != target / row['terminalPath']):
            raise ValueError('Actual restored link differs from the exact closed path graph')
    receipt = {'format': 'FPVFullPortableRestoreVerification.v1', 'indexSHA256': index_sha,
               'logicalFilePaths': checked['logicalFilePaths'], 'logicalBytes': checked['logicalBytes'],
               'allFileHashesAndModesAndTimesMatch': True,
               'githubDependencyFiles': result['githubDependencyFileCount'],
               'githubDependencyBytes': result['githubDependencyBytes'],
               'allGitHubDependencyFileHashesMatch': result['allGitHubDependencyFileHashesMatch'],
               'actualRelativeLinksVerified': checked['symlinks'],
               'linkDispositionsSHA256': checked['linkDispositionsSHA256'],
               'allLinksResolveToExactWithinRootTerminal': True, 'diskPreflight': result['diskPreflight'],
               'detailedRestoreReceiptSHA256': hashlib.sha256((work / 'restore-details.json').read_bytes()).hexdigest(),
               'inventoriedPayloadPortableRestoreComplete': True,
               'sharedVerifiedCacheUsed': shared_cache is not None,
               'oneShotPayloadMaterializationPerformed': True,
               'gitSourceAndReproducibleDependenciesRequireSeparateClosure': True,
               'overallDisconnectSafetyClaimed': False, 'createdAtUnix': time.time()}
    with receipt_path.open('x') as out:
        json.dump(receipt, out, indent=2)
        out.write('\n')
    return receipt


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--index', required=True)
    parser.add_argument('--work', required=True)
    parser.add_argument('--receipt', required=True)
    a = parser.parse_args()
    path = Path(a.index)
    before = path.stat()
    raw = path.read_bytes()
    after = path.stat()
    if (before.st_size, before.st_mtime_ns, before.st_ino, before.st_dev) != (
            after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev):
        raise ValueError('Final restore index changed while reading')
    print(json.dumps(verify(json.loads(raw), hashlib.sha256(raw).hexdigest(),
                            Path(a.work), Path(a.receipt))))


if __name__ == '__main__':
    main()
