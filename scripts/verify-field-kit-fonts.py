#!/usr/bin/env python3
"""Check the shipped Field Kit fonts; optionally reproduce them from pinned sources.

Requires fonttools[woff]. Normal verification is offline and never changes files.
See docs/fpv-typography.md for installation, provenance, and rendering checks.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import sys
from urllib.request import Request, urlopen

try:
    import fontTools
    from fontTools.ttLib import TTFont
    from fontTools.varLib.instancer import instantiateVariableFont
except ImportError:
    sys.exit("Install fonttools[woff] in a Python virtual environment; see docs/fpv-typography.md.")


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "game/ui/fonts/field-kit"
UKRAINIAN = "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯабвгґдеєжзиіїйклмнопрстуфхцчшщьюя"
PUNCTUATION = "ʼ‘’“”«»–—−…•·×÷°€"
REQUIRED = set(range(0x20, 0x7F)) | {ord(c) for c in UKRAINIAN + PUNCTUATION}
UI_SYMBOLS = {ord(c) for c in "₴↑↓←→"}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_file(filename: str) -> Path:
    path = (FONT_DIR / filename).resolve()
    if not path.is_relative_to(FONT_DIR.resolve()):
        raise ValueError(f"Font path leaves its directory: {filename}")
    return path


def fetch_checked(url: str, expected_hash: str) -> bytes:
    request = Request(url, headers={"User-Agent": "RevealLine-font-reproducer/1"})
    with urlopen(request, timeout=45) as response:
        data = response.read()
    if sha256(data) != expected_hash:
        raise ValueError(f"Pinned source checksum mismatch: {url}")
    return data


def generate(entry: dict) -> bytes:
    data = fetch_checked(entry["sourceUrl"], entry["sourceSha256"])
    font = TTFont(io.BytesIO(data), recalcTimestamp=False)
    axes = {tag: tuple(value) if isinstance(value, list) else value for tag, value in entry["axes"].items()}
    if axes:
        font = instantiateVariableFont(font, axes, inplace=True)
    font.flavor = "woff2"
    output = io.BytesIO()
    font.save(output)
    font.close()
    return output.getvalue()


def verify(entry: dict, data: bytes) -> set[int]:
    filename = entry["file"]
    if sha256(data) != entry["sha256"]:
        raise ValueError(f"{filename}: shipped checksum differs from provenance")
    if len(data) != entry["bytes"]:
        raise ValueError(f"{filename}: size differs from provenance")
    if data[:4] != b"wOF2":
        raise ValueError(f"{filename}: expected WOFF2")
    with TTFont(io.BytesIO(data)) as font:
        cmap = font.getBestCmap() or {}
        supported = {codepoint for codepoint, name in cmap.items() if name != ".notdef" and font.getGlyphID(name) != 0}
        missing = sorted(REQUIRED - supported)
        if missing:
            detail = ", ".join(f"{chr(c)!r} U+{c:04X}" for c in missing)
            raise ValueError(f"{filename}: missing required characters: {detail}")
        expected_axes = entry["outputAxes"]
        actual_axes = {
            axis.axisTag: [axis.minValue, axis.defaultValue, axis.maxValue]
            for axis in font["fvar"].axes
        } if "fvar" in font else {}
        if actual_axes != expected_axes:
            raise ValueError(f"{filename}: incorrect variation axes {actual_axes}")
        if font["OS/2"].usWeightClass != entry["defaultWeight"]:
            raise ValueError(f"{filename}: incorrect default weight")
        if font["OS/2"].fsType != 0:
            raise ValueError(f"{filename}: unexpected embedding restrictions")
        # Numerals in telemetry must not shift the rest of a readout as they change.
        if entry["role"] == "numeric":
            widths = {font["hmtx"][cmap[ord(char)]][0] for char in "0123456789"}
            if len(widths) != 1:
                raise ValueError(f"{filename}: telemetry numerals have unequal advance widths")
    license_data = local_file(entry["licenseFile"]).read_bytes()
    if sha256(license_data) != entry["licenseSha256"] or b"SIL OPEN FONT LICENSE" not in license_data:
        raise ValueError(f"{filename}: license checksum/content mismatch")
    return supported


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rebuild", action="store_true", help="Recreate WOFF2 files from pinned, checksum-verified sources.")
    args = parser.parse_args()
    manifest = json.loads((FONT_DIR / "provenance.json").read_text(encoding="utf-8"))
    if args.rebuild and fontTools.__version__ != manifest["build"]["fontTools"]:
        raise ValueError(f"Rebuilding requires fonttools=={manifest['build']['fontTools']}; installed {fontTools.__version__}")
    results = []
    for entry in manifest["fonts"]:
        data = generate(entry) if args.rebuild else local_file(entry["file"]).read_bytes()
        coverage = verify(entry, data)
        results.append((entry, data, coverage))
    interface = next(coverage for entry, _, coverage in results if entry["role"] == "ui")
    numeric = next(coverage for entry, _, coverage in results if entry["role"] == "numeric")
    if UI_SYMBOLS - (interface | numeric):
        raise ValueError("The local UI/Mono fallback stack does not cover HUD symbols.")
    # Validate every output before writing any file during an explicit rebuild.
    if args.rebuild:
        for entry, data, _ in results:
            local_file(entry["file"]).write_bytes(data)
    for entry, data, coverage in results:
        print(f"PASS {entry['file']}: {len(data):,} bytes; {len(REQUIRED)} required characters; {len(coverage)} mapped codepoints")
    print("PASS Ukrainian Ґґ Єє Іі Її, English, punctuation, pinned hashes, licenses, axes, and equal-width telemetry digits")
    print("PASS local Exo 2 → IBM Plex Mono fallback covers ₴ ↑ ↓ ← →")
    print(f"Total font payload: {sum(len(data) for _, data, _ in results):,} bytes")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, KeyError) as error:
        print(f"FAIL {error}", file=sys.stderr)
        raise SystemExit(1)
