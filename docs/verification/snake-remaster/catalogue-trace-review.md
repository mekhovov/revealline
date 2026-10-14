# Whole-catalogue trace and grading review

## Coverage

The expanded audit restores **1,260 exact-recipe winning journals covering all
240 official missions** through the existing match `onStep` observer. It includes
Solo and Team at normal pace for every mission. The 192 non-foundation missions
have all six mode/pace combinations; the 48 retained foundation missions have
normal-pace evidence, not a claimed slow/fast matrix. Twelve additional journals
exercise the revised mobile jammer's alternate schedules.

Twenty-nine new normal-pace journals fill retained foundation gaps: Team Open
Loop and both modes for 14 other missions. No recipe, quota, collision geometry,
grading threshold or simulation behaviour changed to obtain them.

Historical documents are admitted only when their recipe exactly matches the
current selected mission and pace. Duplicate mode/pace/seed/schedule setups are
counted once. The report keeps the originating file for each admitted route.

## Findings and decisions

There are **258 quiet-interval signals across 97 missions** and **zero capture
concentration signals** in the sampled routes. A quiet interval means no discrete
encounter/objective change; it does not mean that the player has no steering or
interception decisions. Crossing the board, routing a long cable, carrying cargo
and observing a moving target can exceed the initial 24-move or six-second signal
threshold. These signals therefore remain visible rather than being classified
automatically as defects or tuned away by shortening every mission.

The two extreme outliers were investigated using additional accepted routes:

| Mission / normal mode   | Retained route moves | Alternate route moves | Longest quiet interval, before → alternate |
| ----------------------- | -------------------: | --------------------: | -----------------------------------------: |
| Courier Overpass / Solo |                1,226 |                   119 |                             949 → 22 moves |
| Courier Overpass / Team |                  804 |                    95 |                             447 → 23 moves |
| Supply Circuit / Team   |                  284 |                   127 |                             160 → 27 moves |

The Courier Overpass trace shows the earlier pilot following the optional
courier for many circuits while a required runner remains available. Completing
the required interception instead avoids the prolonged chase. Supply Circuit
also has a much shorter accepted Team route. Twelve alternate journals verify
these unchanged recipes at all supported paces. The old routes and their flags
remain in the baseline audit; the alternatives are reported separately in
`outlier-trace-review.json` so the evidence is not silently replaced.

**Decision:** retain these recipes. The measured long stalls are avoidable route
choices, not compulsory waits or repeated mandatory catches. Reducing quotas or
changing enemy behaviour solely to accommodate the older pilot would erase the
optional-detour decision without evidence of a gameplay defect. Other modest
quiet signals remain review material; no claim is made that 97 missions have all
been player-tested or that zero concentration flags proves variety.

## Higher-star assessment

The eight tactical revisions remain **completion-only**. Their 48 primary
journals supply one automated winning route per mode/pace setup. Pace variants
usually share the same decisions; they are not independent calibration samples.
Seven missions use deterministic schedules, but the available evidence does not
justify choosing fair silver/gold budgets. Silent Parcel also varies its jammer
schedule; its additional seeds establish replayable completions, not a universal
performance threshold.

The alternate retained-mission routes and foundation gap journals are likewise
qualification evidence only. They are not fed automatically into the older
single-reference grading generator. Existing grades for unchanged exact setups
remain authoritative; changed identities cannot inherit them.

Before adding higher grades to the tactical revisions, collect independent
route approaches for each Solo/Team setup, review actual player performance and
agree the intended margin above a strong reference route. Variable-condition
missions need a separate fairness policy or remain completion-only. This review
does not invent either thresholds or a calibration requirement already met.

## Reproduction

- `node scripts/qualify-snake-retained-foundation.mjs --check`
- `node scripts/qualify-snake-trace-outliers.mjs --check`
- `node scripts/review-snake-traces.mjs --catalogue --check`
- `node scripts/review-snake-traces.mjs --outliers --check`

The report measures the included routes, not all possible strategies. It is
local development evidence and does not collect player telemetry.
