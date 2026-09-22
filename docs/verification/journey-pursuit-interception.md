# Shared pursuit and interception authoring — D1

Local successor candidate. Required independent specification review approved the
[D1 contract](../superpowers/specs/2026-09-21-authored-pressure-roles.md). No public
enrollment, new engine or Team qualification is claimed.

## Implementation

- Additive immutable `journey-actors-v7`: trail pursuer and heading interceptor use
  the existing tested field-retaining `enemy-pressure.v1` runtime. Earlier
  catalogues, capture and gameplay/replay versions are unchanged.
- Shared recipe:18cell sense radius,24tick scan,120tick locked warning,180tick
  commit,360tick base cooldown; lead0/36 for trail/heading respectively. V2 rest
  resolves450/306/234ticks by preset. Warning/scan/lead/commit never shorten.
- Compiler, pressure audit, Studio and preview share effective recipes. Strict
  actor keys reject arbitrary timers/speed/scripts. No pressure descriptor when
  no such roles are present. Team rejects unqualified roles.
- Studio offers named roles, registered movement tiers, heading and effective
  timings/counterplay. Existing immutable CRUD/stale protection/Undo remain in use.
- Persistent TRAIL/HEAD labels distinguish the two behaviours before attacks;
  AIM/CHASE/REST retain mode labels and owned target markers. Paused details name
  each role. Compact briefing distinguishes closing from heading evasion.
- Six optional encounter variants use six existing C1 geometries: Stitch return,
  Oval escape, Band pursuit, Motor feint, Circuit switch and Lens intercept. Two
  three-mission arcs introduce one role each and later combine a known patrol.
  These are not six additional map designs or final picture compositions.

## Evidence

Combined130/130 tests pass on Node20.19.5 and22.22.2; ESLint, Prettier and
diff whitespace checks pass for changed code. These are scoped gates, not a full
repository build or release acceptance.

36 no-loss Solo clear/replays and36 independent equal paired-board race clears:
six variants × three presets × two steering policies, seed1, no pickups/timers.
Every recorded route triggers the new role's warning. Committed attacks occur in
every preset/steering arc; some Lens routes cancel all warnings by timely closure,
which is valid counterplay, not an assertion of having experienced a charge.
Exact simulation identities, final checkpoints and pressure event counts are pinned.

An initial six-process route search exhausted its20second wall-clock search budget
on four Lens cases. Isolated bounded reruns found valid no-loss routes. This was a
search-resource limit, not a game impossibility; no engine or assertion changed.
The retained fixtures run directly and do not repeat the search in CI.

The same combined cohort also replays all48 earlier C1 routes, checking unchanged
identities and outcomes. Additional tests cover immutable catalogue inheritance,
Solo/Versus parity, strict failures, exact cadence, sorted actor recipe IDs,
ten-second lossless stationary spawn observations, CRUD/Undo and Team rejection.
Existing pressure tests cover real sensing, locked targets, warnings/commit/cancel,
freeze, topology invalidation, bounded routing and exact saves/replays. Renderer
tests check text distinction, small-board labels and no authority mutation.

The first corrected briefing exceeded the existing240character card limit on an
older pack. Shortened the guidance rather than relaxing that readability gate.

## Pacing and outstanding acceptance

Optimized immediate-steering seconds (Gentle / Standard / Expert):

| Variant | Seconds |
|---|---:|
| Stitch return |19.85 /24.85 /32.75|
| Oval escape |48.55 /59.25 /50.25|
| Band pursuit |64.35 /57.25 /60.35|
| Motor feint |42.25 /18.75 /16.75|
| Circuit switch |35.45 /49.45 /58.55|
| Lens intercept |44.35 /42.75 /42.75|

Motor remains a clear speed/pacing inversion risk; an aggressive interceptor can
become easier to isolate. Stitch is a short teaching candidate. These are not
human timings and do not prove desired60–150second first-play pacing or enjoyment.

Native warning/commit observation beyond the launch/role checks below remains
required, followed by multi-seed/counterplay variants, device/reduced-effect/muted checks, human
understanding, mastery usefulness and pacing redesign. New sprite/material/art
approval and optional combat actors are separate work. Integration PR/version/
Pages belong to the release owner; do not add this to frozen v0.77.0.

## Native exact-source observation

Commit`4963722a`, read-only port8817: explicitly inspected/applied the six-variant
project. Actor editor showed Trail pursuer and Heading interceptor with standard
4.48cells/s and exact1s/1.5s/2.55s warning/commit/recovery. Started both Stitch return
and Motor feint, made two real cuts in each, observed persistent TRAIL/HEAD labels
and correct compact briefing, then paused and read the distinct role names in Field
details. No losses or console warnings/errors were observed during those short
cuts. Native observed coverage11.7%/0.8% respectively; neither was a native clear.
The transient warning/commit phases were not visually captured in these native
checks; their present evidence is the real-input fixtures and renderer tests, not
an invented browser observation. Physical devices and human balance stay pending.
