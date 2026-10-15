# Late-choice pacing — measured correction for new sorties

16 October 2026. Runtime `cf16eea20`, stacked on the local-spacing performance
follow-up (#1533). The isolated comparisons ran against unchanged runtime sources
at `5f1906a46`; the named revision is checked separately against those outcomes.

## Delivered

New Survival V4 / Riy sorties use **1,250 / 1,550 salvage** for the ninth/tenth
choices instead of 1,400 / 1,900. The first eight thresholds, early evolution,
weapons, enemy behavior and spawn budgets are unchanged. This is a correction to
long late gaps, not an extra reward layer or a blanket damage increase.

New definitions identify `overflight-balance.v4.late-choice-1`. Previous V4
projects with `overflight-balance.v4` remain supported and retain their exact
thresholds, compiled gameplay identity and visual identity. Compile, import,
layout edits and explicit upgraded copies do not silently retune authored data.
V1–V3 definitions retain their earlier rules. Raid has no pacing/revision change.

The records validator admits the new named revision alongside every earlier
supported revision. Old and new records remain separate and survive reopening
a mixed profile. The new project identity changes gameplay records; artwork,
selected drone and shared appearance identity remain independent.

## Predetermined paired study

`plan.json` and `compare.mjs` define six configurations before execution: Survival
and Riy; Echo, Fan and systems builds; three world families/five layouts; four
seeds; Standard/Veteran; one/three airframes. Each runs current and proposed
thresholds, with the **original crowd rule**, isolating pacing from experimental
local movement. A 720-second cap retains incomplete outcomes if any.

All equipment is earned through legal draft offers. The native review controller
samples ordinary pilot input at 10 Hz and resolves earned drafts after 1.5 seconds
of simulated visible wall time. An earned snapshot at 180 or 240 gameplay seconds
continues with no input, including after replacements, while drafts keep resolving.
No equipment, hull, XP or random state is granted or overwritten.

| Configuration | Current outcome / time | Revised outcome / time | Longest completed draft gap, current → revised |
| --- | --- | --- | --- |
| Single Drone · Echo · Receiver Gardens · Standard / 3 | Lost 316.33 s | Won 404.17 s | 66.97 → 43.02 s |
| Riy · Echo · Receiver Gardens · Standard / 3 | Won 500.67 s | Won 528.83 s | 88.83 → 52.92 s |
| Single Drone · Fan · Broken Crossroads · Standard / 3 | Won 322.52 s | Won 321.53 s | 42.90 → 42.90 s |
| Riy · Fan · Shunting Yard · Veteran / 3 | Won 378.58 s | Won 348.83 s | 38.20 → 26.70 s |
| Single Drone · Systems · Dispatch Junction · Veteran / 1 | Lost 293.03 s | Lost 274.83 s | 37.90 → 37.90 s |
| Riy · Systems · Shelterbelt Gaps · Standard / 1 | Lost 338.12 s | Lost 295.07 s | 47.40 → 41.67 s |

Active wins change **3/6 → 4/6**. All **12 earned no-input branches lose**. Every
active prefix reached its assigned checkpoint, and every active run earned ten
choices. The receipt is complete with stable source hashes, approximately 318
seconds of wall execution, and retained per-draft/salvage/damage samples.

The two systems configurations still lose, earlier with the revised progression.
Riy Echo takes longer to finish despite shorter draft gaps. These failures and
tradeoffs are retained. Automated routes do not establish ordinary-player
challenge or enjoyment; this is sampled coverage, not a fully crossed balance
matrix or proof that every intended technique is viable.

## Compatibility and integration checks

- `before-checks.tap`: the new-default expectations initially fail while exact
  previous-project compatibility succeeds.
- `after-checks.tap`: the first candidate exposes two record-save failures because
  the older records validator rejects the new named revision. That admission was
  corrected before delivery; these failures are retained.
- `final-checks.tap`: **24/24 passed** across new/old progression, all authored
  battlefield defaults, exact previous identities, mixed-profile records and
  content validation.
- `integration-checks.tap`: **24/24 passed** across records, both community paths,
  battlefield packages and offline navigation/controls.
- `game/test/fixtures/overflight-previous-v4-pacing.json.gz` preserves actual previous
  Survival/Riy definitions and their identities from `5f1906a46`, rather than
  regenerating them with the revised factory.

The performance parent retains its separately measured three reference trials,
stress trial, graphics recovery and 154-check cohort. Those receipts describe
that runtime and fixture; they are not re-labelled as performance measurements
of a real sortie with this new balance revision.

`default-check.json.gz` reproduces the isolated proposed Single Drone Echo
outcome at **404.1667 seconds**, including exact stats and draft history, using
the new named default revision. Its gameplay identity is `104f94304355661f`.
The revision label itself does not alter RNG or combat.

## Native review and sound

A native Single Drone / Receiver Gardens / seed 202604 / Standard / three balanced
Scout airframes / Echo / figure-eight review is being captured against `cf16eea20`.
It uses the ordinary crowd rule and earned upgrades, with no review power grants.
The shared audio UI was explicitly set to unmuted, **Signal Afterglow** built-in
synth playback, master 0.65 / music 0.55 / effects 0.70, Humanoid reactions. Spoken
commentator reactions were already disabled; the existing caption preference is
preserved. Original settings will be restored after capture.

`settings-blocked.png` retains an inspection issue encountered navigating nested
menus. Native accessibility controls successfully operated Settings and Music;
this is not presented as proof of an application defect or a new UI fix.

Native completion, boss mix samples and exact identity assertions are added below
after the run. Recording excludes that sortie from timing qualification. Signal
metadata or a non-silent waveform does not establish subjective sound quality.

## Review boundaries / next work

- Review the actual native route, later rewards and boss approaches before
  declaring broad Echo/build viability. The systems losses remain open.
- Complete combined-build/map readability and local movement's actual-sortie /
  native ten-retry / full-soak coverage before promoting it from experimental.
- Keep Time Attack medal targets provisional; continue Marathon composition and
  refit review, and monitor the isolated imported-library observation.
- External hardware/input-device and five-player trials remain **skipped, not
  passed**. No new permanent stats, currencies, maps or home tiles were added.
