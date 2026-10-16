# Crowd readability, broader balance and Creator handoff

Continuation of [the pacing follow-up](../pacing-20261013/README.md), rebased onto
main `6514e5c3a` (including the merged Library and Snake world changes). This adds
presentation changes and broader evidence. It does not declare full A/Raid or
release acceptance.

## Delivered

- Distant ordinary Survivor machinery uses shorter body-local armor bars/plates.
  Detail expands continuously from 240 to 140 units away, before contact. Elite,
  heavy and objective targets retain full detail. Raid approach cues retain full
  geometry at every distance. Shield facing, armor fraction and exposed arrows
  remain visible; normal/reduced effects use identical state cues.
- Every visible actor still renders. These changes add no atlas frames, texture
  uploads or simulation changes. They reduce marker coverage, not sprite count.
- The one-airframe preset is labelled a challenge in EN and UK. Three airframes
  remain the default.
- The existing qualifier now accepts explicit `--seeds`, `--airframes` and
  `--mode` selections, rejects invalid options, preserves failed attempts and
  binds the resulting report to its source files.
- The Raid Creator's real download, clean-origin import, native replay and exact
  byte re-export have been exercised successfully through the browser UI.

## Verification

**29/29 presentation and renderer tests pass**, with scoped lint and formatting.
New checks cover continuous detail changes, distant armor fraction, exposed-state
geometry, near/priority detail, actor coverage, reduced-effects equivalence and
no extra texture work. Existing real-core/render regression remains in that test
cohort. [TAP](tests.tap) · [presentation source hashes](presentation-source.json).

[Native Survivor view](survivor-armor.png) shows small distant armor cues while
keeping the nearby final tank prominent. The run completed at **05:27, 2,602 kills,
ten upgrades**, matching the prior native Systems result. The retained screenshot
is from 05:03, not an exact-frame before/after comparison. The [result](survivor-result.png)
is a smoke check, not a performance result or player test. Native Survivor and
imported Raid pages reported no browser runtime errors.

## Expanded route evidence

[Full raw matrix](expanded-matrix.json.gz) and [group summary](balance-summary.json)
cover seeds **17031991, 42, 20261005**, both difficulties, all three encounter sets,
three builds, the Raid baseline kit, and one/three airframes.

**356 attempts**, **252 groups**, **201 groups with at least one completion**.
All **155 failed attempts** are retained. A Survivor group tries tight, orbit,
then figure-eight until one wins; Raid uses the build's selected objective/pack
route. These are bounded scripted reachability checks, **not human win rates**.

| Mode / preset | Standard groups with a completion | Veteran groups with a completion |
| --- | ---: | ---: |
| Survivor / one airframe | 12/27 | 2/27 |
| Survivor / three airframes | 27/27 | 26/27 |
| Raid / one airframe | 29/36 | 33/36 |
| Raid / three airframes | 36/36 | 36/36 |

The unresolved three-airframe group is **Survivor, seed 42, Veteran, Breakthrough,
Systems build**. Tight/orbit/figure-eight lose at **230.00 / 247.97 / 255.93 seconds**,
each consuming all 300 hull. This is before the final tank; prioritise its
mid-sortie formation/build interaction in the next balance review. It is not
proof that a human cannot complete it. A universal nerf based on one pilot would
also erase distinctions that other routes already negotiate successfully.

The three-airframe Survivor successes peak at **330–787 visible enemies**;
**11 of 53** reach 600+, with none above 800. Sustained dense pressure and its
readability still need player review. A maximum observed peak is not a promise
that every route experiences a dense surge.

One-airframe evidence is now explicit. Its low Survivor completion coverage is
why the UI labels it a challenge; three-airframe results must not be presented as
qualification of both presets. Raid's one-airframe baseline losses all occur on
seed 42 Standard at 14.73 seconds across the three encounters, identifying an
approach worth reviewing alongside the shield-screen design.

No gameplay tuning was changed to manufacture successful rows in this continuation.

## Actual Creator round-trip

1. On origin `127.0.0.1:8896`, changed both titles and moved `leader-1` from X340
   to X360 in Raid Studio. Validation returned project `c40e7f018ca69e3e` and the
   native preview showed the authored title.
2. Used **Export package** and retained the actual downloaded
   [13,417-byte package](creator-export.raid.json).
3. Opened origin `127.0.0.1:8897`, which showed no installed Raid packages, and
   selected that downloaded file through **Import package**. Both titles, X360,
   combat settings and shared dependencies survived validation.
4. Installed it through **Install in this profile**, then followed its native
   library link (`community=2c5e959cb7ecd5c0`). The explicit ordinary-input review
   pilot completed all seven objectives: **00:25, 54 kills, 22,550 score, no hull
   loss, seven armor breaks**.
5. Exported again through the second origin's UI. Both downloaded files are
   byte-identical, SHA-256
   `ce040b75d6f6fe0f279f9187fea8c6e6bff32cedeb3d362b286453251c99f1df`.

[Receipt](creator-receipt.json) · [imported Studio](creator-import.png) ·
[imported native completion](imported-raid-result.png).

This uses independent **game storage on two local origins in the same browser**,
not a newly created browser user profile, authenticated Community deployment or
an offline installation. Source came from the isolated checkout, with unchanged
static assets served from the shared checkout to avoid duplicating gigabytes.
No user storage was cleared. Actual package download/import/re-export is now
verified; cross-browser/profile and installed-offline coverage remain distinct.

## Remaining priorities

1. **P0 — targeted balance review:** Veteran seed-42 Systems failure; one-airframe
   difficulty; meaningful Raid resistance and human completion time. Keep the
   exact failure cases available rather than hiding them behind aggregate success.
2. **P0 — five-player readability/play review:** two newcomers, two runs each;
   verify compact armor recognition, exposed/guarded contact, flight decisions
   after upgrades, and whether late pressure feels sustained and fair.
3. **P0 before release — Iris Xe and M1 qualification:** actual hardware/browser
   measurements remain required. Node timings and these concurrent browser smoke
   checks are not FPS evidence.
4. **P1 — physical controls, audio and lifecycle:** physical controller/phone,
   sound-mix listening, current-candidate context recovery, retry/soak and installed
   offline checks. The local Creator download gap is closed; broader profile,
   browser and Community acceptance is still separate.
5. **P2 — additional modes/character mechanics:** Riy, Time Attack and Marathon
   remain behind acceptance of the current movement, contact and pacing rules.

## Reproduce

```sh
node --test game/test/overflight-variety-presentation.test.mjs game/test/overflight-renderer.test.mjs game/test/overflight-raid-presentation.test.mjs
node scripts/qualify-overflight-variety.mjs .cache/expanded-matrix.json --seeds=17031991,42,20261005 --airframes=1,3
```

Use `--mode=survivor` or `--mode=raid` for a narrower run. Default invocation still
uses seed 17031991, three airframes, and both modes. Read the retained full matrix
with `gzip -dc expanded-matrix.json.gz`. Run performance measurements separately.
