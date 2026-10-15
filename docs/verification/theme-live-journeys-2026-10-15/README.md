# R7 unlocked game journeys — 15 October 2026

Reviewed the task checkout at http://127.0.0.1:8893 in the in-app Chromium browser. The user supplied the normal access credential and the preview was unlocked through its ordinary form. Credentials are not included in evidence.

## Fixed

Safari's closed native dropdown bezel rendered much shorter than the surrounding theme controls. The shared stylesheet now paints single-choice selects with the theme's inset material, native selection behavior and a current-color arrow. Resolved target height/padding now applies consistently. Listboxes retain their native presentation; forced colors restore native appearance. The same stylesheet is regenerated into optional SIM. A real select is now included in the close-up geometry audit, and its composition test was updated.

## Completed journeys and evidence

- Settings at 1280 × 720: Flight Deck, Ember, Polar, Desktop 98, DOS, Orchard and Vyshyvanka were selected live. Focus remained on the chosen card; screenshots were visually reviewed. Closed selects measured 44 CSS pixels. [Measurements](settings-measurements.json), [fields](settings-fields.png).
- Flight Deck at 390 × 844: picker, compact category navigation, Plain/Large text, reduced effects and Ukrainian translation. Dialog client/scroll widths matched (370px); the selected Ukrainian card had no internal overflow (322px wide). Controls reflowed. [Ukrainian enlarged card](ukrainian-large-picker.png).
- Mission library: search, select First return, open/close the brief, launch, pause and return Home. [Library](mission-library.png), [brief](mission-brief.png), [pause](pause.png). This source checkout reports unavailable artwork for some other campaigns; those missions were not qualified.
- In-game Settings → Help & Extras → Creator tools → Workshop tools → Theme Studio opened the real authoring page.
- Created a separate local review workspace, changed its family to Orchard, saved, exported the full .rltheme and reloaded. The saved family remained Orchard r1. Original Field Kit staged changes were reset before creating the independent workspace; no player progress or published community was replaced. [Export receipt](workspace-export-receipt.json), [Studio preview](studio-preview.png). The export remains a local download; import/recovery is a separate open gate.
- Restored English, Theme font, Standard text and reduced-effects off after review. Temporary viewport override was reset. The review workspace remains available locally.

## Verification and limits

The 155-test cohort initially passed 154 and failed one fixture composition assertion because the real dropdown increased its control count from 8 to 9. After updating that test, the affected 23-test theme-system suite passed. Thus all 155 distinct checks pass across the run and targeted rerun; a second full cohort was not run. Generated SIM/grain checks, JavaScript lint, formatting and diff whitespace checks passed.

Safari supplied the initial visual reproduction. Post-fix measurements and journeys above are Chromium; a post-fix Safari confirmation remains pending. 390px is a browser viewport, not physical touch evidence. This does not qualify all families on all pages, full contrast sampling, controller/screen-reader behavior, results/rewards, offline recovery or SIM flight performance. R7 stays open; the old password-gate blocker is cleared.
