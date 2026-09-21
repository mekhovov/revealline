# Rebase onto accepted v0.76.1 UI

PR #208 merged as `d70f3a586f3692a9bef58a87d8181714b62798f5`. The soundtrack
branch was rebased onto it; the integration source before this evidence commit
is `2b23545a5ae51a25f59bee0a1f036e8b9fed5918`.

The only manual conflict was Team menu HTML. The accepted compact lobby stays
intact; the unique Now Playing mount follows its lobby tools inside menu-copy.
The removed briefing is not restored. The independent source review proves that
removing the two music mounts reproduces accepted-main Team HTML exactly, and
checks the automatic Solo, Team CSS and Team scene-adapter overlaps. The complete
focused lobby preview/resize/focus and Couch master cohort passed **62/62**.

All 17 recorded recipe-input, ledger and compiled Git blobs remain byte-identical
to the prior repaired source. The scoped functional recipe reviews therefore
retain their original byte scope; no new music approval is inferred. Native
compact lobby with audible credits and Large text still requires verification
on the resulting frozen release.

The earlier run `35550491178` passed preflight and build at
`2744416d8e74464cc03202a9ebc324991f3f5557`. Its four unfinished shards were
cancelled after this source became obsolete. Original before/after metadata is
retained here; it is not a full-suite qualification. The older failing run
`35549279481` remains separately preserved in the repair evidence.

Fresh full hosted preflight, four test shards and build are required for the new
head. Rebase reapplied sparse exclusions; absent tracked production/library
inputs stay in Git, and large local hydration/builds are deferred below the
1 GiB reserve. Scoped syntax/HTML formatting and game/scripts whitespace checks
pass. An unscoped whitespace audit also flags the deliberately byte-preserved
original provenance and TAP logs; those originals are not reformatted.

The base package version is now **0.76.1**, inherited from accepted main; this
does not allocate a new soundtrack release version. PR #209 remains draft, with
zero approved new recordings. Final version sequencing, frozen/offline checks,
merge and publication remain separate release-owner gates.
