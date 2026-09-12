#!/usr/bin/env python3
"""Regenerate the v0.1 schema, primitive catalog and four authoring examples.

Maintainer utility: it overwrites generated files. Author new packs separately.
"""
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

def obj(properties, required=None):
    return {"type": "object", "properties": properties,
            "required": list(properties) if required is None else required,
            "additionalProperties": False}

def arr(items, minimum=0, maximum=1000, unique=False):
    result = {"type": "array", "items": items, "minItems": minimum, "maxItems": maximum}
    if unique:
        result["uniqueItems"] = True
    return result

def string(minimum=1, maximum=2000):
    return {"type": "string", "minLength": minimum, "maxLength": maximum}

def number(lo, hi, integer=False):
    return {"type": "integer" if integer else "number", "minimum": lo, "maximum": hi}

def enum(*values):
    return {"enum": list(values)}

def ref(name):
    return {"$ref": "#/$defs/" + name}

ID = {"type": "string", "pattern": "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$", "maxLength": 96}
VERSION = {"type": "string", "pattern": "^[0-9]+\\.[0-9]+\\.[0-9]+$", "maxLength": 30}
POINT = obj({"x": number(0, 255, True), "y": number(0, 255, True)})
NORMAL_POINT = obj({"x": number(0, 1), "y": number(0, 1)})
RECT = obj({"x": number(0, 255, True), "y": number(0, 255, True),
            "width": number(1, 256, True), "height": number(1, 256, True)})
INVOCATION = obj({"primitiveId": ID, "params": {"type": "object"}})
COLOR = {"type": "string", "pattern": "^#[0-9a-fA-F]{6}$"}

definitions = {
    "asset": obj({
        "id": ID, "kind": enum("image", "spritesheet", "audio", "font", "data"),
        "status": enum("planned", "ready"), "brief": string(),
        "path": string(), "sha256": {"type": "string", "pattern": "^[a-f0-9]{64}$"},
        "byteSize": number(1, 1073741824, True),
        "dimensions": obj({"width": number(1, 32768, True), "height": number(1, 32768, True)}),
        "spriteLayout": obj({"frameWidth": number(1, 1024, True), "frameHeight": number(1, 1024, True),
                             "frameCount": number(1, 4096, True)}),
        "provenance": obj({"method": enum("original-human", "original-ai", "licensed", "public-domain", "user-supplied", "planned"),
                           "creator": string(), "sourceUrl": string(), "licenseEvidence": string(),
                           "promptRef": string(), "reviewNotes": string()}, ["method", "creator"])
    }, ["id", "kind", "status", "brief", "provenance"]),
    "theme": obj({
        "id": ID, "family": enum("fpv-front", "ukraine-atlas", "retro-1994", "navi-network", "custom"),
        "title": string(), "artDirection": string(),
        "cultureNotes": string(), "referenceUrls": arr(string(), 0, 30),
        "palette": obj({key: COLOR for key in ["field", "safe", "trail", "player", "enemy", "objective", "text", "panel"]}),
        "vocabulary": obj({key: string() for key in ["player", "enemy", "capture", "score", "objective"]}),
        "visualRoles": obj({key: ID for key in ["player", "fieldEnemy", "boundaryEnemy", "objective", "menuBackdrop"]}),
        "animations": arr(obj({"id": ID, "assetId": ID, "frames": arr(number(0, 4095, True), 1, 120),
                               "fps": number(1, 60), "loop": {"type": "boolean"}}), 0, 100),
        "audio": obj({"musicAssetId": ID, "cutAssetId": ID, "captureAssetId": ID, "failureAssetId": ID}),
        "presentation": obj({"coverStyle": enum("flat", "dither", "fog", "blueprint"),
                             "spriteSampling": {"const": "nearest"},
                             "motionIntensity": number(0, 1), "crtStrength": number(0, 1),
                             "arenaAspect": {"const": "4:3"},
                             "layoutPolicy": {"const": "fixed-arena-adaptive-chrome"}}),
        "imagePolicy": obj({"allowedStyles": arr(enum("pixel-art", "illustration", "photograph", "scanned-art"), 1, 4, True),
                            "preserveOriginal": {"const": True}, "cropApprovalRequired": {"const": True}})
    }),
    "revealArt": obj({
        "id": ID, "sourceAssetId": ID, "style": enum("pixel-art", "illustration", "photograph", "scanned-art"),
        "title": string(), "caption": string(), "altText": string(),
        "fit": enum("contain", "cover", "crop"), "focalPoint": NORMAL_POINT,
        "crop": obj({"x": number(0, 1), "y": number(0, 1), "width": number(0.0001, 1), "height": number(0.0001, 1)}),
        "sampling": enum("nearest", "linear"), "preserveSource": {"const": True},
        "cropApproved": {"type": "boolean"},
        "protectedRegions": arr(obj({"label": string(), "x": number(0, 1), "y": number(0, 1),
                                     "width": number(0.0001, 1), "height": number(0.0001, 1)}), 0, 50),
        "luminanceTreatment": enum("original", "dim-until-complete", "desaturate-until-complete")
    }, ["id", "sourceAssetId", "style", "title", "caption", "altText", "fit", "focalPoint", "sampling",
        "preserveSource", "cropApproved", "protectedRegions", "luminanceTreatment"]),
    "ruleset": obj({
        "id": ID, "title": string(), "fillPolicy": INVOCATION,
        "lives": number(1, 99, True), "timeLimitSeconds": number(0, 3600, True),
        "playerCellsPerSecond": number(0.5, 60), "scorePerCapturedCell": number(0, 1000, True),
        "cutCommit": enum("hold", "toggle"), "trailContact": enum("lose-life", "cancel-cut"),
        "goals": arr(obj({"id": ID, "test": INVOCATION}), 1, 20),
        "completion": obj({"mode": enum("all", "any"), "goalIds": arr(ID, 1, 20, True)}),
        "failure": obj({"zeroLives": {"const": True}, "timerExpiry": enum("fail", "ignore")})
    }),
    "level": obj({
        "id": ID, "title": string(), "rulesetId": ID, "revealArtId": ID,
        "grid": obj({"width": number(8, 256, True), "height": number(8, 256, True),
                     "safeBorder": {"const": 1}, "blockedRects": arr(RECT, 0, 50)}),
        "generation": obj({"recipeId": ID, "recipeVersion": VERSION, "seed": number(0, 4294967295, True),
                           "note": string()}),
        "playerStart": POINT,
        "enemies": arr(obj({"id": ID, "visualRole": enum("fieldEnemy", "boundaryEnemy"), "behavior": INVOCATION,
                            "start": POINT, "tags": arr(ID, 0, 10, True)}), 0, 30),
        "markers": arr(obj({"id": ID, "at": POINT, "tag": ID, "visualRole": {"const": "objective"},
                            "onCapture": arr(INVOCATION, 0, 8)}), 0, 50),
        "modifiers": arr(obj({"id": ID, "rule": INVOCATION}), 0, 10),
        "difficulty": enum("intro", "easy", "medium", "hard", "expert")
    }, ["id", "title", "rulesetId", "revealArtId", "grid", "playerStart", "enemies", "markers", "modifiers", "difficulty"]),
    "campaign": obj({
        "id": ID, "title": string(), "levelIds": arr(ID, 1, 100, True),
        "progression": enum("linear", "open"), "rewardMode": enum("gallery", "medals", "collection"),
        "fictionalEconomy": {"type": "boolean"}
    })
}

schema = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "urn:xonix-authoring:content-pack:0.1.0",
    "title": "Xonix content authoring pack v0.1.0 (design contract; runtime not implemented)",
    "description": "Local data-only content. Primitive parameters are validated against the separate checked-in catalog.",
    **obj({
        "schemaVersion": {"const": "0.1.0"}, "contentVersion": VERSION, "id": ID,
        "status": enum("draft", "ready"), "title": string(), "summary": string(),
        "requiresCapabilities": arr(ID, 1, 100, True),
        "theme": ref("theme"), "assets": arr(ref("asset"), 1, 500),
        "revealArt": arr(ref("revealArt"), 1, 100), "rulesets": arr(ref("ruleset"), 1, 50),
        "levels": arr(ref("level"), 1, 100), "campaigns": arr(ref("campaign"), 1, 20)
    }),
    "$defs": definitions
}

def primitive(identifier, category, summary, params, spatial=None):
    result = {"id": identifier, "category": category, "status": "specified-not-implemented", "summary": summary, "paramsSchema": obj(params)}
    if spatial:
        result["spawnDomain"] = spatial
    return result

catalog = {
    "catalogVersion": "0.1.0",
    "runtimeImplemented": False,
    "extensionPolicy": "New primitives require reviewed application code, parameter schema, deterministic behavior and tests. Packs cannot contain executable code or load URLs as behavior.",
    "presentationCapabilities": ["content.raster-reveal.v1", "layout.fixed-arena.v1", "content.sprite-animation.v1"],
    "primitives": [
        primitive("fill.enemy-seeded.v1", "fill", "After a closed cut, retain each unclaimed component containing a live field enemy. Claim other reachable components; border and blocked cells are excluded from coverage denominator.", {}),
        primitive("fill.keep-largest.v1", "fill", "After a closed cut retain the largest unclaimed component. Ties retain the component with the first cell in row-major order. Claim other components; remove field enemies in claimed cells without a separate score reward.", {}),
        primitive("goal.coverage.v1", "goal", "Succeed when captured fraction of initial claimable interior reaches targetFraction.", {"targetFraction": number(0.01, 1)}),
        primitive("goal.capture-markers.v1", "goal", "Succeed after targetCount distinct markers with markerTag have been enclosed.", {"markerTag": ID, "targetCount": number(1, 50, True)}),
        primitive("goal.score.v1", "goal", "Succeed when nonnegative score reaches targetScore.", {"targetScore": number(1, 10000000, True)}),
        primitive("goal.survive.v1", "goal", "Succeed after durationSeconds of active play with at least one life.", {"durationSeconds": number(1, 3600, True)}),
        primitive("enemy.bounce-field.v1", "enemy", "Axis-aligned diagonal bouncer inside unclaimed cells; reflect at safe/blocked cells. Touching a live trail applies the ruleset trail penalty.", {"cellsPerSecond": number(0.1, 30)}, "field"),
        primitive("enemy.patrol-boundary.v1", "enemy", "Patrol the outer safe border in the chosen direction; touching player loses one life. Does not seed fill.", {"cellsPerSecond": number(0.1, 30), "clockwise": {"type": "boolean"}}, "boundary"),
        primitive("effect.grant-score.v1", "effect", "Grant points once, when the marker is first captured.", {"points": number(1, 100000, True)}),
        primitive("effect.disable-enemy-tag.v1", "effect", "After filling and marker capture, disable live enemies with enemyTag. This effect does not change the fill algorithm.", {"enemyTag": ID}),
        primitive("effect.add-time.v1", "effect", "Add seconds to a timed ruleset after marker capture; cannot be used on an untimed board.", {"seconds": number(1, 300, True)}),
        primitive("effect.clear-modifier.v1", "effect", "Deactivate a level modifier by ID after marker capture.", {"modifierId": ID}),
        primitive("modifier.speed-scale.v1", "modifier", "Multiply field enemy speed by factor while active; compositional ordering is by modifier ID.", {"factor": number(0.25, 3)}),
        primitive("modifier.cut-timeout.v1", "modifier", "A live cut exceeding seconds applies the trail penalty, then clears the cut.", {"seconds": number(1, 120, True)})
    ]
}

def invoke(identifier, **params):
    return {"primitiveId": identifier, "params": params}

def asset(identifier, kind, brief):
    result = {"id": identifier, "kind": kind, "status": "planned", "brief": brief,
              "provenance": {"method": "planned", "creator": "TBD; original commissioned/generated work reviewed before ready"}}
    if kind == "spritesheet":
        result["spriteLayout"] = {"frameWidth": 32, "frameHeight": 32, "frameCount": 4}
    return result

families = [
    ("fpv-front", "FPV Front: Daybreak", "Ukrainian FPV drone military arcade. Original fictionalized scenes show invading Russian military machinery without portrait likenesses or documentary claims.",
     "Crisp 16-bit graphite machinery, golden fields, blue accents. Pixel silhouettes carry threats; illustration contains static scenery, never collision truth.",
     "Contemporary Ukrainian identity; ornament reserved for safe borders. Geographic layouts and tactical systems are fictional arcade abstractions.",
     ["#122733", "#36A7DC", "#FFDA58", "#FFF18B", "#F86B62", "#B8F5B5", "#F4E7CC", "#192E3C"],
     ["FPV drone", "Invading military patrol", "Secure area", "Mission score", "Signal relay"],
     ["pixel-art", "illustration"], "pixel-art", "dither", "fill.enemy-seeded.v1", "Signal Field", "Original pixel panorama of fields and a fictional invading military convoy; no interface or text.",
     ["https://www.nintendo.com/us/store/products/arcade-archives-volfied-switch/"], "relay"),
    ("ukraine-atlas", "Ukraine Atlas: Living Ornament", "Discover Ukrainian places, art and history through collectible illustrated boards.",
     "Petrykivka-inspired botanical rhythm, a golden bird player, cream paper and restrained green/red details. Distinct historical packs use verified period references.",
     "Avoid treating Petrykivka, pysanka, embroidery and Kosiv ceramics as interchangeable. This first pack explicitly cites Petrykivka; real museum photographs need provenance.",
     ["#183C35", "#F0CF71", "#EDE2B6", "#FFD56B", "#F08B85", "#B1DC9F", "#FFF8E0", "#264A43"],
     ["Golden bird", "Wandering ink", "Uncover", "Discovery points", "Flower medallion"],
     ["pixel-art", "illustration", "photograph", "scanned-art"], "illustration", "flat", "fill.keep-largest.v1", "Garden of Stories", "Original Petrykivka-informed botanical composition; no imitation signature or fabricated museum attribution.",
     ["https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893", "https://collection.nmiu.org/"], "flower"),
    ("retro-1994", "1994 Forever: Amiga Summer", "Collect scenes from an imagined 1980s–1990s computer-game library.",
     "Warm CRT glow, teal shadows, apricot sunlight, expressive chunky sprites. Optional restrained scanlines do not alter arena geometry or text.",
     "Original imaginary hardware labels and game covers; nostalgic visual vocabulary without copying protected game characters or artwork.",
     ["#171D39", "#78D0D4", "#FFD09F", "#FFF2B8", "#F27CC2", "#AFF093", "#F4E5E0", "#2D294E"],
     ["Arcade cursor", "Glitch sprite", "Restore pixels", "High score", "Lost disk"],
     ["pixel-art", "illustration", "photograph"], "pixel-art", "dither", "fill.keep-largest.v1", "Summer Disk", "Original pixel-art computer room at golden hour, imaginary disk cases and cozy summer details.",
     ["https://50games.fun/"], "disk"),
    ("navi-network", "Navi Network: Savings City", "Restore a fictional business network through territory capture, document connections and visible city improvements.",
     "Clean blue/white pixel city, warm workshop lights, expressive assistant silhouette. Use a provisional C character until official brand/Navi assets are supplied.",
     "Currency and AI behavior are fictional arcade metaphors, not product performance or savings claims. Replace placeholder marks using authorized brand assets.",
     ["#11293F", "#70C5EB", "#F3C75B", "#CDEEFF", "#EF8890", "#7ADDAB", "#F7FBFF", "#1E3C57"],
     ["Navi placeholder", "Cost leak", "Reconnect", "Fictional savings", "Matched invoice"],
     ["pixel-art", "illustration", "photograph"], "illustration", "blueprint", "fill.enemy-seeded.v1", "Connected Workshop", "Original inviting business city with suppliers and workshops; no text or numeric savings claims baked into the image.",
     ["https://docs.coupa.com/en/coupa-glossary/overview/c"], "invoice")
]

packs = []
for family, title, summary, direction, culture, colors, words, styles, style, cover, fill, art_title, art_brief, urls, marker_tag in families:
    roles = ["player", "fieldEnemy", "boundaryEnemy", "objective", "menuBackdrop"]
    asset_ids = ["player-sprite", "field-enemy", "boundary-enemy", "objective-sprite", "menu-art"]
    assets = [asset(a, "image" if a == "menu-art" else "spritesheet", f"Original {family} {r}; clear 32 px silhouette, all frames consistent.")
              for r, a in zip(roles, asset_ids)]
    assets += [asset("reveal-main", "image", art_brief)]
    assets += [asset(a, "audio", f"Original {family} audio, clean loop/transient, no copied recordings.") for a in ["music", "sfx-cut", "sfx-capture", "sfx-failure"]]
    goals = [{"id": "coverage", "test": invoke("goal.coverage.v1", targetFraction=0.7)},
             {"id": "objective", "test": invoke("goal.capture-markers.v1", markerTag=marker_tag, targetCount=2)}]
    if family == "retro-1994":
        goals[1] = {"id": "objective", "test": invoke("goal.score.v1", targetScore=800)}
    if family == "ukraine-atlas":
        goals[0]["test"]["params"]["targetFraction"] = 0.6
    effects = [invoke("effect.grant-score.v1", points=150)]
    if family == "fpv-front":
        effects += [invoke("effect.clear-modifier.v1", modifierId="interference")]
    if family == "navi-network":
        effects += [invoke("effect.disable-enemy-tag.v1", enemyTag="leak")]
    if family == "retro-1994":
        effects += [invoke("effect.add-time.v1", seconds=10)]
    pack = {
        "schemaVersion": "0.1.0", "contentVersion": "0.1.0", "id": family,
        "status": "draft", "title": title, "summary": summary,
        "requiresCapabilities": [],
        "theme": {"id": family, "family": family, "title": title, "artDirection": direction, "cultureNotes": culture,
                  "referenceUrls": urls,
                  "palette": dict(zip(["field", "safe", "trail", "player", "enemy", "objective", "text", "panel"], colors)),
                  "vocabulary": dict(zip(["player", "enemy", "capture", "score", "objective"], words)),
                  "visualRoles": dict(zip(roles, asset_ids)),
                  "animations": [{"id": "player-idle", "assetId": "player-sprite", "frames": [0, 1, 2, 3], "fps": 8, "loop": True}],
                  "audio": dict(zip(["musicAssetId", "cutAssetId", "captureAssetId", "failureAssetId"], ["music", "sfx-cut", "sfx-capture", "sfx-failure"])),
                  "presentation": {"coverStyle": cover, "spriteSampling": "nearest", "motionIntensity": 0.25,
                                   "crtStrength": 0.18 if family == "retro-1994" else 0,
                                   "arenaAspect": "4:3", "layoutPolicy": "fixed-arena-adaptive-chrome"},
                  "imagePolicy": {"allowedStyles": styles, "preserveOriginal": True, "cropApprovalRequired": True}},
        "assets": assets,
        "revealArt": [{"id": "main", "sourceAssetId": "reveal-main", "style": style,
                       "title": art_title, "caption": art_brief, "altText": art_brief,
                       "fit": "contain", "focalPoint": {"x": 0.5, "y": 0.5},
                       "sampling": "nearest" if style == "pixel-art" else "linear",
                       "preserveSource": True, "cropApproved": False, "protectedRegions": [],
                       "luminanceTreatment": "dim-until-complete"}],
        "rulesets": [{"id": "standard", "title": "First board", "fillPolicy": invoke(fill),
                      "lives": 3, "timeLimitSeconds": 0 if family == "ukraine-atlas" else 120,
                      "playerCellsPerSecond": 10, "scorePerCapturedCell": 1, "cutCommit": "hold", "trailContact": "lose-life",
                      "goals": goals, "completion": {"mode": "all", "goalIds": ["coverage", "objective"]},
                      "failure": {"zeroLives": True, "timerExpiry": "ignore" if family == "ukraine-atlas" else "fail"}}],
        "levels": [{"id": "first-light", "title": art_title, "rulesetId": "standard", "revealArtId": "main",
                    "grid": {"width": 48, "height": 36, "safeBorder": 1, "blockedRects": [{"x": 20, "y": 14, "width": 4, "height": 4}]},
                    "playerStart": {"x": 24, "y": 0},
                    "enemies": [
                        {"id": "roamer", "visualRole": "fieldEnemy", "behavior": invoke("enemy.bounce-field.v1", cellsPerSecond=3),
                         "start": {"x": 12, "y": 10}, "tags": ["leak" if family == "navi-network" else "patrol"]},
                        {"id": "edge", "visualRole": "boundaryEnemy", "behavior": invoke("enemy.patrol-boundary.v1", cellsPerSecond=2, clockwise=True),
                         "start": {"x": 0, "y": 24}, "tags": ["boundary"]}],
                    "markers": [{"id": "marker-a", "at": {"x": 8, "y": 8}, "tag": marker_tag, "visualRole": "objective", "onCapture": effects},
                                {"id": "marker-b", "at": {"x": 36, "y": 26}, "tag": marker_tag, "visualRole": "objective", "onCapture": [invoke("effect.grant-score.v1", points=150)]}],
                    "modifiers": [{"id": "interference", "rule": invoke("modifier.cut-timeout.v1", seconds=8)}] if family == "fpv-front" else [],
                    "difficulty": "intro"}],
        "campaigns": [{"id": "chapter-one", "title": title, "levelIds": ["first-light"], "progression": "linear", "rewardMode": "gallery", "fictionalEconomy": family == "navi-network"}]
    }
    # Every declared capability is a contract ID, never a claim that the runtime exists.
    primitives = set()
    def collect(value):
        if isinstance(value, dict):
            if "primitiveId" in value:
                primitives.add(value["primitiveId"])
            for child in value.values():
                collect(child)
        elif isinstance(value, list):
            for child in value:
                collect(child)
    collect(pack)
    pack["requiresCapabilities"] = sorted(primitives | set(catalog["presentationCapabilities"]))
    packs.append(pack)

# A second registered image in Atlas proves photographs can coexist with pixel sprites.
atlas = packs[1]
atlas["assets"].append(asset("reveal-photo", "image", "Planned licensed photograph of Ukrainian ceramic work; record exact maker, institution and image license before ready."))
photo = dict(atlas["revealArt"][0])
photo.update({"id": "ceramic-study", "sourceAssetId": "reveal-photo", "style": "photograph", "title": "Ceramic study (planned)",
              "caption": "A licensed photograph will be selected and documented; no provenance is claimed yet.",
              "altText": "Planned close view of Ukrainian ceramic work.", "sampling": "linear"})
atlas["revealArt"].append(photo)

def write(relative, value):
    path = BASE / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

if __name__ == "__main__":
    write("schema/content-pack.schema.json", schema)
    write("schema/primitive-catalog.json", catalog)
    for pack in packs:
        write(f"examples/{pack['id']}.pack.json", pack)
    print("Wrote schema, catalog and four draft example packs. No runtime or ready assets were created.")
