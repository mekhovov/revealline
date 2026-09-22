#!/usr/bin/env python3
"""Pinned distribution.zip ZIP-member upload. Default is local verification, not upload."""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import time
import zipfile

from release_limits import MAX_DISTRIBUTION_BYTES

CHUNK = 1024 * 1024
JSON_LIMIT = 2 * 1024 * 1024
SHA = re.compile(r'[a-f0-9]{64}\Z')
COMMIT = re.compile(r'(?:[a-f0-9]{40}|[a-f0-9]{64})\Z')
REPO = re.compile(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+\Z')
TAG = re.compile(r'v[0-9]+\.[0-9]+\.[0-9]+\Z')


class Refusal(Exception):
    """Safe local or pre-upload refusal; text never includes a response/token."""


class Ambiguous(Refusal):
    """POST may have created an asset. Never retry or delete automatically."""
    def __init__(self, message, *, diagnostics=None):
        super().__init__(message)
        self.diagnostics = diagnostics


def upload_diagnostics(phase, sent, error, status=None):
    # Whitelist names, never exception text, arbitrary class names, headers or body.
    safe_types = {'Refusal', 'OSError', 'BrokenPipeError', 'ConnectionResetError',
                  'ConnectionAbortedError', 'TimeoutError', 'RemoteDisconnected',
                  'BadStatusLine', 'IncompleteRead', 'HTTPException', 'SSLError',
                  'SSLEOFError', 'SSLZeroReturnError', 'SSLSyscallError',
                  'SSLWantReadError', 'SSLWantWriteError', 'SSLCertVerificationError',
                  'ValueError', 'KeyboardInterrupt', 'SystemExit'}
    kind = type(error).__name__
    return {'phase': phase, 'sentBytes': sent,
            'sentBytesMeaning': 'Client-completed body send calls only; not server receipt. '
                                'A failed send may transmit additional bytes; null means unavailable.',
            'exceptionType': kind if kind in safe_types else 'OtherError',
            'httpStatus': status if type(status) is int and 100 <= status <= 599 else None}


def require(ok, message):
    if not ok:
        raise Refusal(message)


def file_identity(file):
    s = os.fstat(file.fileno())
    return (s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)


def open_regular(path):
    fd = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise Refusal('Expected an ordinary file')
    return os.fdopen(fd, 'rb')


def chunks(stream, size):
    total = 0
    while True:
        body = stream.read(min(CHUNK, size - total + 1))
        if not body:
            break
        total += len(body)
        require(total <= size, 'Source stream exceeded expected byte length')
        yield body
    require(total == size, 'Source stream ended before expected byte length')


def stream_digest(stream, size):
    digest = hashlib.sha256()
    for body in chunks(stream, size):
        digest.update(body)
    return digest.hexdigest()


class PinnedDistribution:
    """Keep one ZIP file descriptor; verify before sending and detect later change."""
    def __init__(self, args):
        require(SHA.fullmatch(args.outer_sha256) and SHA.fullmatch(args.member_sha256)
                and SHA.fullmatch(args.inspection_sha256), 'Invalid explicit SHA256 pin')
        require(COMMIT.fullmatch(args.source_commit), 'Invalid explicit source commit')
        require(TAG.fullmatch(args.tag), 'Expected an exact version tag')
        require(0 < args.member_bytes <= MAX_DISTRIBUTION_BYTES, 'Invalid source byte length')
        require(0 < args.outer_bytes <= 4_000_000_000, 'Invalid outer ZIP byte length')
        with open_regular(args.inspection) as receipt:
            data = receipt.read(JSON_LIMIT + 1)
        require(len(data) <= JSON_LIMIT and hashlib.sha256(data).hexdigest() == args.inspection_sha256,
                'Inspection receipt byte pin differs')
        try:
            inspection = json.loads(data)
        except (ValueError, UnicodeError):
            raise Refusal('Invalid inspection receipt JSON') from None
        require(inspection.get('format') == 'revealline-qualified-artifact-offline-inspection.v1'
                and inspection.get('status') == 'PASS'
                and inspection.get('releaseHashChainVerified') is True
                and inspection.get('gitHead') == args.source_commit
                and inspection.get('version') == args.tag, 'Inspection identity or result differs')
        outer = inspection.get('artifact', {})
        source = inspection.get('distribution', {})
        require(outer.get('sha256') == args.outer_sha256 and outer.get('bytes') == args.outer_bytes
                and outer.get('externallyExpectedDigestSupplied') is True,
                'Inspection outer ZIP authority differs')
        self.member = source.get('outerMember')
        require(isinstance(self.member, str) and isinstance(outer.get('prefix'), str)
                and self.member == outer['prefix'] + 'site/distribution.zip' and source.get('bytes') == args.member_bytes
                and source.get('sha256') == args.member_sha256 and source.get('copiedToDisk') is False,
                'Inspection source authority differs')
        self.file = open_regular(args.outer_zip)
        self.zip = None
        try:
            self.identity = file_identity(self.file)
            require(self.identity[2] == args.outer_bytes, 'Outer ZIP byte length differs')
            require(stream_digest(self.file, args.outer_bytes) == args.outer_sha256,
                    'Outer ZIP hash differs')
            self.file.seek(0)
            self.zip = zipfile.ZipFile(self.file)
            infos = self.zip.infolist()
            require(0 < len(infos) <= 100, 'Unexpected outer ZIP member count')
            names = [item.filename for item in infos]
            require(len(names) == len(set(names)), 'Duplicate ZIP member')
            for item in infos:
                name = item.filename.rstrip('/')
                mode = item.external_attr >> 16
                require(name and not name.startswith('/') and '\\' not in name
                        and all(p not in ('', '.', '..') for p in name.split('/'))
                        and str(PurePosixPath(name)) == name and not stat.S_ISLNK(mode)
                        and not item.flag_bits & 1, 'Unsafe ZIP member')
            self.info = self.zip.getinfo(self.member)
            require(not self.info.is_dir() and self.info.file_size == args.member_bytes,
                    'ZIP source member byte length differs')
            self.size, self.sha256, self.commit = args.member_bytes, args.member_sha256, args.source_commit
            with self.open() as source_stream:
                require(stream_digest(source_stream, self.size) == self.sha256,
                        'Source preflight hash differs')
            self.unchanged()
        except BaseException:
            self.close()
            raise

    def open(self):
        return self.zip.open(self.info, 'r')

    def unchanged(self):
        require(file_identity(self.file) == self.identity, 'Outer ZIP changed during operation')

    def close(self):
        if self.zip:
            self.zip.close()
        self.file.close()


class GitHub:
    """No redirects/retries; loopback injection exists only for imported local tests."""
    def __init__(self, token, *, _loopback=None, timeout=120):
        require(isinstance(token, str) and 1 <= len(token) <= 4096
                and not any(c.isspace() for c in token), 'Invalid in-memory credential')
        if _loopback is not None:
            require(_loopback[0] == '127.0.0.1' and type(_loopback[1]) is int,
                    'Synthetic transport must be loopback')
        self.token, self.loopback, self.timeout = token, _loopback, timeout
        self.deadline = time.monotonic() + 5400

    def connection(self, upload=False):
        require(time.monotonic() < self.deadline, 'Operation deadline exceeded')
        if self.loopback:
            return http.client.HTTPConnection(*self.loopback, timeout=self.timeout)
        return http.client.HTTPSConnection('uploads.github.com' if upload else 'api.github.com',
                                          timeout=self.timeout)

    def headers(self):
        return {'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                'User-Agent': 'RevealLine-pinned-source-uploader',
                'X-GitHub-Api-Version': '2022-11-28'}

    @staticmethod
    def response(response, expected):
        require(response.status == expected, 'GitHub returned HTTP ' + str(response.status))
        require(response.getheader('Content-Type', '').split(';')[0].strip() == 'application/json',
                'Expected a JSON API response')
        data = response.read(JSON_LIMIT + 1)
        require(len(data) <= JSON_LIMIT, 'API response exceeded byte limit')
        try:
            return json.loads(data)
        except (ValueError, UnicodeError):
            raise Refusal('Invalid API JSON') from None

    def get(self, path):
        connection = self.connection()
        try:
            connection.request('GET', path, headers=self.headers())
            return self.response(connection.getresponse(), 200)
        except (OSError, http.client.HTTPException):
            raise Refusal('API read failed; no upload attempted by this read') from None
        finally:
            connection.close()

    def upload(self, path, stream, size, expected_hash):
        connection = self.connection(upload=True)
        posted, sent, status = False, 0, None
        phase = 'send-headers'
        try:
            headers = self.headers()
            headers.update({'Content-Type': 'application/zip', 'Content-Length': str(size)})
            # Be conservative: even header-send failure can leave a starter asset.
            posted = True
            connection.putrequest('POST', path)
            for name, value in headers.items():
                connection.putheader(name, value)
            connection.endheaders()
            digest = hashlib.sha256()
            phase = 'read-body'
            for body in chunks(stream, size):
                phase = 'check-deadline'
                require(time.monotonic() < self.deadline, 'Upload deadline exceeded')
                digest.update(body)
                phase = 'send-body'
                connection.send(body)
                # Count only fully returned send calls, not the attempted chunk.
                sent += len(body)
                phase = 'read-body'
            phase = 'verify-stream'
            require(digest.hexdigest() == expected_hash, 'Upload stream hash differs')
            phase = 'response-headers'
            response = connection.getresponse()
            status = response.status
            phase = 'validate-response'
            result = self.response(response, 201)
            return result, sent, digest.hexdigest()
        except BaseException as error:
            if posted:
                raise Ambiguous('Upload outcome unconfirmed. Do not retry or delete automatically; '
                                'reread the exact release asset list first.',
                                diagnostics=upload_diagnostics(phase, sent, error, status)) from None
            raise
        finally:
            connection.close()


def release_assets(api, repository, release_id, tag):
    require(REPO.fullmatch(repository) and not any(p in ('.', '..') for p in repository.split('/')),
            'Invalid exact repository')
    require(type(release_id) is int and release_id > 0 and TAG.fullmatch(tag), 'Invalid release identity')
    path = f'/repos/{repository}/releases/{release_id}'
    release = api.get(path)
    require(isinstance(release, dict) and release.get('id') == release_id
            and type(release.get('id')) is int
            and release.get('url') == 'https://api.github.com' + path
            and release.get('tag_name') == tag and release.get('draft') is True
            and release.get('published_at') is None
            and release.get('assets_url') == 'https://api.github.com' + path + '/assets'
            and release.get('upload_url') == 'https://uploads.github.com' + path + '/assets{?name,label}',
            'Release is not the exact expected draft/repository/tag')
    assets = []
    for page in range(1, 21):
        rows = api.get(path + f'/assets?per_page=100&page={page}')
        require(isinstance(rows, list) and len(rows) <= 100 and all(isinstance(r, dict) for r in rows),
                'Invalid asset list')
        assets.extend(rows)
        if len(rows) < 100:
            return assets
    raise Refusal('Asset list exceeded finite pagination bound')


def validate_asset(asset, repository, size, digest):
    require(isinstance(asset, dict) and type(asset.get('id')) is int and asset['id'] > 0
            and asset.get('url') == f'https://api.github.com/repos/{repository}/releases/assets/{asset["id"]}'
            and asset.get('name') == 'distribution.zip' and asset.get('state') == 'uploaded'
            and asset.get('size') == size and asset.get('digest') == 'sha256:' + digest,
            'Uploaded asset identity/size/server digest differs or is unavailable')


def verify_tag(api, repository, tag, expected_commit):
    ref = api.get(f'/repos/{repository}/git/ref/tags/{tag}')
    require(isinstance(ref, dict) and ref.get('ref') == 'refs/tags/' + tag,
            'Exact release tag reference differs')
    obj, seen = ref.get('object'), set()
    for _ in range(6):
        require(isinstance(obj, dict) and COMMIT.fullmatch(obj.get('sha', '')),
                'Invalid release tag target')
        if obj.get('type') == 'commit':
            require(obj['sha'] == expected_commit, 'Release tag commit differs from inspected source')
            return
        require(obj.get('type') == 'tag' and obj['sha'] not in seen,
                'Invalid or cyclic annotated release tag')
        seen.add(obj['sha'])
        tagged = api.get(f'/repos/{repository}/git/tags/{obj["sha"]}')
        require(isinstance(tagged, dict) and tagged.get('sha') == obj['sha'],
                'Annotated release tag object differs')
        obj = tagged.get('object')
    raise Refusal('Annotated release tag chain exceeded bound')


def perform(source, api, repository, release_id, tag):
    assets = release_assets(api, repository, release_id, tag)
    require(not any(a.get('name') == 'distribution.zip' for a in assets),
            'distribution.zip already exists; refusing to overwrite, delete or retry')
    verify_tag(api, repository, tag, source.commit)
    source.unchanged()
    initiated, sent = False, None
    try:
        with source.open() as stream:
            initiated = True
            result, sent, digest = api.upload(f'/repos/{repository}/releases/{release_id}/assets?name=distribution.zip',
                                              stream, source.size, source.sha256)
        source.unchanged()
        validate_asset(result, repository, source.size, source.sha256)
        # Read back the exact draft asset list and tag after the single POST.
        reread = release_assets(api, repository, release_id, tag)
        matching = [a for a in reread if a.get('name') == 'distribution.zip']
        require(len(matching) == 1 and matching[0].get('id') == result['id'],
                'Uploaded asset is not uniquely bound to the same draft release')
        validate_asset(matching[0], repository, source.size, source.sha256)
        verify_tag(api, repository, tag, source.commit)
    except Ambiguous:
        raise
    except BaseException as error:
        if initiated:
            raise Ambiguous('Post-upload verification unconfirmed. Do not retry or delete automatically; '
                            'reread the exact release asset list first.',
                            diagnostics=upload_diagnostics('verify-upload', sent, error)) from None
        raise
    return {'status': 'UPLOADED_VERIFIED', 'repository': repository, 'releaseId': release_id,
            'tag': tag, 'tagCommit': source.commit, 'assetId': result['id'], 'assetName': 'distribution.zip',
            'bytes': sent, 'sha256': digest, 'serverDigest': result['digest'], 'postCount': 1,
            'readBackVerified': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('outer-zip', 'inspection', 'outer-sha256', 'member-sha256', 'inspection-sha256',
                 'source-commit', 'tag', 'repository', 'receipt'):
        parser.add_argument('--' + name, required=True)
    for name in ('outer-bytes', 'member-bytes', 'release-id'):
        parser.add_argument('--' + name, required=True, type=int)
    parser.add_argument('--upload', action='store_true', help='Perform exactly one authenticated POST')
    parser.add_argument('--token-stdin', action='store_true', help='Read credential from stdin; otherwise use gh auth token')
    args = parser.parse_args()
    result = {'status': 'REFUSED', 'uploadRequested': args.upload, 'repository': args.repository,
              'releaseId': args.release_id, 'tag': args.tag, 'sourceCommit': args.source_commit,
              'memberBytes': args.member_bytes, 'memberSha256': args.member_sha256,
              'outerSha256': args.outer_sha256, 'inspectionSha256': args.inspection_sha256,
              'automaticRetry': False}
    source = None
    # Exclusive receipt reservation prevents accidental overwriting of an earlier ambiguous outcome.
    with open(args.receipt, 'x', encoding='utf-8') as receipt:
        try:
            source = PinnedDistribution(args)
            require(REPO.fullmatch(args.repository) and args.release_id > 0, 'Invalid release target')
            if not args.upload:
                result.update(status='LOCAL_VERIFIED_NO_NETWORK', bytes=source.size,
                              sha256=source.sha256, outerSha256=args.outer_sha256)
            else:
                if args.token_stdin:
                    token = sys.stdin.read(4097).strip()
                else:
                    auth = subprocess.run(['gh', 'auth', 'token', '--hostname', 'github.com'],
                                          capture_output=True, text=True, timeout=30, check=False)
                    require(auth.returncode == 0, 'Unable to obtain in-memory GitHub credential')
                    token = auth.stdout.strip()
                api = GitHub(token)
                try:
                    # A hard interruption still leaves a durable no-auto-retry warning.
                    pending = {**result, 'status': 'IN_PROGRESS_REREAD_ASSETS_IF_INTERRUPTED',
                               'requiresAssetReread': True}
                    json.dump(pending, receipt, indent=2)
                    receipt.write('\n')
                    receipt.flush()
                    os.fsync(receipt.fileno())
                    result.update(perform(source, api, args.repository, args.release_id, args.tag))
                finally:
                    api.token = ''
                    token = None
        except Ambiguous as error:
            result.update(status='UNCONFIRMED_REREAD_ASSETS', message=str(error), requiresAssetReread=True)
            if error.diagnostics is not None:
                result['uploadDiagnostics'] = error.diagnostics
        except Refusal as error:
            result.update(message=str(error))
        except BaseException:
            result.update(message='Local verification or credential preparation failed; raw details suppressed')
        finally:
            if source:
                source.close()
            receipt.seek(0)
            receipt.truncate()
            json.dump(result, receipt, indent=2)
            receipt.write('\n')
            receipt.flush()
            os.fsync(receipt.fileno())
    print(json.dumps(result))
    return 0 if result['status'] in ('LOCAL_VERIFIED_NO_NETWORK', 'UPLOADED_VERIFIED') else 1


if __name__ == '__main__':
    sys.exit(main())
