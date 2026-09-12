#!/usr/bin/env python3
"""Local, non-destructive raster asset authoring. No network or game runtime."""
from __future__ import annotations

import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import struct
import sys
import tempfile

VERSION = "1.0.0"
MAX_BYTES = 64 * 1024 * 1024
IDENTIFIER = re.compile(r"^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$")
SHA = re.compile(r"^[0-9a-f]{64}$")
FORMATS = {"png": "image/png", "jpg": "image/jpeg", "gif": "image/gif", "webp": "image/webp"}
ALLEGIANCES = ("ukrainian", "hostile-military", "neutral", "mixed", "not-applicable", "unconfirmed")
DEFAULT_ROLES = {
    "player.avatar": "Player artwork; scale and silhouette do not define collision.",
    "enemy.field": "Artwork for a field-threat visual slot; behavior belongs elsewhere.",
    "enemy.contour": "Artwork for a contour-threat visual slot.",
    "enemy.exposed": "Artwork for an exposed-area threat visual slot.",
    "enemy.erosion": "Artwork for an erosion-threat visual slot.",
    "terrain.wall": "Solid-barrier visual material, including objects instead of glyphs.",
    "terrain.slow": "Slow-field visual material, including objects instead of glyphs.",
    "terrain.danger": "Lethal-field visual material, including objects instead of glyphs.",
    "reveal.original": "Preserved original chosen as reveal source.",
    "reveal.display": "Chosen original or separately produced styled reveal artwork.",
    "reveal.mask": "Unrevealed-area visual material.",
    "territory.boundary": "Claimed-area contour artwork.",
    "trail.active": "Exposed player-trail artwork.",
    "pickup.item": "Pickup artwork; effect is defined outside this manifest.",
    "ui.menu": "Menu background or visual skin.",
    "ui.hud": "HUD visual skin; localized labels remain real text.",
    "ui.icon": "Interface icon artwork.",
    "ui.cursor": "Focus/cursor artwork.",
    "effect.capture": "Capture effect source artwork.",
    "marketing.key-art": "Marketing illustration, separate from runtime assets.",
}


class MediaError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise MediaError(message)


def fields(value, required, optional=(), label="object"):
    require(isinstance(value, dict), f"{label}: expected an object")
    require(set(required) <= value.keys(), f"{label}: missing fields {sorted(set(required) - value.keys())}")
    require(value.keys() <= set(required) | set(optional),
            f"{label}: unknown fields {sorted(value.keys() - set(required) - set(optional))}")


def string(value, label):
    require(isinstance(value, str) and value.strip(), f"{label}: expected nonempty text")


def identifier(value, label):
    require(isinstance(value, str) and len(value) <= 128 and IDENTIFIER.fullmatch(value),
            f"{label}: expected a lowercase dot/hyphen identifier")


def timestamp(value, label):
    string(value, label)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        require(parsed.tzinfo is not None, f"{label}: timezone required")
    except ValueError as exc:
        raise MediaError(f"{label}: invalid timestamp") from exc


def now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def image_info(data):
    """Identify supported raster headers/dimensions, not full pixel decoding."""
    require(0 < len(data) <= MAX_BYTES, "Image must be nonempty and at most 64 MiB")
    width = height = 0
    fmt = None
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 33:
        require(data[8:16] == b"\x00\x00\x00\rIHDR", "Invalid PNG IHDR header")
        width, height = struct.unpack(">II", data[16:24])
        fmt = "png"
    elif data[:6] in (b"GIF87a", b"GIF89a") and len(data) >= 13:
        width, height = struct.unpack("<HH", data[6:10])
        fmt = "gif"
    elif data.startswith(b"\xff\xd8"):
        offset = 2
        sof = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
        while offset < len(data):
            require(data[offset] == 0xFF, "Invalid JPEG marker")
            while offset < len(data) and data[offset] == 0xFF:
                offset += 1
            require(offset < len(data), "Truncated JPEG marker")
            marker = data[offset]
            offset += 1
            if marker in (0xD9, 0xDA):
                break
            if marker == 0x01 or 0xD0 <= marker <= 0xD7:
                continue
            require(offset + 2 <= len(data), "Truncated JPEG segment")
            size = int.from_bytes(data[offset:offset + 2], "big")
            require(size >= 2 and offset + size <= len(data), "Invalid JPEG segment length")
            if marker in sof:
                require(size >= 8, "Invalid JPEG frame header")
                height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
                fmt = "jpg"
                break
            offset += size
    elif len(data) >= 20 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        require(int.from_bytes(data[4:8], "little") + 8 == len(data), "Invalid WebP RIFF length")
        chunk = data[12:16]
        size = int.from_bytes(data[16:20], "little")
        require(20 + size <= len(data), "Truncated WebP chunk")
        if chunk == b"VP8X" and size >= 10:
            width = 1 + int.from_bytes(data[24:27], "little")
            height = 1 + int.from_bytes(data[27:30], "little")
        elif chunk == b"VP8 " and size >= 10 and data[23:26] == b"\x9d\x01\x2a":
            width, height = (v & 0x3FFF for v in struct.unpack("<HH", data[26:30]))
        elif chunk == b"VP8L" and size >= 5 and data[20] == 0x2F:
            bits = int.from_bytes(data[21:25], "little")
            width, height = (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        fmt = "webp"
    require(fmt is not None and width > 0 and height > 0,
            "Unrecognized or malformed raster header; supported: PNG, JPEG, GIF, WebP")
    return {"format": fmt, "mimeType": FORMATS[fmt], "width": width, "height": height}


def read_image(path):
    require(path.is_file(), f"Image is not a regular file: {path}")
    require(path.stat().st_size <= MAX_BYTES, "Image exceeds 64 MiB")
    data = path.read_bytes()
    return data, image_info(data)


def contained(root, relative):
    string(relative, "file.path")
    require("\\" not in relative and ":" not in relative and "\x00" not in relative,
            "file.path must use a plain relative POSIX path")
    pure = PurePosixPath(relative)
    require(not pure.is_absolute() and ".." not in pure.parts and str(pure) == relative,
            "file.path must be normalized and may not escape the library")
    candidate = root
    for part in pure.parts:
        candidate /= part
        require(not candidate.is_symlink(), f"Symlinks are not allowed in managed paths: {relative}")
    require(candidate.resolve().is_relative_to(root.resolve()), "file.path escapes the library")
    return candidate


def no_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def manifest_path(value):
    path = Path(value).expanduser().absolute()
    require(not path.is_symlink(), "Manifest may not be a symlink")
    return path.parent.resolve() / path.name


def load(path):
    require(not path.is_symlink(), "Manifest may not be a symlink")
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=no_duplicate_keys)


def validate(manifest, root, ready=False):
    fields(manifest, {"mediaVersion", "id", "themeId", "roles", "assets", "bindings"}, label="manifest")
    require(manifest["mediaVersion"] == VERSION, f"Unsupported mediaVersion; expected {VERSION}")
    identifier(manifest["id"], "id")
    identifier(manifest["themeId"], "themeId")
    require(isinstance(manifest["roles"], dict) and manifest["roles"], "roles must be a nonempty object")
    for role, description in manifest["roles"].items():
        identifier(role, "role")
        string(description, f"role {role} description")
    require(isinstance(manifest["assets"], list), "assets must be an array")
    assets = {}
    for asset in manifest["assets"]:
        fields(asset, {"id", "kind", "status", "provenance"}, {"file", "review", "subjectAllegiance"}, "asset")
        aid = asset["id"]
        identifier(aid, "asset.id")
        require(aid not in assets, f"Duplicate asset ID: {aid}")
        assets[aid] = asset
        require(asset["kind"] in ("original", "derivative"), f"{aid}: invalid kind")
        require(asset["status"] in ("planned", "imported", "reviewed"), f"{aid}: invalid status")
        if "subjectAllegiance" in asset:
            require(asset["subjectAllegiance"] in ALLEGIANCES, f"{aid}: invalid subjectAllegiance")
        prov = asset["provenance"]
        if asset["status"] == "planned":
            required = {"method", "brief"} | ({"parentAssetId"} if asset["kind"] == "derivative" else set())
            fields(prov, required, label=f"{aid} provenance")
            require(prov["method"] == "planned", f"{aid}: planned asset needs planned provenance")
            string(prov["brief"], f"{aid} brief")
            require("file" not in asset and "review" not in asset, f"{aid}: planned assets cannot claim files/review")
        else:
            required = {"method", "creator", "rights", "recordedAt", "sourceName"}
            if asset["kind"] == "derivative":
                required |= {"parentAssetId", "parentSha256", "tool"}
            fields(prov, required, {"effectivePrompt", "model"} if asset["kind"] == "derivative" else (),
                   f"{aid} provenance")
            for key in required - {"recordedAt"}:
                string(prov[key], f"{aid} provenance.{key}")
            timestamp(prov["recordedAt"], f"{aid} recordedAt")
            methods = ("import",) if asset["kind"] == "original" else ("manual", "ai", "conversion")
            require(prov["method"] in methods, f"{aid}: invalid production method")
            if prov["method"] == "ai":
                string(prov.get("effectivePrompt"), f"{aid} AI effectivePrompt")
                string(prov.get("model"), f"{aid} AI model")
            else:
                require("effectivePrompt" not in prov and "model" not in prov,
                        f"{aid}: AI provenance belongs only to method ai")
            fields(asset.get("file"), {"path", "sha256", "bytes", "format", "mimeType", "width", "height"},
                   label=f"{aid} file")
            meta = asset["file"]
            require(isinstance(meta["sha256"], str) and SHA.fullmatch(meta["sha256"]), f"{aid}: invalid SHA-256")
            for key in ("bytes", "width", "height"):
                require(type(meta[key]) is int and meta[key] > 0, f"{aid}: {key} must be a positive integer")
            require(meta["format"] in FORMATS, f"{aid}: unsupported format")
            folder = "originals" if asset["kind"] == "original" else "derivatives"
            expected = f"files/{folder}/{meta['sha256']}.{meta['format']}"
            require(meta["path"] == expected, f"{aid}: file path must match kind, hash and detected format")
            file_path = contained(root, meta["path"])
            data, detected = read_image(file_path)
            require(len(data) == meta["bytes"] and sha256(data) == meta["sha256"], f"{aid}: file identity mismatch")
            require(all(meta[key] == value for key, value in detected.items()), f"{aid}: image header metadata mismatch")
        if asset["status"] == "reviewed":
            fields(asset.get("review"), {"reviewer", "reviewedAt", "note"}, label=f"{aid} review")
            string(asset["review"]["reviewer"], f"{aid} reviewer")
            string(asset["review"]["note"], f"{aid} review note")
            timestamp(asset["review"]["reviewedAt"], f"{aid} reviewedAt")
        else:
            require("review" not in asset, f"{aid}: only reviewed assets may carry review")
        if ready:
            require(asset["status"] == "reviewed", f"{aid}: ready gate requires explicit review")
    for aid, asset in assets.items():
        if asset["kind"] != "derivative":
            continue
        parent_id = asset["provenance"]["parentAssetId"]
        identifier(parent_id, f"{aid} parentAssetId")
        require(parent_id in assets, f"{aid}: missing parent asset {parent_id}")
        if asset["status"] != "planned":
            parent = assets[parent_id]
            require(parent["status"] != "planned", f"{aid}: produced derivative needs a produced parent")
            require(asset["provenance"]["parentSha256"] == parent["file"]["sha256"],
                    f"{aid}: derivative parent hash mismatch")
        visited = {aid}
        current = parent_id
        while True:
            require(current not in visited, f"{aid}: derivative ancestry cycle")
            visited.add(current)
            require(current in assets, f"{aid}: missing ancestor {current}")
            ancestor = assets[current]
            if ancestor["kind"] == "original":
                break
            current = ancestor["provenance"]["parentAssetId"]
    require(isinstance(manifest["bindings"], list), "bindings must be an array")
    bindings = set()
    for binding in manifest["bindings"]:
        fields(binding, {"role", "variant", "assetId", "presentation"}, label="binding")
        for key in ("role", "variant", "assetId"):
            identifier(binding[key], f"binding.{key}")
        pair = binding["role"], binding["variant"]
        require(pair not in bindings, f"Duplicate role/variant binding: {pair}")
        bindings.add(pair)
        require(binding["role"] in manifest["roles"], f"Unknown visual role: {binding['role']}")
        require(binding["assetId"] in assets, f"Binding refers to missing asset: {binding['assetId']}")
        presentation = binding["presentation"]
        fields(presentation, {"sampling", "fit"}, {"anchor", "scale", "opacity", "rotationOffsetDegrees"}, "presentation")
        require(presentation["sampling"] in ("nearest", "linear"), "sampling must be nearest or linear")
        require(presentation["fit"] in ("contain", "cover"), "fit must be contain or cover")
        if "anchor" in presentation:
            require(isinstance(presentation["anchor"], list) and len(presentation["anchor"]) == 2 and
                    all(type(v) in (int, float) and 0 <= v <= 1 for v in presentation["anchor"]),
                    "anchor must contain two normalized coordinates")
        for key, minimum, maximum in (("scale", 0.01, 100), ("opacity", 0, 1), ("rotationOffsetDegrees", -360, 360)):
            if key in presentation:
                value = presentation[key]
                require(type(value) in (int, float) and minimum <= value <= maximum, f"Invalid presentation {key}")
    if ready:
        require(assets and bindings, "Ready gate requires assets and bindings")
    return {"valid": True, "mediaVersion": VERSION, "assets": len(assets), "bindings": len(bindings),
            "planned": sum(a["status"] == "planned" for a in assets.values()), "gate": "ready" if ready else "draft"}


@contextmanager
def locked(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    lock = path.with_name(path.name + ".lock")
    try:
        descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise MediaError(f"Manifest is locked: {lock}. If a process crashed, inspect before removing its lock.") from exc
    try:
        os.close(descriptor)
        yield
    finally:
        lock.unlink()


def save(path, manifest):
    require(not path.is_symlink(), "Manifest may not be a symlink")
    validate(manifest, path.parent)
    data = (json.dumps(manifest, indent=2, ensure_ascii=False, allow_nan=False) + "\n").encode("utf-8")
    descriptor, name = tempfile.mkstemp(prefix=".media-", suffix=".json.tmp", dir=path.parent)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def store_image(root, kind, data, info):
    digest = sha256(data)
    folder = "originals" if kind == "original" else "derivatives"
    relative = f"files/{folder}/{digest}.{info['format']}"
    destination = contained(root, relative)
    destination.parent.mkdir(parents=True, exist_ok=True)
    contained(root, relative)
    try:
        with destination.open("xb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
    except FileExistsError:
        require(destination.is_file() and destination.read_bytes() == data,
                "Managed file already exists with different bytes; refusing to overwrite")
    return {"path": relative, "sha256": digest, "bytes": len(data), **info}


def find_asset(manifest, asset_id):
    for asset in manifest["assets"]:
        if asset["id"] == asset_id:
            return asset
    raise MediaError(f"Unknown asset ID: {asset_id}")


def put_asset(manifest, asset):
    identifier(asset["id"], "asset.id")
    for index, existing in enumerate(manifest["assets"]):
        if existing["id"] == asset["id"]:
            require(existing["status"] == "planned", "Produced asset IDs are immutable; use a new ID")
            require(existing["kind"] == asset["kind"], "Cannot change the kind of a planned asset")
            if existing["kind"] == "derivative":
                require(existing["provenance"]["parentAssetId"] == asset["provenance"]["parentAssetId"],
                        "Cannot silently change the source of a planned derivative")
            if "subjectAllegiance" in existing and "subjectAllegiance" not in asset:
                asset["subjectAllegiance"] = existing["subjectAllegiance"]
            manifest["assets"][index] = asset
            return
    manifest["assets"].append(asset)


def register(manifest, root, args):
    kind = "original" if args.command == "import" else "derivative"
    identifier(args.asset, "asset.id")
    # Check identity before writing an immutable file.
    existing = next((a for a in manifest["assets"] if a["id"] == args.asset), None)
    require(existing is None or existing["status"] == "planned", "Produced asset IDs are immutable; use a new ID")
    source = Path(args.source).expanduser()
    data, info = read_image(source)
    provenance = {"method": "import" if kind == "original" else args.method, "creator": args.creator,
                  "rights": args.rights, "recordedAt": now(), "sourceName": source.name}
    if kind == "derivative":
        parent = find_asset(manifest, args.parent)
        require(parent["status"] != "planned", "Import the original/parent before registering a derivative")
        provenance.update(parentAssetId=parent["id"], parentSha256=parent["file"]["sha256"], tool=args.tool)
        if args.method == "ai":
            require(args.model and args.prompt_file, "AI derivative requires --model and --prompt-file")
            provenance.update(model=args.model, effectivePrompt=Path(args.prompt_file).read_text(encoding="utf-8"))
        else:
            require(not args.model and not args.prompt_file, "--model/--prompt-file apply only to --method ai")
    asset = {"id": args.asset, "kind": kind, "status": "imported", "provenance": provenance}
    if args.allegiance:
        asset["subjectAllegiance"] = args.allegiance
    put_asset(manifest, asset)
    asset["file"] = store_image(root, kind, data, info)


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="Create an empty library manifest; never overwrite")
    init.add_argument("manifest")
    init.add_argument("--id", required=True)
    init.add_argument("--theme", required=True)
    plan = commands.add_parser("plan", help="Add a brief without claiming a file exists")
    plan.add_argument("manifest")
    plan.add_argument("--asset", required=True)
    plan.add_argument("--brief", required=True)
    plan.add_argument("--parent", help="Make this a planned derivative of a known asset")
    plan.add_argument("--allegiance", choices=ALLEGIANCES, help="Author-supplied subject identity; not image detection")
    for name in ("import", "derive"):
        command = commands.add_parser(name, help="Copy an original" if name == "import" else "Register an already produced derivative; does not invoke AI")
        command.add_argument("manifest")
        command.add_argument("--asset", required=True)
        command.add_argument("--source", required=True)
        command.add_argument("--creator", required=True)
        command.add_argument("--rights", required=True, help="Provenance note; not automatic legal approval")
        command.add_argument("--allegiance", choices=ALLEGIANCES, help="Author-supplied subject identity; preserves a planned label when omitted")
        if name == "derive":
            command.add_argument("--parent", required=True)
            command.add_argument("--method", choices=("manual", "ai", "conversion"), required=True)
            command.add_argument("--tool", required=True)
            command.add_argument("--model")
            command.add_argument("--prompt-file")
    role = commands.add_parser("role", help="Declare or revise a visual-role description")
    role.add_argument("manifest")
    role.add_argument("--id", required=True)
    role.add_argument("--description", required=True)
    bind = commands.add_parser("bind", help="Set a role/variant asset reference; no physics")
    bind.add_argument("manifest")
    bind.add_argument("--role", required=True)
    bind.add_argument("--variant", default="default")
    bind.add_argument("--asset", required=True)
    bind.add_argument("--sampling", choices=("nearest", "linear"), default="linear")
    bind.add_argument("--fit", choices=("contain", "cover"), default="contain")
    review = commands.add_parser("review", help="Record an explicit human review attestation")
    review.add_argument("manifest")
    review.add_argument("--asset", required=True)
    review.add_argument("--reviewer", required=True)
    review.add_argument("--note", required=True)
    check = commands.add_parser("validate", help="Check manifest references, provenance, paths, hashes and headers")
    check.add_argument("manifest")
    check.add_argument("--ready", action="store_true", help="Additionally require all assets to have explicit reviews")
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    try:
        path = manifest_path(args.manifest)
        if args.command == "validate":
            summary = validate(load(path), path.parent, args.ready)
        else:
            with locked(path):
                if args.command == "init":
                    require(not path.exists(), "Manifest already exists; refusing to overwrite")
                    manifest = {"mediaVersion": VERSION, "id": args.id, "themeId": args.theme,
                                "roles": DEFAULT_ROLES.copy(), "assets": [], "bindings": []}
                else:
                    manifest = load(path)
                    validate(manifest, path.parent)
                if args.command == "plan":
                    provenance = {"method": "planned", "brief": args.brief}
                    if args.parent:
                        find_asset(manifest, args.parent)
                        provenance["parentAssetId"] = args.parent
                    planned = {"id": args.asset, "kind": "derivative" if args.parent else "original",
                               "status": "planned", "provenance": provenance}
                    if args.allegiance:
                        planned["subjectAllegiance"] = args.allegiance
                    put_asset(manifest, planned)
                elif args.command in ("import", "derive"):
                    register(manifest, path.parent, args)
                elif args.command == "role":
                    identifier(args.id, "role.id")
                    string(args.description, "role.description")
                    manifest["roles"][args.id] = args.description
                elif args.command == "bind":
                    pair = args.role, args.variant
                    previous = next((b for b in manifest["bindings"] if (b["role"], b["variant"]) == pair), None)
                    presentation = dict(previous["presentation"]) if previous else {}
                    presentation.update(sampling=args.sampling, fit=args.fit)
                    binding = {"role": args.role, "variant": args.variant, "assetId": args.asset,
                               "presentation": presentation}
                    manifest["bindings"] = [b for b in manifest["bindings"] if (b["role"], b["variant"]) != pair] + [binding]
                elif args.command == "review":
                    asset = find_asset(manifest, args.asset)
                    require(asset["status"] != "planned", "Cannot review an unproduced asset")
                    asset["status"] = "reviewed"
                    asset["review"] = {"reviewer": args.reviewer, "reviewedAt": now(), "note": args.note}
                save(path, manifest)
                summary = validate(manifest, path.parent)
        print(json.dumps(summary, sort_keys=True))
        return 0
    except (MediaError, OSError, ValueError, TypeError, KeyError) as exc:
        print(f"media: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
