#!/usr/bin/env python3
"""Prepare existing scene artwork for the menu; never crop or retouch originals.

Run with: uv run --with pillow==12.1.1 python scripts/prepare-menu-scenes.py
Images below 700 KiB use lossless WebP; larger originals use WebP quality 94.
The supplied DroneAid PNG is retained; its runtime derivative is always lossless.
Use --scene droneaid-nl-community to prepare only that derivative and provenance.
Add --check to verify reproducibility and decoded RGBA without writing files.
"""
from pathlib import Path
from io import BytesIO
import argparse
from PIL import Image
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/ui/art/menu-scenes'
SOURCES = {
    'fpv': 'game/ui/art/field-kit/prepared/title-hangar-v1.png',
    'fpv-portrait': 'game/ui/art/field-kit/prepared/title-hangar-portrait-v1.png',
    'ukraine': 'authoring/library/menu-scenes/ukraine-dawn-v1.png',
    'retro': 'authoring/library/menu-scenes/retro-rainy-arcade-v1.png',
    'coupa': 'game/editions/assets/coupa/home.png',
    'coupa-village': 'authoring/library/menu-scenes/coupa-overview-v1.png',
    'coupa-spend-in-motion-theme': 'game/editions/assets/coupa/spend-city-v2.png',
    'coupa-inside-village-theme': 'game/editions/assets/coupa/coupa-inside-village-key.png',
    'coupa-source-to-pay-theme': 'game/editions/assets/coupa/coupa-source-to-pay-key.png',
    'coupa-product-operations-theme': 'game/editions/assets/coupa/coupa-product-operations-key.png',
    'coupa-developer-integration-theme': 'game/editions/assets/coupa/network-atlas-v2.png',
    'droneaid-community': 'game/editions/assets/droneaid/droneaid-community-relay-01.png',
    'droneaid-nl-community': 'authoring/library/droneaid-brand-kit-2026-09-29/background-original.png',
}
for slug in ['workshop-lights', 'parts-in-motion', 'makers-together', 'careful-handoff', 'signals-of-support', 'shared-horizon']:
    SOURCES[f'droneaid-nl-{slug}-theme'] = f'game/editions/assets/droneaid-nl/artwork-v2/droneaid-nl-{slug}-01.png'

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--scene', choices=SOURCES, help='Prepare only this scene; retain all other provenance rows.')
parser.add_argument('--check', action='store_true', help='Verify encoded bytes and provenance without writing.')
args = parser.parse_args()
ledger_path = OUT / 'provenance.json'
ledger = json.loads(ledger_path.read_text()) if args.scene or args.check else {
    'format': 'revealline-menu-scenes.v1', 'created': '2026-09-28',
    'encoding': 'Pillow 12.1.1, libwebp', 'assets': [],
}
rows = list(ledger['assets']) if args.scene or args.check else []
if not args.check:
    OUT.mkdir(parents=True, exist_ok=True)
for name, source in SOURCES.items():
    if args.scene and name != args.scene:
        continue
    supplied = name == 'droneaid-nl-community'
    output = OUT / ('droneaid-main-background.webp' if supplied else name + '.webp')
    source_bytes = (ROOT / source).read_bytes()
    with Image.open(BytesIO(source_bytes)) as original:
        buffer = BytesIO()
        if supplied:
            assert original.format == 'PNG', name
            # Never overwrite either supplied original, including its old runtime copy.
            assert (OUT / 'droneaid-main-background.png').read_bytes() == source_bytes
            original.save(buffer, format='WEBP', lossless=True, method=6, exact=True)
            lossless = True
        else:
            original.save(buffer, format='WEBP', lossless=True, method=6)
            lossless = buffer.tell() <= 700 * 1024
            if not lossless:
                buffer = BytesIO()
                original.save(buffer, format='WEBP', quality=94, method=6)
        data = buffer.getvalue()
        if lossless:
            with Image.open(BytesIO(data)) as encoded:
                assert encoded.size == original.size
                assert encoded.convert('RGBA').tobytes() == original.convert('RGBA').tobytes()
        process = 'WebP lossless; decoded RGBA verified identical' if lossless else 'WebP quality 94; no cropping, resizing or retouching'
        size = original.size
        pixel_hash = hashlib.sha256(original.convert('RGBA').tobytes()).hexdigest()
    assert len(data) < 2 * 1024 * 1024, name
    row = {
        'id': name, 'file': output.name, 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'source': source,
        'sourceSha256': hashlib.sha256(source_bytes).hexdigest(),
        'width': size[0], 'height': size[1],
        'process': process,
    }
    if supplied:
        row['decodedRgbaSha256'] = pixel_hash
    previous = next((i for i, item in enumerate(rows) if item['id'] == name), None)
    if args.check:
        assert output.read_bytes() == data, f'{name}: encoded bytes differ'
        assert previous is not None and rows[previous] == row, f'{name}: provenance differs'
    else:
        output.write_bytes(data)
        if previous is None:
            rows.append(row)
        else:
            rows[previous] = row
    print(name, len(data), 'verified' if args.check else 'prepared')
if not args.check:
    ledger['assets'] = rows
    ledger_path.write_text(json.dumps(ledger, indent=2) + '\n')
