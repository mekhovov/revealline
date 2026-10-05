# Overflight shared resource reuse proof

Verified on 2026-10-05 against the working candidate based on main
`2d447bc790bdf3951251c99041c8a918363ece0a`.

## Executable cross-mode example

Run:

```sh
node --test game/test/overflight-reuse.test.mjs
```

The two tests pass. The positive test constructs a valid new ThemeBundle in
memory using the existing shared presentation APIs. It takes the generated
`authoring/library/overflight-field-kit-v1/pickup-supply-case-closed.png`
directly from the asset manifest, without copying the painter implementation or
re-creating its pixels. Its exact identity is:

| Field                      | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| Asset revision             | `overflight.field-kit.supply-case@1`                               |
| PNG size                   | 16 × 16; 148 bytes                                                 |
| SHA-256                    | `67779d1280a630872326086fbcd3bd9a58aeba77dd273a218aa1b30d4e98d8bc` |
| Overflight slot            | `pickup.supply-case-closed`                                        |
| Existing Solo slot         | `pickup.supply`                                                    |
| Compatible recipe contract | `pickup.icon.v1`                                                   |

Both bindings select the same immutable asset record:

```json
{
  "pickup.supply-case-closed": {
    "id": "overflight.field-kit.supply-case",
    "revision": 1
  },
  "pickup.supply": {
    "id": "overflight.field-kit.supply-case",
    "revision": 1
  }
}
```

The complete sample bundle is produced by `reuseFixture()` in the test. It
uses the existing slot geometry and validates through `validateThemeBundle`.
`compilePresentation` verifies the PNG bytes and emits one hash-addressed image
file for the two bindings. `createPresentationHost({ profile: 'board' })`
fetches and decodes that image once and shares it between both slots.

The test then supplies the resulting snapshot to the real Solo `BoardPainter`.
It separately supplies the same selected asset through Asset Studio's existing
`createStudioContextPresentation` adapter. Both paths issue the same native
16 × 16 supply-image draw at the same board coordinates. The authoritative
Solo checkpoint remains unchanged, and the shared bitmap closes exactly once.
The negative test rejects binding this 16-pixel image to the existing 24-pixel
`pickup.life` contract; reuse does not bypass compatibility validation.

This is an API and actual painter-command proof. Browser bitmap decoding and
Canvas2D rasterization are modeled by test doubles. It is **not** a captured
visual demonstration of another native mode, and it does not install a new
default theme, change saved preferences, or rewrite historical compiled art.
The registered default bundle is checked for immutability. All compilation is
in memory; the test writes no output files.

## Build dependency closure audit

A read-only Acorn walk started from:

- `game/overflight/play.html`
- `game/studio/overflight.html`
- `authoring/motion-lab/index.html`
- `authoring/asset-studio/index.html`

The walk included literal imports/exports, literal dynamic imports, literal
module-relative `new URL` calls, HTML resources and `data-module` tool launchers,
CSS URLs, the shared compiled runtime's hash-addressed URLs, and all 13 generated
Overflight PNG manifest entries. Current working files took precedence over the
verified main tree. Build inclusion followed `game/build-config.json` and the
existing exclusion of `game/test` and `game/offline`.

Result: 519 reachable JavaScript/HTML/CSS files and 1,861 static dependency edges;
zero excluded dependencies, zero unresolved bare imports, and zero parse errors.
The new Motion Lab panel, Asset Studio preview, Phaser 4.2.1 vendor file, native
Overflight modules and all generated PNGs are covered by existing or added
build includes. Vendor code was treated as an existing included leaf.

The sole apparent absent static URL was the pre-existing
`native/bridge.mjs`. `game/platform.mjs` loads it only on iOS, and
`scripts/native-cli.mjs` adds it during verified iOS staging. It is intentionally
absent from the web source build. No new missing browser dependency was found.

Computed resource paths remain a separate runtime concern: 12 computed
URL/import sites were recorded, including the established shared tool launcher,
body/scene loaders and boot selection. Overflight's new computed URL helper
only constructs the registered main-game, Snake and Overflight Studio
destinations, all inside the included `game` tree. The tool launcher entries
were resolved from their HTML `data-module` attributes in this audit.

No full distribution build or native stage was generated because available disk
space was constrained. This audit establishes source/build inclusion closure;
it does not replace built-distribution, offline-installation, GPU or target
hardware qualification.
