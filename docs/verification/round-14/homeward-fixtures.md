# Homeward browser completion fixtures

Generate the browser QA fixture set with:

```sh
node scripts/create-homeward-fixtures.mjs
```

The output is `.cache/round-14/homeward-fixtures/`. To deliberately regenerate this owned fixture directory after reviewing content changes, use `--replace`. The script refuses an existing unmarked directory and writes only its fixed fixture filenames. Generated large backups remain outside Git.

The directory contains six suspended sessions, six full backups paused near completion, and two completed-campaign player libraries/full backups (one per turn mode): **16 JSON files plus a provenance manifest**. The manifest records every filename, size, SHA-256, source proof and pack identity, stopped tick, earlier clear count, remaining input and expected result. Each full backup includes the actual Homeward pack with its three original PNGs. Session-only files omit artwork and require the real pack to be installed first.

| Mission | Session filename suffix, for either mode | Finish direction | Unboosted input after restore |
|---|---|---|---|
| Copper Orchard | `homeward-01-immediate-near-finish.session.json` / replace `immediate` with `grid-center` | Right | 36 ticks / 0.30 seconds |
| River Switchyard | `homeward-02-immediate-near-finish.session.json` / replace `immediate` with `grid-center` | Up | 36 ticks / 0.30 seconds |
| Home Beacon | `homeward-03-immediate-near-finish.session.json` / replace `immediate` with `grid-center` | Right | 36 ticks / 0.30 seconds |

Install **Homeward Skies** through **Library → Packs** so the browser fully decodes the real images. Import the session files through the normal saved-flight UI in mission order. Loading leaves the game paused; select **Resume**, then hold the direction listed above for at least half a second without Boost. With tap steering enabled, tapping the direction button latches that direction. Normal completion should reveal the mission picture, award progress, add its gallery entry and present the next mission or finished chapter. Importing sessions in sequence preserves completions earned through these UI interactions.

For independent review of one mission, use its matching `.backup.json` instead: it includes zero, one or two earlier generated legal clears and their gallery records. Its preferences enable tap steering. Full-backup import replaces the current collection through the ordinary user-confirmed import flow; the fixture generator does not access browser storage.

For returning-player and completed-overview checks, use `homeward-completed-immediate.library.json` or `homeward-completed-grid-center.library.json` after installing the pack. Matching `.backup.json` files also include the pack. These have three completed maps/gallery records and no suspended session. They are separate imported QA profiles, not newly earned manual playtest results.

## Provenance and assertions

Every source run uses the actual recommended-role input segments in `game/replays/homeward-routes.json`. The script reconstructs all six winning routes through `createRun`, `stepRun` and `recordInput` and checks their exact summaries and authoritative final checkpoints against the committed proof records. Earlier-map rewards are produced only from those actual winning results through `recordLibraryCompletion`; no clear, score, gallery record, timer, actor position, cell or life is assigned directly.

For each suspended fixture it replays the same commands up to **24 recorded boosted ticks before the final closure**, requires an unfinished live cut, and calls `suspendSession`. That API records the normal input release. `restoreSession` then verifies each portable replay before the script continues it. All six restored flights complete with three lives and every required relay after 36 unboosted ticks. With the original boosted input, all six finish in 24 ticks and reproduce the original winning authoritative checkpoint exactly.

The `xonix-backup.v1` output goes through `exportBackup`, including profile validation, included-pack campaign resolution and suspended replay verification. The Node image adapter only returns dimensions for the exact reviewed original image data URLs; it is explicitly **not a full image decoder**. Source bytes, PNG headers and pack budgets are checked by `buildHomewardPack`. Full PNG decoding, visible gameplay, reward animation, collection persistence and layout remain actual browser UI checks, recorded separately by the release review.

Metadata timestamps are fixed at `2026-09-12T14:00:00.000Z` with one-minute offsets for earlier clear records to make generation deterministic. They are fixture timestamps, not claimed human playtest times. Run IDs and replay build labels explicitly identify these as Round 14 legal-replay QA fixtures.

This script writes local fixture files only. It does not launch a browser, inject storage, evaluate page JavaScript, fabricate wins or grant progress to a live user profile.
