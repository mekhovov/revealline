#!/usr/bin/env python3
"""Portable, exclusive restore from the published preservation index; no old volume required."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import subprocess
import time
from pack import digest, safe_relative
from verify_upload import restore_part, validate_header


def real_directory(path):
    # Reject symlinks in any existing ancestor, including a caller-selected cache root.
    absolute = path.absolute()
    for parent in [*absolute.parents, absolute]:
        if parent.is_symlink():
            raise ValueError('Directory path includes a symlink')
    return absolute


def mkdir_safe(root, relative):
    current = root
    for name in safe_relative(relative).parts:
        current /= name
        if current.is_symlink():
            raise ValueError('Refusing a symlink as a restore parent')
        if current.exists():
            if not current.is_dir():
                raise ValueError('Restore parent is not a directory')
        else:
            current.mkdir()
    return current


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
    cache, target = real_directory(cache), real_directory(target)
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
        restored_files.append({'path': row['path'], 'bytes': n, 'sha256': row['sha256']})
        logical_bytes += n
        if len(restored_files) % 1000 == 0:
            print(json.dumps({'event': 'restore-progress', 'files': len(restored_files), 'bytes': logical_bytes}), flush=True)
    external, links = [], []
    for row in index.get('symlinks', []):
        relative = safe_relative(row['path'])
        mapped, reason = link_target(row['path'], row['target'], index['sourceRoot'])
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
               'symlinksRecreated': links, 'externalDependenciesNotCreated': external,
               'unresolvedInternalLinks': unresolved_links,
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
                                                                 'gitCheckoutsRequireSeparateSourceRestore']}), flush=True)
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
