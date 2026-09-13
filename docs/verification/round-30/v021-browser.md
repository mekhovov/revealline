# v0.21.0 candidate browser acceptance

**The packaged candidate passed the recorded solo, offline restore and first offline couch journeys.** Root exercised actual visible controls on a fresh candidate origin at port **8856** on 12 September 2026. No QA award, profile or route fixture was imported into this origin. The [journey record](../../../.cache/round-30/v021-browser/journey.json) attributes the browser observations; preparing this report did not repeat that browser session, build or source gates.

The candidate identifies version **`v0.21.0`**, source **`1250a8afdcf9594d87ed6a79ba29639d1225fa69`** in its [build information](../../../.cache/round-30/v021-candidate-1250a8a/site/game/build-info.json). This is local candidate evidence. Frozen-artifact equality, an independent archive audit and a public deployment require their own records.

## Actual solo and collection journey

Root selected **Gentle / Scout / Grid + buffer** on First Signal. The [Ready capture](../../../.cache/round-30/v021-browser/ready-gentle-grid.dom.txt) shows five lives. After beginning a real cut, pausing and choosing Standard for the next attempt, the [paused capture](../../../.cache/round-30/v021-browser/gentle-paused-standard-next.dom.txt) still identifies the current Gentle flight and explicitly distinguishes Resume/Load from a Standard Retry.

Normal movement completed an [actual Gentle win](../../../.cache/round-30/v021-browser/gentle-grid-win.dom.txt): **52.2%, 8,160 points, five lives, gold**, displayed elapsed time **0:04**. The [earned library export](../../../.cache/round-30/v021-browser/earned-player-library.json) contains one Gentle picture and one score for run `0ae42ab2-cf97-4a12-9e2e-9896d18e6f56`, exact recorded time `4.016666666666656` seconds. The [collection DOM](../../../.cache/round-30/v021-browser/earned-collection.dom.txt) records its Gentle label, mode-specific achievements and shared appearance access.

The [earned-picture screenshot](../../../.cache/round-30/v021-browser/earned-gentle-picture.jpg), also inspected while preparing this report, shows the fully revealed procedural landscape **in the game arena**, with the compact five-life count and earned-appearance message. It is not a gallery-dialog screenshot or a complete animation-timeline test. The separate collection capture supplies collection evidence.

Root installed **Night Shift** through the visible pack flow. Its [Gentle comparison](../../../.cache/round-30/v021-browser/installed-night-shift-gentle.dom.txt) shows Midnight Channel selected, Standard three lives versus Gentle five, and the authored **150-second mission deadline versus none**. This establishes installed-pack selection and the displayed policy; it is not a public or browser win of every Night Shift map.

## Server-stopped restore, completion and couch

The normal offline Prepare action [verified 145 files](../../../.cache/round-30/v021-browser/offline-prepared.json), totaling **32,077,079 bytes**, with build ID **`fe0ae73697503f3627ac036a82210045a99b601f8155236f5f2136a1317f8340`**. Root then stopped the candidate server. The journey records socket connection refusal (`serverConnectResult: 61`); this is not a curl exit-code claim. [Verification after the stop](../../../.cache/round-30/v021-browser/offline-verified-after-stop.json) again reports all 145 verified, with no missing or corrupt entries and the same build ID.

A fresh URL navigation while the server remained stopped opened [Standard Ready](../../../.cache/round-30/v021-browser/offline-ready.dom.txt). Load saved flight reconstructed the newly recorded [166-tick Gentle cut, paused with Standard next](../../../.cache/round-30/v021-browser/offline-restored.dom.txt). Explicit Resume and real input then [won offline](../../../.cache/round-30/v021-browser/offline-resumed-win.dom.txt), again at **52.2% / 8,160 / five lives**, displayed elapsed time **0:03**. Next prepared [Standard Relay Orchard](../../../.cache/round-30/v021-browser/offline-next-standard.dom.txt), demonstrating shared mission access while the next-attempt mode remained Standard.

The **first couch visit on this origin occurred offline**. Its [Ready view](../../../.cache/round-30/v021-browser/offline-couch-first-visit.dom.txt) lists all three installed Night Shift maps and shows the authored First Signal race with **three lives per player**, independently of solo Gentle. Root used separate Player 1 Down and Player 2 Right controls. The [real round result](../../../.cache/round-30/v021-browser/offline-couch-round.dom.txt) declares **Sunflower / first clear**, at 52.2% / 8,160 / three lives; Skyline finishes at zero coverage, and the round clock shows **1:27 remaining**. This was a first-clear result, not a timed draw.

The immersive result hides the Solo link. Root used visible **Show setup**, then Solo, and [returned successfully](../../../.cache/round-30/v021-browser/offline-return-solo.dom.txt). The [persisted collection](../../../.cache/round-30/v021-browser/offline-persisted-collection.dom.txt) still shows the Gentle picture. Complete-backup export also worked offline.

## Independent export checks and retained evidence

Without changing any saved file, this report's author passed the [pre-offline session](../../../.cache/round-30/v021-browser/pre-offline-cut.session.json) through public `restoreSession`, using the shipped base campaign, actual class recipes and `createDifficultyContext(base, 'gentle')`. It reconstructs Grid + buffer / Scout, **tick 166**, **1.3833333333333309 seconds**, five lives, **11 trail cells**, cutting at `(24.5, 11.666666666666668)`. The full checkpoint equals the saved `fnv1a64-state-v2` checkpoint **`b5cf901cc1a52ae2`**, including every section. Its run ID is `f4e9ea19-e4c4-49aa-a094-1e53b720c9ee`.

Public `prepareBackup` independently validated the [7,369-byte final backup](../../../.cache/round-30/v021-browser/offline-complete-backup.json), with the registered base campaign and `expandDifficultyCampaigns`. Pack contexts came from the backup's own successfully imported **Night Shift 1.0.0**; no external installed-pack registry or image decoder result was supplied. No image decode was needed for this procedural pack. The prepared backup contains **one Gentle gallery row, two Gentle scores with distinct run IDs, Standard as the next-attempt preference and `session: null`**. The offline result records `3.9749999999999885` seconds; its better time updates the existing picture row. The two scores substantiate two separately played candidate solo wins, unlike the earlier source QA's two-win/eight-presentation fixture. Preparation was in memory only, not a storage import or a new gameplay run.

| Evidence                | Bytes | SHA-256                                                            |
| ----------------------- | ----: | ------------------------------------------------------------------ |
| Pre-offline cut session | 6,565 | `dec13030c3ef1988fb5f3189fcaca502d2d7b934890917b1f33c3985efb497ef` |
| First earned library    | 1,739 | `a3f3dbcdd33669a94a793422c6f99490e853c8fbadd9708c28b9995f84dccf4f` |
| Final complete backup   | 7,369 | `92f2ff937964b4d2e76fcbc4f9172c29275ecb2098812d5b0ef39e4e13cdf28a` |
| Journey record          | 1,594 | `0b614e11b4be47f0a2e421146ee2f1fc2bb9b7aadf5b73548660c7ffca0d7c6a` |
| Full browser inventory  | 4,437 | `56481887aac38b32233b57ac9d5849ae4312816ff152583af082eb76433cb3f9` |

Every entry in the [23-file / 193,973-byte inventory](../../../.cache/round-30/v021-browser-inventory.json) was rehashed and matched while writing this report. Raw exports, screenshots, DOM captures and the [empty client-console array](../../../.cache/round-30/v021-browser/client-console.json) remain unchanged. The recorded automation corrections were selecting the actual **Steering** label instead of absent **Turning**, and exposing Solo through Show setup; neither is recorded as a game client error.

These checks use software keyboard and native on-screen controls. They do not establish physical touch/gamepad behavior, all viewport layouts, browser-cache survival after eviction, native wrappers, public hosting, difficulty balance or human enjoyment. Physical device and controller behavior were not tested, no private runtime state was patched, and no new test-suite count is claimed by these export validations.
