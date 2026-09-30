# Local-source reconciliation — 30 September 2026

The requested fetch/rebase at `3dbf92d39f0e254d8925cd44e806866a0cf71cd6`
was already up to date and the primary checkout was clean. Later main advanced
through #816 to `451b82dc13dc8a8545ff964ffb724d3d756ac62a`; another owner's
mission-selector follow-up then began in the shared primary. This audit does
not stage that work or claim that all active checkouts remain clean.

## Working/index census

The 04:46 UTC snapshot inspected 268 registered worktrees: 107 dirty, 43 with
meaningful changes, 1,275 meaningful paths / 1,180 unique blobs, and 1,158 dirty
index entries. Compared with the previous audit, 82 Levels variants were already
in advertised GitHub history. Of 28 Pause-owner paths, nine merge-result variants
had no remote match: five staged results and four conflicted paths. Those were
active owner work, not permission to overwrite or commit the unfinished merge.
Later Levels source was pushed as #820. Recheck active owners at final handoff.

Historical recovery remains public at
`117d892e8bb140a1c30b574f1b23bba280d0adfe`; its local traversal was complete.
One registered temporary checkout was missing and was recorded as inaccessible.
Ten descendants in the wider advertised-history traversal were unavailable
locally, so negative matches were bounded rather than universal absence claims.
Original temporary census files were removed during concurrent disk recovery;
these are retained findings from the audit, not a new full-tree census.

## Committed residue

Two formerly local-only tips are now independently verified with `git ls-remote`:

| Preserved ref | Exact tip | Disposition |
|---|---|---|
| `codex/preserved-native-integration-20260930` | `1c70bc3a92cc6e36247badb80d17e9371b40c46d` | Historical cumulative integration; inspect missing intended hunks only. |
| `codex/preserved-radio-release-input-20260930` | `26e64d3d81e24597fab4cdf2d53efa5e9d4217c3` | Historical radio/catalogue input; retain current version and ownership authority. |

Neither ref is a release source or a wholesale merge recommendation. The prior
comparison identified 29 unique final-file variants across these tips. Source
preservation resolves recoverability, not whether each variant belongs in the
current game. Current-owner feature PRs carry runtime adoption and acceptance.

## New stash dispositions

Ten stashes were observed versus seven in the prior recovery checkpoint:

| Added stash | Disposition |
|---|---|
| `3200a3967df31d8a997bf52daf3e0dcff2f7740a` | Levels report duplicates remotely preserved source. |
| `f095979b40906fd95f1c0dbfd841d77ceb7434f2` | Localization checkout corruption quarantine; empty/deleted files are not intended product changes. |
| `859df669131559460ecacd787cf81b1439c333d0` | Two unique failed diagnostic files, preserved below as evidence only. |

The [failed Demo diagnostic](failed-demo-diagnostic/preservation.json) retains
the exact JSON report and a readable helper snapshot. Only the helper's absolute
workstation path is redacted; original and stored hashes are recorded. `.txt`
keeps it an archival document, not an installed script. The historical attempt
reported `Changed game/app.mjs`; its failure and `releaseAdmitted: false` remain
unchanged. It is not a current test or a release-quality certificate.

## Verification boundary

Review covers the scoped documentation diff, JSON validity, retained byte hashes,
relative links and absence of workstation paths in the new packet. Independent
#816 review passed twelve isolated pinned-object checks and linked 498 modules
without executing the app; [its PR receipt](https://github.com/mekhovov/revealline/pull/816#issuecomment-5904286436)
states the limits. No full runtime suite, browser/device acceptance or immutable
release was completed by this reconciliation task.
