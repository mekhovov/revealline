"""Digest-bound diagnostic ZIP extraction; no candidate paths or code execution."""
import argparse
import hashlib
import pathlib
import re
import stat
import zipfile


def require(value, reason):
    if not value:
        raise ValueError(reason)


def unpack(source, destination, expected, kind):
    require(re.fullmatch(r'[a-f0-9]{64}', expected), 'Invalid trusted ZIP digest')
    require(kind in ('preflight', 'pages', 'receipts'), 'Invalid artifact kind')
    require(not destination.exists() and not destination.is_symlink(), 'Output already exists')
    info = source.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1 and
            0 < info.st_size <= 1100000000, 'Invalid ZIP file')
    with source.open('rb') as stream:
        actual = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            actual.update(chunk)
        require(actual.hexdigest() == expected, 'Artifact ZIP digest differs')
        stream.seek(0)
        with zipfile.ZipFile(stream) as archive:
            members = archive.infolist()
            require(0 < len(members) <= 40010, 'Invalid ZIP member count')
            seen, files, total = set(), {}, 0
            for member in members:
                name = member.orig_filename
                require(name == member.filename and '\x00' not in name and
                        0 < len(name) <= 510 and
                        re.fullmatch(r'[A-Za-z0-9_.\-/]+', name) and
                        all(part not in ('', '.', '..') for part in name.rstrip('/').split('/')),
                        'Unsafe ZIP member')
                require(name not in seen, 'Duplicate ZIP member')
                seen.add(name)
                mode = stat.S_IFMT(member.external_attr >> 16)
                require(not member.flag_bits & 1 and member.compress_type in
                        (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'Unsupported ZIP encoding')
                if member.is_dir():
                    require(mode in (0, stat.S_IFDIR) and member.file_size == 0,
                            'Invalid ZIP directory')
                    continue
                require(mode in (0, stat.S_IFREG), 'Linked or special ZIP member')
                limit = 16 * 1024 * 1024
                if kind == 'pages':
                    require(name == 'artifact.tar', 'Unexpected pages artifact member')
                    limit = 980000000
                elif kind == 'receipts':
                    require(name in ('main-pages-inventory.json', 'main-pages-receipt.json',
                                     'main-pages-archive-receipt.json'), 'Unexpected receipt member')
                else:
                    require(name in ('preflight.json', 'selector.json') or
                            re.fullmatch(r'overlay/practice/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*', name),
                            'Unexpected preflight member')
                    if name.startswith('overlay/'):
                        limit = 950000000
                require(0 <= member.file_size <= limit, 'Oversized ZIP member')
                total += member.file_size
                require(total <= (1000000000 if kind != 'receipts' else 48 * 1024 * 1024),
                        'Oversized artifact payload')
                files[name] = member
            expected_files = {'artifact.tar'} if kind == 'pages' else (
                {'main-pages-inventory.json', 'main-pages-receipt.json', 'main-pages-archive-receipt.json'}
                if kind == 'receipts' else None)
            if expected_files is not None:
                require(set(files) == expected_files, 'Incomplete artifact members')
            else:
                require({'preflight.json', 'selector.json'} <= set(files), 'Incomplete preflight')
            for name in seen - set(files):
                require(any(file.startswith(name) for file in files), 'Unrelated ZIP directory')
            destination.mkdir()
            for name, member in files.items():
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                length = 0
                with archive.open(member) as body, target.open('xb') as output:
                    for chunk in iter(lambda: body.read(1024 * 1024), b''):
                        length += len(chunk)
                        require(length <= member.file_size, 'ZIP body exceeds declared size')
                        output.write(chunk)
                require(length == member.file_size, 'Incomplete ZIP body')
    after = source.lstat()
    require((info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns, after.st_ctime_ns),
            'ZIP changed during verification')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--zip', required=True, type=pathlib.Path)
    parser.add_argument('--out', required=True, type=pathlib.Path)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--kind', required=True)
    args = parser.parse_args()
    unpack(args.zip, args.out, args.sha256, args.kind)
