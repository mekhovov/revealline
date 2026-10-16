"""Plot recorded positions, not predicted routes or native gameplay artwork."""
import gzip
import json
from html import escape
from pathlib import Path
root = Path(__file__).parent
cases = []
for file in ['echo-original.json.gz', 'echo-comparisons.json.gz']:
    cases.extend(json.load(gzip.open(root / file))['cases'])
terrain = json.loads((root / 'terrain.json').read_text())
w, h = 1080, 1500
parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">',
'<rect width="100%" height="100%" fill="#111c20"/>',
'<style>text{fill:#ede7d6;font-family:system-ui,sans-serif}.note{fill:#b6c6c4;font-size:14px}</style>',
'<text x="30" y="35" font-size="23" font-weight="700">Echo approaches · Receiver Gardens · seed 202604</text>',
'<text x="30" y="60" class="note">Recorded positions from 240s onward. All three fixed controls lost; these are diagnostic routes.</text>',
'<path d="M30 85h32" stroke="#94e8d5" stroke-width="3"/><text x="72" y="90" class="note">Drone</text>',
'<path d="M180 85h32" stroke="#f0aa72" stroke-width="3"/><text x="222" y="90" class="note">Final tank from 300s</text>',
'<text x="470" y="90" class="note">Circles: last sampled position · lines join samples</text>']
for i, c in enumerate(cases):
    y0 = 150 + i * 440
    title = f"{c['route']} / {c.get('sweeper', 'trail')} Sweeper — loss at {c['time']:.2f}s"
    parts += [f'<text x="30" y="{y0-15}" font-size="17" font-weight="600">{escape(title)}</text>',
              f'<svg x="30" y="{y0}" width="1020" height="382.5" viewBox="0 0 2880 1080" preserveAspectRatio="xMidYMid meet">',
              '<rect width="2880" height="1080" fill="#1d2c30" stroke="#62716f" stroke-width="3"/>']
    for o in (terrain or {}).get('obstacles', []):
        parts.append(f'<rect x="{o["x"]}" y="{o["y"]}" width="{o["width"]}" height="{o["height"]}" fill="#5c6964" opacity=".65"/>')
    trace = [t for t in c['trace'] if t['time'] >= 240]
    bosses = [t['boss'] for t in trace if t.get('boss')]
    for points, color in [(trace, '#94e8d5'), (bosses, '#f0aa72')]:
        coords = ' '.join(f'{p["x"]:.1f},{p["y"]:.1f}' for p in points)
        parts.append(f'<polyline points="{coords}" fill="none" stroke="{color}" stroke-width="6" vector-effect="non-scaling-stroke" opacity=".8"/>')
        if points:
            end = points[-1]
            parts.append(f'<circle cx="{end["x"]}" cy="{end["y"]}" r="17" fill="{color}"/>')
    parts.append('</svg>')
    last = bosses[-1]
    details = f"Last observed tank: {last['armor']:.0f} armor / {last['hp']:.0f} hull · {c['choices']} choices · {c['stats']['xpOnGround']} salvage left"
    parts.append(f'<text x="30" y="{y0+410}" class="note">{escape(details)}</text>')
parts += ['<text x="30" y="1480" class="note">One-second samples after 240s. This chart is not a native capture or a player-difficulty estimate.</text>', '</svg>']
(root / 'approaches.svg').write_text('\n'.join(parts))
