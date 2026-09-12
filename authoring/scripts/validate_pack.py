#!/usr/bin/env python3
"""Validate local authoring packs; no game simulation and no dependencies required."""
import argparse
from collections import deque
from copy import deepcopy
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import tempfile

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parent
SCHEMA_PATH = BASE / "schema/content-pack.schema.json"
CATALOG_PATH = BASE / "schema/primitive-catalog.json"

# This is deliberately a narrow interpreter for this checked-in schema, not a
# general JSON Schema implementation. Unknown keywords fail instead of being ignored.
KEYWORDS = {"$schema", "$id", "$defs", "$ref", "title", "description", "type", "properties", "required",
            "additionalProperties", "items", "minItems", "maxItems", "uniqueItems", "minLength", "maxLength",
            "minimum", "maximum", "pattern", "enum", "const"}

def read_json(path):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f"duplicate JSON key: {key}")
            result[key] = value
        return result
    def bad_constant(value):
        raise ValueError(f"non-finite JSON number: {value}")
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=pairs, parse_constant=bad_constant)

def schema_errors(value, schema, path="$", root=None):
    root = schema if root is None else root
    unknown = set(schema) - KEYWORDS
    if unknown:
        raise ValueError(f"unsupported checked-in schema keywords: {sorted(unknown)}")
    if "$ref" in schema:
        target = schema["$ref"]
        if not target.startswith("#/$defs/"):
            raise ValueError("only local $defs references are supported")
        return schema_errors(value, root["$defs"][target.removeprefix("#/$defs/")], path, root)
    errors = []
    def fail(message):
        errors.append(f"{path}: {message}")
    kinds = {"object": lambda v: isinstance(v, dict), "array": lambda v: isinstance(v, list),
             "string": lambda v: isinstance(v, str), "boolean": lambda v: isinstance(v, bool),
             "integer": lambda v: not isinstance(v, bool) and (isinstance(v, int) or isinstance(v, float) and math.isfinite(v) and v.is_integer()),
             "number": lambda v: not isinstance(v, bool) and (isinstance(v, int) or isinstance(v, float) and math.isfinite(v))}
    expected = schema.get("type")
    if expected and (expected not in kinds or not kinds[expected](value)):
        return [f"{path}: expected {expected}"]
    canonical = lambda v: json.dumps(v, sort_keys=True, ensure_ascii=False)
    if "const" in schema and canonical(value) != canonical(schema["const"]):
        fail(f"must equal {schema['const']!r}")
    if "enum" in schema and canonical(value) not in [canonical(v) for v in schema["enum"]]:
        fail(f"must be one of {schema['enum']}")
    if isinstance(value, dict):
        props = schema.get("properties", {})
        for required in schema.get("required", []):
            if required not in value:
                fail(f"missing {required}")
        if schema.get("additionalProperties") is False:
            for key in sorted(set(value) - set(props)):
                fail(f"unexpected property {key}")
        for key in value.keys() & props.keys():
            errors.extend(schema_errors(value[key], props[key], f"{path}.{key}", root))
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0) or len(value) > schema.get("maxItems", math.inf):
            fail("array length outside allowed range")
        if schema.get("uniqueItems") and len({canonical(v) for v in value}) != len(value):
            fail("array items must be unique")
        if "items" in schema:
            for index, child in enumerate(value):
                errors.extend(schema_errors(child, schema["items"], f"{path}[{index}]", root))
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0) or len(value) > schema.get("maxLength", math.inf):
            fail("string length outside allowed range")
        if "pattern" in schema and re.search(schema["pattern"], value) is None:
            fail(f"must match {schema['pattern']}")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value < schema.get("minimum", -math.inf) or value > schema.get("maximum", math.inf):
            fail("number outside allowed range")
    return errors

def validate(pack, mode="draft", root=ROOT):
    schema, catalog = read_json(SCHEMA_PATH), read_json(CATALOG_PATH)
    errors = schema_errors(pack, schema)
    if errors:
        return {"errors": errors, "warnings": [], "checks": ["contract schema subset"]}
    # JSON Schema treats 48.0 as an integer; normalize it for Python grid ranges.
    def normalize(value):
        if isinstance(value, dict):
            return {k: normalize(v) for k, v in value.items()}
        if isinstance(value, list):
            return [normalize(v) for v in value]
        if isinstance(value, float) and math.isfinite(value) and value.is_integer():
            return int(value)
        return value
    pack = normalize(pack)
    warnings = []
    registry = {item["id"]: item for item in catalog["primitives"]}
    # Stop before semantic arithmetic if an invocation has malformed parameters.
    # The main schema deliberately defers parameter shape to the registry.
    def preflight(value, context="$"):
        if isinstance(value, dict):
            if "primitiveId" in value:
                entry = registry.get(value["primitiveId"])
                if entry is None:
                    errors.append(f"{context}: unknown primitive {value['primitiveId']}")
                else:
                    errors.extend(schema_errors(value["params"], entry["paramsSchema"], context + ".params"))
            for key, child in value.items():
                preflight(child, context + "." + key)
        elif isinstance(value, list):
            for i, child in enumerate(value):
                preflight(child, f"{context}[{i}]")
    preflight(pack)
    if errors:
        return {"errors": errors, "warnings": [], "checks": ["contract schema subset", "registered primitive parameter schemas"]}
    declared = set(pack["requiresCapabilities"])
    known = set(registry) | set(catalog["presentationCapabilities"])
    used = {"content.raster-reveal.v1", "layout.fixed-arena.v1"}
    if pack["theme"]["animations"]:
        used.add("content.sprite-animation.v1")
    for cap in sorted(declared - known):
        errors.append(f"capability: unknown {cap}")
    effective_ready = mode == "ready" or pack["status"] == "ready"
    if mode == "ready" and pack["status"] != "ready":
        errors.append("status: ready validation requires status=ready")
    def index(items, name):
        result = {}
        for item in items:
            if item["id"] in result:
                errors.append(f"{name}: duplicate id {item['id']}")
            result[item["id"]] = item
        return result
    assets = index(pack["assets"], "assets")
    art = index(pack["revealArt"], "revealArt")
    rules = index(pack["rulesets"], "rulesets")
    levels = index(pack["levels"], "levels")
    index(pack["campaigns"], "campaigns")
    def asset_ref(identifier, kinds, context):
        asset = assets.get(identifier)
        if asset is None:
            errors.append(f"{context}: missing asset {identifier}")
        elif asset["kind"] not in kinds:
            errors.append(f"{context}: asset {identifier} has wrong kind {asset['kind']}")
        return asset
    def primitive(inv, category, context):
        identifier = inv["primitiveId"]
        used.add(identifier)
        entry = registry.get(identifier)
        if entry is None:
            errors.append(f"{context}: unknown primitive {identifier}")
            return None
        if entry["category"] != category:
            errors.append(f"{context}: {identifier} is not a {category} primitive")
        errors.extend(schema_errors(inv["params"], entry["paramsSchema"], context + ".params"))
        return entry
    for asset in assets.values():
        label = "asset " + asset["id"]
        must_exist = effective_ready or asset["status"] == "ready"
        if effective_ready and asset["status"] != "ready":
            errors.append(f"{label}: planned asset cannot pass ready validation")
        if must_exist:
            for field in ["path", "sha256", "byteSize"]:
                if field not in asset:
                    errors.append(f"{label}: ready asset missing {field}")
            provenance = asset["provenance"]
            if provenance["method"] == "planned" or not provenance.get("licenseEvidence"):
                errors.append(f"{label}: ready asset requires completed provenance and licenseEvidence")
            if asset["kind"] in {"image", "spritesheet"} and "dimensions" not in asset:
                errors.append(f"{label}: ready visual requires dimensions")
        if "path" in asset:
            path = Path(asset["path"])
            absolute = (root / path).resolve()
            if path.is_absolute() or ".." in path.parts or ":" in asset["path"] or not absolute.is_relative_to(root.resolve()):
                errors.append(f"{label}: path must remain local inside workspace root")
            elif must_exist:
                if not absolute.is_file():
                    errors.append(f"{label}: missing file {asset['path']}")
                else:
                    data = absolute.read_bytes()
                    if hashlib.sha256(data).hexdigest() != asset.get("sha256"):
                        errors.append(f"{label}: sha256 mismatch")
                    if len(data) != asset.get("byteSize"):
                        errors.append(f"{label}: byteSize mismatch")
        if asset["kind"] == "spritesheet":
            if "spriteLayout" not in asset:
                errors.append(f"{label}: spritesheet requires spriteLayout")
            elif "dimensions" in asset:
                dim, layout = asset["dimensions"], asset["spriteLayout"]
                fw, fh = layout["frameWidth"], layout["frameHeight"]
                if dim["width"] % fw or dim["height"] % fh or layout["frameCount"] > (dim["width"] // fw) * (dim["height"] // fh):
                    errors.append(f"{label}: sprite frames do not fit dimensions")
    planned = sum(asset["status"] == "planned" for asset in assets.values())
    if planned:
        warnings.append(f"{planned} planned assets: briefs only, no production files claimed")
    for role, identifier in pack["theme"]["visualRoles"].items():
        asset_ref(identifier, {"image", "spritesheet"}, "visual role " + role)
    for role, identifier in pack["theme"]["audio"].items():
        asset_ref(identifier, {"audio"}, "audio role " + role)
    index(pack["theme"]["animations"], "animations")
    for animation in pack["theme"]["animations"]:
        asset = asset_ref(animation["assetId"], {"spritesheet"}, "animation " + animation["id"])
        if asset and "spriteLayout" in asset and max(animation["frames"]) >= asset["spriteLayout"]["frameCount"]:
            errors.append(f"animation {animation['id']}: frame index exceeds declared sheet")
    for item in art.values():
        asset_ref(item["sourceAssetId"], {"image"}, "reveal art " + item["id"])
        if item["style"] not in pack["theme"]["imagePolicy"]["allowedStyles"]:
            errors.append(f"reveal art {item['id']}: style excluded by theme")
        if item["style"] == "pixel-art" and item["sampling"] != "nearest":
            errors.append(f"reveal art {item['id']}: pixel-art requires nearest sampling")
        if item["fit"] == "crop" and "crop" not in item:
            errors.append(f"reveal art {item['id']}: fit=crop requires crop rectangle")
        if item["fit"] != "crop" and "crop" in item:
            errors.append(f"reveal art {item['id']}: crop rectangle requires fit=crop")
        if effective_ready and item["fit"] in {"cover", "crop"} and not item["cropApproved"]:
            errors.append(f"reveal art {item['id']}: ready crop/cover needs reviewed crop approval")
        for rect in item["protectedRegions"] + ([item["crop"]] if "crop" in item else []):
            if rect["x"] + rect["width"] > 1 or rect["y"] + rect["height"] > 1:
                errors.append(f"reveal art {item['id']}: normalized rectangle exceeds source image")
        if "crop" in item:
            crop = item["crop"]
            for rect in item["protectedRegions"]:
                if rect["x"] < crop["x"] or rect["y"] < crop["y"] or rect["x"] + rect["width"] > crop["x"] + crop["width"] or rect["y"] + rect["height"] > crop["y"] + crop["height"]:
                    errors.append(f"reveal art {item['id']}: crop cuts protected region {rect['label']}")
    for rule in rules.values():
        primitive(rule["fillPolicy"], "fill", "ruleset " + rule["id"])
        goals = index(rule["goals"], "goals in " + rule["id"])
        for goal in goals.values():
            primitive(goal["test"], "goal", "goal " + goal["id"])
        for identifier in rule["completion"]["goalIds"]:
            if identifier not in goals:
                errors.append(f"ruleset {rule['id']}: completion references missing goal {identifier}")
        if rule["timeLimitSeconds"] == 0 and rule["failure"]["timerExpiry"] != "ignore":
            errors.append(f"ruleset {rule['id']}: untimed board must ignore timer expiry")
    for level in levels.values():
        label = "level " + level["id"]
        rule = rules.get(level["rulesetId"])
        if not rule:
            errors.append(f"{label}: missing ruleset {level['rulesetId']}")
        if level["revealArtId"] not in art:
            errors.append(f"{label}: missing reveal art {level['revealArtId']}")
        grid = level["grid"]
        width, height = grid["width"], grid["height"]
        if width * 3 != height * 4:
            errors.append(f"{label}: grid must match v0.1 arena aspect 4:3")
        border = {(x, y) for x in range(width) for y in range(height) if x in (0, width - 1) or y in (0, height - 1)}
        blocked = set()
        for rect in grid["blockedRects"]:
            cells = {(x, y) for x in range(rect["x"], rect["x"] + rect["width"]) for y in range(rect["y"], rect["y"] + rect["height"])}
            if any(x >= width or y >= height for x, y in cells) or cells & border:
                errors.append(f"{label}: blocked rectangle leaves interior")
            if blocked & cells:
                errors.append(f"{label}: blocked rectangles overlap")
            blocked |= cells
        available = {(x, y) for x in range(width) for y in range(height)} - blocked
        claimable = available - border
        start = (level["playerStart"]["x"], level["playerStart"]["y"])
        if start not in border:
            errors.append(f"{label}: player must start on outer safe border")
        # Static four-neighbor reachability only: no enemies, cut logic or timers.
        seen = {start} if start in available else set()
        queue = deque(seen)
        while queue:
            x, y = queue.popleft()
            for cell in [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]:
                if cell in available and cell not in seen:
                    seen.add(cell)
                    queue.append(cell)
        if claimable - seen:
            errors.append(f"{label}: static grid has unreachable claimable cells")
        enemy_index = index(level["enemies"], label + " enemies")
        modifier_index = index(level["modifiers"], label + " modifiers")
        index(level["markers"], label + " markers")
        occupied = {start}
        for enemy in enemy_index.values():
            entry = primitive(enemy["behavior"], "enemy", label + " enemy " + enemy["id"])
            cell = (enemy["start"]["x"], enemy["start"]["y"])
            domain = entry.get("spawnDomain") if entry else None
            if domain == "field" and cell not in claimable or domain == "boundary" and cell not in border:
                errors.append(f"{label}: enemy {enemy['id']} outside behavior spawn domain")
            if domain and enemy["visualRole"] != ("fieldEnemy" if domain == "field" else "boundaryEnemy"):
                errors.append(f"{label}: enemy visual role mismatches behavior domain")
            if cell in occupied:
                errors.append(f"{label}: overlapping initial entity positions")
            occupied.add(cell)
        for modifier in modifier_index.values():
            primitive(modifier["rule"], "modifier", label + " modifier " + modifier["id"])
        for marker in level["markers"]:
            cell = (marker["at"]["x"], marker["at"]["y"])
            if cell not in claimable:
                errors.append(f"{label}: marker {marker['id']} outside claimable interior")
            if cell in occupied:
                errors.append(f"{label}: overlapping initial entity positions")
            occupied.add(cell)
            for effect in marker["onCapture"]:
                primitive(effect, "effect", label + " marker " + marker["id"])
                identifier, params = effect["primitiveId"], effect["params"]
                if identifier == "effect.clear-modifier.v1" and params.get("modifierId") not in modifier_index:
                    errors.append(f"{label}: effect references missing modifier")
                if identifier == "effect.disable-enemy-tag.v1" and not any(params.get("enemyTag") in enemy["tags"] for enemy in enemy_index.values()):
                    errors.append(f"{label}: effect references missing enemy tag")
                if identifier == "effect.add-time.v1" and rule and rule["timeLimitSeconds"] == 0:
                    errors.append(f"{label}: cannot add time on untimed ruleset")
        if rule:
            for goal in rule["goals"]:
                identifier, params = goal["test"]["primitiveId"], goal["test"]["params"]
                if identifier == "goal.capture-markers.v1" and "targetCount" in params:
                    count = sum(m["tag"] == params.get("markerTag") for m in level["markers"])
                    if count < params["targetCount"]:
                        errors.append(f"{label}: marker goal requires {params['targetCount']}, only {count} exist")
                if identifier == "goal.survive.v1" and rule["timeLimitSeconds"] and params.get("durationSeconds", 0) > rule["timeLimitSeconds"]:
                    warnings.append(f"{label}: survival duration exceeds initial timer; playtest time rewards")
                if identifier == "goal.score.v1" and "targetScore" in params:
                    maximum = len(claimable) * rule["scorePerCapturedCell"]
                    maximum += sum(effect["params"].get("points", 0) for marker in level["markers"] for effect in marker["onCapture"] if effect["primitiveId"] == "effect.grant-score.v1")
                    if params["targetScore"] > maximum:
                        errors.append(f"{label}: score goal exceeds static upper bound {maximum}")
    for campaign in pack["campaigns"]:
        for identifier in campaign["levelIds"]:
            if identifier not in levels:
                errors.append(f"campaign {campaign['id']}: missing level {identifier}")
    for capability in sorted(used - declared):
        errors.append(f"capability: used but undeclared {capability}")
    warnings.append("Runtime primitives are specified, not implemented; no dynamic solvability, image decoding or device performance is certified")
    return {"errors": errors, "warnings": warnings,
            "checks": ["contract schema subset", "registered primitives and parameter schemas", "capabilities and cross references",
                       "asset readiness and local file hashes", "crop and animation metadata", "static grid reachability and goal bounds"]}

def self_test():
    original = read_json(BASE / "examples/fpv-front.pack.json")
    failures = []
    count = 0
    def check(name, pack, expected, mode="draft", root=ROOT):
        nonlocal count
        count += 1
        result = validate(pack, mode, root)
        ok = not result["errors"] if expected is None else any(expected in e for e in result["errors"])
        if not ok:
            failures.append({"test": name, "expected": expected, "result": result})
    for path in sorted((BASE / "examples").glob("*.pack.json")):
        check(path.name, read_json(path), None)
    cases = [
        ("unknown behavior", lambda p: p["levels"][0]["enemies"][0]["behavior"].update(primitiveId="enemy.remote-code.v1"), "unknown primitive"),
        ("missing art", lambda p: p["levels"][0].update(revealArtId="missing"), "missing reveal art"),
        ("impossible marker goal", lambda p: p["rulesets"][0]["goals"][1]["test"]["params"].update(targetCount=3), "marker goal requires"),
        ("bad params", lambda p: p["levels"][0]["enemies"][0]["behavior"]["params"].update(cellsPerSecond=-1), "outside allowed range"),
        ("wrong goal parameter type", lambda p: p["rulesets"][0]["goals"][1]["test"]["params"].update(targetCount="three"), "expected integer"),
        ("boolean is not integer", lambda p: p["rulesets"][0].update(lives=True), "expected integer"),
        ("domain visual mismatch", lambda p: p["levels"][0]["enemies"][0].update(visualRole="boundaryEnemy"), "visual role mismatches"),
        ("bad category", lambda p: p["rulesets"][0].update(fillPolicy={"primitiveId": "effect.grant-score.v1", "params": {"points": 1}}), "not a fill"),
        ("bad border", lambda p: p["levels"][0].update(playerStart={"x": 10, "y": 10}), "player must start"),
        ("injected field", lambda p: p.update(script="download-and-execute.js"), "unexpected property"),
        ("missing capability", lambda p: p["requiresCapabilities"].remove("fill.enemy-seeded.v1"), "used but undeclared"),
        ("animation overflow", lambda p: p["theme"]["animations"][0].update(frames=[9]), "frame index exceeds"),
        ("bad crop", lambda p: p["revealArt"][0].update(fit="crop", crop={"x": 0.8, "y": 0, "width": 0.4, "height": 1}), "rectangle exceeds"),
        ("blocked marker", lambda p: p["levels"][0]["markers"][0].update(at={"x": 20, "y": 14}), "outside claimable"),
        ("missing effect target", lambda p: p["levels"][0]["markers"][0]["onCapture"][1]["params"].update(modifierId="missing"), "missing modifier"),
        ("unreachable pocket", lambda p: p["levels"][0]["grid"].update(blockedRects=[{"x": 20, "y": 14, "width": 5, "height": 1}, {"x": 20, "y": 18, "width": 5, "height": 1}, {"x": 20, "y": 15, "width": 1, "height": 3}, {"x": 24, "y": 15, "width": 1, "height": 3}]), "unreachable claimable")
    ]
    for name, edit, expected in cases:
        pack = deepcopy(original)
        edit(pack)
        check(name, pack, expected)
    integral_float = deepcopy(original)
    integral_float["levels"][0]["grid"]["width"] = 48.0
    check("integer as float representation", integral_float, None)
    check("draft cannot pass ready", original, "requires status=ready", mode="ready")
    ready = deepcopy(original)
    ready["status"] = "ready"
    check("planned cannot pass ready", ready, "planned asset cannot pass", mode="ready")
    # Test file verification using temporary bytes; these are not production assets
    # and intentionally do not claim to test image decoding or visual quality.
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        ready = deepcopy(original)
        ready["status"] = "ready"
        for item in ready["assets"]:
            data = ("test fixture " + item["id"]).encode()
            filename = item["id"] + ".fixture"
            (root / filename).write_bytes(data)
            item.update(status="ready", path=filename, sha256=hashlib.sha256(data).hexdigest(), byteSize=len(data))
            item["provenance"] = {"method": "original-human", "creator": "Temporary validation fixture", "licenseEvidence": "Test fixture only"}
            if item["kind"] in {"image", "spritesheet"}:
                item["dimensions"] = {"width": 128, "height": 32}
        check("ready metadata and hashes", ready, None, "ready", root)
        (root / ready["assets"][0]["path"]).write_text("tampered")
        check("tampered file", ready, "sha256 mismatch", "ready", root)
        (root / ready["assets"][0]["path"]).unlink()
        check("missing file", ready, "missing file", "ready", root)
        ready["assets"][0]["path"] = "../outside.png"
        check("path escape", ready, "path must remain local", "ready", root)
    return {"tests": count, "passed": count - len(failures), "failures": failures}

def main():
    parser = argparse.ArgumentParser(description=__doc__, epilog="Draft validates authoring data; ready additionally verifies asset metadata, local bytes and checksums. It does not run the game or decode media.")
    parser.add_argument("packs", nargs="*", type=Path, help="Local .pack.json files; defaults to the four examples")
    parser.add_argument("--mode", choices=["draft", "ready"], default="draft")
    parser.add_argument("--self-test", action="store_true", help="Run valid examples and deliberately invalid mutations")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable report")
    args = parser.parse_args()
    try:
        if args.self_test:
            result = self_test()
            print(json.dumps(result, indent=2) if args.json else f"Self-test: {result['passed']}/{result['tests']} passed" + ("\n" + json.dumps(result["failures"], indent=2) if result["failures"] else ""))
            return 1 if result["failures"] else 0
        results = []
        for path in args.packs or sorted((BASE / "examples").glob("*.pack.json")):
            result = validate(read_json(path), args.mode)
            results.append({"path": str(path), "mode": args.mode, "valid": not result["errors"], **result})
        if args.json:
            print(json.dumps(results, ensure_ascii=False, indent=2))
        else:
            for result in results:
                print(f"{'PASS' if result['valid'] else 'FAIL'} {result['path']} ({args.mode})")
                for message in result["errors"]:
                    print("  ERROR " + message)
                for message in result["warnings"]:
                    print("  NOTE " + message)
        return 1 if any(not r["valid"] for r in results) else 0
    except (OSError, ValueError, KeyError) as error:
        print(f"Validation failed: {error}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
