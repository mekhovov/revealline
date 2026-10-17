"""Verify an existing Pages artifact and rehearse restoration; never deploy it.

Only the standard library is used. The destination must not exist. Archive
metadata is never extracted: validated regular-file bytes are copied explicitly.
"""
import argparse
import hashlib
import json
import pathlib
import re
import shutil
import stat
import tarfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        while block := stream.read(1024 * 1024):
            result.update(block)
    return result.hexdigest()


def safe_path(name):
    require(isinstance(name, str) and 0 < len(name) <= 4096, 'Invalid path length')
    require('\\' not in name and not any(ord(c) < 32 for c in name), 'Unsafe path characters')
    require(all(part not in ('', '.', '..') for part in name.split('/')), 'Unsafe path components')
    return name


def recover(bundle, destination, source, run_id):
    require(re.fullmatch('[0-9a-f]{40}', source), 'Invalid source identity')
    require(re.fullmatch('[1-9][0-9]*', run_id), 'Invalid run identity')
    require(not destination.exists() and not destination.is_symlink(), 'Restore destination already exists')
    names = ['artifact.tar', 'main-pages-inventory.json', 'main-pages-receipt.json',
             'main-pages-archive-receipt.json']
    for name in names:
        info = (bundle / name).lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1, 'Bundle input must be an ordinary unlinked file')
    inventory = json.loads((bundle / names[1]).read_bytes())
    staged = json.loads((bundle / names[2]).read_bytes())
    archive = json.loads((bundle / names[3]).read_bytes())
    require(inventory['format'] == 'revealline-main-pages-inventory.v1', 'Inventory format differs')
    require(staged['format'] == 'revealline-main-pages-receipt.v1', 'Staged format differs')
    require(archive['format'] == 'revealline-main-pages-archive-receipt.v1', 'Archive format differs')
    require(all(row['sourceRevision'] == source for row in [inventory, staged, archive]), 'Source mismatch')
    require(inventory['completeInventory'] is True and staged['completeInventory'] is True
            and staged['capacityAccepted'] is True and archive['archiveAccepted'] is True,
            'Original deployment was not accepted')
    require(staged['errors'] == archive['errors'] == [], 'Original receipts contain errors')
    inventory_hash = digest(bundle / names[1])
    require(staged['inventorySha256'] == archive['inventorySha256'] == inventory_hash, 'Inventory hash mismatch')
    expected = {}
    for row in inventory['files']:
        name = safe_path(row['path'])
        require(name not in expected, 'Duplicate inventory path')
        require(type(row['bytes']) is int and row['bytes'] >= 0, 'Invalid file size')
        require(re.fullmatch('[0-9a-f]{64}', row['sha256']), 'Invalid file checksum')
        expected[name] = row
    require(len(expected) == staged['files'] == archive['files'] > 0, 'File count mismatch')
    total = sum(row['bytes'] for row in expected.values())
    require(total == staged['bytes'] == archive['stagedBytes'], 'Staged byte mismatch')
    artifact = bundle / names[0]
    archive_hash = digest(artifact)
    require(archive_hash == archive['archiveSha256'], 'Archive hash mismatch')
    require(artifact.stat().st_size == archive['archiveBytes'] <= 980000000, 'Archive capacity mismatch')
    require(total <= staged['maximumBytes'] <= 980000000
            and archive['maximumArchiveBytes'] <= 980000000, 'Original budget differs')
    # Validate every member before creating the destination. Do not trust paths,
    # hashes, sizes, modes, link targets, ownership or timestamps from the tar.
    seen = set()
    with tarfile.open(artifact, 'r:') as tar:
        for member in tar:
            name = member.name.removeprefix('./')
            if member.isdir() and name in ('', '.'):
                continue
            safe_path(name)
            if member.isdir():
                require(name not in expected, 'Directory replaces inventoried file')
                continue
            require(member.isfile() and name in expected and name not in seen, 'Unexpected, duplicate or linked archive member')
            row = expected[name]
            require(member.size == row['bytes'], 'Member size mismatch')
            checksum = hashlib.sha256()
            with tar.extractfile(member) as stream:
                while block := stream.read(1024 * 1024):
                    checksum.update(block)
            require(checksum.hexdigest() == row['sha256'], 'Member checksum mismatch')
            seen.add(name)
    require(seen == set(expected), 'Missing archive member')
    destination.mkdir(parents=False)
    with tarfile.open(artifact, 'r:') as tar:
        for member in tar:
            if not member.isfile():
                continue
            name = safe_path(member.name.removeprefix('./'))
            target = destination / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with tar.extractfile(member) as stream, target.open('xb') as output:
                shutil.copyfileobj(stream, output, 1024 * 1024)
    actual = {str(file.relative_to(destination)) for file in destination.rglob('*') if file.is_file()}
    require(actual == set(expected), 'Restored inventory differs')
    for name, row in expected.items():
        target = destination / name
        require(target.stat().st_size == row['bytes'] and digest(target) == row['sha256'], 'Restored bytes differ')
    # The archive must remain unchanged through both verification and restore.
    require(digest(artifact) == archive_hash, 'Archive changed during restore')
    return {'format': 'revealline-pages-recovery-rehearsal.v1', 'sourceRevision': source,
            'sourceRunId': run_id, 'archiveSha256': archive_hash, 'inventorySha256': inventory_hash,
            'files': len(expected), 'restoredBytes': total, 'exactRestoreVerified': True,
            'productionDeploymentPerformed': False, 'browserGameplayQualified': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', type=pathlib.Path, required=True)
    parser.add_argument('--restore', type=pathlib.Path, required=True)
    parser.add_argument('--source', required=True)
    parser.add_argument('--run-id', required=True)
    args = parser.parse_args()
    result = recover(args.bundle, args.restore, args.source, args.run_id)
    # Preserve evidence only after exact restore acceptance; no passing receipt on failure.
    output = args.bundle / 'recovery-rehearsal.json'
    with output.open('x') as stream:
        stream.write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))
