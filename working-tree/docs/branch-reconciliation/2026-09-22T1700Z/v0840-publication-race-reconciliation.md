# v0.84.0 inspection-package reconciliation

Status: diagnosis complete; no asset replacement required. Root Releases made no
tag, release, asset-upload or publication mutation. Both evidence sets remain.

The RevealLine task `01a09328-21d8-7e93-9403-7e6793a4fac2` confirmed that it
dispatched inspection35780429336, created annotated tag
13c6d9632d1f2e41bc32c6b39a5db7999050c76e and draft394095977, uploaded seven
small attachments and dispatched guarded originals upload35780886141. It
interpreted three triggered publisher turns without output as inactivity and
assumed publishing responsibility under its broad user request. No explicit
Playlist-to-RevealLine publisher handoff was cited. Idle snapshots are not a
transfer of the approved sole-publisher role.

Meanwhile the Releases task had explicit bounded qualification/read-only
inspection authority and produced a second package from inspection35780681780.
Both inspections succeeded against the same source1107f570/tree793ee7e and
outer artifact10717823950. Different run IDs, logs, execution paths and evidence
pins yield different evidence-bearing attachments. Comparing the earlier draft
against the later independent package exposed this coordination race, not a
change to game bytes.

Publisher requested a stop. RevealLine stopped further writes; an already
in-flight upload was allowed to finish to avoid interrupting an uncertain POST.
Run35780886141 completed SUCCESS with `ALL_NINE_VERIFIED`. No retry or overwrite
was reported or required. UX and Levels both confirmed zero release mutations.

Root independently reproduced the earlier seven-file package through the exact
frozen-source consumer:54originals/1,869,393bytes, all hashes and CRCs resolved.
Fresh API readback confirmed all nine published descriptors match that package,
and seven independently downloaded small bodies match byte-for-byte. Both
inspection closures (30files each) and upload closure (123files) were verified
against their complete retained manifests, with no missing/extra members.
The two large payloads, manifest, release record and distribution checksum are
identical between packages. Four evidence-bearing assets differ honestly.

Detailed read-only originals and report:
`.cache/v0840-frozen-1107f570/package-race-diagnosis/report.json` in this worktree.
The earlier original package remains at
`/private/tmp/revealline-v0840-small-package-20260922T2030Z`; its independent
reproduction and the later corroborating package are preserved in this
worktree's `v0840-frozen-1107f570` cache.

Playlist independently reviewed the earlier package and published release394095977
at2026-09-22T20:36:42Z. Its prepublish receipt is
`.cache/ux-delivery-review-20260922/v0840-prepublish-review.json` in the shared
repository cache, SHA256
b02cf588182ee52d947e85b7f48bce940a8a96c30dc7957a54f100220b6be274.
Nothing was retagged, deleted, replaced or rebuilt by Releases.

Playlist then explicitly delegated selector-PR preparation only to Releases.
New isolated local branch/worktree `codex/pages-v0840-20260922` starts from
authoritative main1107f570 and is retained as active owner work. No main merge
or Pages deployment is authorized until independent review. Existing Archive51
v0.82.1 occupies590,404,002bytes; preserving v0.83.0 needs a reviewed capacity
solution before selector promotion. No historical-route eviction is inferred.

Playlist explicitly confirmed the standing archive policy and assigned new
Archive52, leaving Archive51 and all older routes untouched. Root independently
reviewed the23-file template and1063-file/590,419,655-byte derived inventory;
the bounded archive-only create/PR/deploy/audit handoff is recorded separately
in `archive52-precreate-review.json`. UX owns a minimal actual native check
only after the deployed archive handoff; extended journeys remain deferred.

Future-release prerequisite found: the unchanged Archive51/52 `tools/verify.py`
accepts only legacy v1 passing source qualifications. That is correct for the
fully qualified v0.83.0 being archived now. Preserving waived v0.84.0 when a
later version becomes current will require a separately reviewed v2-aware
archive consumer; no evidence may be relabeled as passing. Playlist notified.
