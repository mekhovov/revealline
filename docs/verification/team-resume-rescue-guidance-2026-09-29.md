# Team Resume: restore the current rescue instruction

Status: focused source correction for the existing Team readability batch,
not a new gameplay policy, product version or public acceptance receipt.

Base: `b5ab06e12542f72e33c45b973ba693a5e1509c1c`.

## Observed failure and correction

Public host inputs reproduced a downed player with no reserves. Pause → Settings
→ Resume retained the downed state and unchanged world, but replaced the cause
and rescue target with “Choose fresh directions when you are ready.” A real
Support pulse could also overwrite the last advisory before that Resume.

Resume now selects a currently downed player and reconstructs the localized
cause, player name and existing rescue instruction from retained knockdown
evidence. Both the live knockdown and Resume use the same caption factory.
If neither player is downed, ordinary fresh-direction advice is unchanged.
Revival, a completed partner rescue and a new attempt retire the old advice.

This only changes host message selection. It does not change simulation rules,
world time, input rearming, Support ownership, teaching progress or rescue-channel
cancellation. The travelling-impact message uses the failure cause, not a claim
that every specialist can intercept impacts. Both roles can perform contact rescue.

## Focused verification

Node 20.19.5, on the isolated source checkout:

- `node --test game/test/coop-resume-down-warning.test.mjs`: **8 passed**, no
  failures or skips. Covers both seats, Settings roundtrip, EN/UK live caption
  switching, unchanged clock/coverage, overwritten Support advice, ordinary
  Resume, reserve recovery, proximity rescue, confirmed Retry and an authored
  current-rules specialist fixture with a real travelling-impact knockdown.
- `node --test game/test/team-contextual-teaching-host.test.mjs game/test/coop-briefing-host.test.mjs game/test/coop-recovery-copy.test.mjs game/test/team-recovery-cause.test.mjs game/test/team-line-impact.test.mjs`:
  **31 passed**, no failures or skips. Retains adjacent teaching, role help,
  recovery and owned-impact coverage.
- Changed JavaScript files pass ESLint with zero warnings and Prettier checks.
- `git diff --check` passes.
- Independent read-only code review found no actionable defect. It checked
  current downed identity/cause, localization callbacks, state retirement and
  specialist contact-rescue compatibility; it did not run tests or inspect devices.

Individual pre-fix red reproductions established the generic-caption failure.
A later full-red cohort overlapped the host edit and is **not** claimed as an
exact-baseline run. An initial adjacent-test command named a nonexistent
`coop-feedback.test.mjs` and did not execute tests; the corrected command above
completed successfully. These diagnostic mistakes are not product regressions.

## Remaining delivery gates

The host fixture uses public inputs and authored imports with finite DOM/inert
canvas; it is not a physical controller/touch, native browser or human playtest.
Full suites remain waived, not passed. The combined Team PR still needs its
final integrated source checks, build/provenance, immutable publication and
bounded verification on the actual frozen public build. Large-text rendering
and More-collapse behavior remain separately owned changes in that batch.
