# UX1-A1: exact Solo Journey pictures

Status: implementation draft against main `4755a331bf06be1490d2e41bc4d1a59515a5cd0c`
(v0.108.0). This feature does not bump the version or change a published release.
PR404, the v0.108 publication, game rules and content are outside its scope.

## Implemented slice

A legal Solo Journey win retains the accepted, decoded original in a versioned
presentation ledger. Its mode, Journey edition, mission, campaign, authored level
revision, run, gameplay identity, difficulty, theme and full asset descriptor are
recorded. The strict historical gameplay receipt stays unchanged. The companion
uses `<profileKey>:pictures.v1` in the existing Journey database and commits in the
same transaction as progress. Other mode receipts are neither inferred nor minted.

Collection now includes Journey originals alongside the separate Classic gallery.
View earned original opens a static viewer, with immediate loading feedback,
explicit download retry, and Back to the exact opener. It does not award a picture,
launch a mission or play a recording. The existing Collection search includes the
Journey section. Paging bounds the rendered list to twelve entries. This slice
uses text cards in Collection; its broader artwork-first layout remains UX1-B/UX5.

Completed mission cards use the same exact descriptor. Near-viewport display
leases verify bytes, SHA-256, dimensions and decode before drawing. Offscreen,
filtered or closed cards release decoded originals; late work cannot paint a new
screen. Browsers without intersection observation have a bounded twelve-card
fallback for earned pictures. Existing compact-phone detailed-card preference is
preserved; the complete responsive map/artwork gallery remains UX1-B.

Old scopes can contain multiple editions. A historical clear without an exact
presentation receipt is marked **Earlier edition / original unavailable**. No
current asset is substituted as its earned original. Completing that mission again
can earn the current picture; older originals remain retained. Unknown historical
mission IDs stay in backups and appear as unavailable earlier missions.

## Persistence and recovery contract

- Repeated terminal delivery is idempotent. A later run of the same exact original
  retains the first receipt; different artwork keeps both originals. An existing
  run or immutable asset descriptor cannot be replaced by conflicting data.
- Invalid batches fail before in-memory adoption. IndexedDB write failure rolls
  back both records while the session retains its clear and picture for Retry save
  or export. An older custom backend cannot silently discard picture receipts.
- v1/v2 readers and exports remain unchanged when there are no picture records.
  v3 backup adds the scope and complete presentation ledger. Restore is additive;
  scope mismatches and conflicting originals fail before mutation. Historical
  backups do not erase existing picture records.
- Backups contain **references, not image bytes**. Missing originals offer visible
  retry and recovery guidance, rather than silently substituting current art.
  Cross-edition asset download/repair automation and full offline preparation remain
  later work. Keep the matching immutable game edition for older original bytes.
- The ledger is bounded to 2,048 distinct original receipts per profile; malformed
  or oversized ledgers are rejected without overwriting stored data. If a new
  original cannot be admitted, the valid gameplay clear/result remains usable and
  explains the missing picture instead of claiming it was unlocked.

## Focused evidence

- Modeled storage, cross-mode delegation, original validation, display leases,
  backups and existing library behavior: 99 tests passed, no skips.
- Real Solo host: queryless `whole-spatial-v9` Home → direct Start → legal keyboard
  win with exact independent checkpoint/public
  replay; accepted original saved; Collection opens it; missing bytes expose Retry;
  successful retry draws the decoded original; Back restores the exact opener;
  completed card draws the earned original; fresh Retry retains it without a second
  reward. One complete host case passed, no skips.
- Toolchain: Node 20.19.5; ESLint 10.10.0 and Prettier 3.6.2 used read-only from
  `ux0-reconcile-v100/go_test/node_modules`. This is supported local Node evidence,
  not a claim that hosted Node 22 or all source gates have passed.

These are automated/model evidence, not visual approval, physical-device checks,
full offline readiness, every mission playthrough or a public release acceptance.

## Remaining before acceptance

1. Independent source review; exact final draft-head focused checks and full PR
   gates. Qualify persistence across a real browser reload, cross-campaign Next,
   failed preparation, accessible viewer focus and the agreed viewports.
2. Versioned source release, exact-source qualification, immutable freeze, Pages
   deployment and public win → Collection → mission-card verification, coordinated
   after the currently publishing feature. No release is performed by this draft.
3. **UX1-A2:** actual Versus and Team completion admission and presentation records,
   their Collection access and win/reload/Retry/Next qualification. The schema is
   mode-aware, but this PR adds only Solo host admission.
4. **UX1-B:** the complete campaign-grouped compact gallery, all content-source map
   previews and input/layout qualification. Continue UX2–UX6 in the accepted plan;
   do not begin bulk artwork or mission production while player flows are unreliable.
