#!/usr/bin/env python3
"""Prepare existing scene artwork for the menu; never crop or retouch originals.

Run with: uv run --with pillow==12.1.1 python scripts/prepare-menu-scenes.py
Images below 700 KiB use lossless WebP; larger originals use WebP quality 94.
Authored mode compositions prefer lossless within the 2 MiB artwork + atlas limit.
The supplied DroneAid main background remains a byte-for-byte original PNG.
"""
from pathlib import Path
from PIL import Image
import hashlib
import json
import argparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'game/ui/art/menu-scenes'
ACTIVE_BUDGET = 2 * 1024 * 1024
SOURCES = {
    'fpv': 'game/ui/art/field-kit/prepared/title-hangar-v1.png',
    'fpv-portrait': 'game/ui/art/field-kit/prepared/title-hangar-portrait-v1.png',
    'fpv-versus': 'authoring/library/menu-scenes/fpv-versus-v1.png',
    'fpv-versus-portrait': 'authoring/library/menu-scenes/fpv-versus-portrait-v1.png',
    'fpv-team': 'authoring/library/menu-scenes/fpv-team-v1.png',
    'fpv-team-portrait': 'authoring/library/menu-scenes/fpv-team-portrait-v1.png',
    'ukraine': 'authoring/library/menu-scenes/ukraine-dawn-v1.png',
    'ukraine-versus': 'authoring/library/menu-scenes/ukraine-versus-v1.png',
    'ukraine-versus-portrait': 'authoring/library/menu-scenes/ukraine-versus-portrait-v1.png',
    'ukraine-team': 'authoring/library/menu-scenes/ukraine-team-v1.png',
    'ukraine-team-portrait': 'authoring/library/menu-scenes/ukraine-team-portrait-v1.png',
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
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--only', action='append', choices=SOURCES, help='Encode only this scene; retain all other recorded bytes.')
selected = parser.parse_args().only
previous = json.loads((OUT / 'provenance.json').read_text()) if selected else {}
rows = [row for row in previous.get('assets', []) if row['id'] not in selected] if selected else []
for name, source in SOURCES.items():
    if selected and name not in selected:
        continue
    preserve_original = name == 'droneaid-nl-community'
    mode_world = next((world for world in ['fpv', 'ukraine']
                       if name.startswith((world + '-versus', world + '-team'))), None)
    output = OUT / ('droneaid-main-background.png' if preserve_original else name + '.webp')
    with Image.open(ROOT / source) as original:
        if preserve_original:
            assert original.format == 'PNG', name
            output.write_bytes((ROOT / source).read_bytes())
            process = 'Original supplied PNG; byte-for-byte copy, no raster changes'
        else:
            # Quality controls lossless encoder effort, not pixel fidelity.
            # Ukraine's detailed paintings benefit from its exhaustive setting;
            # retain the earlier recipe for previously admitted artwork.
            effort = 100 if mode_world == 'ukraine' else 75
            original.save(output, format='WEBP', lossless=True, quality=effort, method=6)
            atlas_bytes = (OUT / 'analog-noise-atlas.png').stat().st_size
            threshold = ACTIVE_BUDGET - atlas_bytes if mode_world else 700 * 1024
            lossless = output.stat().st_size < threshold
            if not lossless:
                original.save(output, format='WEBP', quality=94, method=6)
            else:
                with Image.open(output) as encoded:
                    assert encoded.convert('RGBA').tobytes() == original.convert('RGBA').tobytes()
            process = ('WebP lossless; quality=100 encoding effort, method=6; decoded RGBA verified identical'
                       if lossless and mode_world == 'ukraine' else
                       'WebP lossless; decoded RGBA verified identical' if lossless else
                       'WebP quality 94, method=6; no cropping, resizing or retouching')
        size = original.size
    data = output.read_bytes()
    assert len(data) + (OUT / 'analog-noise-atlas.png').stat().st_size <= ACTIVE_BUDGET, name
    rows.append({
        'id': name, 'file': output.name, 'bytes': len(data),
        'sha256': hashlib.sha256(data).hexdigest(), 'source': source,
        'sourceSha256': hashlib.sha256((ROOT / source).read_bytes()).hexdigest(),
        'width': size[0], 'height': size[1],
        'process': process,
        **({'promptSource': f'authoring/library/menu-scenes/{mode_world}-mode-prompts.json',
            'generator': 'OpenAI built-in image_gen',
            'rights': f'Original generated project artwork; existing {mode_world.upper()} project art used as reference'}
           if mode_world else {}),
    })
    print(name, len(data))
(OUT / 'provenance.json').write_text(json.dumps({
    'format': 'revealline-menu-scenes.v1', 'created': '2026-09-28',
    'encoding': 'Pillow 12.1.1, libwebp; supplied DroneAid main PNG copied unchanged', 'assets': rows,
}, indent=2) + '\n')
