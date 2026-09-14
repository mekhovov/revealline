"""Extract one hash-pinned original ZIP; no historical game builds or unsafe ZIP extraction."""
import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import stat
import tempfile
import urllib.request
import zipfile

LIMIT = 800_000_000
MARKER = b'{\n  "tool": "xonix-game-cli",\n  "formatVersion": 1\n}\n'

def sha_file(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()

def safe_name(name):
    if not isinstance(name, str) or len(name) > 1024 or re.search(r'[\\\x00-\x1f\x7f:%?#]', name) or any(part in ['', '.', '..'] for part in name.split('/')):
        raise ValueError('Unsafe ZIP member path')
    return name

def extract_current(zip_path, target, record, manifest_bytes, checksum_bytes):
    target = pathlib.Path(target)
    if target.exists() or target.is_symlink():
        raise ValueError('Current extraction destination must not exist')
    if zip_path.stat().st_size > LIMIT or sha_file(zip_path) != record['distributionSha256']:
        raise ValueError('Original ZIP hash or byte budget mismatch')
    if hashlib.sha256(manifest_bytes).hexdigest() != record['manifestSha256']:
        raise ValueError('Manifest SHA mismatch')
    manifest = json.loads(manifest_bytes)
    if manifest['version'] != record['version'] or manifest['sourceRevision'] != record['sourceRevision']:
        raise ValueError('Manifest identity mismatch')
    if checksum_bytes != (record['distributionSha256'] + '  distribution.zip\n').encode():
        raise ValueError('Distribution checksum mismatch')
    expected = {}
    for row in manifest['files']:
        name = safe_name(row['path'])
        if name in expected or name in ['manifest.json', '.xonix-build.json', 'distribution.zip', 'distribution.zip.sha256']:
            raise ValueError('Duplicate or reserved manifest file')
        if type(row['bytes']) is not int or row['bytes'] < 0 or not re.fullmatch(r'[a-f0-9]{64}', row['sha256']):
            raise ValueError('Invalid manifest descriptor')
        expected[name] = row
    total = sum(row['bytes'] for row in expected.values())
    if total != manifest['totalBytes'] or total > LIMIT or len(expected) > 20000:
        raise ValueError('Manifest byte or member budget mismatch')
    expected['manifest.json'] = {'bytes': len(manifest_bytes), 'sha256': record['manifestSha256']}
    # All central-directory entries are validated before creating any output file.
    with zipfile.ZipFile(zip_path) as archive:
        members = archive.infolist()
        if archive.comment or len(members) != len(expected) or len({m.filename for m in members}) != len(members):
            raise ValueError('ZIP member count, duplicate or comment mismatch')
        for member in members:
            safe_name(member.filename)
            mode = member.external_attr >> 16
            if member.filename not in expected or member.is_dir() or member.flag_bits & 1 or member.compress_type not in [0, 8] or member.file_size != expected[member.filename]['bytes'] or (stat.S_IFMT(mode) not in [0, stat.S_IFREG]):
                raise ValueError('ZIP member is missing, unsafe or has a wrong size/type')
        stage = pathlib.Path(tempfile.mkdtemp(prefix='.current-unzip-', dir=target.parent))
        try:
            for member in members:
                destination = stage / member.filename
                destination.parent.mkdir(parents=True, exist_ok=True)
                actual = hashlib.sha256(); count = 0
                with archive.open(member) as source, open(destination, 'xb') as out:
                    while block := source.read(1024 * 1024):
                        count += len(block)
                        if count > expected[member.filename]['bytes']:
                            raise ValueError('Expanded ZIP member exceeded declared size')
                        actual.update(block); out.write(block)
                if count != expected[member.filename]['bytes'] or actual.hexdigest() != expected[member.filename]['sha256']:
                    raise ValueError('ZIP member hash mismatch')
            (stage / '.xonix-build.json').write_bytes(MARKER)
            (stage / 'distribution.zip.sha256').write_bytes(checksum_bytes)
            stage.rename(target)
        except BaseException:
            shutil.rmtree(stage)
            raise
    return {'distributionSha256': record['distributionSha256'], 'manifestSha256': record['manifestSha256'], 'gameSourceRevision': record['sourceRevision'], 'version': record['version'], 'membersVerified': len(expected), 'manifestFilesVerified': len(expected) - 1, 'uncompressedBytesVerified': total + len(manifest_bytes), 'crcAndHashesVerified': True}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--metadata', required=True, type=pathlib.Path)
    parser.add_argument('--output', required=True, type=pathlib.Path)
    parser.add_argument('--receipt', required=True, type=pathlib.Path)
    parser.add_argument('--zip', type=pathlib.Path)
    args = parser.parse_args()
    record = json.loads((args.metadata / 'release.json').read_bytes())
    if not re.fullmatch(r'v\d+\.\d+\.\d+', record['version']):
        raise ValueError('Invalid current release version')
    downloaded = None
    try:
        if args.zip:
            zip_path = args.zip
        else:
            # Manifest data never chooses an arbitrary host/path.
            url = f'https://github.com/mekhovov/revealline/releases/download/{record["version"]}/distribution.zip'
            handle, downloaded = tempfile.mkstemp(prefix='.current-original-', suffix='.zip', dir=args.output.parent)
            zip_path = pathlib.Path(downloaded)
            with os.fdopen(handle, 'wb') as out, urllib.request.urlopen(url, timeout=120) as response:
                count = 0
                while block := response.read(1024 * 1024):
                    count += len(block)
                    if count > LIMIT:
                        raise ValueError('Original ZIP transfer exceeded budget')
                    out.write(block)
        result = extract_current(zip_path, args.output, record, (args.metadata / 'manifest.json').read_bytes(), (args.metadata / 'distribution.zip.sha256').read_bytes())
        with open(args.receipt, 'x') as out:
            json.dump(result, out, indent=2); out.write('\n')
    finally:
        if downloaded:
            pathlib.Path(downloaded).unlink(missing_ok=True)

if __name__ == '__main__':
    main()
