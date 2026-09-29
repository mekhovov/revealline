#!/usr/bin/env python3
"""Prepare existing scene artwork for the menu; never crop or retouch originals.

Run with: uv run --with pillow==12.1.1 python scripts/prepare-menu-scenes.py
Images below 700 KiB use lossless WebP; larger originals use WebP quality 94.
The supplied DroneAid main background remains a byte-for-byte original PNG.
"""
from pathlib import Path
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

OUT.mkdir(parents=True, exist_ok=True)
rows = []
for name, source in SOURCES.items():
    preserve_original = name == 'droneaid-nl-community'
    output = OUT / ('droneaid-main-background.png' if preserve_original else name + '.webp')
    with Image.open(ROOT / source) as original:
        if preserve_original:
            assert original.format == 'PNG', name
            output.write_bytes((ROOT / source).read_bytes())
            process = 'Original supplied PNG; byte-for-byte copy, no raster changes'
        else:
            original.save(output, format='WEBP', lossless=True, method=6)
            lossless = output.stat().st_size <= 700 * 1024
            if not lossless:
                original.save(output, format='WEBP', quality=94, method=6)
            else:
                with Image.open(output) as encoded:
                    assert encoded.convert('RGBA').tobytes() == original.convert('RGBA').tobytes()
            process = 'WebP lossless; decoded RGBA verified identical' if lossless else 'WebP quality 94; no cropping, resizing or retouching'
        size = original.size
    data = output.read_bytes()
    assert len(data) < 2 * 1024 * 1024, name
    rows.append({
        'id': name, 'file': output.name, 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'source': source,
        'sourceSha256': hashlib.sha256((ROOT / source).read_bytes()).hexdigest(),
        'width': size[0], 'height': size[1],
        'process': process,
    })
    print(name, len(data))
(OUT / 'provenance.json').write_text(json.dumps({
    'format': 'revealline-menu-scenes.v1', 'created': '2026-09-28',
    'encoding': 'Pillow 12.1.1, libwebp; supplied DroneAid main PNG copied unchanged', 'assets': rows,
}, indent=2) + '\n')
