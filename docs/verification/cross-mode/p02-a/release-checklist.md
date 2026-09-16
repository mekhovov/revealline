# P02-A release checklist

This is an uncompleted handoff checklist, not approval or an instruction to bypass the active owner. Follow the [phase register](../../../cross-mode-execution.md), [shared master contract](../../../shared-master-audio.md), [delivery workflow](../../../feature-delivery-workflow.md) and current publication controller. Historical example versions in those documents are not today's selector or a reusable tag.

## Close the candidate source

- Preserve P01 ownership and wait for its actual acceptance/integration. Merge the selected current source and its production history without dropping loading, cancellation, focus or release-controller fixes. Keep the allocated v0.58.0 metadata provisional until the actual source/version/tag boundary is checked; never overwrite an existing release.
- Hold the final related source and record full commit/tree plus changed-path review. Include the authority, host persistence, Solo/Studio/story, Versus/Team, Asset Studio, tests and guidance. Verify packaging includes new runtime modules. Leave later playlist/album work outside P02-A.
- Reconcile the `0.01` shared-master steps and input/change behavior across all hosts. Re-run complete affected files on that held source; keep the historical receipts and native discrepancy intact. Do not relabel earlier 53/85/46 batches as this final source.
- Recompute audio provenance with `audio-master.mjs` as a direct input. Keep P01 UI reviews and all prior assets/revisions immutable. Supply the actual scoped P02-A review, then run the canonical producer only within its authorized capacity boundary. Inspect generated differences before accepting them; all unrelated art and compiled asset bodies should remain unchanged.
- Require `node scripts/produce-field-kit-theme.mjs --check`, the complete affected production/history/readiness tests and `node scripts/check-field-kit-readiness.mjs` on the resulting committed ledger. A stale producer or the currently failing actual-approval test is a blocker, not a fixture to weaken.

## Verify player behavior

- In Solo and Studio, master mute must silence active and pending music/audition without changing selected track, queue, position or local faders. Explicit music Pause must survive master changes. Repeat the native `0.01`/`0.13` round trip, close/reopen and navigation/reload, retaining the stored record and visible value together.
- Test an actual saved/draft Asset Studio audio pair with different local faders. Change master, replace one preview, Stop during preparation and settle old work. Check effective audible output, independent cleanup and no late playback. A DOM setter succeeding does not prove iPhone attenuation.
- Exercise victory/Collection video with the actual original, cinematic fader, duck lease and late Play completion. Master attenuation applies once; close/Skip releases only owned media and never changes awards or the parent music Pause.
- Visit Versus and Team Options through keyboard and controller navigation; verify master persistence without starting a race, resuming a paused game or writing Solo progress. Team's current absence of an audio producer remains explicit. Check authoring controls during busy operations and failed storage warnings beside the active controls.
- Check hidden/visible transitions, browser history, nested practice, rejected native Play and explicit retry. A preference event may change output policy but cannot call Play. Validate storage refusal/session-only state, stale profile adoption and unrelated-tab event rejection. Keep deliberate Pause distinct from lifecycle suspension.
- Retain exact browser source/URL, operations and observations. Separate actual audible playback/decoding from visual transport progress and source tests; separately record physical controller/touch and supported iOS/device checks. Qualify ordinary capture/continued flight and relevant save/recovery journeys without input-state shortcuts.

## Require the final source gates

The inspected workflow is `.github/workflows/deploy-pages.yml` at the candidate base. On source PRs it checks out the exact PR head, pins the verifier/runner to `github.workflow_sha`, and records tracked content/mode identity before and after preflight, each of four shards and build. Recheck the workflow after integration rather than assuming it is unchanged.

The six source checks are `npm run validate`, `npm run lint`, `npm test`, `npm run format:check`, `npm run format:native:check`, and `node --check authoring/motion-lab/app.js`. The workflow also checks the production ledger, immutable production tests and ordinary `npm run build`. Four passing full unfiltered shards can provide the test leg only with exact discovery/partition and raw identities retained. The independent build does not wait for all shards, so a green build alone does not imply the suite passed. Treat authoring files outside package lint/format globs explicitly in scoped static checks.

Preserve every failed job and qualified retry. Capture final head/tree, workflow automation identity, commands, runtimes, counts and before/after raw identities. These local receipts do not replace those gates or supply a canonical `source-qualification` receipt.

## Freeze and publish through existing tooling

After source and native gates are actually satisfied, the release owner must bind the final source and fresh capacity to `node scripts/game-cli.mjs release-snapshot --ref FULL_SHA --version vX.Y.Z`. Follow [snapshot staging](../../../snapshot-staging.md): same-filesystem admission is `T + S + U + Z + B + R + G`; EXDEV needs another `T`. Recompute actual source/site/ZIP/intermediate allowances and archive budgets. Do not borrow old totals, duplicate large artifacts or infer permission from this checklist.

Preserve annotated tag/source and all original source TAR, distribution ZIP, release metadata and checksum bytes. Verify the actual outputs and frozen browser journey; publish only the qualified original assets through the release owner's tested path. Prepare new original metadata with `publishing/pages-controller/sync-release-metadata.mjs` only after those assets exist, and preserve catalog/tag/qualification pins and the latest-stable guard.

If retaining the prior public edition requires an archive change, deploy and fully verify that archive and its routing before enabling main forwarding. Keep native/archive acceptance separate from inventory hashes. Use a reviewed controller-only selector change; `publish.mjs verify --preview` is deliberately non-publishable. Only the actual main-branch publisher may deploy. Its hosted 8 GiB guard is not permission for an undersized local build.

After actual deployment, bind the controller commit, successful run/deployment, game source and complete public inventory. Verify all deployed bytes and fresh/cached native entry, ordinary play, save/return and applicable offline behavior. Only then update the phase acceptance record with its real scope. Physical-device and listening gaps stay visible even if source, build and HTTP checks pass.
