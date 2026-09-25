# UX1-A1: exact Solo Journey pictures

Status: reconciled implementation draft against main
`fb703070ea4d4a48fa73ba23a8819bb2053aea6f`. It remains unversioned and does not
merge, tag, deploy or change a published release, game rules or content.

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

- Reconciled reward, storage, exact-artwork, current Team picture-authority and
  Legacy Team entry suites pass 117/117 with no skips on current-main source.
- Real Solo host: queryless current Journey Home → direct Start → legal keyboard
  win with an exact independent checkpoint/public replay; accepted original saved;
  Collection opens it; missing bytes expose Retry; successful retry draws the
  decoded original; Back restores the exact opener; completed card draws the earned
  original; fresh Retry retains it without a second reward.
- The two changed all-campaign Versus journeys pass 2/2; eleven unrelated cases are
  explicitly unselected by the focused name filter. Both boards keep equal
  checkpoints and every retained original remains Versus-only.
- A complete current-main Versus file also exposes an inherited catalogue fixture:
  one unchanged controller test expects 120 cards while the current catalogue
  renders 198. This draft does not hide that failure or change catalogue scope.

These are automated source checks, not visual approval, physical-device checks,
full offline readiness, every mission playthrough, full source gates or public
release acceptance.

## Remaining before acceptance

1. Independent source review; exact final draft-head focused checks and full PR
   gates. Qualify persistence across a real browser reload, cross-campaign Next,
   failed preparation, accessible viewer focus and the agreed viewports.
2. Versioned source release, exact-source qualification, immutable freeze, Pages
   deployment and public win → Collection → mission-card verification, coordinated
   after the currently publishing feature. No release is performed by this draft.
3. **UX1-A2:** actual Versus and Team completion admission and presentation records
   are included in [the reconciled A2 draft](ux1-a2-cross-mode-rewards.md). Its
   focused host evidence and mode-local picture access do not qualify reload/Retry/Next,
   physical devices, full PR gates or a public release.
4. **UX1-B:** the complete campaign-grouped compact gallery, all content-source map
   previews and input/layout qualification. Continue UX2–UX6 in the accepted plan;
   do not begin bulk artwork or mission production while player flows are unreliable.
