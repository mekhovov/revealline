# Canonical worlds and endless Free flight

Free flight previously copied the first challenge remaining after the player's
search, activity and difficulty filters. Selecting a Hunt activity could therefore
open a smaller Hunt arena with fewer obstacles, even though the selected world
also contained a richer authored layout. It also stopped after 36,000 simulation
ticks: twelve minutes at 50 Hz.

## Player-facing changes

- Free flight selects its source from the complete installed catalogue, independent
  of the displayed challenge filters and catalogue order.
- Built-in worlds use their original non-Hunt, non-pursuit layout. Warehouse keeps
  six racks, Stadium three obstacles, Container Yard six containers and Garage its
  eight obstacles, including the deck and ramp.
- Imported worlds without a canonical built-in entry use the widest horizontal
  layout, then the layout with the most authored collision obstacles. Exact ties
  sort by pack identity and challenge ID. Archived entries are excluded; a missing
  world has no eligible source. Selection does not merge geometry from different
  revisions or mutate installed content.
- Free flight remains active beyond the former time limit. Pause, resume, retry and
  flight-mode switching keep it unscored. The EN/UK collection label, objective and
  pause-menu brief identify Free flight and explain that it has no time limit.
- Sector scoring and recording export are disabled. No recorder, recovery proof,
  completion record or medal is produced for this session.

## Implementation and compatibility

`canonicalFreeFlightEntry(catalogue, worldId)` is a pure selection helper. The
application clones the selected course, removes actors/pursuit objectives and
marks the transient catalogue entry `freeFlight`. Its original source course,
bounds and obstacle definitions remain unchanged.

The runtime already supports `unscoredPractice: true`: it skips the ordinary tick
limit and does not finish after the final objective unless an explicit practice
endpoint is supplied. This change enables that existing path for Free flight.
The `survive` objective can advance after 36,000 ticks, but the session remains
active and the UI continues showing the Free flight objective. The runtime also
rejects attempts to create a proof recorder for an unscored flight.

No physics, collision rules, scored course definitions, saved proofs or package
identities are rewritten. This increment does not enlarge map bounds or turn
decorative exterior scenery into collision geometry. Those require separate
authored Explore revisions.

## Functional evidence

Run the manual probe from the repository root:

```sh
node docs/evidence/fpv-endless-exploration-probe.mjs
```

The probe emits a JSON receipt with source hashes and **142 assertions** covering
all 14 built-in world selections, 28 initial flights across Self-level and Acro,
catalogue immutability, imported-layout fallback, archived/missing entries,
unscored proof rejection, and both modes remaining active beyond 36,000 ticks
before pause/resume/reset. It uses the production selector, course validator and
flight runtime. It additionally confirms runtime, collision and demonstration
source bytes are unchanged from the checkout's HEAD.

The 5 October 2026 run passed all 142 assertions against baseline
`cfa30a228eb25d2bc7e4dd6d76e417c0d76a6873`. Both sustained runtime checks reached
36,003 ticks with `status: active`, then passed pause/resume/reset. Runtime,
collision and demonstration source-preservation checks passed. Syntax, ESLint,
formatting and diff checks also passed for the implementation; the probe and this
document pass syntax/formatting checks. Re-run the probe after later integration
changes rather than treating this result as evidence for another source state.

This is functional verification evidence, not additional unit-test coverage.
The imported fallback uses synthetic selection metadata, and the probe reproduces
the app's practice-course projection without mounting the app. Browser acceptance
must separately verify Hunt/search filters followed by Free flight, the canonical
obstacles, EN/UK practice feedback, disabled export and mode/retry persistence.
No hardware, frame-rate, offline installation or actual browser result is claimed
by this probe.

## Root browser verification

The actual localhost development player was opened with a Snake Hunt filter. Free flight selected the original full Stadium instead of the filtered miniature arena, showed its scenery, armed deliberately, and displayed “Free flight · no time limit · unscored”. The final package adds a world-specific title. This is desktop Chromium evidence; the >12-minute continuation is covered by the production-runtime probe, not a native 12-minute hardware session. Frozen-source package/offline admission and public deployment remain pending under the same disk-space gate as the parent learning PR.
