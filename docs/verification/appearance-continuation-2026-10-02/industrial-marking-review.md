# Industrial marking kit: static browser review

On 2026-10-02 the parent agent inspected the exact authoring kit with the actual
in-app browser. This receipt supplements the immutable produced
[`r1/manifest.json`](../../../authoring/fpv-worlds/industrial-markings/r1/manifest.json);
it does not rewrite its original pre-review status or approve runtime adoption.

The GLB SHA-256 is
`57da4671dbb4c3a2aafb96785eb1bf83d14719106279e6fd0f9720800f9a5bf2`.
The embedded PNG SHA-256 is
`ca090b130e686168dedab0350a177a038c41038a3d6bdbf96fe2afb6c756c473`.
The viewer verifies the actual GLB bytes against that manifest before parsing.

| View | Observation | Capture |
| --- | --- | --- |
| Gate plate detail | Chevrons and rivets are clear; plates remain separate from the reference aperture. | [Gate detail](industrial-marking-gate-detail.png) |
| Landing pad | H, ring and orientation triangle are identifiable. | [Pad](industrial-marking-pad.png) |
| Grazing pad | The H remains discernible at the supplied grazing camera position. | [Grazing view](industrial-marking-grazing-pad.png) |
| Unlit neutral wedge | The five texture grays visibly align with the five linear-factor reference swatches. This is visual calibration, not a measured colorimeter result. | [Neutral wedge](industrial-marking-unlit-wedge.png) |

## Decoder and security boundary

The initial browser load failed because the pinned GLTFLoader selected
ImageBitmapLoader, which uses `fetch(blob:...)`. The ordinary server permits blob
images through `img-src`, but its `connect-src` policy does not permit those fetches.
The swallowed image-load error left a null material map; the viewer incorrectly
described it as a color-space error.

The authoring-only `loader.mjs` now configures the same pinned GLTFLoader to use
Three's TextureLoader image-element decoder. The browser then decoded the exact
embedded PNG under the existing image policy. Missing-image and wrong-color-space
diagnostics are separate. No CSP, vendor loader, source model, texture, installed
collection, simulation geometry or proof data changed.

The Node regression uses the real GLTFLoader and checks the exact embedded PNG,
image-element loader selection and assigned sRGB material. Only its final browser
image callback is modeled. The marking suite has six passing tests, including
Khronos validation, glTF Transform readback, exact regeneration, original bounds,
the existing preparation pipeline and immutable successor receipts. Those tests
do not replace these actual browser captures.

## Remaining gates

This is static authoring inspection only. No flight adoption, moving/grazing
temporal sampling, distance readability, performance percentiles, GPU plateau or
physical-device acceptance was performed. The default runtime textured-GLB path
still requires CSP-compatible integration and qualification; the viewer setting
does not establish that behavior in other hosts.

An independent Khronos viewer displayed its standard helmet, but the accessible
local-file flow did not accept this kit. Therefore no independent rendering-engine
result is claimed. The Khronos validator is an independent standards check, not
that missing rendering comparison. Production use still requires a reviewed new
collection revision and exact dependency closure, retaining the installed r1
appearance and authored fallback.
