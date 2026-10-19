# Preserve the published Duel context in host assertions

This test-only correction aligns two expected strings with the already published
Duel contract. The three gentle/standard/expert opening cases still require an
exact summary: `Capture · Duel · One race · First return`. The two completed
Journey cases still require the earned mode wording, now `earned Duel originals`.
All exact board, count, other-mode exclusion, asset, checkpoint, receipt, focus,
input, artwork-failure and progression assertions remain unchanged.

The baseline is captured main `e7465da3e4b1146b492f401fbb165a5e5a4a6202`.
Its context owner was already committed by
`ee6999522b7b218d6c836a3b262dcaeb83ae855e`; its English Duel name by
`f167987b976db8c4627e1ad2b79173e555041f13`. The original host file, its
15 direct relative dependencies and the picture-gallery module are byte-identical
to that main source. Thirteen actual Couch launch/progression/context owners and
the relevant original locale values were also compared exactly.

The motivating F10 candidate's complete adjacent file produced 9 passes and
5 failures, all at these obsolete text expectations, with no skipped/cancelled
cases or protective guard. That is not an actual baseline native test result.
The corrected complete baseline file passed **14/14**, with zero skipped or
cancelled cases, on actual captured main e746 plus this two-path patch. Its exact
source manifest `b7bbfd93ce640b831ce412ff7f2dd00d48350783b6b33cb1457b52533600c470`
was unchanged before and after. TAP duration was 86,865.174 ms; sampled peak
process-group RSS was 1,220.5 MiB. The 1,536 MiB V8 / 2,048 MiB RSS / 180-second
wall protective limits did not trigger. Full output, including the intentional
artwork-failure diagnostics, was retained in the execution receipt.
The initial two-path commit changes no production code, helper, catalogue, timeout or package. The extension below adds only a test metadata fixture and ID helper.
Full repository validation and current-main integration remain pending.

The same published-menu boundary also affects three complete adjacent files.
Their correction uses the visible native Missions action and its actual returned
preparation promise, preserving controller/pointer input and exact Back focus.
The current Team action is still the same anchor and destination, with the
published Team label and 2P badge; its retired descriptive child is not a live UI
contract. The single paused-Journey legacy opener in the Next fixture is replaced
by visible Missions without changing its launch or replacement assertions.

Library inventories are expected from independent metadata, never rendered card
counts. `duel-library-membership.json` pins only pack/campaign/mission membership
and hashes of its authored inputs at e746. Its default Journey membership combines
83 entries from `WHOLE_SPATIAL_ORIGINAL_JSON` and the eight explicit optional
entries from `WHOLE_SPATIAL_CULTURAL_WORKSHOP_JSON.original`; v25 retains their
stable identities. Opening selects the authored Horizon core/remix owners.
Prior editions use the exported curated history. Expedition membership is pinned
from the pure chapter/layout registries and reviewed campaign-part ownership:
72 Duel missions and 96 Team missions. Twelve retained Team missions keep their
explicit original/specialist campaign owners. Hunt uses its six registered stage
IDs, and the two Classic Team arenas keep the authored starter pack revision.
No source factory, compiled execution, geometry, image or host constructs the
expected inventory. The helper uses only pinned metadata and canonical ID primitives, retains only
IDs/modes/lifecycle/collection, and checks uniqueness
and exact membership with no extras. Current and historical membership remain
separate. Source hashes document provenance rather than making unrelated artwork
or geometry revisions part of these expectations.

The former all-Versus-equals-Solo assertion predates the 72 Duel Expedition and
six Duel Hunt missions. Both full mode inventories are now checked independently;
their shared qualified missions must still retain exactly the same order.
The Team handoff still selects the exact retained Journey or Classic owner, even
when newer Expedition missions precede it. Original checkpoint, input, stale
owner, storage, receipt, artwork-failure and navigation assertions remain.

Before this extension, the complete F10 default-entry file produced 7/10 passes
and three failures: obsolete summary copy, a hidden retained link activation,
and a retired mode-description selector. Six later cohort files were not run.
Four files (mode-return departure/recovery, localization, start cue) have no such
retired selectors and remain unchanged. The later per-file receipts below qualify the extension on captured e746;
no feature or whole-cohort pass is inferred.

Classic membership is pinned independently from the source index: 164 Original
identities and 132 explicitly compatible Current-rules identities. The metadata
fixture records its ruleset allowlist, archived source/pack policy and exact
input hashes. Shared owner/edition/campaign components are grouped without
removing any mission revision, mode or lifecycle. The runtime expectation helper
calls neither `classicLibrarySources` nor `createMissionLibrary`, so a production
registration omission cannot also remove the expected row. Only canonical opaque
ID encoding is shared with production. No current-rule gameplay projection runs.

At the refined metadata manifest
`a107e87af546dba2dca7a1c95e6db2cb3c363a7bbbe4132bccfb8923686dc35e`,
the complete default-entry file passed **10/10** on captured e746 runtime
(41,910.427 ms; sampled peak 1,145.3 MiB; no guard). The complete library file
then produced **14/19**, not a cohort pass (112,500.610 ms; peak 1,483.1 MiB;
no guard). One introduced caption expectation was wrong: actual Legacy boot
retains the original strict `Select Mission` caption, which is restored.
Three installed cases failed before host boot because their Node fixture used
the browser-default decoder without an Image environment. The optional case's
PNG-only Image fixture rejected the existing JPEG Base picture. The complete
Next file was not run after this failure. All six failed-candidate source blobs
are retained at `refs/codex/evidence/duel-fixture-a107-0` through `...-5`.

The bounded repair adopts the existing continuous-Next fixture's explicit
nonbrowser image-header/dimension decoder for pack preparation and its external
host. The local optional Image model validates both embedded MIME/header data
and owned typed blob bytes with the existing inspectors, then exposes their
actual dimensions. Valid/error callbacks remain asynchronous; URL ownership and
revocation remain with their existing map. The pinned Base and Night Shift
pictures are JPEG; the selected optional pack contains PNG pictures. No missing
media, new download, pixel decoder or production behavior is substituted.
These modeled Node boundaries do not qualify browser pixel decoding or artwork
appearance. All installed-owner, Stay/Replace, held-download, checkpoint,
picture, focus, input and retry assertions remain. The later complete library/Next rerun is recorded below; no earlier failure
is reclassified as a pass.

## Qualified per-file evidence on captured e746 runtime

Each complete file used a fresh Node 22 process and retained every case, with
zero skips/cancellations, exit 0 and no protective guard. No single combined
rerun, current-main or full repository result is claimed.

| Complete file                          | Result | TAP duration   | Sampled group peak | Source scope                                                         |
| -------------------------------------- | ------ | -------------- | ------------------ | -------------------------------------------------------------------- |
| `candidate-versus-host.test.mjs`       | 14/14  | 86,865.174 ms  | 1,220.5 MiB        | Initial e746 + b7bb two-string fixture patch; unchanged by extension |
| `versus-default-entry.test.mjs`        | 10/10  | 41,910.427 ms  | 1,145.3 MiB        | a107; file and metadata/helper inputs unchanged by media correction  |
| `mission-library-versus-host.test.mjs` | 19/19  | 169,740.238 ms | 1,837.2 MiB        | edb999 corrected media fixture                                       |
| `versus-continuous-next-host.test.mjs` | 9/9    | 57,659.086 ms  | 1,060.0 MiB        | edb999                                                               |

The latter two used exact manifest
`edb99919977c826c073cd6163b8e77447896d53e56f7587435efda36a46ddd81`
before and after, on fixture predecessor
`24753ce6e646ceb8dea073fef2857bf97a0f2ea7` with e746 runtime. Guards remained
1,536 MiB V8 old-space and 2,048 MiB process-group RSS. The library file had an
approved 300-second wall guard for its full 19-case scope; the other files used
180 seconds. Original case timeouts and all source/runtime owners are unchanged.
Full bounded stdout/stderr was retained, including intentional error diagnostics.
The final receipt update changes documentation only. Changed-file lint,
formatting and whitespace checks pass. Full repository gates, newer-main
integration and independent F10 feature qualification remain pending.
