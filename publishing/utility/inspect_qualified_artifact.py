#!/usr/bin/env python3
"""Offline qualified-artifact inspection; both large payloads remain in the original ZIP.

Usage:
  python3 .cache/cross-mode/p01/v0571/inspect-qualified-member.py ARTIFACT.zip \
    --repo . --expected-commit FULL_HEAD --expected-version v0.57.1 \
    --out .cache/cross-mode/p01/v0571/qualified-artifact-verified

The output folder must not exist. Defaults retain 512 MiB free after writing
only small original metadata and bound direct inspection to 1 GiB. The hosted
release utility supplies the exact 950,000,000-byte Pages cap. No network or Git
writes occur.
This validates bytes/Git identity, not workflow success or release acceptance.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tarfile
import zipfile

from release_limits import DEFAULT_MAX_DISTRIBUTION_MIB, MAX_DISTRIBUTION_MIB, distribution_within_limit

CHUNK = 1024 * 1024
SMALL_LIMITS = {'release.json': 64 * 1024, 'site/manifest.json': 4 * CHUNK,
                'distribution.zip.sha256': 1024}
HEX256 = re.compile(r'[0-9a-f]{64}\Z')


def require(ok, message):
    if not ok:
        raise ValueError(message)


def progress(phase, **details):
    print(json.dumps({'phase': phase, **details}), file=sys.stderr, flush=True)


def safe_path(name, directory=False):
    require(isinstance(name, str) and name and '\\' not in name,
            f'Unsafe archive path: {name!r}')
    require(not any(ord(c) < 32 or ord(c) == 127 for c in name),
            f'Control character in archive path: {name!r}')
    if directory:
        require(name.endswith('/'), f'Directory lacks trailing slash: {name!r}')
        name = name[:-1]
    parts = name.split('/')
    require(all(p and p not in {'.', '..'} and ':' not in p and not p.endswith((' ', '.'))
                for p in parts), f'Unsafe archive path: {name!r}')
    return name


def zip_inventory(z, max_members):
    infos = z.infolist()
    require(len(infos) <= max_members, 'ZIP member count exceeds bound')
    by_name, folded = {}, set()
    for info in infos:
        require(info.orig_filename == info.filename, 'NUL-truncated ZIP member name')
        name = safe_path(info.filename, info.is_dir())
        require(name not in by_name and name.casefold() not in folded,
                f'Duplicate or case-colliding ZIP member: {name}')
        require(not info.flag_bits & (1 | 64), f'Encrypted ZIP member: {name}')
        require(info.compress_type in {zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED},
                f'Unsupported ZIP compression: {name}')
        mode = info.external_attr >> 16
        kind = stat.S_IFMT(mode)
        allowed = {0, stat.S_IFDIR} if info.is_dir() else {0, stat.S_IFREG}
        require(kind in allowed and not mode & 0o7000,
                f'Unsupported ZIP member type/mode: {name}')
        require(info.file_size >= 0 and info.compress_size >= 0, 'Invalid ZIP size')
        require(not info.is_dir() or info.file_size == 0, 'Nonempty ZIP directory')
        require(not (info.external_attr & 0x10) or info.is_dir(),
                f'DOS-directory flag on a file: {name}')
        by_name[name] = info
        folded.add(name.casefold())
    return by_name


def stream_hash(stream, expected_size, algorithm='sha256', destination=None):
    digest, count = hashlib.new(algorithm), 0
    while True:
        block = stream.read(CHUNK)
        if not block:
            break
        count += len(block)
        require(count <= expected_size, 'Stream exceeded declared size')
        digest.update(block)
        if destination is not None:
            destination.write(block)
    require(count == expected_size, f'Stream size mismatch: {count} != {expected_size}')
    return digest.hexdigest()


def small_read(z, info, limit):
    require(info.file_size <= limit, f'Small metadata exceeds bound: {info.filename}')
    with z.open(info) as stream:
        data = stream.read(limit + 1)
        require(len(data) == info.file_size and len(data) <= limit,
                f'Metadata size mismatch: {info.filename}')
        require(stream.read(1) == b'', 'Trailing metadata bytes')
    return data


def json_read(data, label):
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            require(key not in obj, f'Duplicate JSON key in {label}: {key}')
            obj[key] = value
        return obj
    return json.loads(data.decode('utf-8'), object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(f'Invalid JSON constant: {value}')))


def git(repo, *args):
    return subprocess.check_output(['git', '-C', str(repo), *args])


def git_inventory(repo, expected_commit):
    head = git(repo, 'rev-parse', '--verify', 'HEAD').decode().strip()
    require(head == expected_commit, 'Git HEAD does not match --expected-commit')
    algorithm = git(repo, 'rev-parse', '--show-object-format').decode().strip()
    require(algorithm in {'sha1', 'sha256'}, f'Unsupported Git object format: {algorithm}')
    tree = git(repo, 'rev-parse', 'HEAD^{tree}').decode().strip()
    records = {}
    for row in git(repo, 'ls-tree', '-r', '-t', '-l', '-z', 'HEAD').split(b'\0'):
        if not row:
            continue
        metadata, raw_name = row.split(b'\t', 1)
        mode, kind, oid, size = metadata.split()
        name = safe_path(raw_name.decode('utf-8'))
        require(name not in records, f'Duplicate Git tree path: {name}')
        if kind == b'tree':
            require(mode == b'040000', f'Unexpected Git tree mode: {name}')
            records[name] = {'mode': '040000', 'kind': 'directory', 'oid': oid.decode(), 'bytes': 0}
        else:
            require(kind == b'blob' and mode in {b'100644', b'100755'},
                    f'Unsupported Git member (symlink/submodule refused): {name}')
            records[name] = {'mode': mode.decode(), 'kind': 'file', 'oid': oid.decode(), 'bytes': int(size)}
    require(records, 'Empty Git tree')
    return head, tree, algorithm, records


class HashingTarReader:
    """Count/hash all original TAR bytes; retain bounded readahead for zero trailer checks."""
    def __init__(self, stream, size):
        self.stream, self.size = stream, size
        self.count, self.digest, self.tail = 0, hashlib.sha256(), b''

    def read(self, size):
        require(0 <= size <= CHUNK, 'Unexpected unbounded TAR stream read')
        data = self.stream.read(size)
        self.count += len(data)
        require(self.count <= self.size, 'TAR stream exceeded outer ZIP declared size')
        self.digest.update(data)
        self.tail = (self.tail + data)[-128 * 1024:]
        return data


class BoundedTarInfo(tarfile.TarInfo):
    # tarfile processes extension bodies before yielding a member; bound them first.
    def _proc_member(self, archive):
        safe_path(self.name.rstrip('/') if self.isdir() else self.name)
        allowed = {tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE,
                   tarfile.XHDTYPE, tarfile.XGLTYPE}
        require(self.type in allowed, f'Unsupported raw TAR member type: {self.name}')
        if self.type in {tarfile.XHDTYPE, tarfile.XGLTYPE}:
            require(0 <= self.size <= 64 * 1024, 'PAX header exceeds 64 KiB bound')
            if self.type == tarfile.XGLTYPE:
                require(not getattr(archive, '_inspection_global_pax', False) and
                        not getattr(archive, '_inspection_member_seen', False) and
                        not getattr(archive, '_inspection_pending_pax', False),
                        'Repeated or misplaced global PAX header')
                archive._inspection_global_pax = True
            else:
                require(not getattr(archive, '_inspection_pending_pax', False),
                        'Stacked PAX headers could hide overridden metadata')
                archive._inspection_pending_pax = True
        else:
            archive._inspection_pending_pax = False
            archive._inspection_member_seen = True
        return super()._proc_member(archive)


def verify_tar(z, info, records, algorithm, commit):
    require(info.file_size % 512 == 0, 'Source TAR is not block aligned')
    # Room for git headers, PAX paths and padding, while refusing a source ZIP bomb.
    max_tar = sum(((r['bytes'] + 511) // 512) * 512 for r in records.values()) + 4096 * (len(records) + 1) + CHUNK
    require(info.file_size <= max_tar, 'Source TAR exceeds Git-derived size bound')
    seen, files, total, last_end, pax_commit = set(), 0, 0, 0, False
    with z.open(info) as raw:
        reader = HashingTarReader(raw, info.file_size)
        with tarfile.open(fileobj=reader, mode='r|', bufsize=64 * 1024, tarinfo=BoundedTarInfo) as archive:
            for member in archive:
                require(member.type in {tarfile.REGTYPE, tarfile.AREGTYPE, tarfile.DIRTYPE},
                        f'Unsupported TAR member type: {member.name}')
                require(not member.issparse() and not member.linkname,
                        f'Sparse/link TAR member refused: {member.name}')
                name = safe_path(member.name.rstrip('/') if member.isdir() else member.name)
                require(name not in seen and name in records, f'Duplicate/unexpected TAR path: {name}')
                require(len(seen) < len(records), 'Too many TAR members')
                expected = records[name]
                require(not member.mode & 0o7000, f'Special TAR permission bits: {name}')
                for key, value in member.pax_headers.items():
                    require(key in {'comment', 'path', 'mtime'}, f'Unexpected PAX metadata: {key}')
                    if key == 'comment':
                        require(value == commit, 'PAX commit differs from Git HEAD')
                        pax_commit = True
                if member.isdir():
                    require(expected['kind'] == 'directory' and member.size == 0 and
                            member.mode in {0o755, 0o775}, f'TAR directory mode/type differs: {name}')
                else:
                    require(expected['kind'] == 'file' and member.size == expected['bytes'],
                            f'TAR file type/size differs from Git: {name}')
                    permitted = {0o644, 0o664} if expected['mode'] == '100644' else {0o755, 0o775}
                    require(member.mode in permitted, f'TAR tracked executable mode differs: {name}')
                    digest = hashlib.new(algorithm)
                    digest.update(f"blob {member.size}\0".encode())
                    count = 0
                    with archive.extractfile(member) as stream:
                        while True:
                            block = stream.read(CHUNK)
                            if not block:
                                break
                            count += len(block)
                            require(count <= member.size, f'TAR file overrun: {name}')
                            digest.update(block)
                    require(count == member.size and digest.hexdigest() == expected['oid'],
                            f'Git blob hash mismatch: {name}')
                    files += 1
                    total += count
                    if files % 500 == 0:
                        progress('checking_source_tar', files=files, originalBytes=total)
                seen.add(name)
                last_end = ((member.offset_data + member.size + 511) // 512) * 512
            if 'comment' in archive.pax_headers:
                require(archive.pax_headers['comment'] == commit, 'Global PAX commit differs')
                pax_commit = True
        require(seen == set(records), f'TAR omits Git paths: {sorted(set(records) - seen)[:10]}')
        buffered_trailer = reader.count - last_end
        require(0 <= buffered_trailer <= len(reader.tail), 'Cannot account for TAR trailer readahead')
        if buffered_trailer:
            require(not any(reader.tail[-buffered_trailer:]), 'Nonzero data after last Git TAR member')
        while True:
            block = reader.read(CHUNK)
            if not block:
                break
            require(not any(block), 'Nonzero hidden payload after TAR end')
        require(reader.count == info.file_size and reader.count - last_end >= 1024,
                'TAR missing complete zero end markers or truncated')
        return {'sha256': reader.digest.hexdigest(), 'bytes': reader.count,
                'gitFiles': files, 'gitDirectories': len(records) - files,
                'gitOriginalBytes': total, 'paxCommitPresent': pax_commit,
                'modePolicy': 'All Git tracked executable bits matched; only canonical Git archive modes 0644/0664 and 0755/0775 accepted'}


def ancestors(names):
    return {prefix for name in names for prefix in
            ['/'.join(name.split('/')[:i]) for i in range(1, len(name.split('/')))]}


def verify_distribution(file, manifest_data, manifest, commit, version):
    require(isinstance(manifest, dict) and type(manifest.get('formatVersion')) is int and
            manifest.get('formatVersion') == 1 and manifest.get('version') == version and
            manifest.get('sourceRevision') == commit, 'Manifest release identity mismatch')
    entry = safe_path(manifest.get('entry'))
    rows = manifest.get('files')
    require(isinstance(rows, list) and 0 < len(rows) <= 20000, 'Manifest file count invalid')
    expected, folded, total = {}, set(), 0
    for row in rows:
        require(isinstance(row, dict), 'Invalid manifest row')
        name = safe_path(row.get('path'))
        require(name not in {'manifest.json', 'distribution.zip'} and name not in expected and
                name.casefold() not in folded, f'Duplicate/reserved manifest path: {name}')
        require(type(row.get('bytes')) is int and row['bytes'] >= 0 and
                isinstance(row.get('sha256'), str) and HEX256.fullmatch(row['sha256']),
                f'Invalid manifest file identity: {name}')
        expected[name] = row
        folded.add(name.casefold())
        total += row['bytes']
    require(type(manifest.get('totalBytes')) is int and manifest['totalBytes'] == total and
            total <= file.stat().st_size,
            'Manifest totalBytes differs from file sum')
    require(entry in expected and 'game/build-info.json' in expected, 'Manifest missing entry/build identity')
    with zipfile.ZipFile(file) as z:
        actual = zip_inventory(z, 40000)
        require(all(info.compress_type == zipfile.ZIP_STORED for info in actual.values()),
                'Inner ZIP must use the existing uncompressed deterministic build format')
        files = {name for name, info in actual.items() if not info.is_dir()}
        require(files == set(expected) | {'manifest.json'}, 'Inner ZIP files do not exactly match manifest')
        require({name for name, info in actual.items() if info.is_dir()} <= ancestors(files),
                'Unexpected inner ZIP directory')
        require(small_read(z, actual['manifest.json'], SMALL_LIMITS['site/manifest.json']) == manifest_data,
                'Inner and outer manifest bytes differ')
        for i, (name, row) in enumerate(expected.items(), 1):
            info = actual[name]
            require(info.file_size == row['bytes'], f'Inner ZIP size differs: {name}')
            with z.open(info) as stream:
                digest = stream_hash(stream, row['bytes'])
            require(digest == row['sha256'], f'Inner ZIP SHA256 differs: {name}')
            if i % 200 == 0:
                progress('checking_distribution', files=i)
        build = json_read(small_read(z, actual['game/build-info.json'], 64 * 1024), 'build-info.json')
        require(isinstance(build, dict) and type(build.get('formatVersion')) is int and
                build.get('formatVersion') == 1 and build.get('version') == version and
                build.get('sourceRevision') == commit and build.get('entry') == entry,
                'Inner build-info release identity differs')
    return {'files': len(expected), 'manifestTotalBytes': total, 'entry': entry,
            'allManifestBytesVerified': True, 'innerManifestIdentical': True}


class VerifiedMemberView:
    """Seek inside one original ZIP member without writing a duplicate payload.

    The caller first hashes the complete sequential member, also checking outer CRC.
    Python may disable that outer CRC after a stored-member seek. The unchanged
    nested verifier checks every inner member CRC/SHA and the original manifest.
    Only the stat-sized protocol needed by that verifier is added.
    """
    def __init__(self, stream, size):
        self.stream, self.size = stream, size

    def stat(self):
        from types import SimpleNamespace
        return SimpleNamespace(st_size=self.size)

    def __getattr__(self, name):
        return getattr(self.stream, name)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('artifact', type=Path)
    parser.add_argument('--repo', required=True, type=Path)
    parser.add_argument('--expected-commit', required=True)
    parser.add_argument('--expected-version', required=True)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--artifact-sha256', help='Optional externally trusted downloaded artifact digest')
    parser.add_argument('--reserve-mib', type=int, default=512)
    distribution_bound = parser.add_mutually_exclusive_group()
    distribution_bound.add_argument('--max-distribution-mib', type=int, default=DEFAULT_MAX_DISTRIBUTION_MIB)
    distribution_bound.add_argument('--max-distribution-bytes', type=int)
    args = parser.parse_args()
    require(re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', args.expected_commit), 'Use full lowercase commit hash')
    require(re.fullmatch(r'v\d+\.\d+\.\d+', args.expected_version), 'Use stable vX.Y.Z release version')
    valid_distribution_bound = (
        1 <= args.max_distribution_mib <= MAX_DISTRIBUTION_MIB
        if args.max_distribution_bytes is None
        else 1 <= args.max_distribution_bytes <= MAX_DISTRIBUTION_MIB * CHUNK
    )
    require(args.reserve_mib >= 256 and valid_distribution_bound, 'Invalid reserve/distribution bounds')
    if args.artifact_sha256:
        require(HEX256.fullmatch(args.artifact_sha256), 'Invalid expected artifact SHA256')
    require(args.artifact.is_file() and not args.artifact.is_symlink(), 'Artifact must be an existing regular file')
    repo, artifact = args.repo.resolve(strict=True), args.artifact.resolve(strict=True)
    out = args.out.absolute()
    require(not out.exists() and not out.is_symlink(), 'Output must be a new folder')
    parent = out.parent.resolve(strict=True)
    out = parent / out.name
    require(out.name not in {'', '.', '..'}, 'Invalid output folder name')
    commit, tree, algorithm, records = git_inventory(repo, args.expected_commit)
    before = artifact.stat()
    progress('hashing_outer_artifact', bytes=before.st_size)
    with artifact.open('rb') as stream:
        artifact_hash = stream_hash(stream, before.st_size)
    if args.artifact_sha256:
        require(artifact_hash == args.artifact_sha256, 'Outer artifact trusted SHA256 mismatch')
    created, owned = False, []
    try:
        with zipfile.ZipFile(artifact) as z:
            actual = zip_inventory(z, 32)
            release_names = [name for name, info in actual.items()
                             if not info.is_dir() and (name == 'release.json' or name.endswith('/release.json'))]
            require(len(release_names) == 1, 'Artifact must contain exactly one release.json')
            prefix = release_names[0][:-len('release.json')]
            wanted = {prefix + n for n in [*SMALL_LIMITS, 'source.tar', 'site/distribution.zip']}
            files = {name for name, info in actual.items() if not info.is_dir()}
            require(files == wanted, 'Artifact must contain exactly the five workflow snapshot files')
            require({name for name, info in actual.items() if info.is_dir()} <= ancestors(wanted),
                    'Unexpected outer ZIP directory')
            small = {name: small_read(z, actual[prefix + name], limit) for name, limit in SMALL_LIMITS.items()}
            release = json_read(small['release.json'], 'release.json')
            require(isinstance(release, dict) and type(release.get('formatVersion')) is int and
                    release.get('formatVersion') == 1 and release.get('version') == args.expected_version and
                    release.get('sourceRevision') == commit, 'Release identity does not match expected Git HEAD/version')
            for key in ['sourceArchiveSha256', 'distributionSha256', 'manifestSha256']:
                require(isinstance(release.get(key), str) and HEX256.fullmatch(release[key]), f'Invalid release hash: {key}')
            require(release.get('play') == args.expected_version + '/site/game/' and
                    release.get('download') == args.expected_version + '/site/distribution.zip', 'Release route identity differs')
            require(hashlib.sha256(small['site/manifest.json']).hexdigest() == release['manifestSha256'],
                    'Release manifest hash differs')
            checksum = small['distribution.zip.sha256'].decode('ascii')
            match = re.fullmatch(r'([0-9a-f]{64})  distribution\.zip\n', checksum)
            require(match and match[1] == release['distributionSha256'], 'Distribution checksum/release hash differ')
            distribution = actual[prefix + 'site/distribution.zip']
            require(
                distribution_within_limit(
                    distribution.file_size,
                    args.max_distribution_mib,
                    args.max_distribution_bytes,
                ),
                'Distribution exceeds extraction bound',
            )
            needed = sum(map(len, small.values())) + CHUNK
            reserve = args.reserve_mib * CHUNK
            require(shutil.disk_usage(parent).free >= needed + reserve,
                    f'Insufficient disk: need {needed + reserve} free bytes including reserve; source.tar will not be extracted')
            progress('checking_source_tar', expectedGitPaths=len(records))
            source = verify_tar(z, actual[prefix + 'source.tar'], records, algorithm, commit)
            require(source['sha256'] == release['sourceArchiveSha256'], 'Original source TAR hash differs from release.json')
            require(shutil.disk_usage(parent).free >= needed + reserve, 'Free-space reserve changed during source check')
            os.mkdir(out, 0o700)
            created = True
            progress('checking_distribution_inside_original_artifact', bytes=distribution.file_size)
            with z.open(distribution) as stream:
                distribution_hash = stream_hash(stream, distribution.file_size)
            require(distribution_hash == release['distributionSha256'], 'Original distribution hash differs')
            manifest = json_read(small['site/manifest.json'], 'manifest.json')
            with z.open(distribution) as stream:
                result = verify_distribution(VerifiedMemberView(stream, distribution.file_size),
                                             small['site/manifest.json'], manifest, commit, args.expected_version)
            require(git(repo, 'rev-parse', 'HEAD').decode().strip() == commit, 'Git HEAD changed during inspection')
            after = artifact.stat()
            require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns) ==
                    (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns),
                    'Artifact file changed during inspection')
            require(shutil.disk_usage(out).free >= reserve, 'Post-inspection disk reserve exhausted')
            for relative, destination_name in [('release.json', 'release.json'), ('site/manifest.json', 'manifest.json'),
                                               ('distribution.zip.sha256', 'distribution.zip.sha256')]:
                target = out / destination_name
                with target.open('xb') as destination:
                    owned.append(target)
                    destination.write(small[relative])
            report = {
                'format': 'revealline-qualified-artifact-offline-inspection.v1', 'status': 'PASS',
                'scope': 'Local byte/Git/hash-chain inspection only; workflow success, public release and play/offline acceptance are separate',
                'gitHead': commit, 'gitTree': tree, 'gitObjectFormat': algorithm, 'version': args.expected_version,
                'artifact': {'path': str(artifact), 'bytes': before.st_size, 'sha256': artifact_hash,
                             'externallyExpectedDigestSupplied': bool(args.artifact_sha256), 'members': len(actual), 'prefix': prefix},
                'sourceTar': {**source, 'outerMember': prefix + 'source.tar', 'copiedToDisk': False},
                'distribution': {**result, 'bytes': distribution.file_size, 'sha256': distribution_hash, 'copiedToDisk': False, 'outerMember': prefix + 'site/distribution.zip'},
                'releaseHashChainVerified': True, 'manifestSha256': release['manifestSha256'],
                'diskReserveBytes': reserve, 'freeBytesAfterInspection': shutil.disk_usage(out).free,
                'output': str(out), 'extractedFiles': ['release.json', 'manifest.json', 'distribution.zip.sha256'],
            }
            target = out / 'inspection.json'
            with target.open('x') as destination:
                owned.append(target)
                json.dump(report, destination, indent=2)
                destination.write('\n')
            print(json.dumps(report, indent=2))
    except BaseException:
        # Remove only files created by this invocation; never recurse through foreign paths.
        if created:
            for file in reversed(owned):
                try:
                    file.unlink(missing_ok=True)
                except OSError:
                    pass
            try:
                out.rmdir()
            except OSError:
                pass
        raise


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, EOFError, tarfile.TarError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f'Inspection refused: {error}', file=sys.stderr)
        sys.exit(1)
