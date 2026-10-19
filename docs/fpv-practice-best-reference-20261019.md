# Local best verified practice reference

This source follow-up adds **Find best verified practice flight** to the existing aircraft archive controls. It searches only this device's bounded archive library, pauses the current flight, and verifies candidates sequentially through the existing native Academy or World worker. It changes no scoring, awards, legacy personal bests, physics, archive storage, or qualification policy.

The search uses the current complete course and configuration-class/terrain identity. Stored manifests only shortlist fresh, ended recordings with compatible settings; their status is never accepted as proof. Each candidate must pass the ordinary physical and course replay, including its post-completion tail, and obtain the verifier's private owned-proof eligibility. Copies, saved reports and custom workers cannot provide that ownership. Personal rotation rates and cosmetic camera settings remain compatible under the existing class rules; throttle/performance limits, aircraft, controller, mode, backend, timing and course conditions remain bound.

Among owned complete proofs, the lowest verified `course.completedAtTick` wins. Equal completion ticks use the archive ID as a stable tie-break. Archive duration does not determine the winner. The UI selects the winning archive but leaves **Use as split reference** and **Show reference aircraft** as separate deliberate actions. Every result remains unscored and ineligible for default or competitive promotion.

At most 16 manifests are inspected. The resolver holds only the best proof and the current candidate's bounded package and replay data; it does not collect every historical path. One worker runs at a time and is disposed before the next. Cancel, close, session replacement, recovery generation, archive selection changes and resuming a pending search invalidate the operation. Late reads or replies cannot install a result. Starting during active flight first requests a pause; resuming after an explicitly selected result retains the normal practice reference behavior. A final metadata check rejects a winning archive changed during the search.

Read failures, invalid records and concurrent changes produce an explicit incomplete-search warning. No result explains that clips, unfinished flights and incompatible settings cannot be used. Both messages are available in English and Ukrainian. The search never writes or deletes an archive and never saves a proof as reusable authority.

## Validation and release boundary

The focused tests cover native ownership and World adapter use, actual completion versus archive duration, deterministic ties, compatible personal rates, incompatible throttle settings and terrain, forged ended records, incomplete courses, altered same-ID course content, custom-worker rejection, concurrent archive changes, inventory bounds, sequential workers, cancellation and late results, initial active-flight pause ordering, explicit separate reference selection, and English/Ukrainian feedback. Test flights use short synthetic static courses; these checks do not establish rendered-browser acceptance, all-course support, platform qualification, real-device performance or measured aircraft fidelity.

Run:

```sh
node --test game/test/fpv-aircraft-archive-controls.test.mjs game/test/fpv-aircraft-archive-runtime.test.mjs game/test/fpv-aircraft-archive.test.mjs
```

This follow-up must pass final integrated source-bound package capacity and rendered acceptance before publication. Package limits and admission rules remain unchanged. Failed platform performance gates still block Advanced scoring/default promotion; they do not turn this explicit local unscored practice tool into a competitive system. Public accounts, rankings and server attestation are outside this local-device feature.
