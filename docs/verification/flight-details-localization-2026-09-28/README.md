# Flight Details EN/UK correction: retained evidence

Source base: `c5885a15561a88331c5566c5312392c4e5d8daf5`. Candidate file hashes and verification boundaries are in [review.json](review.json).

- [Focused cohort](focused.tap): **69 passed, zero failed/skipped**, covering both encounter versions, typed field roles/effects/lanes, captured notices and snapshot immutability, EN → UK → EN, retired visits, and actual mounted Solo Pause/Read/Done/Back/Resume in both turning modes.
- [Original-runtime comparison](baseline.tap): **four expected regression failures**, one passing controller journey and fourteen cases filtered out. The comparison substituted the base app, Flight Details presenter and encounter projection; it retained the new tests and candidate catalog. The four failures are typed translated facts, the live open reader, and both mounted turning modes. All three files were restored before the final cohort.
- Scoped ESLint, Prettier and whitespace checks passed. Complete generated resources decode exactly to locale source JSON. All 43 new flat keys have Ukrainian text and matching placeholders.
- Independent review identified two issues, both corrected before the final run: captured English control labels and an impact-carrier summary incorrectly grouped as an ordinary field hunter. The final read-only review found no remaining blocker in scope.

The mounted controller fixture originally failed on both base and candidate: it reset an already sampled monotonic clock to1000 and used a30ms release against the120ms Confirm gate. It now starts from the current host clock and leaves5×30ms neutral samples. Production controller protection is unchanged. Host fixtures use modeled DOM, media and standard Gamepad inputs; they do not certify hardware or visual quality.

Earlier sparse-checkout diagnostics exposed missing fixture files and were resolved by materializing bounded existing Git blobs (including4.01MB of compiled presentation dependencies), without network downloads. The first implementation also used nested locale objects despite `keySeparator:false`; final resources are flat. None of those preparation failures is represented as a passing check.

The full suite, production reproduction/readiness, ordinary build, browser visual review, listening, physical input, public deployment/playback and offline qualification were **not run for this branch**. Existing full-suite waivers remain skipped, not passing. The release coordinator must requalify the cumulative source, reconcile the shared catalogs and presentation/audio source fingerprints, then publish and verify the release.

Retained TAP display removes trailing whitespace; `review.json` records the original unmodified output hashes.
