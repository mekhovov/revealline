# Pressure corridor runtime and reference-audit qualification

Date: 28 September 2026. Source: PR #735, prepared `whole-spatial-v37`.
This is source qualification, **not a public release or human balance receipt**.
No game rules, geometry, version, default selection or historical source ledger
are changed by this verification follow-up.

## Executed scope

The combined focused run passed **85/85 tests**, zero failures, skips or
cancellations, in 38.86 seconds on Node 20.19.5. Targeted ESLint and formatting
checks also passed. Independent cross-review found no actionable issue in the
audit or first-return changes. Localization, source validation and presentation
metadata checks passed. Validation reports five navigation warnings for generated
site destinations; this receipt does not claim a zero-warning browser crawl.
This is not a full-suite result.

- `pressure-corridor-effective-routes.test.mjs`: 72 first-return cases, covering
  three missions × two approaches × three presets × two steering policies ×
  two deterministic seeds. Each uses the shared gameplay-tuning path, legal
  fixed-timestep input, replay verification and both real untimed Versus boards.
- `pressure-corridor-triptych-candidates.test.mjs`: six preservation/topology/
  registration checks, including an opening no-loss check corrected to use
  effective rather than authored speeds.
- `journey-adaptation-coverage.test.mjs`: seven audit checks. Registered spatial
  editions v5 and later are accepted from the existing route registry; partial
  routes, Team families, unregistered versions and aliases remain rejected.

The first-return suite checks no lost life, no bonus collection, a stopped craft
at closure and the intended return foundation. The lower Pressure ladder route
captures part of its slow-field approach. Relay approaches capture different
required relays, open exactly their respective permanent connectors and preserve
the coverage denominator. The earlier fixture-author errors (a strict interior
landing assertion and a wrong Gentle wait) were corrected before the final run;
they are not presented as product defects or successful initial tests.

## Current reference coverage without rewriting history

Run the audit against an explicit edition:

```sh
node scripts/audit-journey-adaptations.mjs --edition whole-spatial-v33
node scripts/audit-journey-adaptations.mjs --edition whole-spatial-v37
```

v33 belongs to the current published source line; v37 is prepared only. The CLI
reads local source and makes **no HTTP/public validation claim** for either.
Both local v33 and v37 audits resolve 64 source records, all 48 numbered references, 66 adaptation links,
91 missions and 396 linked mode/preset identities. There are 29 original missions
without reference links and **zero final dispositions**. That is expected: links
are declaration coverage, not final design approval.

Historical declaration sources, reasons and reference hashes stay exact. Existing
reports were serialized and hashed before and after the implementation; all seven
hashes match:

| Edition            | SHA-256 of `JSON.stringify(report)` before and after               |
| ------------------ | ------------------------------------------------------------------ |
| greybox            | `aaf75afc9653ad1b209b43f17825b3fa9aad0d0bcd36723124f0e1834719ab67` |
| originals          | `ef32d126cf418726149814686220416703d8256aeea5dc084e9cb254ce8bd89a` |
| teaching-originals | `279cf05601b2e07d29a17797472294faf1c044df6b17ec0adc5e7f9774fe86b3` |
| campaign-originals | `b9df5cb0c719c39457591bd4e63d0d432ef0a66fb9dd95b6b2eff76689a1a658` |
| actor-originals    | `10e6a1080451610159a1207f6204c443b7f2a8327dcc84a54e0307c3df87876a` |
| whole-spatial-v5   | `6f6b179aaf5c027a50ac1d08d18e16bc3166facdb98b5b3d0071ecfe70c2bba0` |
| whole-spatial-v6   | `92670e32bb1ba12a5b03b552aa7db184044e128ecbc85e0b1fa1cdb927714fc6` |

Tests compare ledger/crosswalk bytes before and after, reject edited pins or
fabricated final dispositions, and compare CLI output with the API report.

## Limits and remaining gates

This is **not full-route balance evidence**. The fixed waits in Pressure ladder
are authored test inputs. Several earlier naive departures lost a life when the
frontier patrol struck the unfinished trail; alternative successful windows do
not prove a player will understand that failure or enjoy retrying it.

A separate 15-second bounded Standard/immediate/seed-1 feasibility search made
three no-loss cuts and reached 16.999% coverage at 1,881 ticks, still running.
It did not clear the mission. This is neither an impossibility finding nor a
completed-route receipt. No long-suite pass is claimed.

Still required: complete ordinary and efficient routes, useful pressure/erosion
interactions, all-presets pacing and mastery, tested public selection/Next/Skip/
Continue, actual controller/touch input and human fairness/retry review. Studio
and curated prior-edition discoverability also lag the latest opt-in editions.
The separate publisher owns exact merged-source build, immutable hashes, archive
preservation, version allocation, Pages and scoped public verification.
