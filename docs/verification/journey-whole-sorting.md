# Whole Journey — Sorting successor integration

2026-09-22. `whole-spatial-v5` is an explicitly labeled candidate test route, not
a replacement for published content or a human-validated balance verdict.

## Delivered

- The reviewed [Sorting Yard redesign](journey-rover-sorting-spatial.md) is now
  part of normal Solo/Versus sequential play, not only a Studio preview.
- 91 missions remain: 71 core, twelve optional Remixes and the two four-mission
  Ukrainian-inspired ornament / FPV workshop arcs. Only Sorting's map/runtime
  changes. The other 90 mission manifests and all original asset pins are preserved.
- The build-time compiler composes the reviewed donor into an immutable authored
  delta. Browser hosts parse that data and use the normal shared compiler; no
  expensive candidate construction runs during boot. CLI, Studio, async and
  synchronous route resolution agree.
- V5 has separate progress and suspended-flight keys; all historical route golden
  hashes, including v4, remain unchanged. Existing editions remain selectable.
- Studio's existing combined-Journey card now selects v4 or v5, with an
  edition-neutral Inspect label. No additional card or compulsory player menu.
  Both explicit player links keep the selected edition across Solo/Versus.

## Verification

All twelve Sorting recordings retain their exact original checkpoint hashes in
the combined source, public replay verification and equal independent race
boards. Six ordinary and six mastery paths span all presets and both steering
modes. The accepted-return mastery observer remains test evidence, not an
automatic player award. Greybox/pictured canonical composition agrees exactly.

Actual host tests feed fresh keyboard input through production Solo/Versus
handlers. A complete Standard/Immediate mastery route wins, records only its
mode's receipt and continues directly into First Fracture with one Next. No
chooser appears, and transition controls start rearmed/stopped. Two-action Skip
reaches the same next campaign without awarding a clear; finding Sorting again
starts a fresh attempt. Nonempty prior-v4 receipt/skip storage fixtures remain
unchanged. These are hermetic host tests, not physical two-person sessions.

Native browser evidence at localhost 8846: v5 title accurately says unvalidated
test build, chooser lists 91 missions and finds Sorting with one global search,
card selection starts play directly, and the first Skip pauses for an explicit
“First fracture / no clear” confirmation. The second starts the new campaign
without a menu. Its optional brief confirms First Fracture, and reloading the
same bookmark shows “Continue · Fractured Grid · First fracture.” No debug state
mutation, native full-clear claim or timing benchmark is involved.

The ten snapshot/build-guard tests pass: exact regeneration, immutable historical
outputs, both artwork editions, read-only validation, and refusal to replace a
playable build with stale or changed-after-validation data. Changed JavaScript
passes ESLint and the diff is whitespace-clean. Full device/human testing and
actual release/Pages promotion remain the existing release owner's gates.

Final eight-file regression cohort: 127 passing tests on each of Node 20.19.5
and 22.22.2, exit 0. It covers new candidates/hosts, route loader/library, old
whole-variety candidates/hosts, old whole-spatial hosts and picture-entry wiring.
The 14 navigation tests and ten snapshot/build-guard tests also pass on Node 20.
The initial navigation invocation omitted the sparse preload and failed on absent
historical `game/content/campaign.json`; rerunning with the existing read-only
exact-commit fixture fallback passes. No source assertion was weakened. This
fallback is the same one documented in the Sorting study, not runtime injection.
Generated source: 528,831 bytes, SHA-256
`e62ef45089df1bbaea04cceb932949fbe8d29377a4eeefcac8280125006495b3`.
Independent review additionally matched all twelve original recording hashes and
found no production compatibility or navigation blocker.

## Remaining

Public distribution and exact-build verification; optimized cleanup, broader
starts and human difficulty/enjoyment across this and the other campaigns;
physical controllers, small screens, accessibility and two-person qualification.
This closes one-map whole-route integration, not P05/P13 or the overall plan.
