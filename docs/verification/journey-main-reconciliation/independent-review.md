# PR225 main reconciliation — independent bounded review

**No concrete correctness blocker found in the reviewed conflict resolution.** This is a read-only source/artifact review of the uncommitted worktree `.cache/worktrees/journey-delivery-checkpoint`, comparing exact main `f22a47e570f14cee79fdd41e5676c6b58d0a8112` with unpublished checkpoint `e1eaf90460e50fd0717fab435e7aa4d1fe5808b2`. No tests, generators, builds, source edits, index writes or promotion actions were performed.

`begin.json` and `end.json` record 54 reviewed source/artifact hashes at the start and end of the pinned review window. None changed. Initial orientation preceded the beginning snapshot; the substantive byte comparisons and final review below use that stable window. A final independent check also verifies all 130 files listed by the compiled manifest against their recorded sizes/hashes.

## Lineage and bytes

The archive has the exact single regular-file payload from e1eaf904 Git: the 7,754,923-byte production bundle, SHA256 `622de0a5b0eced6f92aab94dc1f982270c0f8bb889f121af6926967edb229959`. Archive SHA256 `ce0a71b49c38225e41e15f7fdbd6f481d89065460b45aa1e83be38b89f813be3` matches its fixture. No archive path is selected by build include rules; references are historical documentation/quality-evidence strings and the new test/fixture, not a runtime import or fallback.

Canonical current production advances accepted main56 to57 exactly once. Every main slot, asset, theme and collection prefix is unchanged: 293 slots, assets1493→1510, themes57→58, one collection. The archived e1 theme55–58 records are deliberately not merged into those occupied canonical IDs. The README accurately distinguishes the two edition lineages by commit/bundle hashes and does not pretend numeric theme revisions alone identify the same edition. No padding or relaxed transition validator is introduced.

All three bundles—main56, archived e1e58 and canonical57—contain the same 127 payload hashes and exact bytes. Independent envelope parsing checks their lengths and payload digests. Canonical bundle SHA256 is `e2539ea2152bf5a8715621089f6d09eefba0d30b80f2a13dbbd47fa27b33f0d9`; main bundle is `4f560512a46ff03bdc50f750067d85ebd1afc47b7fa7f888e34f82153a04182d`.

## Runtime composition

All 14 audio fingerprint source inputs are byte-identical to accepted main, including soundtrack model/default selection and soundtrack-panel CSS. The eight selected audio asset records also match main exactly. Supplemental read-only comparison confirms `game/library.mjs` and `game/ui/music.mjs` match main. Current ordered audio fingerprint is `1128ede72e1d687690a3832d84b240bd8013be643bb9a21b430fe6875adcac94`. All five current recipe fingerprints match the producer's explicit review pins; this checks identity, not additional review scope.

The six existing Team source frames retain the same asset IDs, revision2, PNG hashes, dimensions/geometry records and bytes as the e1 checkpoint and compiled runtime. Team painter, shared presentation host and strict model are byte-identical to e1. Picture bindings change only the exact admitted canonical theme revision58→57 and explanatory comments; pack/level identities, picture IDs/hashes and contain semantics are retained. No archived-edition fallback is added. The three related test changes update only the expected exact canonical theme identity; the substantive image/hash and import checks remain intact.

Package/build version remains0.82.0 relative to the e1 checkpoint. This review does not authorize a version change or publication.

## Test-oracle review and limits

`presentation-main-reconciliation.test.mjs` meaningfully authenticates the entire archive, reconstructs canonical main and successor only after independently pinned group hashes match, checks complete exported bundle hashes, enforces strict56→57 transition, distinguishes conflicting theme55/56/57 records, checks unique identities and all original payloads, preserves selected main audio records, and rejects archive inclusion in the deployed input set. Historical reconstruction remains usable when later canonical records append; it does not widen active production authority.

The README explicitly keeps verification pending and attributes older CI/native evidence to its predecessor. Owner-reported Node20 focused59/59 and ongoing broader cohorts were not independently rerun or promoted to final-head acceptance here. The worktree still has unmerged index entries while the owner resolves/stages the merge; this review concerns the stable working-file bytes, not a finished merge commit. Final integrated producer checks, full gates, native/offline behavior and exact committed-head/public acceptance remain owner responsibilities.

Detailed independent comparisons and pins: `proof.json`, `begin.json`, `end.json`. No actionable defect or test-weakening request resulted from this bounded review.
