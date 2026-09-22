# Combined Journey: field-finale successor

2026-09-21. P12/P13 technical integration, **not human balance acceptance or a
public deployment**. The explicit `?journey=whole-spatial-v2` route now places the
reviewed ordinary-capture Home Signal alternative inside the complete Solo and
Versus Journey. Studio offers the same source through Inspect, then Apply.

## Exact scope

The 71-core/12-Remix sequence is unchanged. Home Signal uses `home-field-2` and
its `home-approach-1` map; the other 82 missions preserve their exact v1 runtime
levels, actors, difficulty policy and revisions. All campaign picture bindings,
actor materials and asset records remain unchanged. This is one successor of an
existing mission, not an increased content count or a new game mechanic.

The old `whole-spatial-v1`, older routes and default entry remain available and
unchanged. V2 has the stable profile key `journey-whole-spatial-v2` and suspended
attempt key `revealline.suspended.journey-whole-spatial.v2`; release versions are
not part of either identity. A v1 boss clear does not clear the new field finale.
Cross-edition backups are rejected rather than silently importing completion.
Solo and Versus retain separate progress within the v2 review profile. Team is
still separately authored and is not converted from these Solo layouts.

## Shared source and packaging

The build-time composer validates the complete successor. A 3,819-byte authored
mission/map delta is added to the existing checked snapshot, leaving its three
historical JSON exports byte-identical. The browser parses that delta and retains
the ordinary shared compiler boundary; it neither runs the expensive study
composer nor trusts a serialized runtime manifest. Both artwork variants match
the independently composed full source exactly. Factory callers own fresh data.

The snapshot is now 474,887 bytes with SHA-256
`a732e65f859ee5ffd3031cfe1fa0e316eaff38c896763cab5dec8b0814557fff`.
Existing selected-tree freshness, exact build bytes, ZIP/offline inventory and
post-validation mutation guards still apply. The 64 MiB offline and 950 MiB Pages
guards are not relaxed. This is not a full populated-tree release size audit.

## Verification scope

All 133 integration, persistence, Studio, route and packaging tests pass on Node
20.19.5 and 22.22.2. The cohort extends the preceding 120-test source-loading
qualification with six candidate tests, two actual finale-host tests, four v2
continuation/recovery checks and one canonical delta comparison. Sparse tracked
media reads use the same exact read-only Git fallback as the preceding study;
working files win. Lint, formatting and diff checks are part of the handoff.

- 996 runtime comparisons cover two artwork variants, all 83 missions, three
  presets and Solo/Versus. Home matches the isolated field-finale study; all other
  missions match v1. No manifest becomes official-progress eligible.
- All fourteen recorded field-finale samples preserve their exact evidence,
  replay results and equal paired-board outcomes in the pictured combined source.
- Actual Solo and Versus entry tests cover first clear, Next, two-action Skip,
  edition-specific mode links and progress. Solo additionally tests exact reload
  Continue and failed cross-pack picture preparation without a lost flight or
  false skip. The same tests still run against v1.
- Actual full Home Signal keyboard clears compare complete checkpoints at each
  capture/segment boundary and the original golden final hash. Solo completion
  opens voluntary replay/mission choice; Versus offers Rematch/Find missions.
  Neither automatically assigns a Remix. Completion writes are awaited before
  inspecting durable receipts; starting an asynchronous save is not proof it
  has reached storage.

### Engine inputs versus real gestures

The first host test reached the same no-loss victory but failed its final
checkpoint. Segment comparison located the first divergence at tick 936: the
raw engine log continued downward after closure at tick 930, whereas the host
correctly stopped at the return surface and required a fresh gesture. This was
not repaired by weakening the input contract or the assertion.

The test now independently finds capture boundaries in the reference simulation,
ends each rendered batch at that exact tick and sends real key release/press
events when the recorded direction continues. Full checkpoints and the original
`d74c7c88e032488d` final remain required. Host state is never injected. Reference
stepping fails explicitly if a route terminates early instead of looping forever.
Rendered batches contain up to six fixed ticks (50 ms), not a claimed 60 Hz or
physical-controller test. Scripted immediate re-presses are feasibility evidence,
not human reaction-time or enjoyment evidence. The old raw fixtures stay intact.

Independent review confirmed unchanged historical snapshot exports, all 996
runtime comparisons, profile/backup separation, Studio's Apply boundary and
snapshot build guards. It reproduced the initial host mismatch, verified the
fresh-gesture correction and requested the early-terminal guard. The corrected
Solo host test independently passed on Node 22 with its original golden hash.

## Native localhost observations

Studio Inspect compiled all 83 maps/missions without changing the saved isolated
finale draft. Explicit Apply created a separate combined project at checkpoint 1.
Selecting Home Signal showed Standard ×1.4, three lives, 85% earned target,
two named field anchors and 24 reserved non-scoring gate cells.

The Solo route showed its balance-pending test label and an 83-card searchable
chooser. An early Escape during image preparation cancelled without changing the
current mission; selecting Home again succeeded. A native Up cut secured 0.3%
and 50 points with three lives. Paused Field details listed two field hunters,
the contour crawler, dormant ground rover and four ordinary relay objectives,
not a boss release phase. Main menu → reload → one Continue restored that
coverage, score, lives and selected mission. This was a bounded UI observation,
not a new native full clear or measured warm-transition benchmark.

Native Versus opened the same labelled edition and retained the matching Solo
return URL. Its global chooser launched Home Signal on two separate boards.
W and Up produced a 0.3%, 50-point closure with three lives on each board, then
Pause stopped both. The gestures were not simultaneous; equal visible counters
are not an exact-checkpoint claim. Deterministic equality is covered by the
automated paired-host and engine checks above, not this native observation.

## Remaining gates

This integrates the playable comparison; it does not settle short finale routes,
quota tails, frontier usefulness, roamer bypasses or broader difficulty balance.
Timed bonuses, cultural/workshop maps and optional combat are not silently added
to this edition. Their own integration and qualification remain open.

Physical controllers, touch/small screens, two-human play, human capture
understanding, final content acceptance, coordinated reviewed PR/version/release,
full distribution capacity and verified GitHub Pages promotion remain required.
No old attempt, published edition, original artwork or release asset is replaced.
