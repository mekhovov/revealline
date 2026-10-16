#!/usr/bin/env python3
"""Portable, exclusive restore from the published preservation index; no old volume required."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import shutil
import subprocess
import time
from pack import digest, safe_relative
from verify_upload import restore_part, validate_header
from restore_paths import mkdir_safe, real_directory
from github_dependencies import restore_dependencies, validate_dependency


def disk_preflight(index, cache, target, reserve=2 * 1024 ** 3):
    """Conservative fresh-space gate; never clear a runner to make the restore fit."""
    def ancestor(path):
        while not path.exists():
            path = path.parent
        return path
    parts, direct = list(index.get('parts', {}).values()), list(index.get('directAssets', {}).values())
    objects = [row for part in parts for row in part['partManifest']['objects']]
    dependencies = [row for dep in index.get('githubLinkDependencies', []) for row in dep['files']]
    cache_bytes = sum(p['bytes'] for p in parts + direct) + sum(r['bytes'] for r in objects + dependencies)
    logical_bytes = sum(r['bytes'] for r in index['files'] + dependencies)
    allowance = 256 * 1024 ** 2 + 8192 * (len(index['files']) + len(objects) + len(dependencies) * 2)
    cache_parent, target_parent = ancestor(cache), ancestor(target.parent)
    cache_free, target_free = shutil.disk_usage(cache_parent).free, shutil.disk_usage(target_parent).free
    same_disk = cache_parent.stat().st_dev == target_parent.stat().st_dev
    if (same_disk and cache_bytes + logical_bytes + allowance + reserve > min(cache_free, target_free)
            or not same_disk and (cache_bytes + allowance + reserve > cache_free
                                  or logical_bytes + allowance + reserve > target_free)):
        raise ValueError('Insufficient free disk before restoration; use bounded partitions on fresh runners')
    return {'cacheEstimatedBytes': cache_bytes, 'logicalCopyEstimatedBytes': logical_bytes,
            'metadataAllowanceBytes': allowance, 'estimatedPeakBytes': cache_bytes + logical_bytes + allowance,
            'freeDiskReserveBytes': reserve, 'cacheFreeBytesBeforeRestore': cache_free,
            'targetFreeBytesBeforeRestore': target_free, 'cacheAndTargetOnSameFilesystem': same_disk}


def obtain_asset(repo, asset, cache):
    sha = asset['sha256']
    if len(sha) != 64 or any(x not in '0123456789abcdef' for x in sha):
        raise ValueError('Invalid content digest')
    target = cache / ('asset-' + str(asset['assetId']) + '-' + sha)
    if target.exists():
        if target.is_symlink() or target.stat().st_size != asset['bytes'] or digest(target) != sha:
            raise ValueError('Existing cache differs; refusing overwrite')
        return target
    with target.open('xb') as f:
        p = subprocess.run(['gh', 'api', '-H', 'Accept: application/octet-stream',
                            f'repos/{repo}/releases/assets/{asset["assetId"]}'], stdout=f)
    if p.returncode or target.stat().st_size != asset['bytes'] or digest(target) != sha:
        raise ValueError('Authenticated asset download failed verification; retained for inspection')
    return target


def link_target(path, target, source_root):
    """Return a safe within-root target, or an explicit external-dependency record."""
    safe_relative(path)
    if '\\' in target or '\0' in target:
        return None, 'unsupported link target'
    if target.startswith('/'):
        try:
            relative = str(PurePosixPath(target).relative_to(PurePosixPath(source_root)))
        except ValueError:
            return None, 'absolute target outside the captured source root'
    else:
        relative = posixpath.normpath(posixpath.join(posixpath.dirname(path), target))
    relative = posixpath.normpath(relative)
    if relative == '..' or relative.startswith('../') or relative.startswith('/'):
        return None, 'relative target escapes the captured source root'
    if relative == '.':
        relative = ''
    return relative, None


def restore(index, cache, target, receipt_path, defer_external=False):
    if index.get('format') != 'FPVPreservationIndex.v1':
        raise ValueError('Unsupported preservation index')
    link_rows = {r['path']: r for r in index.get('symlinks', [])}
    for dep in index.get('githubLinkDependencies', []):
        validate_dependency(dep)
        if dep['linkPath'] not in link_rows or link_rows[dep['linkPath']]['target'] != dep['originalTargetExact']:
            raise ValueError('Reviewed mapping does not match the exact captured link')
    cache, target = real_directory(cache), real_directory(target)
    if target.exists():
        raise FileExistsError('Restore destination must be fresh')
    disk = disk_preflight(index, cache, target)
    target.mkdir()  # Existing destinations are never merged, cleared or overwritten.
    cache.mkdir(parents=True, exist_ok=True)
    if cache.is_symlink() or target.is_symlink():
        raise ValueError('Restore/cache roots must be real directories')
    objects, part_roots = {}, {}
    for sha, part in index['parts'].items():
        if sha != part['sha256']:
            raise ValueError('Part map key differs from its digest')
        validate_header(part['partManifest'])
        archive = obtain_asset(index['repo'], part, cache)
        restored = cache / ('part-' + sha)
        if restored.exists():
            if restored.is_symlink():
                raise ValueError('Unsafe existing part cache')
            for x in part['partManifest']['objects']:
                path = restored / x['member']
                if (path.parent.is_symlink() or path.is_symlink()
                        or path.stat().st_size != x['bytes'] or digest(path) != x['sha256']):
                    raise ValueError('Existing part cache differs')
        else:
            restore_part(archive, restored, part['partManifest'])
        for x in part['partManifest']['objects']:
            objects[x['sha256']] = restored / x['member']
    for sha, asset in index.get('directAssets', {}).items():
        objects[sha] = obtain_asset(index['repo'], asset, cache)
    restored_files, logical_bytes = [], 0
    for row in index['files']:
        relative = safe_relative(row['path'])
        if len(relative.parts) > 1:
            parent = mkdir_safe(target, str(relative.parent))
        else:
            parent = target
        path = parent / relative.name
        components = index.get('compositeObjects', {}).get(row['sha256'], [row['sha256']])
        h, n = hashlib.sha256(), 0
        with path.open('xb') as out:
            for component in components:
                source = objects[component]
                if source.is_symlink():
                    raise ValueError('Unsafe cached object')
                with source.open('rb') as f:
                    while data := f.read(4 * 1024 * 1024):
                        out.write(data)
                        h.update(data)
                        n += len(data)
        if n != row['bytes'] or h.hexdigest() != row['sha256'] or digest(path) != row['sha256']:
            raise ValueError('Restored file hash/size differs: ' + row['path'])
        os.chmod(path, row['mode'] & 0o777)
        os.utime(path, ns=(row['mtime_ns'], row['mtime_ns']))
        restored_stat = path.stat()
        if restored_stat.st_mode & 0o777 != row['mode'] & 0o777 or restored_stat.st_mtime_ns != row['mtime_ns']:
            raise ValueError('Restored file metadata differs: ' + row['path'])
        restored_files.append({'path': row['path'], 'bytes': n, 'sha256': row['sha256']})
        logical_bytes += n
        if len(restored_files) % 1000 == 0:
            print(json.dumps({'event': 'restore-progress', 'files': len(restored_files), 'bytes': logical_bytes}), flush=True)
    mappings, dependency_files = restore_dependencies(index.get('githubLinkDependencies', []), cache, target)
    external, links = [], []
    for row in index.get('symlinks', []):
        relative = safe_relative(row['path'])
        mapped, reason = link_target(row['path'], row['target'], index['sourceRoot'])
        if reason and row['path'] in mappings:
            mapped, reason = mappings[row['path']]['targetWithinRoot'], None
        if reason:
            external.append({'path': row['path'], 'target': row['target'], 'reason': reason})
            continue
        parent = target if len(relative.parts) == 1 else mkdir_safe(target, str(relative.parent))
        path = parent / relative.name
        destination = target / mapped
        # Files were restored before links: no subsequent file write can follow a created link.
        path.symlink_to(os.path.relpath(destination, parent))
        links.append({'path': row['path'], 'rewrittenRelativeTarget': os.readlink(path)})
    unresolved_links = []
    for link in links:
        path = target.joinpath(*safe_relative(link['path']).parts)
        try:
            resolved = path.exists()
        except OSError:
            resolved = False
        if not resolved:
            unresolved_links.append(link)
    receipt = {'format': 'FPVPortableRestoreReceipt.v1', 'files': len(restored_files),
               'logicalBytes': logical_bytes, 'allFileHashesMatch': True,
               'allFileModesAndTimesMatch': True,
               'symlinksRecreated': links, 'externalDependenciesNotCreated': external,
               'unresolvedInternalLinks': unresolved_links,
               'githubDependencyFiles': dependency_files, 'reviewedExternalLinkMappings': list(mappings.values()),
               'githubDependencyFileCount': len(dependency_files),
               'githubDependencyBytes': sum(r['bytes'] for r in dependency_files),
               'allGitHubDependencyFileHashesMatch': True,
               'diskPreflight': disk,
               'complete': index.get('coverageComplete') is True and not external
                           and not index.get('held') and not index.get('uncovered')
                           and not index.get('inventoryConflicts') and not index.get('inventoryErrorsOrUnstable')
                           and not unresolved_links,
               'scope': 'inventoried non-Git payload; Git checkout recovery is a separate receipt',
               'overallDisconnectSafetyClaimed': False,
               'inventoryCoverageComplete': index.get('coverageComplete') is True,
               'deferredExternalDependenciesExplicitlyAccepted': defer_external,
               'gitCheckoutsRequireSeparateSourceRestore': index.get('gitCheckouts', []),
               'createdAtUnix': time.time()}
    with receipt_path.open('x') as f:
        json.dump(receipt, f, indent=2)
        f.write('\n')
    print(json.dumps({k: v for k, v in receipt.items() if k not in ['symlinksRecreated', 'externalDependenciesNotCreated',
                          'gitCheckoutsRequireSeparateSourceRestore', 'githubDependencyFiles',
                          'reviewedExternalLinkMappings']}), flush=True)
    if external and not defer_external:
        raise ValueError('External dependencies were reported and not recreated; supply a reviewed mapping or restore them separately')
    return receipt


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--index', required=True)
    p.add_argument('--cache', required=True)
    p.add_argument('--restore-root', required=True)
    p.add_argument('--receipt', required=True)
    p.add_argument('--defer-external-dependencies', action='store_true')
    a = p.parse_args()
    index = json.loads(Path(a.index).read_text())
    restore(index, Path(a.cache), Path(a.restore_root), Path(a.receipt), a.defer_external_dependencies)


if __name__ == '__main__':
    main()
