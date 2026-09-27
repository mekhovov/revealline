#!/usr/bin/env python3
"""Offline, original-preserving install icons. Requires Pillow==12.0.0.

Run with PYTHONPATH pointing at an isolated pinned Pillow installation. No
network requests, invented marks, cropping, recoloring, or source mutation.
--check derives in memory and compares exact PNG bytes plus public ledger pins.
"""
import argparse
import hashlib
import io
import json
import re
from pathlib import Path

import PIL
from PIL import Image


def digest(value):
    return hashlib.sha256(value).hexdigest()


def local(root, name):
    if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9_][A-Za-z0-9_.-]*(/[A-Za-z0-9_][A-Za-z0-9_.-]*)*", name):
        raise ValueError("An icon path must stay inside the source workspace.")
    target = root / name
    if not target.resolve().is_relative_to(root):
        raise ValueError("An icon path escapes through a symlink.")
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=".")
    parser.add_argument("--recipes", default="game/editions/icon-sources.json")
    parser.add_argument("--ledger", default="game/editions/assets.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if PIL.__version__ != "12.0.0":
        raise ValueError("Install the exact offline derivation dependency Pillow==12.0.0.")
    root = Path(args.root).resolve()
    recipe_source = json.loads(local(root, args.recipes).read_text())
    if recipe_source.get("format") != "revealline-install-icon-recipes.v1":
        raise ValueError("Unsupported icon recipes.")
    ledger_path = local(root, args.ledger)
    ledger = json.loads(ledger_path.read_text())
    assets = {asset["id"]: asset for asset in ledger}
    count = 0
    for recipe in recipe_source["recipes"]:
        source = assets[recipe["sourceAssetId"]]
        original = local(root, source["path"]).read_bytes()
        if source["publication"] != "public" or not source["approved"] or digest(original) != source["sha256"] or len(original) != source["bytes"] or recipe["sourceSha256"] != source["sha256"]:
            raise ValueError("Icon derivation needs the exact approved original bytes.")
        padding = recipe["paddingRatio"]
        background = recipe["background"]
        if not isinstance(padding, (float, int)) or not 0.1 <= padding <= 0.25 or not re.fullmatch(r"#[0-9A-Fa-f]{6}", background):
            raise ValueError("Install icons require bounded clearspace and a fixed background.")
        image = Image.open(io.BytesIO(original))
        if image.width > 8192 or image.height > 8192 or image.width * image.height > 16_000_000:
            raise ValueError("Original image exceeds the derivation pixel budget.")
        image = image.convert("RGBA")
        outputs = sorted(recipe["outputs"], key=lambda item: item["size"])
        if [output["size"] for output in outputs] != [192, 512]:
            raise ValueError("Install icons require distinct 192 and 512 pixel variants.")
        for output in outputs:
            size = output["size"]
            edge = int(size * (1 - padding * 2))
            ratio = min(edge / image.width, edge / image.height)
            dimensions = (max(1, round(image.width * ratio)), max(1, round(image.height * ratio)))
            mark = image.resize(dimensions, Image.Resampling.LANCZOS)
            canvas = Image.new("RGBA", (size, size), background)
            canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
            buffer = io.BytesIO()
            canvas.save(buffer, format="PNG", optimize=False, compress_level=9)
            png = buffer.getvalue()
            record = {
                "id": output["id"], "path": output["path"],
                "sha256": digest(png), "bytes": len(png),
                "publication": "public", "approved": True,
                "dependencies": [source["id"]] + ([outputs[0]["id"]] if size == 512 else []),
                "derivative": {
                    "sourceAssetId": source["id"], "sourceSha256": source["sha256"],
                    "sourceWidth": image.width, "sourceHeight": image.height,
                    "width": size, "height": size, "kind": "square-install-icon",
                    "background": background, "paddingRatio": padding,
                    "resampling": "lanczos", "implementation": "pillow-12.0.0",
                },
            }
            target = local(root, output["path"])
            if args.check:
                if target.read_bytes() != png or assets.get(output["id"]) != record:
                    raise ValueError(f"Icon derivative differs from its pinned recipe: {output['id']}")
            else:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(png)
                if output["id"] in assets:
                    ledger[ledger.index(assets[output["id"]])] = record
                else:
                    ledger.append(record)
                assets[output["id"]] = record
            count += 1
    if not args.check:
        ledger_path.write_text(json.dumps(ledger, indent=2) + "\n")
    print(f"{'Verified' if args.check else 'Derived'} {count} exact square install icons.")


if __name__ == "__main__":
    main()
