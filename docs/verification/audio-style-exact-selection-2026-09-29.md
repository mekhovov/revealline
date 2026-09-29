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

The exact-choice record remains device-local and is not exported in `.rlsound`;
replacement imports deliberately use their own legacy listening preferences.
Public-only choices retain the compatible prior local listening projection for
historical readers. The next explicit Play / Start restores the exact public
queue lazily, as described below; startup does not restore a remote queue or
change catalogue admission, automatic playback, mute, or browser permission.

## Saved-choice playback follow-up

Solo startup, the Couch library owner and the panel pass validated public
choices alongside their adopted library. The shared player holds those choices
pending the next user Play / Start. Neither adoption nor silent preparation
fetches a catalogue or prepares the previous local-genre projection. The
existing panel catalogue-discovery request remains unchanged; the host checks
verify there is no additional player request before explicit playback.

Generic Play and Play selected styles share the exact public taxonomy,
Recording-mode filter, and bounded online-track window. Generic restoration
uses the chooser's default Shuffle / Repeat all policy. It does not commit
preferences or advance the saved generation. FPV-only and Fusion-only stream
only their chosen public recordings; a selection with mapped genres may also
include its matching local tracks.

Repeated pending Play calls share one catalogue request. Pause, Studio close,
suspension, disposal, changed preferences and newer explicit selections cancel
obsolete acquisition. An unrelated same-style adoption preserves an active
session queue and position. Changed or cleared authoritative metadata cancels
both a pending request and an obsolete mixed queue, including when its current
member is local. No-sidecar local playback retains its synchronous media call.

Catalogue errors and an empty permitted match remain retryable without playing
the prior genre. A browser gesture rejection retains the resolved exact queue
for direct media retry. Exhausted exact-style media stops for retry after its
selected queue members; it cannot fall through to an unrelated local genre.
Ordinary archive queues retain their prior fallback behavior. Master mute and
Recording-mode permission remain authoritative throughout acquisition.

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

The first additional boundary run produced 87 passes and one pre-existing stale
catalogue expectation. The assertion at `soundtrack-catalogue.test.mjs:85` used
the first three expanded genres (Synth, Metal, Electronic) while the selected
historical genres are explicitly Synth, Metal, Ukrainian. The exact PR #779
test and unchanged `soundtrack.mjs` reproduced that failure independently at
`/tmp/audio-pr779-review/baseline-catalogue.tap`. The follow-up derives expected
recording IDs from those explicit `previousChoices`, preserving the intended
historical selection instead of relying on catalogue order.

```sh
node --test --test-concurrency=1 \
  game/test/managed-media-connection.test.mjs \
  game/test/soundtrack-store.test.mjs \
  game/test/couch-music-library.test.mjs \
  game/test/opening-soundtrack.test.mjs \
  game/test/soundtrack-catalogue.test.mjs
```

The corrected boundary cohort passed **88 tests, 0 failed, 0 skipped**, 6.38
seconds. Log: `/tmp/audio-style-storage-boundaries-final.tap`. These bounded
cohorts do not constitute a full-suite claim. Scoped ESLint, Prettier and
`git diff --check` pass.

The saved-choice playback follow-up passed the expanded cohort:

```sh
node --test --test-concurrency=1 \
  game/test/soundtrack-saved-styles.test.mjs \
  game/test/soundtrack-player.test.mjs \
  game/test/soundtrack-host.test.mjs \
  game/test/soundtrack-panel.test.mjs \
  game/test/soundtrack-style-selection.test.mjs \
  game/test/soundtrack-style-taxonomy.test.mjs \
  game/test/managed-media-store.test.mjs \
  game/test/couch-music-library.test.mjs \
  game/test/couch-music-session.test.mjs \
  game/test/opening-soundtrack.test.mjs
```

Result: **342 passed, 0 failed, 0 skipped or cancelled**, 75.06 seconds. Log:
`/tmp/audio-saved-playback-final.tap`. This includes 27 new real-player / durable
Couch cases, actual Solo FPV Start and Fusion Studio Play after reload, actual
Studio-close cancellation, and the remounted explicit chooser matrix. It also
retains the existing ordinary archive fallback, prepared local-media gesture,
master mute, lifecycle resume, opening-theme, panel authoring and old-reader
storage checks. Scoped ESLint, Prettier and `git diff --check` pass. Independent
runtime and test-evidence review found no remaining actionable finding.

The existing muted-fresh Solo discovery test initially failed because its
catalogue stub returned no response: failed attachment discovery retried when
Studio opened. Exact pre-follow-up runtime and test bytes from `924340e32`
reproduced that failure using the read-only loader at
`/tmp/audio-playback-baseline-924340e32/loader.mjs`; evidence is
`/tmp/audio-playback-baseline-924340e32/muted-discovery.tap` (one selected failure,
20 skipped). The fixture now returns a valid bounded public catalogue. The
one-request assertion and no-playback expectation remain unchanged. No runtime
retry or discovery policy was altered to make the assertion pass.

## Release dependencies

Keep this functional follow-up separate from production generation until the
accepted v0.142.4 source is fixed. PR #779's previous generated production101 /
audio53 conflicts with the selector's production101 / audio53. Preserve the
accepted v0.142.4 ledger and its exact predecessor oracle; append the next
available production/audio revision rather than replacing either history.

Before fresh review and generation, add `game/soundtrack-style-selection.mjs`
immediately after `game/soundtrack-style-taxonomy.mjs` in the ordered
`sources.audio` list in `scripts/produce-field-kit-theme.mjs`. This expands the
audio input closure by one file. Also add `game/couch/couch-music-library.mjs`
immediately after the existing Couch music host: that changed adoption owner
must participate in the same fingerprint. The final closure grows from 28 to
30 ordered inputs. Add the independent consumer contracts
`['game/soundtrack-style-selection.mjs', ['audio']]` and
`['game/couch/couch-music-library.mjs', ['audio']]` in
`scripts/test-field-kit-recipe-sources.mjs`; its existing mutation loop must
prove each dependency invalidates audio alone. The shared selector extends the
existing style-selection helper; the new catalogue fixture is test-only.
Neither the producer nor generated outputs were changed in these functional
follow-ups.

Recompute the combined source fingerprint, pin the accepted v0.142.4
predecessor, update retained Team bindings/history tests, regenerate compiled
outputs, and run exact-head hosted qualification and release gates. Existing
PR #779 receipts cannot approve the new storage implementation or the expanded
input closure. Public bytes, cold-offline operation, physical
iPhone/controller/touch and Steam Deck acceptance remain separate gates.
