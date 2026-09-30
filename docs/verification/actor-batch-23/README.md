# Surface motion, buffered pursuit and retained artwork — batch 23

Parent: `049bd1f7da058209119230aa4f60e5be0ce6884c` (existing draft PR761).
This is a bounded parallel A/B/C-source batch. Production review remains deferred;
no artwork, mission, release version or production approval is adopted here.

## A2 — sampled surface motion

The prepared enemy surface accents used raw body/travel clocks multiplied by
per-part rates. In the real bouncer movement sample at 12 cells/s and 60 FPS,
a rate-6 travel mark advanced 0.54 of a cycle between paints. It therefore
appeared to move backward by 0.46 cycles. Merely checking that the clock changes
does not detect this failure.

Two independent sampled surface clocks now bound every accepted part to at most
0.22 cycles per paint. The helper uses the existing maximum admitted rate of 8;
a schema-bound regression rejects an uncoordinated increase. Body phase, travel,
gait, rotors, facing, badges and physical contact cues retain their prior command
stream. Original image bytes, part geometry, rates and simulation remain unchanged.
Legacy direct frames retain their finite supplied pose; current sampler frames use
the new clocks. Pause, freeze and stun hold; reduced effects omit these accents.

The focused evidence inspects painted marks across all existing part declarations
at 10/30/60/120 FPS, supported rate limits, containment, stationary/idle separation,
held states and elapsed-time return. A real prepared BoardPainter fixture retains
the accepted image object and authoritative core checkpoints. Canvas calls and
lifecycle inputs are modeled; this is not native pixel, browser-background,
physical-device or whole-roster visual approval. Final counts and hashes are in
the manifest and retained TAP receipt. The complete four-file cohort passes
**85/85**, with zero failures/skips/cancellations:

```sh
node --test game/test/enemy-surface-sampling.test.mjs game/test/enemy-body-motion.test.mjs game/test/actor-presentation.test.mjs game/test/coop-actor-presentation.test.mjs
```

`surface-parent-red.tap.gz` retains the valid 2-pass/8-fail original result. An
earlier placeholder golden-hash calibration is not used as regression evidence.
Independent review found no source blocker.

## B — buffered pursuit through the actual Solo host

The existing Band pursuit Standard / grid-center / seed1 route now shares the
actual practice admission, input, Pause, recorder, terminal-state and Retry
harness with Lens intercept. This extends qualification of authored content; it
does not add or rebalance a mission. Grid-center is deliberately selected before
scenario admission, not misreported as the preview's default or ordinary Journey
fresh-attempt tuning.

Band preserves identity `8641e22597e489bd` and checkpoint `ac781296e170bdfa` over
6,726 ticks. The route exercises a trail pursuer alongside a perimeter patrol,
with four warnings, two commitments, three capture cancellations and one full
commitment expiry while a cut remains open. Five queued-turn windows spanning
30 ticks resolve at cell centers. The patrol keeps the outside boundary.

Pursuit target observations prove a retained trail endpoint lock that the moving
player leaves behind. They do not establish a deeper-trail target independent of
the pre-step head: warning sensing occurs before movement. Warning Pause holds
the exact actors and lock. Recorded commands replay to the same terminal state.
Held native Enter repetition cannot activate the explicitly focused Retry; a
released fresh command can. Automatic result-focus placement is not tested here.

All previous Lens interception/frontier assertions remain, including its exact
5,130-tick result, capture cancellation, moving/rejoining frontier, immediate
steering, replay and no-write boundary. Both routes retain their authored scenario,
class, theme and initial Retry checkpoint. These greybox previews explicitly have
null decoded actor/backdrop leases; they prove neither restored production artwork
nor human fairness, native browser or physical input qualification.

The exact final file passes **2/2**, with no failures/skips/cancellations:

```sh
node --test game/test/pressure-combination-practice.test.mjs
```

The final run took 587.75 seconds under observed CPU contention. An earlier
188.01-second pass and its tested source are preserved separately; comments and
one assertion message were then clarified without changing predicates or flow.
The final full rerun pins the corrected source. Independent reviews found no
behavior blocker. Scoped ESLint, syntax, formatting and diff checks pass.

## C — real revision 7 packet remains intact

A read-only audit found no new defect in the existing collection path. All nine
files, 17,884,748 payload bytes, exact hashes/dimensions and six parent relations
pass. All eight predecessor records and other collection declarations remain
unchanged. Strict export reproduces the retained native download byte for byte:
17,904,621 bytes, SHA-256
`942580e3d25345f24ee83509d719a3f4033c77d878aabe82b28a127f4aec4967`.
Strict reimport preserves every payload; bad hash, truncated/trailing packet and
unknown parent inputs reject. The dimension adapter reads PNG headers; no fresh
browser decode or art approval is claimed.

The exact as-run audit script, inputs, reviewed helper hashes and output are
retained beside this note. The script records local evidence paths deliberately;
it is a one-off receipt, not a new authoring tool. Nine packet/preview/helper files
match publisher source `81df80dda259ba8e1cef5378af1cec91260eb51e`. Its separate
Studio retained-source export/focus changes are not duplicated.

The original cohort READMEs now point to already-prepared revision 5 and revision 7
board derivatives. They no longer list that preparation as missing. Cultural and
pixel review, gameplay contrast, approved bindings and production adoption remain
open. No packet, image, original ownership or current mission is changed.

## Integration and remaining work

Keep the existing publisher's newer hosts and retained-content work. This worker
branch is an implementation donor, not a rebase of the active release. Changed
renderer hashes require the applicable integrated source/provenance review; old
fingerprints and approvals remain immutable. The waived long suites are not
reported as passed. Build, immutable publication and public byte/play checks remain
with the single publisher. Local free space fell from 3.2GiB to approximately
596MiB during this turn, below its release reserve. This worker created only small
source/evidence files and started no build, asset download, extraction or cleanup.

Priority remains A current characters/reliable play, B broader encounter and
fairness qualification, C the first accepted artwork cohort, then supporting and
whole-content work. C2's formal human study remains last. This batch does not
complete an entire phase or replace deferred production/device qualification.
