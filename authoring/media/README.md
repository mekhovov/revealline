# Local asset authoring tool

Media manifest version **1.0.0** · Python **3.9+**, standard library only.

This working CLI imports raster originals without changing their bytes, registers separately produced derivatives, binds visual roles to asset variants, and checks provenance, references, paths, hashes and image-header metadata. It does not run AI, edit pixels, implement an upload screen, or render a game.

The media manifest is a **separate format** from the [v0.1 content-pack contract](../CONTRACT.md). Neither the existing pack validator nor a game runtime consumes it. An explicit, tested content-compiler integration is future work. The enemy and terrain role names describe visual slots, including proposed rule extensions; declaring or binding them does not implement those behaviors.

## Start with a theme

Choose a template and copy it into a library directory before editing:

- [FPV FRONT](examples/fpv-front.media.json): realistic FPV avatar with an optional pixel derivative, fictional invading infantry/equipment variants, concrete/mud/wire terrain objects, and uploaded scene originals.
- [UKRAINE ATLAS](examples/ukraine-atlas.media.json): bird/charm avatar, researched cultural materials, folkloric threats, landscape/artwork/photo originals.
- [1994 FOREVER](examples/retro-1994.media.json): original arcade craft, robots, cassette/circuit/CRT objects, retro scenes.
- [NAVI NETWORK](examples/navi-network.media.json): planned approved Navi/brand artwork, fictional spend-leak agents, paperwork/archive objects, business-city images.

Each template has **27 planned assets and 31 bindings**. No file paths, hashes, produced images, rights approvals or visual reviews are invented. Planned derivatives name their planned source; import that source before registering an actual derivative. The templates cover player variants, enemy characters/equipment, all three terrain materials, reveal layers, active trail, contour, pickups, UI, capture-effect sources and separate marketing art.

```sh
mkdir -p authoring/media/work/fpv-front
cp authoring/media/examples/fpv-front.media.json authoring/media/work/fpv-front/theme.media.json
python3 authoring/media/media.py validate authoring/media/work/fpv-front/theme.media.json
```

Or start empty, with the default visual-role vocabulary:

```sh
python3 authoring/media/media.py init authoring/media/work/custom/theme.media.json --id custom-media --theme custom-theme
```

`init` refuses to replace an existing manifest. A library consists of its JSON manifest and a sibling `files/` tree; keep both together when moving or backing it up. Relative image paths are resolved against the manifest's own directory, not the current working directory.

## Import a background or avatar

Replace the `/absolute/path/...` arguments below with actual files you own or are authorized to use. `--creator` and `--rights` record your supplied provenance; the tool cannot verify legal ownership.

```sh
python3 authoring/media/media.py import authoring/media/work/fpv-front/theme.media.json --asset reveal-source --source /absolute/path/your-original.jpg --creator 'Actual creator' --rights 'Actual source and permission evidence'
python3 authoring/media/media.py import authoring/media/work/fpv-front/theme.media.json --asset player-source --source /absolute/path/your-fpv-avatar.png --creator 'Actual creator' --rights 'Actual source and permission evidence'
```

Import copies the source bytes into `files/originals/<sha256>.<detected-format>`. The source filename is recorded as provenance; the detected format, not the filename extension, determines the managed extension. PNG, JPEG, GIF and WebP raster headers are supported, up to 64 MiB per input. The tool records width, height, byte count, MIME type and SHA-256. It does not recompress, rename, crop or modify the external source.

A planned asset with the same ID is fulfilled in place, preserving its bindings. Once an asset is produced, its ID cannot be reused by the CLI to replace its content. Use a new ID for a revised original, then rebind the selected role/variant. Identical file bytes in the same original/derivative store may share their content-addressed file. There is no deletion or garbage-collection command.

Assets may also carry author-supplied `subjectAllegiance`: `ukrainian`, `hostile-military`, `neutral`, `mixed`, `not-applicable`, or `unconfirmed`. `plan`, `import` and `derive` accept `--allegiance`; omitting it preserves an existing planned asset's label when fulfilled. An explicitly supplied value replaces that planned label. These are authored identity declarations, never classifications inferred from an image or automatic Z-symbol detection. The FPV template labels player art `ukrainian`, enemy art `hostile-military`, reveal art `mixed`, and UI/material art `not-applicable`; its military briefs explicitly exclude Z markings.

```sh
python3 authoring/media/media.py plan authoring/media/work/custom/theme.media.json --asset player-source --brief 'Realistic Ukrainian FPV avatar, no Z markings' --allegiance ukrainian
```

## Register an optional style derivative

Create the styled image explicitly in your chosen editor or AI image tool first. Inspect the source before requesting an AI edit, record the effective prompt and actual model/tool used, and save the new result separately. The following command **registers an existing result**; it does not invoke that model or perform the style change:

```sh
python3 authoring/media/media.py derive authoring/media/work/fpv-front/theme.media.json --asset reveal-pixel-art --parent reveal-source --source /absolute/path/separate-pixel-result.png --method ai --tool 'Actual image tool' --model 'Actual model and version' --prompt-file /absolute/path/effective-prompt.txt --creator 'Actual operator and tool attribution' --rights 'Actual derivative rights/source note'
```

For an artist-produced or deterministic conversion result:

```sh
python3 authoring/media/media.py derive authoring/media/work/fpv-front/theme.media.json --asset player-pixel --parent player-source --source /absolute/path/separate-pixel-avatar.png --method manual --tool 'Actual editor/version' --creator 'Actual artist' --rights 'Actual derivative rights/source note'
```

Accepted derivative methods are `manual`, `ai` and `conversion`. AI requires both a nonempty effective prompt and a model name; those fields are rejected on non-AI records. Every produced derivative records its parent asset ID and the parent's current SHA-256. Derivative chains are allowed, must terminate in an original, and cannot contain cycles. A produced derivative cannot depend on an unproduced parent. A planned derivative cannot silently switch its parent during fulfilment.

Derivatives are stored separately under `files/derivatives/`. Every import/derivative starts at `imported`; registration never claims visual review or production readiness. A valid provenance record establishes an auditable claim about the input, not proof that a model followed its prompt.

## Bind replaceable visuals

Bindings are keyed by **role + variant**. Assets can be reused by multiple bindings. Every role is declared in the manifest's `roles` object, so authors can add visual slots without changing this tool or the game code. The role description and binding have no executable expressions or physics parameters.

```sh
python3 authoring/media/media.py bind authoring/media/work/fpv-front/theme.media.json --role player.avatar --variant realistic --asset player-source --sampling linear
python3 authoring/media/media.py bind authoring/media/work/fpv-front/theme.media.json --role player.avatar --variant pixel-art --asset player-pixel --sampling nearest
python3 authoring/media/media.py bind authoring/media/work/fpv-front/theme.media.json --role reveal.display --variant default --asset reveal-source --sampling linear
python3 authoring/media/media.py bind authoring/media/work/fpv-front/theme.media.json --role reveal.display --variant pixel-art --asset reveal-pixel-art --sampling nearest
python3 authoring/media/media.py role authoring/media/work/fpv-front/theme.media.json --id decoration.weather --description 'Decorative atmosphere only; no collision or visibility rule'
```

For example, `enemy.field` can select `infantry` or `equipment` artwork without changing an enemy's registered behavior, collision bounds, speed, HP or score. `terrain.wall`, `terrain.slow` and `terrain.danger` can show concrete, mud and wire objects instead of glyphs. Those rules must remain separate and taught; changing their images cannot redefine which entities pass through them. A realistic avatar can use linear filtering while its pixel variant uses nearest sampling.

`bind` replaces only the matching role/variant reference, preserving other variants. Its `--sampling` and `--fit` flags explicitly set those presentation fields; other existing presentation metadata is retained. Binding a planned asset is valid in a draft. No binding changes what appears in a game yet because runtime integration is not implemented.

## JSON format

The top-level fields are mandatory and unknown fields are rejected:

| Field | Meaning |
|---|---|
| `mediaVersion` | Exactly `1.0.0`; independent of content-pack `schemaVersion`. |
| `id`, `themeId` | Lowercase dot/hyphen identifiers, maximum 128 characters. `themeId` is descriptive association, not an integrated pack reference. |
| `roles` | Nonempty map from visual-role identifier to a human-readable description. |
| `assets` | Local array of uniquely identified planned, imported or reviewed originals/derivatives. |
| `bindings` | Array of unique role/variant references with presentation metadata. |

This is a complete valid minimal draft:

```json
{
  "mediaVersion": "1.0.0",
  "id": "drone-media",
  "themeId": "fpv-front",
  "roles": {"player.avatar": "Player artwork only; physics belongs elsewhere."},
  "assets": [{
    "id": "drone-source",
    "kind": "original",
    "status": "planned",
    "subjectAllegiance": "ukrainian",
    "provenance": {"method": "planned", "brief": "A realistic FPV quadcopter with transparent background."}
  }],
  "bindings": [{
    "role": "player.avatar",
    "variant": "realistic",
    "assetId": "drone-source",
    "presentation": {"sampling": "linear", "fit": "contain"}
  }]
}
```

Produced assets add `file` with `path`, `sha256`, `bytes`, `format`, `mimeType`, `width` and `height`. Assets may optionally add the `subjectAllegiance` enum described above. Their provenance requires `method`, `creator`, `rights`, `recordedAt` and `sourceName`; derivatives additionally require `parentAssetId`, `parentSha256` and `tool`, plus `effectivePrompt`/`model` for AI. Timestamps require a timezone. Do not manually invent identity fields: the import/derive commands compute file identity and source hash.

Presentation requires `sampling` (`nearest`/`linear`) and `fit` (`contain`/`cover`). Optional JSON fields are `anchor` (two normalized coordinates), `scale` (0.01–100), `opacity` (0–1), and `rotationOffsetDegrees` (−360–360). These describe visual placement only; `scale` never changes a collider or a board cell. `cover` can crop artwork and still needs a real visual crop review. Atlas/frame layout, animation, crop/protected-region metadata, shader settings and audio are not included in this initial raster authoring format. The current content-pack contract's independent crop requirements still apply to a future integration.

## Review and validation

```sh
python3 authoring/media/media.py validate authoring/media/work/fpv-front/theme.media.json
python3 authoring/media/media.py review authoring/media/work/fpv-front/theme.media.json --asset player-source --reviewer 'Actual reviewer' --note 'Actual findings about silhouette, transparency, provenance and minimum-size readability'
python3 authoring/media/media.py validate authoring/media/work/fpv-front/theme.media.json --ready
```

`review` records an explicit attestation with a reviewer, timestamp and note. It cannot review a planned asset or perform the inspection for you. The `--ready` gate requires at least one binding and every asset to be `reviewed`; it intentionally fails on all supplied templates. A normal draft validation still checks every produced file, even if other assets remain planned.

Validation checks IDs, duplicate JSON keys, known fields, version, status/provenance compatibility, derivative ancestry and parent hashes, role and asset references, unique variants, presentation ranges, exact content-addressed paths, file existence/bytes/SHA-256, format and dimensions from headers. Managed paths cannot use traversal, absolute paths, Windows separators or symlinks. Produced IDs and existing content-addressed files are never overwritten by import. Existing manifests are validated before mutation and saved atomically; a sibling `.lock` prevents simultaneous CLI writers. If a process crashes, inspect the inactive process/manifest before manually removing its stale lock.

These checks do not fully decode images or prove alpha/transparency, frame layout, visual quality, copyright clearance, accessibility, performance or runtime compatibility. A file with a plausible raster header can still fail to decode in an image editor; open and inspect production exports. Imported bytes are preserved, but the filesystem is not an immutable archive: external edits are detected by hash validation, not prevented. An interrupted registration may leave an unreferenced content-addressed file; it does not overwrite another asset, and automatic cleanup is deliberately absent.

Recorded dimensions are encoded raster-header dimensions; EXIF orientation is not interpreted here. The future image preview/compiler must verify displayed orientation and decoded dimensions before approving crops or producing platform exports.

Commands print a compact JSON success summary. Exit codes: **0** success, **1** data/file/validation failure, **2** invalid CLI arguments. There are no network requests, subprocess-based converters, AI calls or package dependencies.

## Verify the tool

```sh
python3 -m unittest discover -s authoring/media -p 'test_*.py' -v
python3 authoring/media/media.py validate authoring/media/examples/fpv-front.media.json
python3 authoring/media/media.py --help
```

See [verification record](VERIFICATION.md) for executed checks and their scope.
