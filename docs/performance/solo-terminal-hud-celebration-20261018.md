# Celebration HUD refresh and terminal substage evidence

The unchanged celebration path now reuses the structural HUD while its picture phase remains the same. It still updates the clocks and the existing hunt, mastery, course and flight-details owners. The existing 100 ms guard is unchanged. Run/status/lives/coverage/score/input changes, explicit HUD dirtiness, locale and preference refreshes, and revealing → celebrating → settled transitions retain the full refresh.

This addresses demonstrated repeated work. It does **not** identify the cause of the earlier native WebKit terminal HUD samples of 74 ms and 84 ms, and it does not claim a native timing pass.

## Source and operation evidence

The same modeled public authored First Return route reaches victory at tick 631 and retains the exact checkpoint through 24 further revealing callbacks. Both versions keep 20 callbacks behind the original 100 ms guard and perform four clock/owner passes. Per unchanged pass:

| Observed operation                       | Previous source | Candidate |
| ---------------------------------------- | --------------: | --------: |
| Same-value property/style/dataset writes |              49 |        10 |
| Localized binding calls                  |              18 |         2 |
| Translation calls                        |              10 |         1 |
| Full classic projections                 |               1 |         0 |
| Changed property writes                  |               0 |         0 |
| Geometry reads                           |               0 |         0 |

The first victory HUD has identical operation counts in this model. The comparison uses instrumented JavaScript and a lightweight DOM; it is not browser CPU, layout, GPU, scheduling, or physical-display evidence. The earlier native observations used runtime `39774cce8697d412d138ef4da11ac547a5f8e535`; the reviewed HUD functions remained identical at the proposal base `5f1f1e8f3d493af231d46112796f8dda87dc401b`.

## Opt-in terminal measurements

The existing performance session receives seven numeric event kinds only for the final HUD call in the same update callback that completed terminal work: begin, clocks, owners, picture, values, controls, and end. They delimit inclusive elapsed substages; differences are not CPU attribution. The final stage includes encounter/classic projections and the remaining owners. The diagnostic remains off by default and uses the existing 256-event ring, with existing overflow and export ownership rules.

An end mark is emitted only after the full path completes normally. A begin-only or otherwise partial sample can also result from an existing throttle, fast return, or explicit early return; it is not by itself proof of an exception. No refresh is forced to complete a diagnostic sample. Previous event kinds and raw numeric assessments retain their semantics. Existing native readers retain this application data without a strict event-kind schema. Any native use of the new marks requires a newly built source-bound candidate; historical packages, declarations and failures remain unchanged.

## Verification

The complete performance-session, Solo transition-performance and win-picture host files passed **20/20** in 52.18 s against the exact candidate bytes. Controls preserve live capture/run checkpoints and generation changes; full/reduced reward timing and the single arrival transition; explicit locale/preference updates; hidden-state pause behavior; disabled diagnostics; ring overflow; partial samples; and independent numerical frame attribution. The actual before control failed with four unchanged coverage rewrites; the candidate records zero. The separate public-route operation model passed 1/1. Scoped lint and nonignored formatting passed for all five authored files.

Root integrated those exact five paths in `b89d729c8`. These are source/model checks, not native browser qualification. Raw controls, original failure and operation outputs remain under `.cache/solo-followup/terminal-hud-proposal/` and `.cache/solo-followup/terminal-hud-attribution/`.
