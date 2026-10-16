"""Inspect candidate bytes independently. Never extract or execute candidate code."""

import argparse
import hashlib
import json
import os
import pathlib
import re
import stat
import sys
import tarfile

MAXIMUM = 980000000
JSON_LIMIT = 16 * 1024 * 1024
METADATA = {
    'main-deployment.json': 'mainDeployment',
    'release.json': 'release',
    'game/index.html': 'gameGateHTML',
    'releases/index.html': 'releasesHTML',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def signature(info):
    return (info.st_dev, info.st_ino, info.st_mode, info.st_size,
            info.st_mtime_ns, info.st_ctime_ns, info.st_nlink)


def ordinary(path, maximum):
    before = path.lstat()
    require(stat.S_ISREG(before.st_mode) and before.st_nlink == 1,
            'Input must be an ordinary unlinked file: ' + path.name)
    require(0 <= before.st_size <= maximum, 'Oversized input: ' + path.name)
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    stream = os.fdopen(descriptor, 'rb')
    if signature(before) != signature(os.fstat(stream.fileno())):
        stream.close()
        raise ValueError('Input changed while opening: ' + path.name)
    return stream, before


def pairs(items):
    result = {}
    for key, value in items:
        require(key not in result, 'Duplicate JSON property')
        result[key] = value
    return result


def decode(data):
    return json.loads(data.decode('utf-8'), object_pairs_hook=pairs,
                      parse_constant=lambda value: (_ for _ in ()).throw(
                          ValueError('Nonfinite JSON number')))


def read_json(path):
    stream, before = ordinary(path, JSON_LIMIT)
    with stream:
        data = stream.read(JSON_LIMIT + 1)
        require(len(data) == before.st_size <= JSON_LIMIT,
                'Input changed while reading: ' + path.name)
        require(signature(before) == signature(os.fstat(stream.fileno())) ==
                signature(path.lstat()), 'Input changed: ' + path.name)
    return data, decode(data)


def safe_path(name):
    require(isinstance(name, str) and 0 < len(name) <= 4096 and
            not re.search(r'[\\\x00-\x1f\x7f]', name) and
            all(part not in ('', '.', '..', '.git', '.github')
                for part in name.split('/')), 'Unsafe path')
    return name


def natural(value):
    return type(value) is int and 0 <= value <= MAXIMUM


def descriptors(rows):
    require(type(rows) is list and len(rows) <= 100000, 'Invalid file list')
    result = {}
    for row in rows:
        require(type(row) is dict and set(row) == {'path', 'bytes', 'sha256'},
                'Invalid file descriptor')
        name = safe_path(row['path'])
        require(name not in result, 'Duplicate file path')
        require(natural(row['bytes']) and isinstance(row['sha256'], str) and
                re.fullmatch(r'[a-f0-9]{64}', row['sha256']), 'Invalid file descriptor')
        result[name] = row
    return result


def inspect(bundle, preflight_path):
    require(stat.S_ISDIR(bundle.lstat().st_mode), 'Bundle must be an ordinary directory')
    output = bundle / 'independent-archive.json'
    require(not output.exists() and not output.is_symlink(), 'Independent output already exists')
    _, trusted = read_json(preflight_path)
    source = trusted['syntheticSha']
    require(isinstance(source, str) and re.fullmatch(r'[a-f0-9]{40}', source),
            'Invalid trusted source')
    overlay = descriptors(trusted['overlay']['files'])
    require(all(name.startswith('practice/') for name in overlay),
            'Trusted overlay path is outside practice/')
    inventory_bytes, inventory = read_json(bundle / 'main-pages-inventory.json')
    _, staged = read_json(bundle / 'main-pages-receipt.json')
    _, archived = read_json(bundle / 'main-pages-archive-receipt.json')
    require(inventory['format'] == 'revealline-main-pages-inventory.v1' and
            staged['format'] == 'revealline-main-pages-receipt.v1' and
            archived['format'] == 'revealline-main-pages-archive-receipt.v1',
            'Invalid production receipt format')
    require(all(item['sourceRevision'] == source for item in (inventory, staged, archived)),
            'Source identity mismatch')
    require(inventory['completeInventory'] is True and staged['completeInventory'] is True and
            staged['capacityAccepted'] is True and staged['withinCapacity'] is True and
            archived['archiveAccepted'] is True and staged['errors'] == [] and
            archived['errors'] == [], 'Production evidence was not accepted')
    inventory_hash = hashlib.sha256(inventory_bytes).hexdigest()
    require(staged['inventorySha256'] == archived['inventorySha256'] == inventory_hash,
            'Inventory checksum mismatch')
    expected = descriptors(inventory['files'])
    require(bool(expected), 'Empty inventory')
    require(isinstance(archived['artifactId'], str) and
            re.fullmatch(r'[1-9][0-9]*', archived['artifactId']), 'Invalid artifact identity')
    for value in (staged['maximumBytes'], archived['maximumArchiveBytes']):
        require(natural(value), 'Invalid or broadened capacity budget')

    archive = bundle / 'artifact.tar'
    stream, before = ordinary(archive, MAXIMUM)
    actual, metadata, seen = {}, {}, set()
    raw = captured = 0
    with stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
        archive_hash = digest.hexdigest()
        stream.seek(0)
        with tarfile.open(fileobj=stream, mode='r|') as tar:
            for member in tar:
                name = member.name[2:] if member.name.startswith('./') else member.name
                if member.isdir() and name in ('', '.'):
                    require('.' not in seen, 'Duplicate archive root')
                    seen.add('.')
                    continue
                safe_path(name)
                require(name not in seen, 'Duplicate archive member')
                seen.add(name)
                require(len(seen) <= 200000, 'Too many archive members')
                if member.isdir():
                    continue
                require(member.type in (tarfile.REGTYPE, tarfile.AREGTYPE) and
                        not member.sparse, 'Unsupported archive member')
                require(name in expected, 'Unexpected archive file')
                require(natural(member.size), 'Invalid archive member size')
                raw += member.size
                require(raw <= MAXIMUM, 'Raw archive payload exceeds capacity')
                require(member.size == expected[name]['bytes'], 'Archive file size mismatch')
                if name in METADATA:
                    captured += member.size
                    require(captured <= JSON_LIMIT, 'Oversized captured metadata')
                body_hash, size, content = hashlib.sha256(), 0, []
                with tar.extractfile(member) as body:
                    for chunk in iter(lambda: body.read(1024 * 1024), b''):
                        body_hash.update(chunk)
                        size += len(chunk)
                        if name in METADATA:
                            content.append(chunk)
                row = {'path': name, 'bytes': size, 'sha256': body_hash.hexdigest()}
                require(row == expected[name], 'Archive file hash mismatch')
                actual[name] = row
                if name in METADATA:
                    metadata[METADATA[name]] = b''.join(content).decode('utf-8')
        require(signature(before) == signature(os.fstat(stream.fileno())) ==
                signature(archive.lstat()), 'Archive changed during inspection')
    require(actual == expected, 'Archive is missing inventoried files')
    for name in seen - {'.'}:
        parts = name.split('/')
        require(all('/'.join(parts[:end]) not in actual for end in range(1, len(parts))),
                'Archive file is also a parent directory')
    require(set(metadata) == set(METADATA.values()), 'Missing required metadata')
    actual_overlay = {name: row for name, row in actual.items() if name.startswith('practice/')}
    require(actual_overlay == overlay, 'Frozen overlay closure differs')
    deployment = {
        'format': 'revealline-main-deployment.v1', 'channel': 'main',
        'sourceRevision': source, 'sourceCommittedAt': trusted['sourceCommittedAt'],
        'buildVersion': trusted['buildVersion'], 'play': 'game/',
        'releases': 'https://github.com/mekhovov/revealline/releases',
    }
    writer_bytes = json.dumps(deployment, ensure_ascii=False, indent=2) + '\n'
    require(metadata['mainDeployment'] == metadata['release'] == writer_bytes,
            'Rolling deployment metadata differs from trusted writer identity')
    for value in (staged['files'], archived['files']):
        require(type(value) is int and value == len(actual), 'Receipt file count mismatch')
    for value in (staged['bytes'], archived['stagedBytes']):
        require(type(value) is int and value == raw, 'Receipt raw bytes mismatch')
    require(type(archived['archiveBytes']) is int and archived['archiveBytes'] == before.st_size,
            'Receipt archive size mismatch')
    require(type(archived['overheadBytes']) is int and
            archived['overheadBytes'] == before.st_size - raw >= 0,
            'Receipt archive overhead mismatch')
    require(archived['archiveSha256'] == archive_hash, 'Receipt archive hash mismatch')
    require(raw <= staged['maximumBytes'] and before.st_size <= archived['maximumArchiveBytes'],
            'Recorded capacity budget exceeded')
    rows = sorted(actual.values(), key=lambda row: row['path'])
    require(staged['largestFiles'] == sorted(rows, key=lambda row: (-row['bytes'], row['path']))[:20],
            'Receipt largest files mismatch')
    result = {
        'format': 'revealline-pages-independent-archive.v1',
        'sourceRevision': source, 'files': rows, 'fileCount': len(rows),
        'stagedBytes': raw, 'archiveBytes': before.st_size, 'archiveSha256': archive_hash,
        'artifactId': archived['artifactId'], 'overheadBytes': before.st_size - raw,
        'maximumBytes': staged['maximumBytes'],
        'maximumArchiveBytes': archived['maximumArchiveBytes'],
        'inventorySha256': inventory_hash, 'metadata': metadata,
        'mergeAuthorized': False, 'qualificationPerformed': False,
        'productionDeploymentPerformed': False,
    }
    with output.open('x', encoding='utf-8') as target:
        target.write(json.dumps(result, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle', required=True, type=pathlib.Path)
    parser.add_argument('--preflight', required=True, type=pathlib.Path)
    args = parser.parse_args()
    try:
        inspect(args.bundle, args.preflight)
    except (OSError, ValueError, KeyError, TypeError, tarfile.TarError) as error:
        print('Candidate archive rejected: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
