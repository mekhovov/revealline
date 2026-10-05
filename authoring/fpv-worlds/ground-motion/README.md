# Optional ground movement correction

Runtime `9b5c3d65e2877847126c87f263fbc7e9aca357fb` adds explicit
`groundMotion: "support-v1"` for patrol, sentry and vehicle actors. Existing
courses retain the absent field, original movement branch, identities and
recordings. [DESIGN.md](DESIGN.md) explains the finite-platform rounding failure,
bounded correction and rejected experiments.

The four readable/generated source changes total 2,464 bytes. Only three are
members of the admitted input inventory: the readable Library is projected into
the reaction runtime. Their actual input growth is 2,422 bytes, projecting
16,744,060 bytes and 33,156 bytes of reserve. The 104-file and 16 MiB ceilings are
unchanged. This projection is not package admission.

## Current evidence

| Evidence                       | Result and limit                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Manual geometry                | 534 passing checks, 66 synthetic cases, 3,000 ordinary native ticks per case. Exact independent partial-practice replay, reset, repeated 60-tick state, and all 264 observed native Worlds freed. No authored course completion claim.                                                                                                                                                                                                 |
| Original Harbor geometry       | Both modes on the unchanged two courses, adding only the opt-in: cart travels 42,004.582 mm and inspector 18,008.401 mm over 3,000 ticks, no blocked or missing-support ticks. Original named supports retained. This is a movement diagnostic, not completed Harbor route proof.                                                                                                                                                      |
| Retained legacy recordings     | Ten unchanged completed recordings replay exactly: Woodland patrol, Container Yard sentry/vehicle, and Festival guide/cart, both modes. The original Festival archive checksum is required.                                                                                                                                                                                                                                            |
| Existing contact-hunt checks   | All nine existing tests pass, including actual swept contacts, independent completed replay, and recovery continuation. No test or assertion was added or weakened.                                                                                                                                                                                                                                                                    |
| Contract/Creator compatibility | 1,372 manual controls retain all 196 catalogue entries, optional-field absence, identities, actual editor callbacks, definitions/reimport, pack/ZIP, malformed/unsupported distinction and cross-policy replay refusal. See the [compatibility handoff](evidence/compatibility/README.md).                                                                                                                                             |
| Actual source browser          | Root's native 8980 run passes all 292 checks: old imports reject before mutation; candidate installs while retaining legacy data; genuine Arm/Pause/Resume and 150-tick completion; actual recording export/import and exact Watch; old/new reopening. Four owners, no errors, warnings or dropped observations; owned renderer resources disposed. Candidate source overlays are explicit. This is not package or offline acceptance. |

Geometry includes finite boxes and narrow supports, walls, ledges, a tested
220 mm gap at the maximum 300 mm/tick request, stacked floors, 150 mm steps,
5 mm headroom and a 1 mm ceiling skin, and 15°/29.9° slopes uphill, downhill,
sideways and on rotated solids. The 30.1° surfaces are refused. It does not claim
universal gap exclusion or every possible imported terrain topology. Ball
support while straddling a step is retained; settling is measured only after the
entire body clears it.

The earlier nine absent-field finite-platform runs are byte-identical to their
original diagnostic cases, including their original stalls. Their receipt pins
an intermediate experimental source; the final source is independently covered
by the retained recordings and 196-entry compatibility check. This distinction
is preserved in the historical archive.

## Bounded CPU observation

The manual ABBA comparison creates twelve actors on the same finite scene and
uses the same 3,000 neutral-input ticks. Fresh Worlds are disposed after each
sample. Native clock measurement includes the ordinary step loop, with no added
recorder or snapshots in that loop. The legacy samples measured 0.18825 and
0.17704 ms/tick; support-v1 measured 0.19532 and 0.19569 ms/tick. Mean difference
was approximately +0.01286 ms/tick for twelve actors on this local run.

Legacy actors stall while opt-in actors continue, so their later poses and
collision-query work differ. This is a cost observation, not an isolated
per-query benchmark, hardware guarantee, browser frame time, input latency or
FPS claim. No quiet-machine or GPU measurement is asserted.

## Reproduce manually

From the repository root with the pinned Node 22 runtime:

```sh
node authoring/fpv-worlds/ground-motion/qualify.mjs /tmp/NEW-ground-motion-cases
node authoring/fpv-worlds/ground-motion/retained-proofs.mjs /path/to/festival-grounds-r5-proof-part-1-of-1.json /tmp/NEW-retained-proofs.json
node authoring/fpv-worlds/ground-motion/observe-cost.mjs /tmp/NEW-ground-motion-cost.json
node --test game/test/fpv-snake-hunt.test.mjs
```

The scripts refuse to replace output receipts. The retained Festival input is
`277503e86f3cb0b9cd60bc405ec41562bed1533c3f8a779391141ac3985884b6`.
The two final manual runners received formatting only after execution.

[Evidence manifest](evidence/manifest.json) records raw and stored checksums for
lossless gzip archives. It retains intermediate failures, causal native contact
traces, original Harbor geometry, the failed frozen-namespace observer, and the
final 66 partial-practice recordings. The separate compatibility manifest keeps
the native 8979 fixture failure: it used the legacy archive parser for a genuine
checksummed v2 export. Native 8980 uses the existing async checksum-aware parser;
the product did not change.

Full package admission, actual admitted entry acceptance and the separately
controlled old cached/offline tail remain pending. Both existing Library feeds
stay unchanged. A later Harbor listing requires its own compatible cohort and
qualified content; it cannot be added to an older surface-only feed. Publication
must remain a Draft under the current human main-merge hold.
