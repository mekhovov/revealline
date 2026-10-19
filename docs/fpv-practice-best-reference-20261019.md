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

The integrated qualification and rendered acceptance below satisfy this local gate; publication and public acceptance remain. Package limits and admission rules remain unchanged. Failed platform performance gates still block Advanced scoring/default promotion; they do not turn this explicit local unscored practice tool into a competitive system. Public accounts, rankings and server attestation are outside this local-device feature.

## Rendered search acceptance — 19 October, 06:49 CEST

An exact local World package at `cf26a2a083420c48e58f7430f44a50e4cac2c61f`
(tree `9a6f53cf75df014fb5dfdbf5c0b7dd4d4f73c8ce`) was served at the existing,
owned local test origin. Normal UI retained the saved Nazgul setup and the genuine
completed flight from source `1dfb180f2`; no archive was injected, edited or deleted.

Through Learn to fly → level147 Meet your drone → Restart lesson in Self-level →
Practice with Nazgul → Pause, **Find best verified practice flight** replayed the
local candidates and selected the finished `2026-10-19T04:17:18.397Z` archive.
The UI reported **Recorded course completion verified: 14.34 s. Unscored. The
current flight is unchanged. Fastest completion among checked compatible flights.**
The other displayed records were open/incomplete. This inventory had one completed
compatible reference; synthetic tests separately exercise multiple winners/ties.

**Use as split reference** and **Show reference aircraft** were both enabled but
unselected. Explicit clicks changed them to **Clear split reference** and **Hide
reference aircraft**. A new search followed immediately by Cancel reported
**Course verification cancelled**, removed reference actions, and retained the
cancelled state after a later observation. Rerunning selected the same verified
archive and again allowed separate deliberate reference actions.

The first attempted cancellation was too late: the short search had already
completed, so there was no Cancel button. The subsequent immediate cancellation
is the successful cancellation check; the earlier timing miss is not presented
as a product failure. There were no warning/error console entries. The newly
started current attempt remained paused near its starting point; it was not used
as a completion candidate. All local archives remain retained. The temporary
browser tab and server were closed. Protected public storage was not touched.

Screenshot and accessibility evidence: `world-best-practice-reference-cf26a2a083`
`.jpg`/`.txt` in this task's sustained-flight evidence directory. This is local
World-host Flight School keyboard acceptance, not public deployment, Academy,
all courses or platform performance qualification. It precedes the separately
reviewed audio-sharing projection and must not be relabeled as that later build.

## Final combined qualification and Academy acceptance

Combined source **`9dd87a9c1aeb05107b4d13f0e5f6806f75f38faf`**, tree
`3f99693d2821d8c50d42e360a77e6e6bea531d63`, integrates the search, PID corrections
and reviewed canonical audio-bank reuse. **776/776 focused checks and 19/19
package checks** pass, with no skips. Scoped lint/format and both shell/audio
canonical projections pass. All **243** distinct packaged inputs match the
committed bytes and hashes. The focused set extends the prior 743-test cohort
with the search cases, archive-storage suite and audio-projection suite.

The initial isolated search failed Academy original-input capacity by **5,720
bytes**, retained in its isolated receipt. No limits were increased. Reusing the
already-admitted canonical audio bank removes **52,782 duplicated bytes**, while
retaining all sounds and per-instance playback state. Final Academy inputs are
**13,255,277 / 13,303,808 bytes**, leaving **48,531 bytes**; World has **1,225,989
bytes** spare. Source-file counts remain 98/151/211. [Exact combined receipt](fpv-practice-reference-qualification-20261019.json).

The actual combined Academy package was served at its existing owned local test
origin. The saved Meteor75 and Self-level Lift and land course remained selected.
The explicit search chose the genuine finished `2026-10-19T04:21:30.754Z` archive
and the native worker verified **17.20 s**. Incomplete archives were not chosen.
Split and visual reference buttons remained separate deliberate actions; after
selection, Resume → Pause retained both selected references.

Opening Settings, switching English → Ukrainian and returning translated the
result to **Найшвидше завершення серед перевірених сумісних польотів**, retained
the 17.20 s proof and selected-reference controls without starting another search.
English was then restored. Console warning/error entries were empty. The new
current attempt stayed near its launch point and was not used as a completion
candidate. No archive was removed; temporary tab/server were closed.

Screenshots: `academy-best-practice-reference-9dd87a9c1a.jpg` and
`academy-best-practice-reference-uk-9dd87a9c1a.jpg`; Ukrainian accessibility
text is retained beside them in this task's sustained-flight evidence directory.
The World search receipt above remains bound to its earlier source; the combined
Academy receipt is not a claim of a new World/Regional or all-course run.

At **06:51 CEST**, a read-only public deployment metadata request still reported
`dd337c8120fd6f875544c1479713d3aa4299c323`. These local improvements are not yet
claimed accepted on Pages. Firefox's failed performance gate, protected older
archive retention and matched real-aircraft evidence remain separate open items.
