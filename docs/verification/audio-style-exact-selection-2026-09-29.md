# Exact public Audio style preferences

This follow-up starts from PR #779 head
`ef968688a8afcf71c514e519c7be4fbfd4618dfb`. The prior repair restored Synth + Metal,
but its inverse local-genre mapping could not represent all public choices.
The real panel reproduced four failures: FPV-only and Fusion-only played once
then displayed Ukrainian; Synth + FPV displayed Synth alone; selecting the eight
mapped styles while excluding Fusion and FPV displayed all ten. The original
remount and failed-save retry tests passed alongside those four failures.

## Behavior and compatibility

- Exact ordered public choices persist separately from their local-genre
  projection. FPV-only and Fusion-only now make a preference commit too.
- The optional `revealline-public-soundtrack-styles.v1` record uses the existing
  DB5 `metadata` store at `public-styles.v1`. It is bounded to 1 KiB and the ten
  known, unique style IDs. Database version, soundtrack v3 format, and the exact
  stored `{generation, library}` record stay unchanged.
- Library and sidecar writes share one transaction, including rollback on a
  failed sidecar write. Reservation, quota and stored-byte accounting include
  the new metadata. A read never writes or migrates preferences.
- A sidecar is usable only for its exact audio generation. New unrelated
  writes retain it when listening and playlist preferences are unchanged.
  Every older writer generation advance invalidates it, including unrelated
  legacy edits. An old explicit All action can serialize identically to a
  public-only selection's local projection, so that conservative invalidation
  avoids restoring stale choices over the older action.
- Explicit Quick Style, All, playlist, and replacement-backup choices clear the
  sidecar even if their legacy values are unchanged. That intent survives a
  failed commit and subsequent Save All. Undo and reload restore the saved
  preference; a newer public-style save supersedes the pending replacement.
- A public-style save owns listening preferences. It reconciles those fields
  in an unsaved replacement draft while retaining unrelated tracks, playlists
  and assets for the separate Save action.
- Factory defaults are unchanged. Fresh upgraded libraries retain Ukrainian;
  explicit saved Synth and historical Automatic preferences are not inferred
  to be factory defaults or overwritten.

This record preserves device-local style controls. It does not recreate an
online playback queue at startup or alter catalogue admission, automatic
playback, mute, Recording mode, or browser gesture requirements. Public-only
choices retain the compatible prior local listening projection for historical
readers. The optional exact-choice record is not exported in `.rlsound`;
replacement imports deliberately use their own legacy listening preferences.

## Verification

The old-reader fixture is the exact `game/managed-media-store.mjs` from PR #779
head, SHA-256
`65d9249677045e7d7aad1d99003aeeac5adc9b72ea0b045be7a08b8480219885`.
Tests resolve only its import URLs; its reader/writer implementation is frozen.
It reads and writes a current shared library without accepting any new fields.

```sh
node --test --test-concurrency=1 \
  game/test/soundtrack-style-selection.test.mjs \
  game/test/soundtrack-panel.test.mjs \
  game/test/soundtrack-style-taxonomy.test.mjs \
  game/test/managed-media-store.test.mjs
```

Result: **166 passed, 0 failed, 0 skipped**, 3.22 seconds. The finite DOM/media and
IndexedDB models exercise real panel handlers, storage transactions, historical
reads/writes, immediate display, remount, explicit All, mixed selections,
replacement imports and retry behavior. Log:
`/tmp/audio-style-exact-choice-tests-final.tap`.

The additional connection, legacy store, Couch library, opening-theme and
catalogue cohort produced 87 passes and one pre-existing stale catalogue
expectation. The assertion at `soundtrack-catalogue.test.mjs:85` uses the first
three expanded genres (Synth, Metal, Electronic) while the selected historical
genres are explicitly Synth, Metal, Ukrainian. The exact PR #779 test and
unchanged `soundtrack.mjs` reproduce that failure independently at
`/tmp/audio-pr779-review/baseline-catalogue.tap`. This is not a passing full-suite
claim. Scoped ESLint, Prettier and `git diff --check` pass.

## Release dependencies

Keep this functional follow-up separate from production generation until the
accepted v0.142.4 source is fixed. PR #779's previous generated production101 /
audio53 conflicts with the selector's production101 / audio53. Preserve the
accepted v0.142.4 ledger and its exact predecessor oracle; append the next
available production/audio revision rather than replacing either history.

The new `game/soundtrack-style-selection.mjs` must join the ordered audio recipe
input closure before that fresh review and generation. Recompute the combined
source fingerprint, pin the accepted v0.142.4 predecessor, update retained Team
bindings/history tests, regenerate compiled outputs, and run exact-head hosted
qualification and release gates. Existing PR #779 receipts cannot approve the
new storage implementation. Public bytes, cold-offline operation, physical
iPhone/controller/touch and Steam Deck acceptance remain separate gates.
