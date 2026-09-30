# Picture Campaign Creator current input qualification

This receipt covers the bounded Phase 6 single-picture Creator workflow. The
tested Creator operation and review-reading bytes were committed as
`7f1a893770518000193f16fb623151526434c2c1`, based on
`6364b42c2b11162aa25b2056bab5f086442c1d98`; the accompanying browser fixture records
the complete journey. It does not qualify every creator,
batch/video intake, an operating-system file picker or a physical controller.

## Problems found and changes

Before the fix, asynchronous Generate and Approve could leave native focus on
BODY. With the production controller navigator engaged, disabling Install let
its normal focus repair choose Sections; the later Install-to-Play helper then
correctly refused to steal that newer focus. A composed production-navigation
reproduction confirmed this failure. Review cards also contained only picture,
map and text, so Sections → Review reached Approve without a controller reading
surface for the generated content.

Creator operations now retain an explicit initiating control and focus the
visible Cancel action while work disables ordinary controls. Completion restores
the enabled opener, or Play after successful installation, only while that same
foreground interaction still owns the operation. New input, focus, blur, hiding,
page departure and controller loss retire the return intent. A failed or canceled
installation consumes its one-use storage review; retry returns to Approve to
obtain a fresh review, while the already approved pack remains exportable.

Each generated mission has Read and scroll, a bounded region containing the
actual picture, map and validation text, and an explicit Back action. The shared
reading owner handles keyboard/controller scrolling and returns to the reading
entry. Leaving reading never approves the pack.

## Automated evidence

The final focused cohort passed **56/56** tests, with no failures or skipped
tests; log `/private/tmp/picture-creator-focused-20260929.log`:

```sh
node --test game/test/creator-operation.test.mjs game/test/creator-player-menu.test.mjs game/test/creator-image.test.mjs game/test/authoring-input.test.mjs game/test/creator-bundle.test.mjs
```

Coverage includes the real navigation adapter during disabled-control frames,
native/controller operation ownership, success/failure/cancel focus, newer-owner
and lifecycle cancellation, explicit review reading without approval, immutable
portable roundtrips, transactional installation, consumed-review retry, retained
source checkpoints, image validation and existing Custom player menu behavior.
Finite DOM checks do not prove browser layout, pixel rendering, actual downloads
or device input. The four manual fixture files passed ESLint, Prettier,
`git diff --check` and a Node module-import check.

The default source collector admitted **1,723 files**, including both new Creator
modules. An Acorn walk from Creator Studio resolved **138 modules / 476 relative
static or literal-dynamic import edges**, with **zero manual fixture files** and
unchanged source hashes during inspection. Receipt:
`/private/tmp/creator-default-build-closure-20260929.json`. This is source-closure
evidence, not a materialized default build, computed-fetch audit, offline install
or native package qualification.

All **14 edition packages** also passed sequential in-memory compilation,
including their offline manifests and normal size admission. The captured
**835 inputs** and six compiler/checker inputs remained unchanged during the run;
inventory SHA-256 was
`bab38a91b5b90631d561fa1248b680dd26218188c5f112d10288e50b3a7622cf`.
Largest output: DroneAid aggregate, **668 files / 66,781,145 bytes**, with
**327,719 bytes** headroom under 64 MiB. No edition admitted manual fixtures.
Receipts: `/private/tmp/edition-package-creator-20260929.json` and its
`-full.json` input inventory. These working-tree captures predate the source
commit; no archive, installed offline run, native binary or publication is
claimed by the in-memory check.
Subsequent verification compared the 835 captured package inputs, six compiler /
checker inputs and the 138-module Creator graph against Git blobs at
`7f1a893770518000193f16fb623151526434c2c1`: **859 unique paths matched**. This
establishes committed-source agreement without implying another materialized
build.

## Final current virtual-controller browser receipt

On 2026-09-29 the in-app browser ran the final frozen source at:

`http://127.0.0.1:8986/game/test/manual/authoring-controller.html?tool=creatorCurrent`

All **three rows passed**. The fixture uses standard-pad button pulses through
production owners; it never focuses/clicks tool targets, invokes domain commands
or changes location to bypass navigation. Its initial iframe focus establishes
the test host. On actual application-link navigation, it reattaches the virtual
pad and passive export observation to the new document. Blob observation keeps
the real download path intact.

1. Canceling the source chooser and a name draft preserved their previous state.
   The built-in Dawn Signal picture was then selected. A blank picture description
   failed validation without losing that File, saving an invalid checkpoint,
   exposing review, or enabling approval/installation.
2. The corrected description generated and saved one real mission. Sections →
   Review entered the reading surface. The picture decoded at **1280 × 640**,
   the rendered map was **720 × 360**, and controller Down moved the bounded
   region from **0 to 77.5 pixels of 78 pixels overflow**. Back restored the
   entry with approval still absent. Explicit Approve and Export produced a
   portable bundle accepted by `importCreatorBundle`, including actual image
   decoding, asset hashes and completion evidence.
3. Explicit Install focused Play and retained the exact edition identity.
   Play opened the Custom landing without starting gameplay. Settings → Help &
   Extras → My creations returned through actual links; the exact installed
   row's editable source reopened, was separately approved, and exported the
   **same edition ID and SHA-256**. All **three pre-existing installed editions
   and ten media references** remained unchanged. There were no pre-existing
   localStorage or sessionStorage keys on this isolated origin.

Final artifact:

- File: `creation-30ee6445-eb5b-41a6-973d-c52439065f03.rlpack`
- Project: `creation-30ee6445-eb5b-41a6-973d-c52439065f03`
- Edition: `11693cfb63bcc9bf4e33038b1cb4714bffa3e958cc1923d563c664064bbe217f`
- Size: **1,464,904 bytes**
- SHA-256: `421ddf2c99292aa731dd637d35f0db9b0ea10c6dbf372c28a4c984103cd411d5`

A preliminary run passed the corrected focus and reading paths but the fixture
then tried Down from the desktop Settings category rail to reach panel content.
That was a fixture error: desktop categories use Right to enter their selected
panel, whereas compact Confirm already drills in. The fixture now uses that
actual direction, without a focus shortcut or application change. An intermediate
complete pass preceded the final operation-retry adjustment; the receipt above
is the fresh final-source rerun.

## Native keyboard, downloads and remaining boundaries

Both actual OS downloads were independently read from
`/Users/oleksandr.mekhovov/Downloads/`:
`creation-30ee6445-eb5b-41a6-973d-c52439065f03.rlpack` and
`creation-30ee6445-eb5b-41a6-973d-c52439065f03 (1).rlpack`.
Each is **1,464,904 bytes** with SHA-256
`421ddf2c99292aa731dd637d35f0db9b0ea10c6dbf372c28a4c984103cd411d5`,
matching the actual browser-importer-validated export Blob. This verifies the
downloaded bytes, not an OS file-picker import action.

Both downloaded files also passed the production `importCreatorBundle` in a
separate Node verification. Its decode boundary used macOS `sips` to decode the
actual PNG to uncompressed BMP and verified every pixel row and complete payload:
**1280 × 640, 640 rows, 3,276,800 decoded pixel bytes**. The importer verified the
same edition, one mission and one asset; downloaded originals remained unchanged.
Receipts are `/private/tmp/creator-virtual-download-first-20260929.json` and
`/private/tmp/creator-virtual-download-second-20260929.json`. This complements the
real browser decode; it is not a native file-dialog workflow.

The separate standalone native-keyboard journey passed source/cancellation,
invalid metadata rejection, valid generation, Read and scroll entry/Escape,
explicit approval, Install → Play focus, the real player Settings → Help &
Extras → My creations return, exact installed-source reopening and reapproval.
These stages used native Tab/Shift+Tab, activation keys and typing, with no
pointer or direct-focus shortcut and no virtual pad. The native viewport had no
review overflow, so overflow scrolling is established by the virtual receipt
above. Reopened source retained **Keyboard Dawn Final** and description
**A dawn valley created using keyboard controls**.

The standalone journey's final Download Enter/Space attempts did **not** produce
an observed OS file, including after a fresh native focus cycle. Therefore a
seamless standalone keyboard-only journey through export remains **unqualified**.
The cause was not established; this observation alone does not justify changing
the production download or Confirm guard.

A separate passive probe then opened the same installed source. Native
Tab/Enter, without pointer or virtual pad, reopened its editable source, approved
and exported successfully. Its trace reported an empty gamepad list, foreground
focus, a trusted Enter and Download click, and an untrusted nested blob-anchor
click. Neither click was prevented. Production input/download code was unchanged.
The reusable diagnostic is
`game/test/manual/creator-download-native-probe.html?draft=<existing-draft-id>`;
it only observes events/Blob creation and requires a same-origin draft. See its
adjacent `.md` for scope and instructions.
The observed run used its temporary draft-specific predecessor. The retained
generic `.html`, `.mjs` and `.md` fixture removes the embedded draft ID in favor
of a validated query; its observation behavior is the same. The generic source
passed lint/format checks, but is not presented as another browser-run receipt.

That focused native export produced the actual OS file
`creation-49cb7cd9-f990-4ca4-8e4f-29783a1fb1a1.rlpack`, **1,464,536 bytes**,
SHA-256 `ba1e6c9b1d47fe3d11b53ac534d7364f7cd66f3f2db63f26a2915a03f207beeb`.
The production importer accepted exact edition
`10089329fa2772a7bf510bc9093b3e01db7166915636f066b9d7a227c1aa20dc`, one
mission and one asset. A complete **1280 × 640** PNG decode scanned all 640 rows
and **3,276,800 pixel bytes**; the downloaded original remained unchanged.
Receipt: `/private/tmp/creator-native-download-first-20260929.json`.
Native Space activation produced the second OS file, `creation-49cb7cd9-f990-4ca4-8e4f-29783a1fb1a1 (1).rlpack`,
also passed the same production import and full decode and was byte-identical
to the first. Additional receipts:
`/private/tmp/creator-native-download-second-20260929.json` and
`/private/tmp/creator-native-download-comparison-20260929.json`.
This proves the separate native export path; it does not retroactively complete
the preceding standalone run.

The native keyboard fixture route adds `&keyboard=1` and installs no virtual pad.
Its complete checklist is in `game/test/manual/authoring-current-workflows.md`.

The browser case retains its new qualification drafts and installed edition on
the dedicated local port 8986 origin. It never clears databases or deletes prior
content. Cancellation in this full browser journey covers the source chooser
and text draft; timed in-flight cancellation/retry is covered by focused tests,
not claimed as a browser action here. Reopening uses the installed editable
source, not an OS-file-picker reimport of the export. Gameplay victory,
batch/video Creator workflows, OS file-picker interaction and physical-pad
qualification remain separate gates.
