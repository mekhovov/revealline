#!/usr/bin/env python3
"""Join inventories to verified preservation objects without reading source payloads."""
import argparse
import json
from pathlib import Path
import time
from pack import digest, load_clearances, privacy_hold, rows, safe_relative
from verify_upload import validate_header


def cleared(row, clearances):
    return (row['path'], row.get('sha256')) in clearances


def build(manifests, state, verified_receipts, library_manifests, catalogue, source_root,
          clearances=(), inventory_set_final=False):
    approved = {(x['path'], x['sha256']) for x in clearances}
    files, symlinks, other, conflicts, inputs = {}, {}, [], [], []
    for manifest in manifests:
        before = Path(manifest).stat()
        for row in rows(manifest, require_final_newline=inventory_set_final):
            if row.get('kind') in ('file', 'symlink'):
                safe_relative(row['path'])
                target = files if row['kind'] == 'file' else symlinks
                if row['path'] in target and target[row['path']] != row:
                    conflicts.append({'path': row['path'], 'reason': 'conflicting inventory records'})
                target[row['path']] = row
            else:
                other.append(row)
        sha = digest(manifest)
        after = Path(manifest).stat()
        if inventory_set_final and (before.st_size, before.st_mtime_ns, before.st_ino, before.st_dev) != (
                after.st_size, after.st_mtime_ns, after.st_ino, after.st_dev):
            raise ValueError('Final manifest changed during index creation: ' + str(manifest))
        inputs.append({'path': str(manifest), 'sha256': sha, 'bytes': after.st_size})
    held_sha = {r['sha256'] for r in files.values()
                if (r.get('review') or privacy_hold(r['path'])) and not cleared(r, approved)}
    held = [r for r in files.values() if r['sha256'] in held_sha]
    parts, objects, direct = {}, {}, {}
    for receipt in verified_receipts:
        r = json.loads(Path(receipt).read_text())
        if (r.get('format') != 'FPVCASPartVerified.v1' or not r.get('serverDigestMatch')
                or not r.get('authenticatedFullReadbackSHA256Match')
                or not r.get('restoredMembers', {}).get('allRestoredMemberSHA256Match')):
            raise ValueError('Unverified CAS receipt: ' + str(receipt))
        validate_header(r['partManifest'])
        if (r['restoredMembers']['members'] != len(r['partManifest']['objects'])
                or r['restoredMembers']['bytes'] != sum(x['bytes'] for x in r['partManifest']['objects'])
                or r['sourceBeforeAfterChecks'] != len(r['partManifest']['objects'])):
            raise ValueError('Incomplete source/member verification receipt')
        parts[r['sha256']] = {k: r[k] for k in ['assetId', 'assetName', 'assetURL', 'bytes', 'sha256', 'partManifest']}
        for x in r['partManifest']['objects']:
            if x['sha256'] in objects and objects[x['sha256']]['bytes'] != x['bytes']:
                raise ValueError('Object digest has contradictory size')
            objects[x['sha256']] = {'bytes': x['bytes'], 'partSHA256': r['sha256']}
    for path in library_manifests:
        for r in json.loads(Path(path).read_text())['archives']:
            if (not r.get('preserved') or r.get('serverDigest') != 'sha256:' + r['sha256']
                    or r.get('serverBytes') != r['bytes']
                    or r.get('fullReadback', {}).get('sha256') != r['sha256']
                    or r.get('fullReadback', {}).get('bytes') != r['bytes']):
                raise ValueError('Unverified library asset')
            direct[r['sha256']] = {'assetId': r['assetID'], 'assetName': r['assetName'],
                                   'assetURL': r['assetURL'], 'bytes': r['bytes'], 'sha256': r['sha256'],
                                   'provenance': 'library-full-authenticated-readback'}
    # Catalogue matches are durable candidates; portable restoration still authenticates and hashes all bytes.
    releases = json.loads(Path(catalogue).read_text())
    if isinstance(releases, dict):
        releases = releases['releases']
    for release in releases:
        for asset in release['assets']:
            sha = asset.get('digest', '').removeprefix('sha256:')
            if len(sha) == 64 and sha not in direct:
                direct[sha] = {'assetId': asset['id'], 'assetName': asset['name'], 'assetURL': asset['url'],
                               'bytes': asset['bytes'], 'sha256': sha, 'provenance': 'release-server-digest-catalogue',
                               'releaseTag': release['tag'], 'fullRestoreReadbackRequired': True}
    covered, uncovered, needed_direct = [], [], {}
    for row in sorted(files.values(), key=lambda x: x['path']):
        if row['sha256'] in held_sha:
            continue
        obj = objects.get(row['sha256']) or direct.get(row['sha256'])
        if not obj or obj['bytes'] != row['bytes']:
            uncovered.append(row)
            continue
        covered.append({k: row[k] for k in ['path', 'bytes', 'sha256', 'mtime_ns', 'mode']})
        if row['sha256'] not in objects:
            needed_direct[row['sha256']] = direct[row['sha256']]
    inventory_state = json.loads(Path(state).read_text())
    unresolved = [r for r in other if r.get('kind') in ('error', 'unstable')]
    held_links = [r for r in symlinks.values() if r.get('review') or privacy_hold(r['path'])]
    safe_links = [r for r in symlinks.values() if r not in held_links]
    result = {'format': 'FPVPreservationIndex.v1', 'repo': 'mekhovov/revealline',
              'sourceRoot': source_root, 'inventoryComplete': inventory_state.get('complete') is True,
              'inventorySetFinal': inventory_set_final,
              'inventoryInputs': inputs,
              'parts': parts, 'directAssets': needed_direct, 'files': covered, 'symlinks': safe_links,
              'held': held + held_links, 'uncovered': uncovered, 'inventoryConflicts': conflicts,
              'inventoryErrorsOrUnstable': unresolved,
              'gitCheckouts': [r for r in other if r.get('kind') == 'git-checkout'],
              'excluded': [r for r in other if r.get('kind') == 'excluded'],
              'reviewClearances': list(clearances),
              'coverageComplete': inventory_set_final and inventory_state.get('complete') is True
                                  and not (held or held_links or uncovered or conflicts or unresolved),
              'portableRestoreComplete': False, 'createdAtUnix': time.time()}
    result['counts'] = {'inventoryFilePaths': len(files), 'coveredFilePaths': len(covered),
                        'heldFilePaths': len(held), 'uncoveredFilePaths': len(uncovered),
                        'logicalCoveredBytes': sum(r['bytes'] for r in covered),
                        'verifiedParts': len(parts), 'directAssets': len(needed_direct),
                        'symlinks': len(safe_links), 'heldSymlinks': len(held_links)}
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--manifest', action='append', required=True)
    p.add_argument('--inventory-state', required=True)
    p.add_argument('--verified-receipt', action='append', default=[])
    p.add_argument('--library-manifest', action='append', default=[])
    p.add_argument('--catalogue', required=True)
    p.add_argument('--source-root', required=True)
    p.add_argument('--clearances')
    p.add_argument('--inventory-set-final', action='store_true',
                   help='Root-confirmed complete set includes primary, flat, ignored payload and final delta manifests')
    p.add_argument('--output', required=True)
    a = p.parse_args()
    clearances = load_clearances(a.clearances)
    result = build(a.manifest, a.inventory_state, a.verified_receipt, a.library_manifest,
                   a.catalogue, a.source_root, clearances, a.inventory_set_final)
    with Path(a.output).open('x') as f:
        json.dump(result, f, indent=2)
        f.write('\n')
    print(json.dumps({'counts': result['counts'], 'coverageComplete': result['coverageComplete'],
                      'portableRestoreComplete': False}), flush=True)


if __name__ == '__main__':
    main()
