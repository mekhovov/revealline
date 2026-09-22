# Gameplay pressure and mission readiness

Priority successor to v0.85.0. Keep the current release promotion independent.

1. Fix the unified mission library's static-image preparation failure without
   relaxing validation of uploaded media or changing content ownership.
2. Apply a shared, deterministic fresh-attempt pressure policy in Solo, Versus
   and Team: faster enemies, moderately faster craft and safely placed additional
   field enemies. Keep historical levels and replay playback unchanged.
3. Put difficulty directly on the main menu. Preserve an active/resumed attempt;
   changed settings apply to the next fresh attempt.
4. Add bounded browser-global admin playtest overrides for enemy speed, player
   speed and additional enemy density, with reset and truthful save warnings.
   Non-default admin overrides are labelled playtests and earn no normal awards.
5. Run focused regression checks, validation/lint/format and the release build.
   Long automated suites are explicitly waived, not reported as passing.
6. Review and publish through the sole publisher after v0.85 public acceptance;
   verify the actual frozen public mission launch and difficulty controls.

Initial speed/density values are tuning hypotheses, not human balance evidence.
No new artwork, campaign production, release infrastructure or destructive
storage migration belongs in this change.

## Implemented candidate

- Extra enemy speed relative to each compiled authored preset: Gentle 1.2×,
  Standard 1.6×, Expert 2×. Craft speed is 1.15×. Values stay within runtime limits.
- Additional field keepers: Gentle none, Standard targets 50%, Expert 100%,
  rounded up with at most six additions. Authored enemies remain; additions only occupy
  already enemy-retained components, with spawn clearance and no boss-isolation
  or narrow-corridor additions. Warning/active attack windows do not shrink.
- Main-menu difficulty and shared browser-wide Settings → Admin playtest tuning.
  Enemy multiplier 0.5–2, craft 0.75–1.5, additional density 0–2; Reset restores
  normal presets. Existing attempts retain their exact rules.
- Runtime revisions encode the tuning recipe. Restore reconstructs it from the
  installed authored level and compares the complete simulation; historical
  replay playback never reads current tuning preferences.
- Normal clears preserve Journey progression and Classic picture ownership.
  Classic collection admission requires exact reconstruction of the known
  pressure adapter. Historical mastery seals are not awarded for changed rules.
  Non-default admin playtests award no clear/medal/mastery and retire only their
  own completed suspended slot.

## Focused verification (source candidate, not public acceptance)

- Shared tuning + attempt preparation: 23 tests passed, including 819 Solo,
  108 Team and 192 retained Classic level/settings variants, plus unchanged
  historical full-clear replay fixtures.
- Couch/progress/artwork/actor integration: 57 tests passed.
- Solo settings/save integration plus historical sessions: 12 tests passed.
- Real-host Classic Start → Save → Resume → capture → win → Next: three tests
  passed, covering normal awards, admin no-awards and mastery eligibility.
- Journey direct Start/Continue: two selected cases passed, nine name-filter
  skips. An earlier run failed because sparse-checkout omitted its PNG fixture;
  that fixture was restored from Git before the successful rerun.
- Still-media/bundle/storage diagnostics: 46 tests passed.
- Bounded source-native browser check on the isolated local preview: main-menu
  Standard → Expert, Settings → Controls → admin slider Apply (1.25×) and Reset,
  then a normal Expert launch. Both field enemies rendered. A real downward cut
  was intercepted, reducing lives from two to one with the visible explanation
  “Your line was caught”; Pause/Resume worked. No native win or enjoyment claim.
- Long automated suites are waived. Full source validation and build must run
  in hosted CI because this machine has less than 1 GiB free; no local full
  build or artifact-copy success is claimed.

## Still open: reported PNG/JPEG mission error

The exact affected card/profile has not been identified. This change adds an
asset ID and validation stage to original-image failures; it is **not a claimed
root-cause fix**. Upload validation and existing media are unchanged.

Read-only inspection found all 16 v0.84 paired bundles and their 48 PNG originals
match published hashes. A bounded native v0.84 selector check downloaded Orchard
Crossing in Pressure Pictures (7.7 MiB), reached Play on all three chapter cards,
and reported no console errors. That successful path does not disprove the
reported failure. The affected mission name/mode or the new asset diagnostic is
needed for a targeted repair. Do not delete retained media to bypass it.

Human balance, physical-device coverage and new frozen/public acceptance remain
pending. No claim that stronger numerical pressure proves enjoyment is made.

The source PR does not allocate a release version or mutate publication files.
The sole publisher will promote it after v0.85.0 public acceptance and mandatory
exact-head hosted gates. This is the next user-facing priority, ahead of CI-only
efficiency work or unrelated content production.
