# Pictures & Stories input qualification

This batch follows the Motion Lab receipt. Shared locale changes are
`288935c1c` and `eed47759a`; picture/story operation focus is
`e73b8a69041083253a8764a7dbbe0464d0f5f270`. These are source inputs for PR #782,
not a published release or physical-controller acceptance.

## Source changes and automated checks

Shared authoring navigation, Sections, source chooser and reference seek
accessible names now follow EN/UK changes. Built-in source choices update in
place; filenames remain literal. Section choices refresh after ordinary
bindings and host locale callbacks, so late-registered heading translations
cannot leave the options one language behind. Disposal removes the callback.
The focused cohort passed **57/57**, including live EN → UK → EN, node/focus
preservation and callback-registration-order regressions. Native keyboard
language switching in Motion showed the dialog named “Розділи” and navigation
named “Навігація редактора”; returning to English restored “Sections”. That
browser observation covers the initial locale fix; the callback-order follow-up
has the additional automated regression.

An actual Pictures & Stories keyboard journey exposed focus falling to BODY
after picture Save and video Inspect. The correction uses the existing
operation focus lease across picture Save, Discard, Unassign, Cancel, backup
preparation/review/restore and their story counterparts. Picture Save returns
to saved preview; Discard returns to authored preview. Story Prepare focuses
the separate Save action, and Save returns to the saved-story selector. A
consumed failed story review returns to Prepare for fresh validation. Focus
returns only after controls are enabled and while the originating interaction
still owns the foreground. New focus, hiding, closing and cancellation retire
the lease. Store identities, immutable histories and commit guards are intact.

The final nine-file cohort passed **175/175**, with no failures or skips:

```sh
node --test --test-reporter=spec game/test/still-media-panel.test.mjs game/test/still-story-panel.test.mjs game/test/still-media-bundle-ui.test.mjs game/test/still-story-lifecycle.test.mjs game/test/still-media-host.test.mjs game/test/still-media-preview.test.mjs game/test/media-still.test.mjs game/test/story-bundle.test.mjs game/test/still-media-catalog.test.mjs
```

It includes 22 new focused regressions and actual router/Confirm composition.
Independent review and **23/23** overlapping targeted checks found no blocker;
those are not added to the 175 count. Scoped ESLint, Prettier and whitespace
checks passed.

## Native keyboard browser journey

Codex in-app browser, English, isolated origin `http://127.0.0.1:8989`, actual
unbound keyboard events only after setup. No pointer focus reset was used.
The initial exploratory save created revision 1 and exposed the focus defect.
After reloading the final source as setup, the complete repeated journey:

1. Opened local media, canceled the in-app source picker, then selected the
   bundled Dawn Signal PNG. Preview rejected missing provenance without saving.
2. Entered credit, source note and description, then previewed the real
   **640 × 360**, **422,581-byte** original. Explicit Save retained revision 1,
   added revision 2, and returned focus to Preview saved revision.
3. Previewed revision 2 and discarded that selection draft. Focus returned to
   Preview authored picture; saved revision 2 remained assigned.
4. Used the in-app video source, entered a story description and inspected the
   silent **640 × 360**, **8-second**, **713,732-byte** MP4. Inspect retained
   focus. Prepare rejected end=0; correcting end=8 produced a review without
   saving and focused Save. Separate Save returned to saved-story selection.
5. Escape closed to Open local media. Reopening read the saved picture revision
   and exact story binding. Prepared and activated both backup download links
   with native Enter. Closed local connections explicitly before the separate
   virtual-pad run. No saved content was deleted.

The preview is an inline isolated canvas, not a child game requiring Enter
Preview/Return. No gameplay, score or Collection reward was generated.

Actual OS files were validated through `importMediaBundle` with full PNG
decoding and `inspectStoryBundle` with exact metadata, descriptor, binding and
original-byte hashes. `/usr/bin/sips` decoded the PNG to a complete BMP;
every pixel row was checked. Canonical production re-export reproduced both
files exactly, and the story backup pins the same complete picture history.

| Actual file                  |   Bytes | SHA-256                                                            |
| ---------------------------- | ------: | ------------------------------------------------------------------ |
| `fpv-line-originals.rlmedia` | 438,793 | `3c288ce9ecae16379ccb2b0501b4ad3f6bd56630ab4169ff2af8999a5bf0462e` |
| `fpv-line-stories.rlstory`   | 731,359 | `80f2d48fab1bc514d52be908396fd242dbb7301d7c0a069c320fe460b6912455` |

These are under `/Users/oleksandr.mekhovov/Downloads/`; validation receipt:
`/private/tmp/still-native-downloads-20260929.json`. The CLI story inspector is
byte/metadata validation, not browser codec preparation. The native browser's
Inspect/Prepare supplies separate video metadata/container evidence; neither
establishes complete video frame decoding or playback acceptance.

## Current virtual controller fixture

The test-only `stillCurrent` case uses the isolated port 8989 and real standard
pad pulses. It chooses an unused map/world, preserves every pre-existing
picture/story row and audio/browser storage, and retains its new assignment
and story for inspection. Read-only store handles and production bundle
validators inspect outcomes; they do not drive app edits. Source/text/select
and numeric cancellation, invalid provenance/description/segment, explicit
picture/story saves, reopening and two exports of each type are required.
Browser `importStoryBundle` performs real silent native video inspection;
this differs from the CLI byte-only inspector above.

The final current run passed **3/3** stages against `e73b8a690`:

- Canceled world/source/credit drafts and rejected missing provenance/description
  preserved the prior picture generation. The real bundled preview stayed unsaved.
- Canceled video source/time/text and rejected zero-length segment/blank description
  preserved story storage. Separate picture Save and story Prepare/Save restored
  their expected focus and committed exactly one generation each.
- Close/reopen retained the exact revision and story pin. Preparing a saved-story
  binding and pressing Back canceled it without another save. Two exports of each
  format passed browser production import and byte-identical canonical export.

The final target was `signal-12` / `retro` in
`first-signal/2/88639f3aab7b6cc1`; picture generation advanced 3 → 4 and story
2 → 3. Three old pictures, two old assignments, two old stories, all retained
originals, audio and the prior browser key remained unchanged. The new records
remain on origin 8989. Exact new picture ID:
`still-de54c568-cd9c-437b-8ae7-32f2c96cbd96`, revision 1; story ID:
`story-b13f23b5-f075-4f3d-ba71-b8af8cddbe53`, revision 1, segment 0–8 seconds.

The first run reached both exports but failed its final whole-owner equality
assertion. Production deliberately preserves the complete campaign snapshot
while extending `themeIds` for newly referenced worlds. The fixture now checks
exact campaign content, the exact permitted owner-key set, all previous themes,
and only the selected world's permitted addition. Eight bounded safety cases
confirmed legitimate extensions pass while changed content, lost themes/owners
or unrelated additions fail. No production guard was weakened and the failed
run's `signal-12` / `coupa` records were preserved. Only the complete fresh rerun
is counted as passing.

The two real OS export pairs, filenames suffixed `(3)` and `(4)`, match each other
and the observed browser blobs:

| Export     |   Bytes | SHA-256                                                            |
| ---------- | ------: | ------------------------------------------------------------------ |
| `.rlmedia` | 440,549 | `7c93861df93d688ddc867bb297d1dfbb97ba60af24442f5ef9fe811fc5078268` |
| `.rlstory` | 735,605 | `b5be21852492ecb2964fdb9cb362973679c6e2d013b613d2e440d6da02138c99` |

The `(4)` pair also passed the separate CLI full-PNG/metadata/hash/binding and
canonical round-trip checks; receipt
`/private/tmp/still-virtual-downloads-20260929.json`. Browser `importStoryBundle`
checks silent native video metadata/container support as well; neither receipt
claims full frame decoding or physical-controller behavior.

## Packaging and remaining gates

All **14** editions compile in memory with ordinary admission and final byte
limits. The largest DroneAid aggregate contains 668 files / **66,783,208 bytes**,
with **325,656 bytes** below 64 MiB. The 835 stable source inputs and six compiler
pins match final `e73b8a690`; only authoring-copy and page-input-host changed
among those inputs since the Team receipt. The compile began on `eed47759a`;
raw source hashes, rather than rewritten output metadata, attribute it to the
final commit.

The default Still/shared-authoring closure resolves **202 modules / 649 imports**
and 33 resource edges among 1,723 collected files. Its 234 captured inputs plus
the edition/compiler capture form **868 unique paths**, all matching final Git
blobs and disk. No missing dependencies, test fixtures or drift were found;
bundled `.rlmedia`/`.rlstory` bytes and hashes match their manifest. Receipts:
`/private/tmp/edition-package-authoring-locale-20260929.json` and
`/private/tmp/still-authoring-source-closure-20260929.json`.

These are source/compile results, not installed-offline or native package
acceptance. Physical controllers, browser/OS picker handoffs, full video playback,
target-store backup restore, soundtrack recovery and published acceptance remain
separate. The top-level soundtrack backup's unconditional asynchronous focus
in `still-media-host.mjs` remains a concrete follow-up outside this picture/story
panel batch. Other creator tools remain in the plan, next Video Poster.
