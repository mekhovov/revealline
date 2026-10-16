"""Bounded, independent ZIP readback for the temporary hosted Solo cohort.

ZIP modes have no network, deletion, symlinks, overwrite or general extraction API.
Profile modes preserve only a proven closed job-owned profile; retirement is a
separate exact-identity operation after full archive readback and source rehash.
The caller owns timeout/process limits and retains this receipt on failure.
"""
import hashlib
import json
import os
import re
from pathlib import Path, PurePosixPath
import stat
import sys
import tarfile
import shutil
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


def verify_baseline_outer(archive_path, destination, revision):
    assert revision == 'b11745223861c3973ad4bf440cc536198b8e0371'
    archive_path = Path(archive_path).resolve(strict=True)
    assert archive_path.stat().st_size <= MAX_ZIP
    destination = Path(destination).absolute()
    assert not destination.exists(), 'Fresh baseline destination required'
    destination.mkdir(parents=True)
    names = {'distribution.zip', 'manifest.json', *[
        'normal-baseline-proof/' + name for name in
        ['source-proof.json', 'archive-proof.json', 'command-receipts.json',
         'environment.json', 'ready.json', 'SHA256SUMS']]}
    with zipfile.ZipFile(archive_path) as archive:
        rows = entries(archive)
        assert {row.filename for row in rows} == names, 'Unexpected baseline bundle members'
        for row in rows:
            assert row.file_size <= (MAX_ZIP if row.filename == 'distribution.zip' else 2 * 1024**2)
        observed = {row.filename: member(archive, row, destination / row.filename) for row in rows}
    lines = (destination / 'normal-baseline-proof/SHA256SUMS').read_text().splitlines()
    assert len(lines) == len(names) - 1
    checksums = {}
    for line in lines:
        sha, name = line.split('  ', 1)
        assert re.fullmatch('[a-f0-9]{64}', sha) and name not in checksums
        checksums[safe_name(name)] = sha
    assert set(checksums) == names - {'normal-baseline-proof/SHA256SUMS'}
    assert all(observed[name]['sha256'] == sha for name, sha in checksums.items())
    ready = json.loads((destination / 'normal-baseline-proof/ready.json').read_text())
    assert ready['format'] == 'SoloHostedNormalBaselineReadyV1' and ready['status'] == 'ready'
    assert ready['sourceRevision'] == revision and ready['profile'] == 'normal'
    return {'status': 'passed', 'sourceRevision': revision,
            'archive': digest(archive_path), 'members': observed,
            'scope': 'Exact outer member readback only; ready provenance, inner and source admission still required'}


def exact_json(ref, maximum=4 * 1024**2):
    path = Path(ref['path'])
    assert path.is_file() and not path.is_symlink()
    assert path.stat().st_size <= maximum
    assert digest(path) == {'bytes': ref['bytes'], 'sha256': ref['sha256']}
    return json.loads(path.read_text())


def plain_path(value, missing=False):
    path = Path(value)
    assert path.is_absolute() and '..' not in path.parts
    for part in [*reversed(path.parents), path]:
        try:
            info = part.lstat()
        except FileNotFoundError:
            assert missing
            break
        assert not stat.S_ISLNK(info.st_mode), f'Path alias: {part}'
    return path


def profile_inventory(profile, limits):
    profile = plain_path(profile)
    root = profile.lstat()
    assert stat.S_ISDIR(root.st_mode)
    rows, total = [], 0

    def walk(directory):
        nonlocal total
        for path in sorted(directory.iterdir()):
            info = path.lstat()
            relative = path.relative_to(profile).as_posix()
            safe_name(relative)
            assert len(relative.encode()) <= 4096
            assert len(rows) < limits['maximumMembers'], 'Profile member cap'
            row = {'path': relative, 'mode': stat.S_IMODE(info.st_mode),
                   'device': info.st_dev, 'inode': info.st_ino,
                   'mtimeNs': info.st_mtime_ns}
            if stat.S_ISLNK(info.st_mode):
                row.update(kind='symlink', link=os.readlink(path))
                assert len(row['link'].encode()) <= 4096
            elif stat.S_ISDIR(info.st_mode):
                row['kind'] = 'directory'
            elif stat.S_ISREG(info.st_mode):
                assert info.st_nlink == 1, 'Hard-linked profile file'
                total += info.st_size
                assert total <= limits['maximumSourceBytes'], 'Profile source-byte cap'
                flags = os.O_RDONLY | os.O_NOFOLLOW
                fd = os.open(path, flags)
                try:
                    opened = os.fstat(fd)
                    assert (opened.st_dev, opened.st_ino, opened.st_size, opened.st_mtime_ns) == (info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns)
                    h, length = hashlib.sha256(), 0
                    with os.fdopen(fd, 'rb', closefd=False) as stream:
                        for data in iter(lambda: stream.read(1024 * 1024), b''):
                            length += len(data)
                            assert length <= info.st_size
                            h.update(data)
                    after = os.fstat(fd)
                    assert (after.st_size, after.st_mtime_ns) == (info.st_size, info.st_mtime_ns)
                    assert length == info.st_size
                    row.update(kind='file', bytes=length, sha256=h.hexdigest())
                finally:
                    os.close(fd)
            else:
                raise AssertionError(f'Unsupported profile type: {relative}')
            rows.append(row)
            if row['kind'] == 'directory':
                walk(path)
    walk(profile)
    return {'root': {'device': root.st_dev, 'inode': root.st_ino,
                     'mode': stat.S_IMODE(root.st_mode)}, 'files': rows, 'sourceBytes': total}


def verify_profile_tar(archive, inventory, limits):
    assert archive.stat().st_size <= limits['maximumArchiveBytes']
    expected = {row['path']: row for row in inventory['files']}
    assert len(expected) == len(inventory['files']) <= limits['maximumMembers']
    seen = set()
    with tarfile.open(archive, 'r:') as stored:
        for member_info in stored:
            name = safe_name(member_info.name)
            assert name not in seen and name in expected, 'Unexpected or duplicate profile member'
            seen.add(name)
            row = expected[name]
            assert member_info.mode == row['mode'], 'Profile member mode changed'
            if row['kind'] == 'directory':
                assert member_info.isdir() and member_info.size == 0
            elif row['kind'] == 'symlink':
                assert member_info.issym() and member_info.linkname == row['link'] and member_info.size == 0
            else:
                assert member_info.isfile() and not member_info.islnk() and member_info.size == row['bytes']
                h, size = hashlib.sha256(), 0
                with stored.extractfile(member_info) as stream:
                    for data in iter(lambda: stream.read(1024 * 1024), b''):
                        size += len(data)
                        assert size <= row['bytes']
                        h.update(data)
                assert size == row['bytes'] and h.hexdigest() == row['sha256'], 'Profile member hash changed'
    assert seen == set(expected), 'Profile member set changed'


def profile_admission(plan):
    assert sys.platform == 'linux', 'Hosted Linux only'
    assert plan['format'] == 'SoloHostedClosedProfilePlanV1'
    limits = plan['limits']
    assert limits == {'maximumSourceBytes': 512 * 1024**2,
                      'maximumArchiveBytes': 512 * 1024**2, 'maximumMembers': 20000,
                      'minimumFreeBytes': 1024**3 + 4 * 1024**2}
    run = plain_path(plan['runRoot'])
    temp = plain_path(os.environ['RUNNER_TEMP'])
    assert run.is_relative_to(temp) and run != temp
    scratch = plain_path(plan['scratchRoot'])
    assert scratch.is_relative_to(temp) and scratch != temp
    profile = plain_path(plan['profile']['path'])
    assert profile.parent == scratch and profile.name.startswith('solo-offline-pair-')
    identity = profile.lstat()
    assert stat.S_ISDIR(identity.st_mode)
    assert (identity.st_dev, identity.st_ino) == (plan['profile']['device'], plan['profile']['inode'])
    destination = plain_path(plan['destination'], True)
    assert destination.is_relative_to(run / 'profile-evidence') and destination != run / 'profile-evidence'
    command = exact_json(plan['command'])
    assert command['status'] == 'closed' and command['completedAt']
    assert not any(command.get(key) for key in ['violation', 'forcedCleanup', 'cleanupUnconfirmed', 'survivors', 'ambiguous'])
    assert command['argv'] == plan['expectedArgv']
    raw = exact_json(plan['rawReport'], 2 * 1024**2)
    assert raw['plan'] == {'path': plan['casePlan']['path'], 'sha256': plan['casePlan']['sha256']}
    case = exact_json(plan['casePlan'])
    assert case['commonOwner']['scratchAuthority'] == plan['scratchAuthority']
    authority = exact_json(plan['scratchAuthority'])
    assert authority['format'] == 'SoloHostedRowScratchV1' and authority['runRoot'] == str(run)
    storage = authority['storage']
    assert storage['scratchRoot'] == str(scratch)
    assert Path(storage['outputRoot']) == Path(plan['casePlan']['path']).parent
    owner = storage['scratchOwner']
    owned_root = plain_path(owner['path'])
    assert owned_root.parent == temp and re.fullmatch(r'sc-[a-zA-Z0-9]{6}', owned_root.name)
    assert scratch.parent == owned_root and re.fullmatch(r'r[0-9]{2}', scratch.name)
    assert owner['maximumRowPathBytes'] == 52 and len(str(scratch).encode()) <= 52
    for target, expected in [(owned_root, owner), (scratch, storage)]:
        current = target.lstat()
        assert stat.S_ISDIR(current.st_mode)
        assert (current.st_dev, current.st_ino) == (expected['device'], expected['inode'])
    assert command['argv'][-3:] == [case['commonOwner']['offlineDriverPath'], plan['casePlan']['path'], str(Path(plan['rawReport']['path']).parent)]
    assert raw['observationSettled'] is True and raw['profileRetained'] == str(profile)
    assert raw['profileIdentity'] == {'dev': identity.st_dev, 'ino': identity.st_ino}
    assert not any(raw.get(key) for key in ['cleanupFailure', 'cdpCleanupFailure', 'serverCleanupFailure', 'launchDrainFailure', 'observationDrainFailure'])
    # Read-only exact-profile check; no process signalling or PID-only ownership inference.
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().split(b'\0')
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
        target = str(profile).encode()
        assert b'--user-data-dir=' + target not in args, 'Profile is still referenced by a browser'
        for i, arg in enumerate(args[:-1]):
            assert not (arg == b'--user-data-dir' and args[i + 1] == target), 'Profile is still referenced by a browser'
    return profile, destination


class LimitedArchive:
    def __init__(self, file, limit):
        self.file, self.limit = file, limit
    def write(self, data):
        assert self.file.tell() + len(data) <= self.limit, 'Profile archive-byte cap'
        return self.file.write(data)
    def tell(self):
        return self.file.tell()
    def flush(self):
        return self.file.flush()


def preserve_profile(plan):
    profile, destination = profile_admission(plan)
    limits = plan['limits']
    space = shutil.disk_usage(profile)
    assert space.free >= limits['minimumFreeBytes'] + limits['maximumArchiveBytes'], 'Profile preservation peak reserve'
    inventory = profile_inventory(profile, limits)
    assert not destination.exists()
    destination.mkdir(parents=True)
    archive = destination / 'profile.tar'
    with archive.open('xb') as file:
        bounded = LimitedArchive(file, limits['maximumArchiveBytes'])
        with tarfile.open(fileobj=bounded, mode='w:', format=tarfile.PAX_FORMAT) as tar:
            for row in inventory['files']:
                source = profile / row['path']
                info = tarfile.TarInfo(row['path'])
                info.mode = row['mode']
                info.mtime = row['mtimeNs'] // 1000000000
                if row['kind'] == 'directory':
                    info.type = tarfile.DIRTYPE
                    tar.addfile(info)
                elif row['kind'] == 'symlink':
                    info.type, info.linkname = tarfile.SYMTYPE, row['link']
                    tar.addfile(info)
                else:
                    info.size = row['bytes']
                    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW)
                    try:
                        current = os.fstat(fd)
                        assert (current.st_dev, current.st_ino, current.st_size, current.st_mtime_ns) == (row['device'], row['inode'], row['bytes'], row['mtimeNs'])
                        with os.fdopen(fd, 'rb', closefd=False) as stream:
                            tar.addfile(info, stream)
                    finally:
                        os.close(fd)
        file.flush()
        os.fsync(file.fileno())
    verify_profile_tar(archive, inventory, limits)
    assert profile_inventory(profile, limits) == inventory, 'Profile changed during preservation'
    profile_admission(plan)
    assert shutil.disk_usage(profile).free >= limits['minimumFreeBytes']
    inventory_path = destination / 'inventory.json'
    with inventory_path.open('x') as out:
        json.dump(inventory, out, indent=2)
        out.write('\n')
        out.flush()
        os.fsync(out.fileno())
    assert json.loads(inventory_path.read_text()) == inventory
    return {'format': 'SoloHostedClosedProfilePreservationV1', 'status': 'passed',
            'profile': plan['profile'], 'command': plan['command'], 'rawReport': plan['rawReport'],
            'casePlan': plan['casePlan'], 'destination': str(destination),
            'archive': {'path': str(archive), **digest(archive)},
            'inventory': {'path': str(inventory_path), **digest(inventory_path)},
            'members': len(inventory['files']), 'sourceBytes': inventory['sourceBytes'],
            'sourceUnchanged': True, 'retired': False, 'freeBytes': shutil.disk_usage(profile).free}


def retire_profile(plan):
    assert plan['format'] == 'SoloHostedClosedProfileRetirementV1'
    original = exact_json(plan['profilePlan'])
    preservation = exact_json(plan['preservation'])
    assert preservation['format'] == 'SoloHostedClosedProfilePreservationV1' and preservation['status'] == 'passed'
    profile, destination = profile_admission(original)
    assert preservation['profile'] == original['profile']
    assert preservation['destination'] == str(destination)
    for name in ['command', 'rawReport', 'casePlan']:
        assert preservation[name] == original[name]
    archive = plain_path(preservation['archive']['path'])
    assert archive == destination / 'profile.tar'
    assert digest(archive) == {key: preservation['archive'][key] for key in ['bytes', 'sha256']}
    inventory = exact_json(preservation['inventory'], 16 * 1024**2)
    assert Path(preservation['inventory']['path']) == destination / 'inventory.json'
    verify_profile_tar(archive, inventory, original['limits'])
    assert profile_inventory(profile, original['limits']) == inventory, 'Profile changed before retirement'
    profile_admission(original)
    assert shutil.rmtree.avoids_symlink_attacks, 'Require descriptor-based recursive deletion'
    shutil.rmtree(profile)
    assert not profile.exists() and not profile.is_symlink()
    return {'format': 'SoloHostedClosedProfileRetirementV1', 'status': 'passed',
            'profile': original['profile'], 'preservation': plan['preservation'],
            'removed': True, 'archiveRetained': preservation['archive'],
            'freeBytes': shutil.disk_usage(destination).free}


if __name__ == '__main__':
    mode = sys.argv[1]
    result = {'status': 'failed', 'mode': mode}
    report = sys.argv[-1]
    try:
        if mode in ('profile', 'profile-retire'):
            assert len(sys.argv) == 4
            plan_path = plain_path(sys.argv[2])
            assert plan_path.stat().st_size <= 4 * 1024**2
            plan = json.loads(plan_path.read_text())
            result = preserve_profile(plan) if mode == 'profile' else retire_profile(plan)
        else:
            mode, archive_path, destination, revision, report = sys.argv[1:]
            result['sourceRevision'] = revision
            result = verify_baseline_outer(archive_path, destination, revision) if mode == 'baseline-outer' else verify(mode, archive_path, destination, revision)
    except Exception as error:
        result['error'] = str(error)
        raise
    finally:
        with open(report, 'x') as output:
            json.dump(result, output, indent=2)
            output.write('\n')
