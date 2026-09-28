# Artwork collection packets

Asset Studio's **Artwork collections · source candidates** panel imports a JSON
packet together with every named original image, previews a verified source, and
exports a portable `.rlart` packet. It can also prepare a separate board-sized PNG
derivative from a retained reveal image. Import an export to recover the same
declarations and retained bytes. Choose the JSON and images in one file-selection
operation; a portable `.rlart` is selected alone.

This is a separate, unsaved authoring draft. It neither changes the Studio's
`.rltheme` workspace nor supplies a mission, approved pin, runtime binding or
release decision. Export it before leaving. Historical presentation readers and
compiled collections are unchanged and reject this format. Runtime adoption of
the policy requires a separately versioned integration.

## Versioned policy and provenance

`revealline-artwork-collection.v1` has exact required fields:

```json
{
  "format": "revealline-artwork-collection.v1",
  "id": "community-source",
  "revision": 1,
  "name": "Community source collection",
  "treatment": "pixel-art",
  "sources": [],
  "artworks": []
}
```

The empty `artworks` above illustrates field names only; a valid packet contains
1–16 artworks. `createArtworkCollection()` defaults treatment to `pixel-art`.
Serialized packets must declare the treatment explicitly. A `photograph` requires
both `photographic-reveals` collection treatment and a `reveal` role. Actor and
interface photographs are rejected. Photographic collections may also include
pixel art. These are author declarations, not automatic medium detection or
visual approval. Changing treatment in Studio advances the packet revision and
preserves every original file and the currently selected artwork.

Each `sources` entry has:

```json
{
  "id": "reference-site",
  "use": "reference-only",
  "creator": "Source creator",
  "source": "https://example.org/source-page",
  "license": {
    "status": "unverified",
    "name": "No reuse permission established",
    "url": null,
    "evidence": "Visual reference only; no source image pixels incorporated."
  }
}
```

`use` is `reference-only` or `incorporated`. Public availability alone never
establishes reuse permission. Incorporated material must declare a reuse basis:
`public-domain`, `licensed`, `permission` or `original`, with a name and evidence.
`unverified` is allowed only for reference-only external sources. These fields
record the author's claim; schema validation does not verify legal permission.
Source and optional license links must be HTTPS without credentials. The importer
never fetches them, and reference links are not image payload locations.

Each `artworks` entry has this shape (file facts below are placeholders):

```json
{
  "id": "workshop-original",
  "role": "reveal",
  "medium": "pixel-art",
  "file": {
    "name": "workshop-original.png",
    "sha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "bytes": 1,
    "mime": "image/png",
    "width": 1,
    "height": 1
  },
  "provenance": {
    "origin": "generated",
    "creator": "Actual creator or generator",
    "license": {
      "status": "original",
      "name": "Original generated source candidate",
      "url": null,
      "evidence": "Record the actual source and rights basis."
    },
    "sourceIds": ["reference-site"],
    "derivative": null,
    "prompt": "Retain the complete effective generation prompt."
  }
}
```

Roles are `reveal`, `actor`, `interface`; media are `pixel-art`, `photograph`.
Origins are `original`, `generated`, `derivative`. Generated originals require a
nonempty effective prompt. Derivatives require
`{"parent":"retained-artwork-id","changes":"Actual changes"}`; their parent
artwork and its ancestor chain must remain in the same packet. Missing parents
and cycles are rejected.
Every source ID resolves to a structured source declaration. Source artwork needs
a declared rights basis; unknown permission cannot become usable artwork merely
by importing it.

## Original-byte and lifecycle boundaries

The reader accepts static PNG, JPEG and WebP through the existing bounded image
header guard. Each file is at most **4 MiB**, each side at most **8192 pixels**, and
each image at most **16 million pixels**. A packet holds at most **16 artwork
files total**, counting originals and derivatives, 32 reference declarations,
**32 MiB of combined file payload** and 256 KiB of metadata.
Metadata has bounded strings, depth and node counts; executable fields, getters,
unexpected keys, paths, duplicate names and unknown versions are rejected.

All supplied original byte counts, SHA-256 hashes and static headers are checked
before any image decode. Native browser decoding must then agree with the declared
dimensions. Node tests inject a dimension decoder; those tests do not qualify image
appearance. Oversized originals are rejected visibly during import; the separate
derivative operation cannot bypass that intake limit.
For example, the retained 4,590,659-byte Synevyr photograph exceeds this particular
importer's 4 MiB limit and is not a supported original here.

The `.rlart` transport uses eight-byte `RLART1\r\n` magic, a big-endian four-byte
metadata length, canonical UTF-8 JSON and then retained payloads in `artworks`
order. It contains no archive paths or executable content. Truncated and trailing
bytes fail import. Export re-verifies retained originals and derivatives and
copies them unchanged.

## Prepare a board derivative

After importing a valid collection, select a retained artwork with role `reveal`.
Under **Prepare board image**, choose the output size and fitting policy, then
choose **Create board candidate**. The operation appends a separately identified
PNG and advances the collection revision. It selects the verified result for
inspection while retaining every existing file byte-for-byte. Actor and interface
artworks are not supported by this board preparation operation.

| Choice                | Result                                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Wide                  | Native output frame of 1152 × 576 pixels (2:1).                                                                        |
| Classic               | Native output frame of 768 × 576 pixels (4:3).                                                                         |
| Fit (`contain`)       | Uniformly scales the complete source to fit, centered over opaque ink `#08131e`; unmatched space becomes letterboxing. |
| Centre crop (`cover`) | Uniformly scales to fill the frame and crops the excess equally from opposite outer edges.                             |

Both choices preserve aspect ratio; neither stretches artwork or changes a
mission's logical dimensions. The chosen plan is rejected if its uniform scale
would exceed 1. The tool never upscales a small source to manufacture detail or
silently switches fitting policy.

Sampling follows the selected parent's declared medium: `pixel-art` uses
nearest-pixel sampling with Canvas smoothing disabled; `photograph` uses smooth
sampling at high quality. A photograph still requires explicit
`photographic-reveals` collection treatment. There is no automatic medium
classification. The result is a native-sized PNG, not proof that a generated
scene has been reconstructed on a coherent pixel grid.

Before rasterization, the operation re-verifies retained byte counts, SHA-256
hashes, static headers and decoded dimensions. It re-verifies the appended result
and whole collection before acceptance. The 16-file, 4-MiB-per-file and
32-MiB-total limits include derivatives and their retained parents. Capacity,
decode, encode, cancellation or stale-operation failure preserves the previously
accepted collection. Decode/draw/encode has a 15-second timeout; temporary image
URLs and canvases are released on every settled exit. Reference URLs are never
fetched as image inputs.

The new record has `origin: "derivative"` and a `derivative.parent` pointing to
the selected retained artwork. It inherits the parent's role, medium, creator,
license and source IDs. Its existing `derivative.changes` string records a
`board-derivative.v1` plan: board/fit choices, original/output dimensions, source
and destination rectangles, ink background, sampling, tool name,
`native-canvas-png` encoder and `candidate-not-production-approved` review status.
This uses the existing packet schema; it does not migrate historical readers.

The actual encoded PNG determines its byte count and SHA-256. Browser sampling
and native encoders may differ, so the same plan does not promise identical bytes
or hashes on another browser. Preserve and reimport the exported `.rlart` to
recover the exact accepted result, rather than regenerate it. A parent hash is
never substituted for a derivative hash.

Generated Ukrainian cultural scenes remain candidates after this preparation.
They still need deliberate cleanup of native pixel clusters, palette and edges,
plus cultural-detail and real-board readability review. Nearest-pixel reduction
alone does not complete that work. This operation does not approve art, resolve
rights claims, produce a `.rltheme`, assign an approved pin, replace campaign
artwork or authorize publication.

## Preview and departure

The preview fits the complete selected retained file with letterboxing. Pixel-art declarations
use nearest-neighbor display sampling; photographic declarations use normal image
sampling. Neither modifies source bytes or proves native-grid quality. Rights,
creator, source use, original facts, derivative parent and prompt remain visible.

Import and export expose progress and cancellation. Failed or stale imports retain
the previously accepted collection. Temporary decode URLs are revoked on success,
failure or cancellation; displayed image and download URLs are released on
replacement and departure. A browser back/forward-cache return stays without a
decoded preview until **Show source** is chosen. There is no remote source fetch,
save-data write, campaign change or approval promotion.

Implementation: `authoring/asset-studio/artwork-collection.mjs`,
`artwork-derivative.mjs` and `artwork-panel.mjs`. Focused verification:
`node --test game/test/artwork-collection.test.mjs`.
