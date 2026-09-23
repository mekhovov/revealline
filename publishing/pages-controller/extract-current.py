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
import urllib.error
import urllib.parse
import urllib.request
import zipfile

LIMIT = 800_000_000
MARKER = b'{\n  "tool": "xonix-game-cli",\n  "formatVersion": 1\n}\n'
API_ROOT = 'https://api.github.com/repos/mekhovov/revealline'
API_VERSION = '2022-11-28'
USER_AGENT = 'RevealLine-Pages-Publisher/1'

def api_headers(accept):
    token = os.environ.get('GH_TOKEN')
    if not token:
        raise ValueError('GH_TOKEN is required to read private release assets')
    return {'Accept': accept, 'Authorization': f'Bearer {token}', 'X-GitHub-Api-Version': API_VERSION, 'User-Agent': USER_AGENT}

def select_release_asset(release, version, name, expected_sha256):
    matches = [asset for asset in release.get('assets', []) if asset.get('name') == name]
    if release.get('draft') or release.get('prerelease') or release.get('tag_name') != version or len(matches) != 1:
        raise ValueError('Selected release or asset identity mismatch')
    asset = matches[0]
    if asset.get('state') != 'uploaded' or type(asset.get('size')) is not int or not 0 <= asset['size'] <= LIMIT or asset.get('digest') != f'sha256:{expected_sha256}' or not re.fullmatch(r'https://api\.github\.com/repos/mekhovov/revealline/releases/assets/\d+', asset.get('url', '')):
        raise ValueError('Selected release asset descriptor mismatch')
    return asset

def release_asset(version, name, expected_sha256):
    url = f'{API_ROOT}/releases/tags/{urllib.parse.quote(version, safe="")}'
    request = urllib.request.Request(url, headers=api_headers('application/vnd.github+json'))
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read(2_000_001)
    if len(raw) > 2_000_000:
        raise ValueError('Release metadata exceeds its byte budget')
    return select_release_asset(json.loads(raw), version, name, expected_sha256)

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, file_pointer, code, message, headers, new_url):
        return None

def download_release_asset(asset, destination):
    request = urllib.request.Request(asset['url'], headers=api_headers('application/octet-stream'))
    opener = urllib.request.build_opener(NoRedirect())
    try:
        response = opener.open(request, timeout=120)
    except urllib.error.HTTPError as error:
        if error.code not in [301, 302, 303, 307, 308]:
            raise
        location = error.headers.get('Location', '')
        parsed = urllib.parse.urlparse(location)
        if parsed.scheme != 'https' or parsed.hostname != 'release-assets.githubusercontent.com':
            raise ValueError('Release asset redirect left the approved host') from error
        response = urllib.request.urlopen(urllib.request.Request(location, headers={'User-Agent': USER_AGENT}), timeout=120)
    with response, os.fdopen(destination, 'wb') as out:
        count = 0
        while block := response.read(1024 * 1024):
            count += len(block)
            if count > LIMIT or count > asset['size']:
                raise ValueError('Original ZIP transfer exceeded budget')
            out.write(block)
    if count != asset['size']:
        raise ValueError('Original ZIP transfer size mismatch')

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
            # Authenticated API metadata chooses the exact immutable-by-policy asset.
            asset = release_asset(record['version'], 'distribution.zip', record['distributionSha256'])
            handle, downloaded = tempfile.mkstemp(prefix='.current-original-', suffix='.zip', dir=args.output.parent)
            zip_path = pathlib.Path(downloaded)
            download_release_asset(asset, handle)
        result = extract_current(zip_path, args.output, record, (args.metadata / 'manifest.json').read_bytes(), (args.metadata / 'distribution.zip.sha256').read_bytes())
        with open(args.receipt, 'x') as out:
            json.dump(result, out, indent=2); out.write('\n')
    finally:
        if downloaded:
            pathlib.Path(downloaded).unlink(missing_ok=True)

if __name__ == '__main__':
    main()
