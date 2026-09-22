# Twin Receivers: inner receiver approach study

This is an explicit P11 study, not replacement of a published edition or a claim
of final balance. It addresses the known shared-mouth shortcut with placement,
not new physics, mandatory waiting, extra enemies or a different capture rule.

## Decision and scope

The retained Standard Immediate route clears the previous receiver galleries in
21.35 seconds. Its third closure at tick2046 captures both shield objectives by
closing one mouth outside the core court. In the new study, that exact closure
still secures the upper receiver but leaves the inner receiver unclaimed and the
core shielded. The unchanged input's later attempted release now encounters the
still-shielded attack; this failed control is preserved rather than re-recorded.

Move only `east-shield` from the lower outer gallery to `(50.5,19.5)` inside the
retained core court. Its stable role ID supports the existing optional order
observer; the description now says inner before upper rather than lower before
upper. Choose an outer return first and then approach the inner receiver, or
enter from below for the optional inner-first route. Walls, foundations, spawns,
other actors, speeds, difficulty presets, quota and encounter schedule are exact
copies of the earlier spatial source. Both objective orders remain legal.

`createSentinelInnerCandidates` produces a separate source/revision. All other
missions and all earlier factories, route fixtures, save editions and artwork
remain unchanged. Studio adds an edition choice beside the existing Sentinel
Inspect action: Original receiver galleries remains default; Inner receiver
approach is labelled balance pending. Inspect and Apply remain separate.

## Technical evidence

- 48 tests passed on each of Node20.19.5 and Node22.22.2, zero
  failures/skips/cancellations, including
  historical receiver routes, the exact old short-clear checkpoint, placement
  isolation, lossless decision windows/first returns and searchable Studio entry.
- Nine new complete legal-input routes: ordinary outer-first on all three
  presets/both steering policies, and an inner-first mastery route on each
  preset. Every route loses no life, captures the two shields on different
  closures, verifies its public replay and reproduces the final checkpoint after
  reconstructing a replay prefix following the first shield capture.
- Equal paired-board races use independent simulations and finish as ties on all
  nine inputs. This is deterministic fairness evidence, not human competition.
- The bounded Standard Grid search stopped at an unfinished tick2898 prefix.
  Its exact checkpoint and inputs remain in the fixture; a separate resumed
  search completed it. A budget expiration was not labelled impossible.
- Initial local test attempts lacked two sparse-checkout dependencies. Restoring
  those exact tracked files allowed the complete48-test run; no expectation or
  runtime change was made to conceal those setup failures.

Search-route seconds (Immediate / Grid + Buffer):

| Preset   | Outer-first   | Inner-first sample  |
| -------- | ------------- | ------------------- |
| Gentle   | 33.05 / 32.45 | 28.55 Immediate     |
| Standard | 28.45 / 28.36 | 32.05 Immediate     |
| Expert   | 31.45 / 31.25 | 33.35 Grid + Buffer |

These are omniscient, bounded search routes, not minima or human pace results.
Some include legal waits chosen by the solver; no wait was added to the level.
Five routes use a qualifying exposed-stage cut and four use the unchanged legal
isolation finish. Isolation remains a supported strategy, not a test failure.
Short optimized clears still require human pacing review; longer sampled time
alone does not establish a better level.

## Native Studio check

On 22 September 2026, the in-app browser used exact source `c9b64e5e`
on localhost8955 with real IndexedDB and no simulation injection. Generated
presentation/vendor dependencies came from the unchanged v0.82.0 graph; this
was a source preview, not a frozen or public-release check.

Searching for `inner receiver` found the existing Sentinel entry. Selecting the
new edition and Inspect left Nearby shore and the one-mission draft unchanged.
Explicit Apply adopted the five-mission study. Twin's workbench listed the inner
receiver at `(50.5,19.5)`, the unchanged120 foundation/2028 earnable cells, and one
retained component with Sentinel as the sole anchor and no unintended auto-fill.
The board visibly retained its platforms and receiver galleries.

Exact Solo preview opened in Studio's practice iframe, not a separate tab. The
ready screen named Twin receivers,85% coverage, two shield relays and the core.
Start and an ordinary Up gesture produced a0.6% first return,130points, three
lives and no relay credit. Pause worked normally. Return to draft and reload
retained checkpoint1 and the exact objective placement after reselecting Twin;
mission selection itself reset to First relay. No captured browser warn/error
logs were present. A label-based automation selector failed after reload; the
visible native mission selector worked. This is not a full native clear, human
balance, physical-controller, offline or browser-crash qualification.

## Remaining gates

Full native play readability; wider input
timing and both-policy mastery samples; real human/controller/accessibility
review; original-picture successor integration; exact-head CI and independent
review; allocated version, immutable release and public Pages verification.
No Team, newly generated art/music or fully validated-content claim.
