#!/usr/bin/env python3
"""Check frozen offline metadata after the complete original artifact inspection.

Reads four bounded original ZIP members. Does not rebuild, extract large payloads,
repeat the whole artifact hash, or claim browser/offline execution.
"""
from pathlib import Path
from html.parser import HTMLParser
import argparse, datetime, hashlib, json, re, shutil, subprocess, zipfile

ROOT = BASE = SOURCE = TREE = VERSION = None
seen = {}

def require(ok, why):
    if not ok:
        raise ValueError(why)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def read(path, digest=None):
    require(path.is_file() and not path.is_symlink(), 'Nonordinary metadata: ' + str(path))
    data = path.read_bytes()
    require(digest is None or sha(data) == digest, 'Metadata pin changed: ' + str(path))
    require(path not in seen or seen[path] == sha(data), 'Metadata changed during review')
    seen[path] = sha(data)
    return data

def pin(path):
    data = read(path)
    return {'path': str(path.resolve()), 'bytes': len(data), 'sha256': sha(data)}

def strict_json(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'Duplicate JSON key')
            result[key] = value
        return result
    return json.loads(data.decode('utf-8'), object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Invalid JSON number')))

class Markers(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta' and attrs.get('name') == 'revealline-offline':
            self.values.append(strict_json(attrs['content'].encode()))

def main():
    global ROOT, BASE, SOURCE, TREE, VERSION
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--inspection-sha256', required=True)
    parser.add_argument('--download-sha256', required=True)
    parser.add_argument('--manifest-sha256', required=True)
    parser.add_argument('--repo', required=True, type=Path)
    parser.add_argument('--base', required=True, type=Path)
    parser.add_argument('--source', required=True)
    parser.add_argument('--tree', required=True)
    parser.add_argument('--version', required=True)
    args = parser.parse_args()
    ROOT, BASE, SOURCE, TREE, VERSION = args.repo.resolve(), args.base.resolve(), args.source, args.tree, args.version
    require(re.fullmatch('[0-9a-f]{40}', SOURCE) and re.fullmatch('[0-9a-f]{40}', TREE) and re.fullmatch(r'v[0-9]+\.[0-9]+\.[0-9]+', VERSION), 'Exact source/tree/version required')
    for value in [args.inspection_sha256, args.download_sha256, args.manifest_sha256]:
        require(re.fullmatch('[0-9a-f]{64}', value) is not None, 'Explicit actual input pins required')
    inspection_path = BASE / 'qualified-artifact-verified/inspection.json'
    download_path = BASE / 'qualified-artifact-original.download.json'
    manifest_path = BASE / 'qualified-artifact-verified/manifest.json'
    inspection = strict_json(read(inspection_path, args.inspection_sha256))
    download = strict_json(read(download_path, args.download_sha256))
    manifest_bytes = read(manifest_path, args.manifest_sha256)
    manifest = strict_json(manifest_bytes)
    require(inspection['status'] == 'PASS' and inspection['gitHead'] == SOURCE and
            inspection['gitTree'] == TREE and inspection['version'] == VERSION and
            inspection['releaseHashChainVerified'] is True and
            inspection['distribution']['allManifestBytesVerified'] is True and
            inspection['distribution']['innerManifestIdentical'] is True and
            inspection['artifact']['externallyExpectedDigestSupplied'] is True,
            'Complete actual frozen original inspection required')
    require(download['status'] == 'ORIGINAL_RECEIVED_VERIFIED' and download['exitCode'] == 0 and
            download['sourceRevision'] == SOURCE and download['sha256'] == inspection['artifact']['sha256'] and
            download['bytes'] == inspection['artifact']['bytes'], 'Authenticated download differs')
    artifact = BASE / 'qualified-artifact-original.zip'
    require(artifact.is_file() and not artifact.is_symlink() and
            Path(download['output']).resolve() == artifact.resolve(), 'Wrong original artifact')
    require(manifest['version'] == VERSION and manifest['sourceRevision'] == SOURCE and
            sha(manifest_bytes) == inspection['manifestSha256'], 'Frozen manifest identity differs')
    require(subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip() == SOURCE and
            subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], cwd=ROOT, text=True).strip() == TREE,
            'Selected Git source changed')
    rows = {r['path']: r for r in manifest['files']}
    require(len(rows) == len(manifest['files']) == inspection['distribution']['files'], 'Frozen file inventory differs')
    names = ['offline-cache.json', 'game/build-info.json', 'service-worker.js', manifest['entry']]
    require(len(set(names)) == 4 and all(n in rows and 0 < rows[n]['bytes'] <= 2 * 1024**2 for n in names),
            'Bounded offline original roles missing')
    out = BASE / 'frozen-offline-review'
    require(not out.exists(), 'Preserve prior review; output already exists')
    require(shutil.disk_usage(BASE).free >= 512 * 1024**2 + sum(rows[n]['bytes'] for n in names) + 1024**2,
            'Reserve plus bounded original output required')
    stat_before = artifact.stat()
    require(stat_before.st_size == inspection['artifact']['bytes'], 'Original artifact length changed')
    bodies = {}
    with zipfile.ZipFile(artifact) as outer:
        member = inspection['distribution']['outerMember']
        require(member == VERSION + '/site/distribution.zip' and
                outer.getinfo(member).file_size == inspection['distribution']['bytes'], 'Frozen ZIP member changed')
        with outer.open(member) as stream, zipfile.ZipFile(stream) as inner:
            for name in names:
                info = inner.getinfo(name)
                require(info.file_size == rows[name]['bytes'], 'Original member length differs')
                with inner.open(info) as original:
                    body = original.read(2 * 1024**2 + 1)
                    require(len(body) == info.file_size and original.read(1) == b'' and
                            sha(body) == rows[name]['sha256'], 'Original member byte/CRC/hash mismatch')
                bodies[name] = body
    offline = strict_json(bodies['offline-cache.json'])
    require(offline.get('format') == 'revealline-offline.v1' and offline.get('version') == VERSION and
            re.fullmatch('[0-9a-f]{64}', offline.get('buildId', '')) is not None, 'Offline build identity differs')
    files = offline.get('files')
    require(isinstance(files, list) and 0 < len(files) <= 2000 and
            len({r['path'] for r in files}) == len(files), 'Offline count/unique paths invalid')
    for row in files:
        require(rows.get(row['path']) == row, 'Offline dependency differs from fully verified frozen manifest')
    total = sum(row['bytes'] for row in files)
    require(total <= 64 * 1024**2 and manifest['entry'] in {r['path'] for r in files},
            'Offline byte budget or entry missing')
    template = subprocess.check_output(['git', 'show', SOURCE + ':game/offline/service-worker.template.js'], cwd=ROOT)
    require(template.count(b'__XONIX_OFFLINE_CONFIG__') == 1, 'Unexpected source worker template')
    worker = template.replace(b'__XONIX_OFFLINE_CONFIG__',
                              json.dumps(offline, ensure_ascii=False, separators=(',', ':')).encode())
    require(bodies['service-worker.js'] == worker, 'Worker does not bind exact original offline inventory')
    markers = Markers(); markers.feed(bodies[manifest['entry']].decode())
    require(len(markers.values) == 1 and
            all(markers.values[0].get(k) == offline[k] for k in ['format', 'version', 'buildId']),
            'Entry and worker build identity differ')
    build = strict_json(bodies['game/build-info.json'])
    require(build['version'] == VERSION and build['sourceRevision'] == SOURCE, 'Frozen build source differs')
    stat_after = artifact.stat()
    fields = ['st_dev', 'st_ino', 'st_size', 'st_mtime_ns', 'st_ctime_ns']
    require(all(getattr(stat_before, f) == getattr(stat_after, f) for f in fields), 'Original changed during review')
    for path, digest in list(seen.items()):
        require(sha(path.read_bytes()) == digest, 'Input metadata changed during review')
    out.mkdir()
    originals = []
    for name, data in bodies.items():
        target = out / 'originals' / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.open('xb').write(data)
        originals.append({'archivePath': name, **pin(target)})
    result = {'format': 'revealline-frozen-offline-review.v1', 'status': 'PASS',
              'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'sourceRevision': SOURCE, 'sourceTree': TREE, 'version': VERSION,
              'inspectionPin': pin(inspection_path), 'manifestPin': pin(manifest_path),
              'downloadPin': pin(download_path), 'verifierPin': pin(Path(__file__).resolve()),
              'originals': originals, 'sourceWorkerTemplateSha256': sha(template),
              'frozenBuildInfo': build,
              'offline': {'buildId': offline['buildId'], 'files': len(files), 'bytes': total,
                          'maxFiles': 2000, 'maxBytes': 64 * 1024**2,
                          'optionalPacks': len(offline.get('optionalPacks', [])),
                          'allOfflineRowsMatchFrozenManifest': True, 'allOfflineBytesVerified': True,
                          'offlineBudgetVerified': True, 'workerInventoryBindingVerified': True,
                          'entryMetaBindingVerified': True, 'entryIncluded': True},
              'limits': ['Frozen byte/dependency/identity review only. No browser offline execution or P01 acceptance.',
                         'Whole original artifact bytes were verified by the prerequisite inspector; this check rereads four bounded originals.',
                         'No local ordinary build or repeated whole artifact hash is claimed.']}
    target = out / 'review.json'; target.open('x').write(json.dumps(result, indent=2) + '\n')
    print(json.dumps(pin(target)), flush=True)

if __name__ == '__main__':
    main()
