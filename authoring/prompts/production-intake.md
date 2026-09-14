# Production register intake

Use this workflow with the existing thirteen project skills and [shared delivery contract](../../docs/feature-delivery-workflow.md#production-register-intake). These are reusable prose requests, not new prompt CLI IDs or completed asset runs.

## Inspect the slot before producing work

Run from the repository root:

```sh
node authoring/production/cli.mjs report authoring/production/register.json
node authoring/production/cli.mjs inspect authoring/production/register.json --slot picture.sentinel-listening.ukraine
node authoring/production/cli.mjs validate authoring/production/register.json --files
```

Read the exact slot, theme, current binding revision, source owner and outstanding checks. A missing Sentinel theme owner requires a separately authored source variant before binding; artwork alone does not invent its campaign key. The [read-only view](../production/index.html) helps find cells and inspect selected PNGs. Its preview checks one declared source at a time and never records approval.

## Reusable generation request

> Inspect the production register for **EXACT_SLOT_ID**. Describe the intended theme, composition, replacement handle and current missing evidence. Use only the supplied references in their declared roles: target, identity, style, composition or factual source. Produce the authorized original through the available generation tool, retaining its unchanged output, full effective prompt, tool result and provenance. Inspect the actual image and record observed dimensions and findings. Keep scenery separate from playable geometry. Report the exact new files and checks still missing. Do not add an assessment for work you did not perform or count a new theme as new geometry.

For an edit, inspect the target and preserve it first. Keep the generated result at a new immutable path. Record semantic reuse or derivative ancestry even when pixels, crop or compression change. No prompt, concept sheet or rig handle counts as a finished presentation set, playable story, spare original or listened soundtrack.

## Register actual raster work

The [existing media CLI](../media/README.md) imports original bytes and separately produced derivatives. Use `init`, `plan`, `import` or `derive` against an owned manifest; pass actual creator/tool/rights/reference information. Its import computes byte identities. Preserve a versioned metadata snapshot beside the unchanged content-addressed files before adding a production work revision. Reusing a pathname for different historical bytes is refused.

In a **new** candidate register, append the exact work/source/file/dependency/owner records and increment the register revision. Preserve all prior works, bindings, layouts, deliveries and assessments. Validate against the prior register:

```sh
node authoring/production/cli.mjs validate authoring/production/candidate.json --previous authoring/production/register.json --files
```

Use the [documented propose-binding command](../production/README.md#data-and-replacement-workflow) with the actual current binding revision or `none`, exact typed handle and a new output path. It writes an exclusive candidate file; it does not replace the selected register or adopt content into the game. Validate and review that new JSON before committing it. New video/audio formats need an explicit adapter, not fabricated raster metadata.

## Reusable assessment request

> Inspect **EXACT_WORK_ID / WORK_REVISION / SLOT_ID / BINDING_REVISION** using its retained original and named production checks. Record what was actually viewed, decoded, played or heard, the reviewer/date, exact evidence paths and failures. Keep source bytes, native browser behavior, physical devices and human aesthetic/listening judgments distinct. Propose only assessments supported by that inspection, retaining failures until an explicit same-subject resolution. Do not carry old approval to a replacement binding.

Generated-art intake and quality review are separate steps. The browser view is a reader, not an approval interface. Never mass-mark planned cells ready to meet the 29-map, 116-picture, 56-presentation, 12-story, 40-reserve or 24-track targets. Use `report` again to show what actually changed and what remains unbound or unqualified.
