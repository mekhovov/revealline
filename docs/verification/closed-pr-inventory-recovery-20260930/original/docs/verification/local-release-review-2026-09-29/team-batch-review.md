# Team readability source batch review — 2026-09-29

## Decision

No actionable source defect found in the reviewed batch. It is appropriate to fast-forward the existing draft PR757 branch to aa32c591e7a7b57dabc2ab122d0125f0a35fbbf5, retaining a hold for release qualification. No new overlapping PR is needed.

Reviewed current branch codex/team-readability-batch-20260929 in the gallery-v133-verify worktree. git merge-base --is-ancestor confirms PR757 head8e15bc7523c39a33ecc2a5d457f24b0d99bdc170 is an ancestor. The batch incorporates main6a67d6dbfe01d5e1f3842b5a79dd5d5ddeefcfd8. No branch, worktree, source or helper was changed by this audit.

## Scoped source findings

- 885105e84: coopCueScale in game/couch/coop-actor-layout.mjs:6–17 applies Large after the existing CSS clamp, leaving cell geometry unchanged. coop-view.mjs:197 accepts/validates the setting before drawing and scales text, label plates and spacing. relay-rescue.mjs:1522 forwards the actual shared preference. Standard command parity, larger measured labels, protected pilot/contact bounds, crowded label behavior and invalid setting handling are covered by tests.
- The same commit adds relay-rescue.mjs:761 to collapse More when utilities are hidden or pause is entered. It retains main's existing Help rule at758–760, avoiding the earlier proposal to close Help on every paused refresh. The focused More and paused Help tests passed.
- 0e13057b7: relay-rescue.mjs:4347–4356 centralizes current knockdown guidance. Resume at4377–4381 restores the current downed player's cause or the existing ordinary direction instruction. The event path uses the same caption. Focused tests cover both players, Settings/Resume, replaced advisories, reserve and partner revival, Retry isolation and current-rules specialist causes without world advancement.
- 552d5faa0: team-contextual-teaching.mjs:111–118 requires an actual slowed enemy or intercepted impact before completing Support learning. It retains the existing v1 introduced/completed schema, storage key and callbacks. This avoids the incompatible acknowledged-field donor discussed separately. Empty/no-effect and effective Support persistence tests passed.
- The reviewed batch leaves current controller guard/lifecycle/router/navigation/trace files byte-identical to main6a67d6d. No Steam Deck protocol rollback found.
- Resume commit0e13057b7 and Support commit552d5faa0 have identical stable patch IDs to remote8a143fe951b28ea36c18b4138650c9187032d9f2's parent and head respectively. Preserve one source line rather than scheduling duplicates.

## Focused checks

Command1:

```sh
node --test --test-concurrency=1 game/test/coop-actor-layout.test.mjs game/test/team-contextual-teaching.test.mjs scripts/test-field-kit-recipe-sources.mjs
```

26 passed.13 continuation checks failed before their assertions because this worktree's sparse checkout omits tracked docs/verification review.json files. These are not missing from the commit: core.sparseCheckout=true; git ls-files -v marks the files S; git cat-file resolves the v0.142.3 receipt at HEAD (14,357 bytes). No source/config changes were made to expand the checkout. The changed generic dependency-closure tests passed.

Command2:

```sh
node --test --test-concurrency=1 --test-name-pattern='rescue guidance|ordinary Resume|Resume reconstructs|reserve revival|confirmed Retry cannot|completed partner rescue|current-rules specialist Resume|Team More exposes|paused Help reading|Solo to Team to Versus' game/test/coop-resume-down-warning.test.mjs game/test/coop-host.test.mjs game/test/display-preferences-host.test.mjs
```

15 passed,0 failed,80 unrelated skips in18.8s. This includes nested shared display preference tests. These are focused checks, not a full-suite or physical-device acceptance claim.

Logs:

- /tmp/revealline-team-batch-units-20260929.tap
- /tmp/revealline-team-batch-hosts-20260929.tap

## Remaining release qualification

The source batch updates the Team renderer and adds game/text-size.mjs to the declared Team dependency closure. The production ledger is still byte-identical to accepted main: SHA-256 3cfdf800e5794058de080edddf5a91a914ddd20098015a25a27818694478c71f.

Exact ordered source hashing at the pinned refs proves:

- Main:31 inputs, Team fingerprint c162660dcc177f6d975704920513d8171a9190ea708c61b1a5189adbb3b67980; this fingerprint is present in the ledger.
- Batch:32 inputs, Team fingerprint4547bb004e73a8d31ad1e3d8449da8ee32b8e4819c179577f81f0f7224dc2494; this fingerprint is absent from the unchanged ledger.

Fresh scoped Team presentation review and append-only production/compiled qualification are therefore required before release. This is a release gate, not a reason to withhold preservation in the draft PR. Use the final integrated source and current ledger; do not import historical generated candidates or weaken checks. Complete required PR/release gates with the tracked review receipts available.

Evidence: /tmp/revealline-team-batch-fingerprints-20260929.json.

The active owner has two untracked evidence images under docs/verification/team-readability-20260929/: first-connection-large-390x844.png and first-connection-large-844x390.png. They were not staged, modified or treated as physical-device acceptance by this audit. Source status after tests still contains only that owner's untracked evidence directory. Coordinate any evidence snapshot without disturbing the owner's worktree.
