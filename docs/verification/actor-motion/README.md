# Current art and motion work queue

The [generated disposition report](art-motion-disposition.json) extends the
[current-entry actor baseline](../../actor-motion-live-baseline.md). It covers
every distinct actor role/runtime/material binding and exact mission artwork in
the current Solo, Versus and Team source owners, plus every slot in the compiled
presentation library. It is a source work queue, not visual approval or completed
C0/C7 qualification.

```sh
node scripts/art-motion-disposition.mjs --summary
node scripts/art-motion-disposition.mjs --write
node scripts/art-motion-disposition.mjs --check
node --test scripts/test-art-motion-disposition.mjs
```

`--summary` and `--check` are read-only. `--write` updates only this generated
JSON. The helper compiles fresh current-entry coverage rather than trusting the
saved baseline. It records content identities and hashes its relevant source
inputs without timestamps. It does not decode media, inspect browser storage,
change game state, edit production registrations, or rewrite historical reviews.

## Using the report

1. Start with `summary`, then follow a row's `policy` into `policies` for the
   evidence reason and next action. **Keep** preserves an exact original;
   **Repair** identifies a concrete gap; **Review** means evidence or ownership
   is incomplete. **Replace** requires visual evidence, a separately reviewed
   successor and retained compatibility; this generator never selects it.
2. `actorBindings` groups only equal mode, authored role, runtime type, theme,
   campaign material and optional FPV slot. Each placement links to an `owners`
   row with route/campaign/mission revisions, simulation identity and artwork.
   A Team drifter and Solo bouncer remain separate despite sharing an FPV slot.
3. `assets` records every compiled binding, exact asset/revision, file hash,
   geometry/anchors, recipe and source-review fingerprint. These are available
   library components, not proof each mission consumes them. `playerBindings`
   likewise records class capability without inventing a selected player setup.
   Campaign material painting and optional FPV appearances stay distinct.
4. `artworkBindings` retains actual current mission artwork ownership separately
   from the library's picture recipes. Inspect reveal fit, mask, complete reveal
   and exact Retry/gallery restoration; metadata presence does not verify bytes.
5. Inspect `unknownCoverage` before claiming completeness. Manual uploads,
   retained attempts, historical/installed/imported/explicit editions, effective
   configurations and rendered/device evidence remain unknown, with `null`
   counts rather than misleading zeroes.

The source metadata's `reviewed` stage remains unchanged. The queue does not
approve native candidates or the generated roster concept. Registered player
proportions remain a repair item following the current visual rejection, while
original bytes are preserved. The prepared patrol's empty registered rig remains
visible even when a renderer adapter or unregistered candidate supplies motion.

## Updating coverage and evidence

After a source or binding change, run `--write`, inspect changed owner identities,
source hashes and policies, run the focused tests, and run `--check`. Unknown
categories must receive an explicit classification and regression case before
being treated as covered. A missing current slot is a repair item; mismatched
compiled asset/binding identities fail the audit visibly.

Record actual visual decisions in a separate review with the exact asset and
source hashes, relevant owner IDs, rendered frames, viewport/state matrix and
limitations. Do not hand-edit this report to mark approval or overwrite an older
review. A correction needs a compatible successor revision through the existing
publisher, followed by regeneration. Reproduction tests prove report closure and
honesty; they do not certify artwork, frame time, devices or player comprehension.

## C4 behavior boundary

`behaviorCoverage` distinguishes authored default placements from existing
catalog/runtime capability and the three optional scout/sentry greybox studies.
Pursuit and interception already have current source placements. Optional scouts
and sentries have runtime/authoring code and studies but no authored default
placements in this snapshot. Test files are listed as evidence locations, not as
claims that those tests were executed by the report.

Zero authored role placements does not mean the behavior system is missing:
effective tuning, shared impact rules and Team specialist recipes need their own
configuration audit. Remaining C4 work is deliberate opt-in/teaching, appropriate
mode support, replay/checkpoint and score identity, current appearance and player
qualification. This report implements no attack or simulation change.
