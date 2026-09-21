"""Explicit, resumable intake of reviewed source URLs. Never publishes audio.

Keep exact MP3/OGG originals. ZIPs are temporary download containers; retain their
hash and selected MP3 member identity, without extracting the redundant WAV.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from urllib.parse import urlparse
import zipfile

MIB = 1024 ** 2
ROOT = Path(__file__).resolve().parents[4]
LIBRARY = ROOT / 'authoring/library/licensed-audio'
OUTPUT = LIBRARY / 'originals/expansion-20260921'
RECEIPT = LIBRARY / 'provenance/expansion-downloads.json'


def digest(body):
    return hashlib.sha256(body).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--retained-limit-mib', type=int, default=200)
    args = parser.parse_args()
    assert 1 <= args.retained_limit_mib <= 300
    manifest = json.loads(args.manifest.read_text())
    assert manifest['format'] == 'revealline-licensed-music-research.v1'
    receipt = json.loads(RECEIPT.read_text()) if RECEIPT.exists() else {
        'format': 'revealline-licensed-intake.v1', 'tracks': [],
        'meaning': 'Exact download/member identity only; not listening or publication approval.',
    }
    OUTPUT.mkdir(parents=True, exist_ok=True)
    scratch = ROOT / '.cache/licensed-intake'
    scratch.mkdir(parents=True, exist_ok=True)
    for track in manifest['tracks']:
        identifier = track['id']
        assert re.fullmatch(r'[a-z0-9][a-z0-9._-]{1,119}', identifier)
        source = track['sourceAsset']
        parsed = urlparse(source['url'])
        assert parsed.scheme == 'https' and parsed.hostname == 'opengameart.org'
        assert parsed.path.startswith('/sites/default/files/')
        assert track['license'] in ('CC0', 'CC0-1.0', 'CC-BY-3.0', 'CC-BY-4.0')
        old = next((row for row in receipt['tracks'] if row['id'] == identifier), None)
        if old:
            body = (LIBRARY / old['original']['path']).read_bytes()
            assert len(body) == old['original']['bytes'] and digest(body) == old['original']['sha256']
            assert old['sourceURL'] == source['url']
            print(identifier, 'verified existing', flush=True)
            continue
        assert 0 < source['bytes'] <= 64 * MIB
        assert shutil.disk_usage(ROOT).free >= 1024 ** 3 + 96 * MIB
        with tempfile.TemporaryDirectory(prefix='download-', dir=scratch) as temporary:
            container = Path(temporary) / 'source'
            # macOS curl uses the configured system trust store. Do not disable
            # certificate validation to work around a Python CA-store mismatch.
            fetched = subprocess.run([
                '/usr/bin/curl', '--proto', '=https', '--proto-redir', '=https',
                '--fail', '--silent', '--show-error', '--location',
                '--max-time', '120', '--max-filesize', str(source['bytes']),
                '--output', str(container), '--write-out', '%{url_effective}', source['url'],
            ], check=True, capture_output=True, text=True)
            final = urlparse(fetched.stdout)
            assert final.scheme == 'https' and final.hostname == 'opengameart.org'
            count = container.stat().st_size
            assert count == source['bytes'], (identifier, count, source['bytes'])
            raw = container.read_bytes()
            container_hash = digest(raw)
            member = None
            if source['mimeType'] == 'application/zip':
                with zipfile.ZipFile(container) as archive:
                    choices = [item for item in archive.infolist()
                               if not item.is_dir() and item.filename.lower().endswith('.mp3')
                               and not item.filename.startswith('__MACOSX/')]
                    assert len(choices) == 1, (identifier, [item.filename for item in choices])
                    item = choices[0]
                    assert 0 < item.file_size <= 32 * MIB
                    body = archive.read(item)
                    filename = Path(item.filename).name
                    member = {'name': item.filename, 'crc32': f'{item.CRC:08x}', 'bytes': item.file_size}
            else:
                body = raw
                filename = source['fileName']
            assert Path(filename).name == filename and '/' not in filename and '\\' not in filename
            assert Path(filename).suffix.lower() in ('.mp3', '.ogg')
            assert len(body) <= 32 * MIB
            retained = sum(p.stat().st_size for p in OUTPUT.rglob('*') if p.is_file())
            assert retained + len(body) <= args.retained_limit_mib * MIB, 'Retained intake budget reached'
            destination = OUTPUT / identifier / filename
            destination.parent.mkdir(exist_ok=True)
            with destination.open('xb') as out:
                out.write(body)
            assert digest(destination.read_bytes()) == digest(body)
            receipt['tracks'].append({
                'id': identifier, 'sourcePage': track['sourcePage'], 'sourceURL': source['url'],
                'downloadBytes': count, 'downloadSha256': container_hash,
                'selectedMember': member,
                'original': {'path': str(destination.relative_to(LIBRARY)),
                             'bytes': len(body), 'sha256': digest(body)},
            })
            RECEIPT.write_text(json.dumps(receipt, indent=2, ensure_ascii=False) + '\n')
            print(identifier, len(body), digest(body), flush=True)


if __name__ == '__main__':
    main()
