# P01 source-pinned UI and audio recipe review

This is a scoped asset-recipe readiness review of the current working source on 2026-09-15. It does not accept P01, a release, every host journey, physical input/audio hardware, or subjective sound quality. Root retains exact committed-source and public release gates.

## Decision and source scope

Approve the 24 current UI and eight current audio recipe slots only for the exact source fingerprints below. The generator keeps its existing source-stage default for any unmatched fingerprint. Existing motion/effects approvals and every historical review remain unchanged.

| Group | Ordered recipe inputs                                                                                                                                              | Reviewed SHA-256                                                   |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| UI    | `game/ui/field-kit-components.css`; `game/ui/field-kit-compiled.css`; `game/presentation/host.mjs`; `game/ui/operation-status.css`; `game/ui/operation-status.mjs` | `e3f6c6e0b186a3ea3f0ed9203e6da709641782bcbc9a3ca698bdba0bae06a450` |
| Audio | `game/ui/audio.mjs`; `game/ui/published-audio.mjs`; `game/ui/soundtrack-player.mjs`                                                                                | `998a1326a484cb3a492770ec68b927181ae5cb6d0041cdf309628fefd9349a95` |

Fingerprints use the existing generator rule: SHA-256 of concatenated file bytes in the stated order. Adding both shared operation-status sources is an agreed provenance expansion. These sources now implement the visible status/progress primitive, so changing either must reopen UI review. No slot identity, schema, role, required flag, source budget, recipe selector, artwork, or audio asset was changed.

## Actual source review

The comparison base is integrated source `a395462b101c348d28ee2643c24263ca72b2c751`, whose ledger selected UI revision7 and audio revision4. UI revision7 retains the explicit [component decisions](../../fpv-redesign/phase7/component-asset-decisions.json) and native component-state evidence. Audio revision4 retains its technical integration assessment of unchanged cue/music recipes, instrument/event mappings, gains and media bytes. Those historical approvals provide context; current source review, tests and browser evidence establish this decision.

The two existing UI CSS inputs are byte-unchanged from the base. `presentation/host.mjs` adds optional, exception-isolated current-owner callbacks at existing read, manifest/byte verification, font/image decode, crop and terminal boundaries. Byte counts/hashes, accepted snapshot ownership, cleanup and drawing remain authoritative. It does not add an image request, decoder, durable write, input action or readiness shortcut.

The new shared presenter owns only its status DOM. It uses scoped generation/host/selection fences, a polite label updated only when its message changes, a native progress element only for measured valid counts, and separate ready/error/cancelled/detached states. It neither changes focus nor owns cancellation. CSS keeps text visible without artwork/font downloads, uses Field Kit tokens and wrapped layout, and disables signal animation under both native reduced motion and the existing Reduced Effects setting. The bars are decoration; the changing text is the meaning. Existing raster control mappings and native checked/selected/disabled/focus state remain unchanged.

`audio.mjs` and `published-audio.mjs` are byte-unchanged. `soundtrack-player.mjs` adds current-generation preparation snapshots for read/verify/start, emits observation changes, rechecks authority after observers, and clears only the current preparation in finally. Cached Play additionally fences by the exact observer object. The original procedural instruments/cues, original-byte verification, playlist policy, media element/URLs, gains/ducking, mute, explicit activation, pause, seek and natural-end paths are preserved. No new sound, listening-panel judgment or physical speaker/codec qualification is inferred from a status label.

## Current verification

The independent source command passed **67/67**, zero failures or skips:

```sh
node --test game/test/operation-status.test.mjs game/test/presentation-host.test.mjs game/test/presentation-page.test.mjs game/test/presentation-ui.test.mjs game/test/soundtrack-player.test.mjs game/test/published-audio.test.mjs game/test/soundtrack-gain-leases.test.mjs
```

The decisive assertions cover stale callbacks and disposal, exact byte validation, original native handlers/checked state, no focus theft, measured progress without repeated live announcements, silent preparation, gesture ordering, overlapping cached Play, Pause/disposal during reads, no late cue replay and gain ownership. Log: `.cache/cross-mode/p01/recipe-source-tests.log`.

The production-history/readiness command passed **11/11**, zero failures or skips. The new real generator regression independently changes status CSS, status MJS and soundtrack-player bytes in isolated fixture files; each change creates source-stage successors only for its group and preserves earlier records. Existing capacity, integrity, required-slot and committed-ledger guards also pass.

```sh
node --test game/test/presentation-production-history.test.mjs game/test/presentation-readiness.test.mjs
```

Log: `.cache/cross-mode/p01/recipe-approval-tests.log`. This working-tree run does not claim the committed-ledger CLI passes before the reviewed ledger is committed.

## Current browser evidence

Current P01 screenshots were inspected during this review; selected originals are copied unchanged into [recipe-evidence](recipe-evidence/copies.json), with source paths, byte counts and SHA-256s. These are current source Chromium observations at390×844 and844×390, separate from historical component screenshots.

- [Large/Plain loading](recipe-evidence/deploy-large-plain-portrait.png) keeps text and controls readable; [landscape measurements](recipe-evidence/deploy-large-plain-landscape.json) record all three signals with `animationName=none` under Reduced Effects.
- [Couch cosmetic preparation](recipe-evidence/couch-cosmetic-held-portrait.png), its [landscape measurement](recipe-evidence/couch-cosmetic-held-landscape.json), and [released state](recipe-evidence/couch-cosmetic-released.json) show a real compiled-runtime read held141.572s, ready lobby and enabled Start throughout, then a hidden terminal status.
- [Replay reading and Cancel](recipe-evidence/replay-held-landscape-fixed.png), with [portrait](recipe-evidence/replay-held-portrait-fixed.json) and [landscape](recipe-evidence/replay-held-landscape-fixed.json) measurements, show the corrected loading controls in the initial viewport; Cancel is44 CSS pixels. The earlier below-fold failure was corrected and retained in the broader G6 evidence.
- [Music MP3 read](recipe-evidence/music-held-mp3-current-landscape.png) and [portrait measurement](recipe-evidence/music-held-mp3-current-portrait.json) show a real uploaded MP3 Blob read held at its completion boundary with original bytes unchanged. [Cancelled completion](recipe-evidence/music-cancel-after-read-settles.json) retains the saved library; [retry](recipe-evidence/music-retry-draft-ready.json) verifies that original into a draft. This proves scoped preparation/cancellation UI, not audible quality.

The broader records remain `.cache/cross-mode/p01/g0-coverage.md`, `g1-g3-g6-coverage.md` and `g5-coverage.md`. Browser automation mistakes and initial failed screenshots remain distinguished there. This review used no fresh browser automation and makes no claim about physical touch, gamepads, native zoom, hardware codecs or listening quality.

## Immutable adoption and remaining gates

The existing generator appended production **revision19**, preserving the r18 source-stage append. [Adoption proof](recipe-evidence/production-adoption.json) verifies every prior immutable record and compares every original Blob byte. It also checks each changed selection retains the same runtime role, recipe, description, file and geometry and points to its immediate prior revision.

| Item                      | Before r18 | After r19 | Result                                                        |
| ------------------------- | ---------- | --------- | ------------------------------------------------------------- |
| Asset records             | 1,014      | 1,046     | All1,014 prior records unchanged; exactly32 review successors |
| Theme records             | 19         | 20        | All19 prior records unchanged                                 |
| Collections               | 1          | 1         | Unchanged                                                     |
| Original/derivative blobs | 127        | 127       | Every byte unchanged; no new file asset                       |
| Required reviewed slots   | 162        | 194       | All194 required slots pass declaration check                  |
| Optional source slots     | 99         | 99        | No blanket approval                                           |

UI selections are revision9; audio selections revision6. Ledger SHA-256 is `02576a6d3f7af62636d044e74fb39bf5629d8f6de21569dd0613b6c170b211a7`.

`node scripts/produce-field-kit-theme.mjs --write` and the following `--check` both passed, selecting revision19,293 slots,131 compiled files and4,007,816 bytes of retained file assets. The working-ledger `checkFieldKitReadiness` import verifies194 required reviewed declarations with no unresolved required slot. Retained [write](recipe-evidence/recipe-production-write.log), [reproduction](recipe-evidence/recipe-production-check.log), [source tests](recipe-evidence/recipe-source-tests.log) and [approval tests](recipe-evidence/recipe-approval-tests.log) are exact copies with hashes in the receipt. Scoped ESLint, Prettier and whitespace checks pass.

No actual recipe-review gap remains for these32 exact inputs. This is a declaration/readiness result, not visual proof by itself. Committed-ledger identity, final source gates, ordinary build, immutable freeze, deployed bytes/play/offline and phase acceptance remain root release work. No version, Git index/commit, full-suite run or publication was performed in this review.
