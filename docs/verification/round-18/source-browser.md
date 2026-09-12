# Round 18 source browser checks

Checked 12 September 2026 in the Codex in-app browser on owned port 8808. Source is the v0.8.0 equipment-goal increment; the [source input inventory](source-inputs.json) identifies the final tested files. Early screenshots preceded the marketing-version label change from v0.7.0/DEV to v0.8.0/DEV. QA imports did not replace a user release profile.

## Play, goals and collection

Homeward Skies was installed through Library & saves → Expansion packs. The normal saved-file picker restored the existing Round 14 legal input prefixes, each stopping 24 boosted ticks before its recorded finish. Final cuts were flown with visible controls and Tap steering. These are actual browser continuations of legal fixtures, **not complete manually flown routes**.

- **Supply Line / Immediate:** the restored pause checklist showed both collected pads, both completed region crossings and the Light carrier → Heavy carrier switch, with mission finish still pending. Resume plus Move up closed the route: **71.1%, three lives, 11,910 points and gold**. Replay checking reported the seal earned and saved.
- **Safe Return / Grid + buffer:** the restored checklist showed the qualifying return complete and clean finish pending. Resume plus Move right completed **73.1%, three lives, 11,740 points and gold**, then saved Safe Return. The [picture detail screenshot](screenshots/safe-return-picture.jpg) shows the original Home Beacon art and **Impact craft · Grid + buffer · seed 1**.
- Collection retained both pictures and seals. Its new Campaign achievements heading explicitly identified Homeward Skies; it did not imply that this separate achievement section spans every campaign.
- **Ordinary Interceptor / Home Beacon / Immediate:** a new fixture used the original fallback input prefix through tick 781. Save & pause, reload and Load saved flight preserved that ordinary route. Its manual final Right cut won **73.1%, three lives and 11,740 points**. No third seal appeared. The final UI marked the clean finish complete while leaving the pulse requirement pending and preserving the picture/continuation controls. This exercises the partial-completion review fix.

The [profile export report](profile-checks.json) records actual public-UI exports and hashes: after the ordinary clear, two pictures, three scores and two seals. No synthetic metadata was inserted to manufacture an award.

## Recovery and open-cut restoration

The local script `.cache/round-18/create-browser-fixtures.mjs` created bounded prefixes exclusively through public core/recorder APIs and validated each suspended session before browser import. It neither edited simulation state nor generated a mastery award.

At Safe Return tick 105, the craft is respawning after its qualifying pulse. The browser showed “wait for the craft to return,” with no completed recovery check. Save & pause, reload and Load saved flight retained that pending phase. Resume with no movement allowed recovery to complete; a later Pause showed “craft returned safely” and the clean finish still pending. The remaining deadline read 0:21, so this inspection was not treated as a speed run or completed mission.

At Supply Line / Grid tick 460, the west pad was collected and four west-region cells were on an open cut; no crossing was yet banked. Import and later Save & pause/reload retained **0 / 2 closed cells; four pending**. The west and south requirements stayed distinct, and the missing pad and hangar switch remained readable.

## Phone, landscape and keyboard reading

Initial measurement found Resume at 42 px high on 320 × 640 and 36 px on 844 × 390. The [before-fix measurements](checklist-viewports-before-fix.json) are retained. The final overlay action rule keeps Resume at **44, 44 and 45 px** across 320 × 640, 844 × 390 and 1440 × 900. Each document width exactly matched its viewport; [final measurements](checklist-viewports.json) record the button bounds and scroll dimensions.

The six-item Supply checklist uses the existing scrollable message area. It is now a focusable Mission details region with a visible outline. On the phone layout, End followed by ArrowDown scrolled it from 0 to **161.5 px** (309 px content, 147 px viewport) while the game stayed paused and the deadline text remained **1:01**. The [phone reading screenshot](screenshots/phone-reading.jpg) shows the final requirements, Resume and touch controls. After the separate hangar-shortcut fix and reload, G followed by End left no dialog open, retained Mission details focus and kept the same paused clock. No JavaScript state assignment or hidden gameplay hook was used.

The [larger checklist screenshot](screenshots/supply-checklist.jpg) documents row readability; its browser screenshot has cropped outer-page edges and is not used as proof of viewport fit. Actual DOM bounds above establish the layout observations. Controller navigation's selector is unchanged; this increment does not add controller-driven text scrolling or claim physical-controller verification.

## Authoring preview isolation

The source playground loaded Homeward Skies with its visible example-pack button. After “Expansion decoded,” River Switchyard and Light carrier were selected and Play configuration loaded the actual engine iframe. It displayed **Practice goal · Supply Line** with the same requirements.

A fresh Start and Supply-pad press collected the west pad. A second press reported “Your supplies are already full”; the checklist retained one collected pad, with both region crossings and the switch still pending. Pause showed one of one charges and the same named rows. These are fresh public-UI actions, not a fixture replay or a completed practice win.

The standalone game then reloaded and exported its library again. The complete **4,663-byte** export matched its pre-practice export byte-for-byte, SHA-256 `7339c6426e6d3f1c80a901146edb99374d05000a725f2a4844ad762c1b36a501`. Practice changed neither saved preferences nor campaign/gallery/score/seal records. Sampled source and playground warning/error logs were empty.

These browser observations complement [985 passing source tests](source-gates.md) and [independent review](independent-review.md). They do not establish physical touch comfort, controller hardware, Safari/native behavior, audible quality, public hosting or human enjoyment.
