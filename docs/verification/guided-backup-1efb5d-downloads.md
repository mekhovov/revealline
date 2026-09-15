# Guided backup downloads — exact source 1efb5d51

On 2026-09-15, root used the Git-backed preview at `http://127.0.0.1:57100/game/` for source `1efb5d51c91a2099927da175924e4038ef54af9a` (tree `db474cdb94ae1d8fbe24d70bf80bd48c5e18028f`). In a fresh top-level browser tab, Tab followed by Enter on each short-purpose download link produced all five files below. A separate filesystem/CLI reviewer verified those files in place. This is source-preview evidence, not a published-version qualification.

The coverage report identifies `version: dev`, `channel: dev`, and `sourceRevision: null`; the source binding comes from the controlled preview and exact checker Git inputs, not from report authentication. The game envelope has empty campaigns, gallery, scores, masteries, packs and external chapters, with no saved session. Saved referenced media contains one original (40,810 bytes); story and soundtrack original counts are zero. This does not exercise a custom MP3 or non-empty story-original backup.

All filenames share this prefix:

```text
RevealLine-backup-20260915T053719895Z-9d37f6f94aca4636a77eb1c1fde2bf35-
```

| Suffix             | Bytes | SHA-256                                                            |
| ------------------ | ----: | ------------------------------------------------------------------ |
| game-data.json     |   799 | `3ca2d3463c403a61c25dcfd63651ac283304cf58e073bdb42c81a61ed520aae8` |
| originals.rlmedia  | 56378 | `c731a8cc0e70008a12c9cdc40e2c7350125a74d4f0e2f388fd7cbf2fdff83b82` |
| stories.rlstory    | 15554 | `a69e6079c984ae471073c2f921a52705d6a14daf380eaed24f507d18e9cef7b5` |
| soundtrack.rlsound |   192 | `97cf00ac47a512848c19869483c075c69b1142da21e8a15ddced77b31f1a4d1e` |
| coverage.json      |  2640 | `b423c453061925ac30835615cd99f4dc83117e844abc6b985014f62ff3cbf8ac` |

The exact-source checker ran directly against the Downloads directory; no input was copied or renamed:

```text
node scripts/check-backup-set.mjs --report ~/Downloads/RevealLine-backup-20260915T053719895Z-9d37f6f94aca4636a77eb1c1fde2bf35-coverage.json --directory ~/Downloads
```

| Runtime  | Exit | Elapsed | Raw stdout SHA-256                                                 |
| -------- | ---: | ------: | ------------------------------------------------------------------ |
| v20.19.5 |    0 | 0.284 s | `fe6f0853c0b99d48f6b2a0fecc58665935826a41e45bbb1fd961ddfd1901d9e0` |
| v22.22.2 |    0 | 0.653 s | `fe6f0853c0b99d48f6b2a0fecc58665935826a41e45bbb1fd961ddfd1901d9e0` |

Both results were identical and reported `verified`; stderr was empty. The checker matched all report filenames, sizes and hashes, inspected bounded component metadata and referenced-original hashes, and reconciled paired story/media context. With no saved audio originals, this run does not exercise an MP3 payload. All five download identities and hashes remained unchanged. The 65-file literal static import graph matched exact source Git bytes before and after execution; this was not a whole-repository audit.

The first preflight stopped before either CLI ran because four modules were absent from the sparse checkout. Root authorized restoring only those exact Git files (`backup.mjs`, `replay.mjs`, `sessions.mjs`, `story-bundle.mjs`; 52,880 bytes), with no existing source overwrite. The successful checks followed that restoration.

Root also observed the corrected keyboard Back sequence: first Escape closes File names, focuses its disclosure control and retains five prepared links; second Escape closes the Library, focuses Saves & recovery and removes the prepared links. Root additionally reported a third Escape returning to the Title Settings control. These are root-owned native observations; the independent byte reviewer did not drive the browser.

Earlier requested downloads in reused ce5652/1efb contexts remain unsuccessful observations. The ce5652 missing-file receipt is retained separately, as is the earlier 050434355Z single-file control. Fresh-context success required no new code change for this retry, but context and interaction differences prevent assigning an exact browser/application cause. The earlier File names Escape bug is a separate corrected issue.

Local proof is retained under `.cache/round47/guided-backup-1efb5d-downloads/`: `execution.json` SHA-256 `fef147bde69cc6b483a47456f98c230e2cf53bf52e799f8319d9ad003f54e339` and `native-download-proof.json` SHA-256 `52a8e761d35429240a34af5db8e90c429f8103ef934f90e12694a095aa7a8e42`. The earlier absence receipt is `.cache/round47/backup-native-ce5652-missing-downloads/observation.json` SHA-256 `6fbacbc454b63628dcc12432d81d320297541acfa98c5f99319b13c6fc381ad3`.

This does not verify report authenticity, replay validity, earned ownership, native media decoding or listening, successful restore, cross-edition compatibility, offline availability, physical controllers/devices, or all modal paths. No release, version, tag, gameplay or publication state was changed by this verification.

Root separately checked the same-origin `/portrait-390x844.html` wrapper at a 390×844 CSS viewport on exact 1efb5d51. Keyboard navigation reached Title Settings → Game data → Saves & recovery → Prepare; Tab reached all five short links, and Enter opened File names. The screenshot shows wrapping within the narrow pane, with no horizontal text overflow observed. First Escape collapsed the disclosure and retained five prepared links; second Escape returned to Settings with Saves & recovery focused. This is layout/navigation evidence, with no portrait-download or physical-touch-hardware claim.

The [local portrait screenshot](/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/round47/backup-1efb5d-native-layout/portrait-filenames.jpg) is 45,249 bytes, SHA-256 `3ca49938e105aaabe71bec594a532d4c3f121742a482d9998b5238bb21769500`. The original capture had a `.png` filename; it was renamed to `.jpg` to match its actual 1280×720 JPEG format, with identical bytes and no image editing or re-encoding. Root owns the visual observation; the separate verifier checked its hash and file header without another visual review.

Related earlier source context: root observed 29 nonblank Motion Lab animation-recipe choices on ce5652, including the 14 stable-ID fallback labels from the 9ed change. This is DOM label coverage, not acceptance of every animation or motion state.
