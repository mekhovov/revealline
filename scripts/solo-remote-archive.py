"""Bounded, independent ZIP readback for the temporary hosted Solo cohort.

No network, deletion, symlinks, overwrite, or general archive extraction API.
The caller owns timeout/process limits and retains this receipt on failure.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile

MAX_ZIP = 2 * 1024**3
MAX_PAYLOAD = 2 * 1024**3
MAX_MEMBERS = 6000
MARKER = b'{"tool":"xonix-game-cli","formatVersion":1}\n'


def digest(path):
    h = hashlib.sha256()
    size = 0
    with open(path, 'rb') as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(data)
            size += len(data)
    return {'sha256': h.hexdigest(), 'bytes': size}


def safe_name(name):
    p = PurePosixPath(name)
    assert name and '\\' not in name and '\x00' not in name
    assert not p.is_absolute() and '..' not in p.parts and '.' not in p.parts
    assert str(p) == name and not name.endswith('/')
    return name


def entries(archive):
    rows = archive.infolist()
    assert 0 < len(rows) <= MAX_MEMBERS
    assert len({r.filename for r in rows}) == len(rows)
    assert sum(r.file_size for r in rows) <= MAX_PAYLOAD
    for row in rows:
        safe_name(row.filename)
        mode = row.external_attr >> 16
        assert stat.S_IFMT(mode) in (0, stat.S_IFREG), 'Non-regular ZIP member'
        assert not row.flag_bits & 1, 'Encrypted member'
    return rows


def member(archive, row, target=None):
    h = hashlib.sha256()
    size = 0
    output = None
    try:
        if target:
            target.parent.mkdir(parents=True, exist_ok=True)
            output = open(target, 'xb')
        with archive.open(row) as stream:
            for data in iter(lambda: stream.read(1024 * 1024), b''):
                size += len(data)
                assert size <= row.file_size
                h.update(data)
                if output:
                    output.write(data)
        assert size == row.file_size
        if output:
            output.flush()
            os.fsync(output.fileno())
    finally:
        if output:
            output.close()
    result = {'bytes': size, 'sha256': h.hexdigest()}
    if target:
        assert digest(target) == result, 'Extracted member readback differs'
    return result


def verify(mode, archive_path, destination, revision):
    archive_path = Path(archive_path).resolve(strict=True)
    assert archive_path.stat().st_size <= MAX_ZIP
    destination = Path(destination).absolute()
    assert not destination.exists(), 'Fresh destination required'
    destination.mkdir(parents=True)
    archive_identity = digest(archive_path)
    with zipfile.ZipFile(archive_path) as archive:
        rows = entries(archive)
        by_name = {r.filename: r for r in rows}
        if mode == 'outer':
            assert set(by_name) == {'distribution.zip', 'fpv-worlds-playtest.zip',
                'main-build.json', 'world-build.json', 'preview-identity.json',
                'focused-tests.tap', 'README.md', 'SHA256SUMS'}
            assert by_name['SHA256SUMS'].file_size < 16384
            checksums = {}
            for line in archive.read('SHA256SUMS').decode().splitlines():
                sha, name = line.split('  ', 1)
                assert name not in checksums and len(sha) == 64
                checksums[safe_name(name)] = sha
            assert set(checksums) == set(by_name) - {'SHA256SUMS'}
            observed = {}
            for row in rows:
                target = None if row.filename == 'fpv-worlds-playtest.zip' else destination / row.filename
                observed[row.filename] = member(archive, row, target)
                if row.filename != 'SHA256SUMS':
                    assert observed[row.filename]['sha256'] == checksums[row.filename]
            identity = json.loads((destination / 'preview-identity.json').read_text())
            build = json.loads((destination / 'main-build.json').read_text())
            assert identity['sourceRevision'] == build['sourceRevision'] == revision
            assert identity['focusedTests']['result'] == 'passed'
            assert identity['focusedTests']['executed'] is True
            return {'status': 'passed', 'sourceRevision': revision,
                    'archive': archive_identity, 'members': observed, 'producer': identity}
        assert mode == 'inner'
        assert by_name['manifest.json'].file_size < 2 * 1024**2
        manifest_bytes = archive.read('manifest.json')
        manifest = json.loads(manifest_bytes)
        assert manifest['sourceRevision'] == revision
        declared = {r['path']: r for r in manifest['files']}
        assert len(declared) == len(manifest['files'])
        assert not {'manifest.json', '.xonix-build.json', 'distribution.zip'} & set(declared)
        assert set(by_name) == set(declared) | {'manifest.json'}
        total = 0
        for row in rows:
            actual = member(archive, row, destination / row.filename)
            if row.filename != 'manifest.json':
                expected = declared[row.filename]
                assert actual == {'bytes': expected['bytes'], 'sha256': expected['sha256']}
                total += actual['bytes']
        assert total == manifest['totalBytes']
        (destination / '.xonix-build.json').write_bytes(MARKER)
        return {'status': 'passed', 'sourceRevision': revision,
                'destination': str(destination.resolve()),
                'manifestSHA256': hashlib.sha256(manifest_bytes).hexdigest(),
                'verifiedMembers': len(rows), 'verifiedBytes': total + len(manifest_bytes),
                'zipSHA256': archive_identity['sha256'], 'zipBytes': archive_identity['bytes'],
                'markerReconstructed': True, 'markerExcludedFromArchive': True}


if __name__ == '__main__':
    mode, archive_path, destination, revision, report = sys.argv[1:]
    result = {'status': 'failed', 'mode': mode, 'sourceRevision': revision}
    try:
        result = verify(mode, archive_path, destination, revision)
    except Exception as error:
        result['error'] = str(error)
        raise
    finally:
        with open(report, 'x') as output:
            json.dump(result, output, indent=2)
            output.write('\n')
