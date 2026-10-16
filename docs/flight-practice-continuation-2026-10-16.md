# Flight practice: integrated-main continuation

Hosting and real hardware remain owner-deferred. This report advances local
qualification without selecting a public release or approving human review gates.

## Follow-up after the first batch merged

### Production journey and fresh-candidate offline/update checks pass

Observer `88867270621a9d59f8041056e2653d21421ad374`, tree
`d1d45065e06931a8bf724b8510a53625d4444160`, uses the original onboarding
candidate `1b339bfe6` / envelope `f559fdd7…`, not relabelled b8 outputs.

- The **complete original-production journey passes all six EN/UK cases** with
  one Play each, no optional runtime before Play, disarmed start screens,
  Tryzub appearance parity, guides and return navigation. Every original build
  member is verified both before and after: 3,493 files / 1,072,077,940 bytes;
  integrity phases take 335,248 / 204,463 ms and settle without outstanding work.
  The explicit memory policy retains 2,737 original members / 116,052,929 bytes
  below 128 MiB, serves 9,262 memory / 72 original-file requests, then clears its
  private cache with zero pending reads. Original build source stays `3a1b5e3c3`.
  [Original receipts, authority, manifest and 24 PNGs](flight-practice-continuation-20261016/production-memory-passed-originals.tgz)
  SHA-256: `854e1bb901692c3ee4da56eb54ccf4f2ebaeca904cba474b89e29fbe063ae91d`.
  The [independent audit](flight-practice-continuation-20261016/production-memory-independent-audit.json)
  matches all manifest pins, deterministic selection, delivery/source/artifact
  identities and cleanup; it reviews the pinned full verifier but does not
  reread the entire gigabyte again. Directory PNGs show a scrolled viewport,
  not every card simultaneously; Ukrainian guides contain older English preview
  imagery, not a freshly translated visual walkthrough. This is an exact local
  production-build functional pass, not latest-main output, hosted capacity,
  measured performance, human review or public release. Earlier failures stay failed.
- The new candidate's **six restarted-offline flights** pass nine checkpoints
  and five exact imported-model/content witnesses. Gym launcher rises to 0.25 m;
  the other five rise to 0.2 m; paused samples stay exact over 639–644 ms.
  [Original evidence](flight-practice-continuation-20261016/onboarding-six-offline-originals.tgz)
  SHA-256: `b90b038b4ca266ad8357d1d0fba679a3a98a1419d8754b015b46976bb23abbcc`.
  The [independent audit](flight-practice-continuation-20261016/onboarding-six-offline-independent-audit.json)
  rechecks all artifacts, original model-derived assets, seven PNGs, source and
  owned cleanup. Scope remains English short lift/pause, not completed lessons,
  physical devices, machine-wide outage or Academy distinct-release migration.
- Its **installed historical Academy update continuity** also passes again:
  trusted focus-loss pause in 35 ms, native unfocused→focused return in 56 ms,
  genuine changed-package preparation, retained document and explicit resumed
  lift within 7,200 ms. Nine checkpoints and clean teardown pass.
  [Original evidence](flight-practice-continuation-20261016/onboarding-pwa-continuity-originals.tgz)
  SHA-256: `8006ed47155f08605906cf6e134e5276d3ef0ab9b0e039e7ae9af5d4934e45ac`.
  The [independent audit](flight-practice-continuation-20261016/onboarding-pwa-continuity-independent-audit.json)
  confirms 54 changed historical/current members. Cache names/scopes and archived
  equality assertions are not raw post-update backups or fresh member hashes;
  World content witnesses precede the active update. No all-app flight or
  physical-switching claim is made.

### Native zoom diagnosis and main-entry language correction

The [first C9 attempt](flight-practice-continuation-20261016/native-c9-first-failed-originals.tgz)
remains failed: Academy/Worlds pass the English software route, Gym fails a strict
clipping assertion whose old reader did not retain the failing rectangle, and
three Ukrainian cases incorrectly assume query-only language selection in a
shared English profile. A [temporary diagnostic](flight-practice-continuation-20261016/native-c9-temp-diagnostic-failed-originals.tgz)
also remains failed: its uncommitted observer hash `0831c9fd…` incorrectly uses a
static Home language mount that maintained menus move into Settings. It is not
assigned to Git `888672706`. Neither failure proves a simulator rendering defect.

The corrected observer preserves failed focus geometry before asserting and
uses the actual Settings → Display visible language select when needed, with at
most two public Back presses and actual modal closure. Matching actual document
language is a no-op. Focus bounds, deadlines and native inputs are unchanged;
twenty focused observer tests pass. A fresh native result is still required.

Separately, a real return-link bug is corrected in the main app only: one exact
supported `?lang=en` or `?lang=uk` initializes that main-app visit through
`setLocale(..., { persist: false })`, before other app UI dependencies initialize.
Missing, invalid or duplicate parameters keep the saved/browser default. The
saved preference is unchanged; ordinary Settings language selection still saves
normally. Seven actual directory/bootstrap/control tests and independent review
pass. Shared bootstrap, package code and worker policies are unchanged, and all
three package input revisions still match preflight. Classic boot/access/recovery
may retain the saved/detected language until the app imports; existing cross-tab
preference events remain unchanged. A fresh source-shell browser observation is
needed; the older production build above does not contain this main-only fix.

Current expanded regression after delivery/C9 integration: **390/390 practice
tests**, **357 observer tests passed with one explicit historical-fixture skip**.
The fourteen C9 focused tests also pass after adding exact descriptor-copy and
visible restored-opener assertions. These are automated tool regressions, not
the pending native matrix or production journey.

### Latest-main integration and the next independently bound checks

The branch rebased cleanly onto main
`bd0885811be4646cb1d092c91a7bddac96b8e9b6` (merged Neon recovery/presentation
work). The prior head and original evidence commits are retained on
`codex/practice-before-main-bd088-20261016`. No unmerged SIM files were copied.
Post-rebase regression passes 389/389 practice tests and 335 observer tests plus
one explicit historical-fixture skip, before the new observer helpers below.

The [onboarding candidate](flight-practice-continuation-20261016/onboarding-candidate-verification.json)
reproduces all three packages twice, verifies committed inputs and complete ZIP
members, and passes admission with `publicEligible: false`. Its original source
is `1b339bfe6596290b6db17ae0e268e4c8a843071a`, tree
`08e5a779523e8e356cccc9c45b96340676c1c56d`, not the rewritten rebase commit.
[Envelope](flight-practice-continuation-20261016/onboarding-candidate-envelope.json)
SHA-256 is `f559fdd7a935f03f15481fe657fbee3eb4b52e3c0c4b48d0bd3c9f70bedab7eb`.
An unchanged external copy is retained under
`/Volumes/alex/CodexMigrationStaging/flight-practice-onboarding-20261016-candidate`.
Compared with b8 distribution ZIPs, Gym and Academy change only generated worker
and manifest bytes; Worlds additionally changes its descriptor and generated
launcher app/worker. No simulator app/mechanics module differs. Their new source
and worker identities still require fresh affected observations, not relabelled
old receipts.

The original-production observer now has an explicit
`PRACTICE_DIRECTORY_DELIVERY=bounded-original-memory-v1` option, production-v2
only. It retains at most 128 MiB of deterministic original manifest-pinned members
during the existing complete before-verification, checks private copies on every
delivery, and falls back only to hash-verified original files. All 3,493 originals
are still reverified afterward. Browser/action/case deadlines are unchanged.
Thirty focused delivery/directory tests pass; native full-journey execution is
pending. The [independent diagnostic audit](flight-practice-continuation-20261016/production-home-independent-audit.json)
supports only the earlier matched delivery comparison, not this unrun lane.

The next C9 adapter covers six fixed EN/UK directory/launcher/guide-return routes
with actual native 200% zoom, ordinary Tab navigation and explicitly emulated
reduced-motion media. It checks source-bound onboarding copy, sampled focus
geometry/outlines and status semantics; images remain visually unqualified and
no speech/readability/hardware approval is inferred. Fourteen focused tests pass.
Independent review corrected unsafe profile cleanup during a pending Chrome
launch and bounded final source checks before any native attempt. The shared
observer deadline also now rejects late responses after event-loop stalls; its
new regression reproduces a 5 ms deadline accepting a 25 ms response before the
fix. None of these test-only changes changes package bytes or startup budgets.

### Player wording correction: new candidate required

World Studio's descriptor now points to its maintained Home actions: **Learn to
fly / Explore worlds**, **Навчитися літати / Дослідити світи**. It retains explicit
start and explains that `.rlpack` adds World content, not executable directory
apps. The new source-bound regression reads the actual mounted labels without
executing simulator code; the original descriptor fails and the corrected guide
suite passes 5/5. The full current practice suite passes **389/389**, no skips,
and all three packages pass preflight within their existing limits.

This changes metadata/package identity. A fresh committed-source three-app build,
reproduction/admission and affected launcher/guide check are required. The b8
candidate and all native receipts below remain unchanged; neither this wording
correction nor newer accepted main runtime bytes inherit their qualification.

### Latest verified checkpoint: all six offline flights and installed-PWA continuity

Frozen observer `57d3b748cf83e21513ae40a4df18eb5b2bc00e7b`, tree
`e6c3390b997ae1a1931e657e8e2e9969a497f7b0`, uses the unchanged admitted feedback
candidate `b8aec0821` / envelope `c271bc6c…`. The expanded observer suite passes
317 tests with one explicitly skipped historical fixture.

- **Six restarted-offline flights pass:** Gym, Academy and imported-model Worlds,
  each through stable launcher and actual standalone installed window. Every route
  explicitly lifts from 0 to 0.2 m and pauses, with four stable readings spanning
  638–643 ms, an uncached failed network probe and screenshot. All nine installation
  checkpoints and five exact populated World/database/card witnesses pass.
  Independent audit verifies the actual pack/GLB-derived asset fingerprint,
  original package/source pins, seven PNGs and complete owned cleanup.
  [Original evidence](flight-practice-continuation-20261016/all-six-offline-passed-originals.tgz)
  has SHA-256 `b8e25dccba8be0546b2c31ea49ff6b881e19dfcd150f93baf60201c3452f5a4c`;
  [independent audit](flight-practice-continuation-20261016/all-six-offline-independent-audit.json)
  preserves its limits. English short flights are not completed exercises, Acro,
  physical input, machine-wide outage or OS reboot. Academy's v0.0.0 alias is a
  same-byte fixture, not a real historical migration. The earlier failed attempt
  remains failed; its paused-state observation repair changes no app bytes.
- **Installed-PWA Academy update continuity passes:** the actual historical
  v0.142.4 standalone window loses focus through one native updater activation,
  produces trusted blur and visible pause in 74 ms, and retains its document while
  genuine different-package preparation completes. Native return is observed
  unfocused→focused in 55 ms, before explicit resumed lift. The whole session takes
  7,499 ms within its unchanged 30-second limit. Nine checkpoints and all owning
  cleanup gates pass. [Original evidence](flight-practice-continuation-20261016/pwa-activation-passed-originals.tgz)
  has SHA-256 `5140f0c57c5da692c7ec8ef494d1e7b04629bfadb6ee4671fef3024759ca6bb3`;
  [independent audit](flight-practice-continuation-20261016/pwa-activation-independent-audit.json)
  verifies 54 genuinely changed Academy members and exact authority. Document and
  proof/profile equality are archived-code assertions, not serialized raw exports;
  cache names/scopes are checked, not new member hashes. The World witnesses precede
  the active update. This does not qualify minimization, physical switching,
  uninterrupted background simulation or all-app active-flight coverage.

The [matched production startup diagnostic](flight-practice-continuation-20261016/production-home-diagnostic-originals.tgz),
SHA-256 `bd409bb99d7826c31204d090dc6f6c140b2748d75e270b53c0a9152978c64b46`,
verifies the previous receipt's 643 original served members (10,300,719 bytes),
then compares fresh English contexts with identical original bytes/CSP and normal
authentication. Request-time original-file reads miss Home at 10,002.61 ms;
preverified memory delivery reaches Home at 7,470.14 ms. Afterward all 725 selected
or additionally served members (18,940,603 bytes) are reverified. Source and cleanup
pass. This isolates sensitivity to the delivery path for this pair, not a specific
filesystem cause or a production journey/performance qualification. Full production
before/after integrity remains in the earlier failed run, not this subset diagnostic.
The first invocation silently skipped the temporary CLI because macOS resolves
`/tmp` to `/private/tmp`; its empty log is retained, not counted as a browser case.

Native zoom runs 2 and 3 retain valid ordinary-control 100→200→100 geometry and
cleanup evidence, but Chrome's native-zoom page/locator screenshots are cropped
or blank. Their [framing](flight-practice-continuation-20261016/native-zoom-framed-originals.tgz)
and [locator](flight-practice-continuation-20261016/native-zoom-locator-originals.tgz)
originals are retained. No visual selected-option or package-accessibility pass is
claimed. A bounded package-bound EN/UK keyboard/zoom/reduced-motion check remains
the next separate C9 lane; assistive speech and human readability remain unverified.

The native zoom tools are now repository-owned and documented. Eighteen focused
tests include ordinary selection, immutable geometry, clipped/obscured/moving
controls, pending operation cleanup and a reproduced symlinked-CLI no-op repair.
The expanded observer suite passes **335 tests with one explicit fixture skip**.
These tool-only changes do not rebuild or relabel the native receipts above.

### Restarted-offline expansion: first attempt retained, pause sampling repaired

Observer `8facc4b8a`'s first all-six flight run remains **failed**. Gym and
Academy complete the restarted offline launcher lift/pause witnesses. Worlds
then records one active frame immediately after the ordinary pause key, followed
by three paused frames at the same 0.2 m height. The strict four-paused-sample
gate correctly refuses this receipt. The observer now waits at most 1.5 seconds
for the maintained paused HUD before starting its unchanged four-sample stability
interval, inside the existing 30-second case and overall journey budget. Fifteen
focused imported-world tests pass, including delayed paint, missing pause and
unexpected state. No app-state mutation, extra pause key or longer journey
deadline is used. A fresh native all-six receipt is still required.
[Original failed receipt, screenshots and executed authority](flight-practice-continuation-20261016/all-six-offline-first-failed-originals.tgz)
have SHA-256 `3f46b98053ce92c745e0c38878b4e3d624cab5802e50f4850d5311911e936ab0`.

The separately named installed-PWA activation lane is now implemented and passes
17 focused tests, with all 24 independent offline-flight helper tests unchanged.
It observes one real native target activation, trusted blur and maintained pause,
then actual unfocused-to-focused return before the existing continuity verifier.
It does not treat a command acknowledgment as focus proof, change simulator
mechanics or supersede the failed minimization receipts. Native execution is
still required. Hardware and hosting remain owner-deferred.

### Current continuation: fresh five-minute passes; production startup still open

The newer feedback candidate now passes all three genuine five-minute runs:
[Gym](flight-practice-continuation-20261016/feedback-overall-gym.json),
[Academy](flight-practice-continuation-20261016/feedback-overall-academy.json),
[Worlds](flight-practice-continuation-20261016/feedback-overall-worlds.json).
Each passes 13 checkpoints, explicit five-minute reason, pristine retry/removal
and owned cleanup without page errors. First-byte-to-abort is
299,810.945/299,809.875/299,602.932 ms, with continued original bytes, no Cancel or
server-safety termination. All retain original candidate `b8aec0821`, envelope
`c271bc6c…`, and observer `ddacb33d2`. Earlier timeout receipts remain bound to
their original candidate. [Original receipts/logs and authority](flight-practice-continuation-20261016/feedback-overall-originals.tgz)
also retain the current **388/388** full practice regression log.

The [second production attempt](flight-practice-continuation-20261016/production-run2-failed-originals.tgz),
SHA-256 `cdf2bf34abdfbdf38d1b231914943ceacaed2912f3db266b0648c6461cff7cb5`,
verifies all 3,493 original files/1,072,077,940 bytes both before and after.
Integrity phases take 349,675 and 209,567 ms with zero pending operations/streams.
All six browser cases nevertheless fail before Home at the unchanged ten-second
action deadline, showing Loading flight systems. No request or page errors are
reported; 643 original members/10,300,719 bytes are served. Cleanup and final
source checks pass. This is **not** a production player-journey pass. The receipt
does not contain request timings, so slow network-drive delivery versus an
application startup problem remains an unproven hypothesis requiring a matched
diagnostic, not a larger startup deadline or source fallback.

A [separate native zoom capability probe](flight-practice-continuation-20261016/native-zoom-capability-originals.tgz),
SHA-256 `8c63928ab5c3cf29daade9e2738d78ae41867b0f246846c7a5c8c3db4754a32c`,
passes on Chrome 155 in an owned disposable profile. Ordinary visible Chrome
Appearance controls select 100→200→100; fixed outer width 1280 accompanies
inner width 1280→640→1280 and DPR 2→4→2, with visual scale 1 and unchanged CSS.
Reset, browser/server closure and profile removal succeed. Its temporary source
hashes are archived, not falsely assigned a repository commit. The settings PNG
shows magnified Settings but not the below-viewport zoom select; selected-option
proof is DOM/control evidence. This is capability only, not app accessibility,
physical input, screen-reader announcements or a package-bound C9 pass.

The next source-bound opt-in adds four deliberate restarted-offline Gym/Academy
flights to the two existing imported Worlds routes. Both visible-HUD controllers
retain the original 30-second case/ten-minute journey bounds; delayed cleanup
responses now fail independently of timer dispatch. Card screenshots use an
ordinary scroll and require onscreen bounds. Focused tests pass 24/24 and the
expanded observer suite passes 298 with one explicit historical-fixture skip.
Native all-six flight execution remains pending.

Follow-up [draft PR #1554](https://github.com/mekhovov/revealline/pull/1554) is open;
the prior PR remains merged. Development continues without waiting for merge.
Hosting/public selection and real hardware remain deferred.

### Three fresh local browser checks pass

Frozen observer `8e29a04c35eb57de6fb8274347e10397f5fc110e`, tree
`b5254b22dd24cebd127a950e9fdd68f520f41b1c`, uses the exact feedback candidate
`b8aec0821`/`c271bc6c…`. The ordinary-window run additionally uses the original
historical `98ad851` candidate. No package is rebuilt or relabelled.
[Original receipts, seven screenshots and authority](flight-practice-continuation-20261016/native-8e29-passed-originals.tgz)
have SHA-256 `af7ba4d991bbcb54ae75f112f60356c7317c7dbaa7a2d30309caf3217b1c7f45`.

- [Imported offline flight](flight-practice-continuation-20261016/imported-offline-flight-passed.json):
  nine installation checkpoints and five exact populated content witnesses pass.
  Independent audit extracts the original 63,754-byte pack's 31,796-byte GLB and
  independently derives its observed asset-row fingerprint. All five databases
  retain assets=1, projects=2, revisions=2 and metadata=1. After owned browser
  process restart, stable launcher and standalone routes each explicitly arm,
  rise from 0 to 0.2 m and pause at that height for over 640 ms, with real offline
  probes, visible HUD and screenshots. No course completion is claimed.
  The import screenshot shows the success toast; the card is below the captured
  viewport, so its exact identity is DOM evidence, not visible-card PNG proof.
  Gym/Academy offline flight, whole-machine outage and OS reboot remain open.
- [Final verification cancellation](flight-practice-continuation-20261016/final-verification-cancel-passed.json):
  22 checkpoints, three original ready replies, actual Verifying screenshots and
  three ordinary pointer cancellations pass. Observed cancellation latency is
  46.35/48.57/40.64 ms for Gym/Academy/Worlds. Every original cache pin and pointer
  remains intact. Each complete unrecorded target is verified, adopted by public
  retry, then removed through UI. The [independent audit](flight-practice-continuation-20261016/final-verification-independent-audit.json)
  re-admits the candidate and binds inventories to original archived workers.
  Proof/profile equality is an executed source assertion with retained hashes,
  not retained raw export backups. Nonempty World projects/revisions/cards remain
  exact; assets and Gym records are unpopulated in this separate lane.
  Scope is English controlled response latency after hashing, not interruption
  during hashing, Ukrainian native cancellation, actual eviction or real devices.
- [Ordinary-browser update continuity](flight-practice-continuation-20261016/ordinary-update-continuity-passed.json):
  nine checkpoints and actual flight/focus-loss pause/update/explicit-resume pass
  within 7,325 ms. The original document, time origin and immutable URL survive
  genuine different-version B preparation; visible height remains paused at
  0.3 m and rises to 0.4 m only after explicit resume. Actual geometry, focus
  defaults, sessions and exact owned target are cleaned up. Identity equality
  is enforced by archived source; raw document/time-origin values are not saved.
  Sibling cache names/scopes and proof/profile export equality are checked, not
  per-entry cache hashes. Its five exact World witnesses precede this active
  update and are not post-update World-retention proof. Installed-PWA continuity
  stays open; four PWA failures and ordinary run 5's cleanup failure stay failed.

All three runs have no page errors and remove their owned profiles/apps. They
are functional checks, not measured performance, human approval or public release.

### Production I/O follow-up

The reviewed verifier uses four bounded streams, a separately reported ten-minute
integrity-I/O phase, thirty-second stream inactivity and five-second settlement.
This replaces only the sequential 120-second file-verification ceiling that failed
on the original network-drive output. The 90-second case, ten-second action and
ten-minute browser-journey limits are unchanged. Every original manifest/member/
source pin is still checked before and after, with no source fallback.
Pending filesystem operations or streams prevent a clean result. Thirty focused
tests and independent review pass; a fresh production native receipt is required.

Frozen observer `752e4c999` has three further failed native receipts in
[the unchanged original archive](flight-practice-continuation-20261016/native-752e-failed-originals.tgz),
SHA-256 `8a26ac2a813dc34cf889367443bc50ccb54178f21ad92fcbb4f4377ba0a6b1a4`:

- Imported-world run 1 stops before installation: direct app URLs have no
  language query, while the parent incorrectly used the stricter launcher URL
  predicate. Cleanup succeeds. The new bounded identity check accepts only the
  exact admitted direct entry or its exact English launcher query, not arbitrary
  query parameters, fragments, credentials, ports or versions.
- Ordinary-browser active-session run 5 completes genuine upward motion,
  native focus-loss pause, real B preparation, unchanged old document identity,
  stable paused return and explicit resumed upward motion in 7.2 seconds.
  Its overall result remains failed: cleanup closes the target before detaching
  its target-bound session. The correction detaches page sessions first, keeps
  the separate updater control until exact target closure, and retains all
  failure/late-ownership checks. The new regression fails before and passes after.
- Production v2 run 1 admits the current package but stops before browser
  acquisition: hashing all 3,493 original files on the network drive exceeds
  the observer's separate 120-second distribution-I/O deadline. No player
  journey, package startup or performance failure is inferred.

The next cancellation check explicitly covers final verification response
latency, not per-file hashing interruption. Independent review reproduced a
timer-dispatch false-pass in its first proposal; absolute deadline checks and
independent event-time validation fix it. The reviewed revision passes 38 unit
tests; integrated cancellation/URL/window tests pass 61/61. Actual browser
receipts remain required. Runtime bytes and publication policy are unchanged.
The complete expanded observer suite passes 276 tests with one explicit
historical-fixture skip. Scoped lint and whitespace checks pass. The imported
world adapter now follows native Library fragments only after its own public
navigation, and follows actual Settings Back state within a fixed five-action
bound; arbitrary navigation is still rejected.

PR #1512 merged at original source `3a1b5e3c3`. The four later follow-up commits
were rebased cleanly onto main `facf1627e2bb039ee7e5a3b9d662ded4c4ef3368`.
Their rewritten head before the next observer batch is `224f97d35`; original
package and observation sources below are not relabelled. No unmerged SIM
worktree files or hosting changes were incorporated.

Independent migration audit verifies all 630 original cached-member pins in
twelve inventories, all 24 old/new package artifact pins, seven ordered content
witnesses and exact worker/launcher revisions. This strengthens the existing
three-app migration/rollback pass, not active-flight protection.

The [fourth installed-window attempt](flight-practice-continuation-20261016/active-fourth-failed.json)
uses isolated visible Chrome but still fails before update: actual native bounds
remain normal throughout the 1.5-second limit. Cleanup succeeds. Its
[original authority](flight-practice-continuation-20261016/native-224f-fourth-authority.tgz)
is source `224f97d35`. The [plain-window routing probe](flight-practice-continuation-20261016/window-routing-probe.tgz)
observes trusted blur and actual minimization through both CDP routes, but uses
no simulator. It does not qualify PWA continuity or establish a routing repair.

The next explicitly separate ordinary-browser lane retains the same historical
payload, real update, visible flight/pause/resume and document-identity checks.
Its acquisition cleanup initially had two reproduced ownership regressions
(11 passing, two failing tests). Ownership now transfers before post-await
deadline checks, late rejected creation releases its reserved session, and
close/detach are exact-once. Independent review passes all 13 regressions.
Installed-PWA continuity remains open even if this ordinary-window lane passes.

Two further observer-only checks are prepared: the real CC0 Roadworks imported
model through offline process restart and explicit offline flight, and the exact
production distribution's six localized directory journeys. The production v2
protocol pins observer, original build, and admitted app sources independently;
it never substitutes source for missing build output. These are pending native
execution, not new completed acceptance items. No SIM mechanics or package bytes
are changed in this observer batch.

## Integrated source and package

The feature branch rebased cleanly onto main
`2169552a0571b9d62bce116054f1e21aabd10fa1`. Accepted SIM regional delivery,
library, session, reaction and world-store changes were integrated from main;
no files were copied from SIM's active worktree. A local backup branch preserves
the earlier frozen evidence commits, whose original receipts remain historical.

The original recovery candidate used by the native receipts below is source
`134313f232e45ec2768d02ceb65aa4fac9795748`, tree
`ac1697d2f0a740220512c56a2884fbd7b1c4a986`, envelope SHA-256
`072fa308213cb1d9885c6f480bb9afda3cf156d04bd47aa1bf091aae4d9c9826`.
Its existing development version is `v0.151.1`, not a newly allocated release.
Original [envelope](flight-practice-continuation-20261016/candidate-envelope.json)
and [verification](flight-practice-continuation-20261016/candidate-verification.json)
record two identical builds, committed inputs, complete ZIP admission and
`publicEligible: false`. The external original is
`/Volumes/alex/CodexMigrationStaging/flight-practice-download-recovery-20261016-candidate`.

## Localized offline failure feedback — implementation continuation

The maintained shared service now attaches additive, fixed `offlineCode` reasons
without changing legacy messages, Error/AbortError identities, worker protocols
or deadline values. All three apps and stable launchers use allowlisted EN/UK
copy for known inactivity/overall deadlines, cancellation, unfinished verification,
confirmed repair and retryable failures. Unknown exception text/URLs are not
displayed. Only a known quota error selects storage-specific copy; generic
security/permission errors remain unknown. Launcher failure rendering preserves
verified actions, supports language changes without repeating an operation, and
does not promise a saved copy exists. Both guide formats explain recovery.

Independent review corrected the permission/storage distinction and an overly
broad fallback availability claim before freezing. The integrated focused suite
passes [209 tests](flight-practice-continuation-20261016/feedback-209-tests.log),
the [guide checks](flight-practice-continuation-20261016/feedback-guide-tests.log)
pass 4/4, and independent current launcher/resolver/admission checks pass 30/30.
The first focused attempt lacked the external IndexedDB test dependency; the
first broad suite exposed a real mismatch in admission's independently reconstructed
launcher wrapper. [Original logs](flight-practice-continuation-20261016/feedback-first-test-attempts.tgz)
remain failed. Admission now chooses exactly the old or additive-service wrapper
from the archive's pinned parameter signature, without executing archive code.
Eight admission regressions pass, including altered import/service rejection.
The [unchanged original candidate](flight-practice-continuation-20261016/feedback-legacy-admission.json)
also passes current admission for all three apps; compatibility was not assumed.

The normal practice suite subsequently passes **387/387**, zero failures/skips.
A fresh candidate freezes source `b8aec0821087354ac8a6765a5b95c68d24dd9137`,
tree `3bafa19b36118173b1b19a9039d9572b09692f7b`, envelope SHA-256
`c271bc6c248844f756ba4c1a191e6008593d48c4d03b9e4d34836d6a174c73a6`.
Both a new external-drive output and a 54-MiB local fallback reproduce all three
apps twice and pass committed-input and complete archive admission checks.
The fallback avoids external-drive latency, not admission or source checks.
The existing numeric development version remains `v0.151.1`, with no public
release allocation, selection or hosting change. These new bytes require fresh
native observations; none of the earlier receipts is relabelled.

Fresh native checks on that exact new candidate now pass:

- [Short recovery](flight-practice-continuation-20261016/feedback-short-passed.json):
  22 checkpoints; all three genuine 30-second stalls and prompt native cancellations
  display explicit reasons, retain all prepared caches/data, and pass pristine
  retry/removal. Browser-process offline reopening and installed-window cleanup pass.
- [Distinct historical migration](flight-practice-continuation-20261016/migration-passed.json):
  10 checkpoints, seven ordered data witnesses, all three real old→new upgrades
  and offline rollbacks. Both admitted launcher caches are hashed, the sole
  active worker is revision-bound, all runtime dependencies and sibling ownership
  remain exact, and proofs/profiles plus World projects/revisions/cards are retained.
  No page errors or cleanup failures. Imported assets remain unpopulated.

The [executed authority](flight-practice-continuation-20261016/native-ae9109-authority.tgz)
is original `ae9109c84`, SHA-256
`9e3c650f4d94a1c40f6a96c60473ffa611cfad369abdfed3a593d490920370d8`.
The [third active-session attempt](flight-practice-continuation-20261016/active-third-failed.json)
still fails before update: 27 native bounds samples remain normal throughout the
1.5-second minimization bound, despite real positive lift/pause/resume. Cleanup
succeeds; no active-session update pass is inferred. The explicit window lane
will use isolated **visible** Chrome next, with actual transition and cleanup
requirements unchanged. Other observer lanes remain headless. This is software
window qualification, not an owner-deferred physical-controller/device test.

## Six selected-appearance player journeys pass

The [original receipt](flight-practice-continuation-20261016/personal-appearance.json)
has SHA-256 `0b37b5827dfb252c98c974305262a1cdc1834ee3babb1300ae94a546238a9fbb`.
All three packages pass in English and Ukrainian, on Chrome 155.0.8059.80.
The unchanged full source shell is `b8c0cf6a83c17e7034ec892bb24a0c6717911b93`,
tree `430b816f2d09ad5ba4aea4177de3bf7819684a1b`.

Each fresh context selects Tryzub through native Settings, verifies its card's
unselected→selected state, then follows Help & Extras → Flight practice. All
three cards, genuine previews, bilingual descriptions and generated sizes match
the admitted metadata. One ordinary Play opens one app tab without starting or
arming a flight. Main and app resolve the same Tryzub interface and preserve the
two exact bounded preference records. Details/guide, directory return, main-game
return and locale propagation also pass. No progress/authentication is injected;
approved access is entered through the ordinary form.

The [complete original archive](flight-practice-continuation-20261016/personal-appearance-originals.tgz)
contains the exact plan, ten authority snapshots, six case receipts and 24 actual
screenshots. Browser/server cleanup succeeds and there are no page errors.
An independent read-only agent verified every one of its 42 original files,
24 screenshot hashes, ten authority hashes, 823 committed source pins and twelve
package artifact pins. Archive SHA-256 is
`9b03993295d7cbf3583acb14a47f08f2cd27b2a70be60d7eebda0560176ae312`.
The source-only server records twelve unavailable generated `build-info.json`
requests and one root favicon request; these are retained, not hidden.

This is personal-preference transfer, not positive compiled-edition URL pins,
all themes, rendered-world appearance, flight or production-distribution browser
qualification. Its standalone catalogue/current pointers are explicit local,
unpublished fixtures. `completed` is true; `qualified` remains false.

## Installation status repair and timed recovery lane

Both worker families now announce Downloading immediately after local verification
and before awaiting the next dependency. Previously a stalled next response could
leave Verifying visible after verification had ended. Two deterministic regressions
fail before repair and pass afterward; the combined worker/lifecycle suite passes
47 tests. The compact shared worker is refreshed from its maintained source.

The new opt-in short fault lane targets one exact admitted README request on an
owned loopback server, sends its unchanged first byte and withholds EOF. It records
real monotonic boundaries, distinguishes server safety deadlines from app aborts,
and never changes clocks, runtime bytes or public publication rules. Native Cancel
must act well before inactivity and complete promptly; a no-op click followed by
timeout cannot pass. Gym's generic terminal copy is distinguished from explicit
Academy/Worlds cancellation feedback. Preserved data and cache checks recur after
both failures and successful retry/removal, not only at journey end.

The [first native attempt](flight-practice-continuation-20261016/download-first-failed.json)
passes its five initial prepare/restart/baseline checkpoints but stops **before any
fault case**: the observer expected three prepared caches, while stable launchers
correctly add three more. Cleanup succeeds. This is a harness-inventory assumption,
not evidence of an installation failure or a passing interruption test. The
[first authority archive](flight-practice-continuation-20261016/download-first-authority.tgz)
retains the original executed code. Account for all generated runtime/launcher
pins before retrying; do not ignore unrecognized caches.
The corrected inventory reader parses the original admitted runtime and launcher
workers' literal pin arrays without executing their functions. All twelve
old/current × three-app × runtime/launcher inventories parse successfully. It
checks every recognized cache, not merely the three runtime caches, and reads
only expected pinned responses through CacheStorage.match with bounded streaming.
There is no caches.open call, cache recreation on an eviction race or content
write. Separate malformed/scope/revision/duplicate/tamper regressions pass.

The [second original attempt](flight-practice-continuation-20261016/download-second-failed.json)
validates all six cache inventories. Gym's native idle case terminates after
30,002.7 ms; one ordinary Cancel terminates its held request after 66.2 ms, with
47.5 ms observed click-to-settlement latency. Both preserve records, original
caches/workers and pointers; pristine retry and removal restore the baseline.
Academy's held request also aborts after about 30,004.7 ms, but the observer waits
315 seconds for terminal copy it does not recognize. That attempt remains failed
with nine completed checkpoints and successful cleanup, **not an all-three pass**.
The [second authority archive](flight-practice-continuation-20261016/download-second-authority.tgz)
retains its original code. The shared client has a documented “Download stalled
for 30 seconds” outcome absent from the observer's terminal patterns. Regressions
now recognize that known outcome and fail promptly on unexpected stalls; improved
failure diagnostics read bounded offline status/progress text, never form values.
The next unchanged-package native run confirms the complete journey below.

### All six short native fault cases now pass

The [third original receipt](flight-practice-continuation-20261016/download-passed.json)
has SHA-256 `daa492fb2863a51747bcc5c1bf06618091f36f6ed64b83ce1a5e11115465a0f5`.
It passes 22 checkpoints, all six faults, all three pristine retry/removals,
genuine historical Academy upgrade/rollback, three-app restart and five exact
World project/card witnesses. Chrome is 155.0.8059.80. Idle termination is
30,007.6 ms (Gym), 30,005.0 ms (Academy) and 30,005.5 ms (Worlds).
Academy's visible status confirms the documented 30-second stalled outcome.
Native cancellation aborts the held request after 81.0/76.7/74.0 ms respectively;
observed click-to-settlement is 60.9/67.3/53.4 ms. Every case has one exact request,
one original byte, no retry and an app-side abort, not a server safety deadline.

All six original caches and 351 admitted dependency pins remain exact, as do
the seeded proof/profile and populated World fingerprints. Independent review
verified those pins and all nine post-fault/retry World witnesses. Cleanup,
authority/source stability and all installed-app removals succeed. The complete
[ten-file authority archive](flight-practice-continuation-20261016/download-passed-authority.tgz)
has SHA-256 `b63758130c89cabdde69a60d57e6435886fc159daabaad8b8f08da5c20bb2942`.

This is the short download lane, not verification-phase cancellation, the real
five-minute limit, eviction or human flight. Its server uses preview security
headers. Optional status instrumentation forwards production APIs but can affect
scheduling; this is diagnostic functional evidence, not a performance claim.
Gym's records are unpopulated. The two earlier failed receipts remain unchanged.

## Maintainer recipe and tests

### Three real overall-timeout runs pass

Original receipts: [Gym](flight-practice-continuation-20261016/overall-gym.json),
[Academy](flight-practice-continuation-20261016/overall-academy.json) and
[Worlds](flight-practice-continuation-20261016/overall-worlds.json). Each passes
13 checkpoints, one selected fault, pristine retry/removal, retained data,
historical Academy update/rollback and cleanup on Chrome 155.0.8059.80.
First-byte-to-client-abort is 298,514.165 / 298,763.223 / 295,937.351 ms;
the overall operation begins before that response. Each has sixty ordered original
one-byte writes, with maximum gaps of 5,049.126 / 5,040.754 / 5,025.874 ms,
no Cancel, no silent retry and no server safety/cleanup termination.

Academy's status explicitly names the five-minute limit. Gym and Worlds expose
generic failure, so their exact internal error cause is not inferred from text.
Server transmission is not direct browser receipt timing. These are genuine
wall-clock functional observations, not accelerated clocks or performance tests.
Builds/tests ran concurrently. The [original nine-file authority](flight-practice-continuation-20261016/overall-authority.tgz)
has SHA-256 `c37a05d56cdcb0f893cb5ed9f902e3ab899e735898113838ee9c1838f12bf9fb`.
Independent audit matches all authority files and all 351 admitted cache pins per
receipt. Pointers, workers, caches, five World witnesses and post-fault/retry
database/card identities are unchanged; archived exact-export assertions retain
proof/profile. Cleanup succeeds and `publicEligible` stays false.

### Active-session first attempt remains failed

The [original](flight-practice-continuation-20261016/active-first-failed.json)
fails **before update** while waiting for natural blur after activating a separate
window. Four initial checkpoints and actual visible flight/pause observations
exist, but they do not qualify update continuity. All apps/profile are cleaned up.
[Executed authority](flight-practice-continuation-20261016/active-first-authority.tgz)
is retained unchanged. The resumed-height witness could include descent, so the
new helper requires positive upward gain and keeps bounded failed-transfer data.

[Separate plain-page probes](flight-practice-continuation-20261016/window-probes-originals.tgz)
identify the installed Playwright focus-emulation override. Neither ordinary
headless nor visible-window switching under that override provides real blur.
After removing it only on owned targets, native minimization produces trusted
browser blur and restoring the window produces trusted focus. No event is
dispatched and no app state/package byte is changed. The separate opt-in diagnostic
now requires that configuration, normal original geometry, actual paused HUD,
real B update, explicit resumed upward motion, unchanged document identity and
both independently successful cleanups. The [second native attempt](flight-practice-continuation-20261016/active-second-failed.json)
also remains failed, before update: genuine positive lift, pause and resumed lift
were observed, but the first immediate native bounds read after requesting
minimization still returned `normal`. This does not establish whether the
transition was asynchronous or unsupported. The revised helper polls actual
bounds within 1.5 seconds, records intermediate states, and still rejects a no-op
or late transition; restoration requires the original geometry. Native retry is pending;
ordinary switching, uninterrupted background flight and physical inputs stay open.

The all-three genuine historical migration lane is also implemented, independently
reviewed and unit-tested, with its own report/protocol rather than skipped default
OS/restart checks. Historical/current bytes and complete runtime/launcher cache
inventories are checked per package; nonempty World projects/revisions and shared
proof/profile are witnesses, not fictional Gym records or imported assets.
The [first native migration attempt](flight-practice-continuation-20261016/migration-first-failed.json)
established the historical three-app baseline, then failed its strict dependency
check with `Prepared cache disappeared` after opening the current Academy
launcher. Cleanup succeeded. Upgrade/rollback qualification remains open while
launcher-cache lifecycle and observer expectations are investigated. The
[executed shared authority](flight-practice-continuation-20261016/native-d15-failed-authority.tgz)
preserves both failed attempts' original observer/helper bytes at `d15c0874f`.

The [new native sample receipt](flight-practice-continuation-20261016/sample-recipe.json)
passes the temporary fourth-package catalogue, explicit start/pause/retry,
preparation, changed-version update, closed-tabs offline reopening, rollback and
retirement journey. A [real paused screenshot](flight-practice-continuation-20261016/sample-paused.png)
is retained. The sample is cloned Gym content and synthetic review fixture data,
not a new public application or human package approval. It is never published.
Its source is a working-tree fixture based on `b6706a9912ed0c94489f4926f90daa4ebecd7fe1`,
not the frozen candidate above. Cleanup passes.

The current integrated-main practice suite passes **362 tests, zero failures or
skips**. Earlier 360-test and 143-test observer logs remain historical. A later
153-test observer run has one flaky fake-DOM progress assertion failure, preserved
in the [lossless original-log archive](flight-practice-continuation-20261016/observer-first-fixture-failure-original.tgz);
its unchanged focused retry passed 8/8. The plain-text copy is replaced, not edited;
its bytes remain in that archive and original Git history.
The fake wait incorrectly asserted before the HTTP client's first data event and
could leave its first-data promise unresolved after an early abort. Bounded polling,
settled error/abort/end paths and joined fixture promises repair that harness;
delayed-data and pre-data-abort regressions are deterministic. No production
deadline or Cancel acceptance bound is increased.

At source `3a1b5e3c3`, the expanded suite passes **168 tests**, with one explicit external historical
bundle skip; the opt-in real-bundle suite separately passes **7/7**. The actual-body
writer and installation-observer regression run passes **32/32**. The new active-session
helper's **11/11** tests are synthetic and independently reviewed, not native proof.
After the separate migration/window lanes, **186 observer tests pass**, with the
same one explicit historical-bundle skip. The first expanded run failed a source
order assertion that accidentally matched the new migration branch instead of
the default restart branch. Its original console output is retained in
`migration-seed-contract-first-failed.tgz`; the corrected assertion explicitly
scopes the default journey and still requires seeding before its first Worlds
preparation. Independent session/window/migration tests pass 29/29.
Scoped formatting, lint and whitespace checks pass. Original logs are retained
alongside this report; a name-filtered sample run is not a second full suite.

## Corrected build-blocker diagnosis

The Couch verification document and FPV baseline images are committed and available.
This worktree's non-cone sparse patterns excluded `docs/verification`; earlier
missing-file errors were real, but attributing them to unavailable producer inputs
was wrong. Only the exact required document and baseline directory (about 416 KiB)
were materialized from Git. The first ordinary build then reached two further
committed soundtrack review records under `docs/verification/music-publication-2026-09-21`.
Those exact `rights-audit.json` and `public-delivery.json` files were restored too;
their existing compiler passes 70 tracks, one archive and fifteen collections.
No listening/license approval is added. No user's primary-checkout files were copied, changed
or published; no evidence was fabricated or build rule removed.

Build collection now reads all **3,310** declared source files. The ordinary
[main validation result](flight-practice-continuation-20261016/main-validation.json)
passes reference/content, campaign, theme, class, pack and cooperative checks.
The second build reached staging but spent many seconds per Darwin `cp -c`
between local device 16777235 and remote device 905969668. Local free space also
fell to about 1.6 GiB; moving the whole output locally was not a safe alternative.
The exact owned build process group was verified and terminated (exit 143).
Its partial staging directory is retained, not published or silently deleted.
[Attempt dispositions](flight-practice-continuation-20261016/build-attempts.json)
distinguish failure, cancellation and a completed distribution.

The maintained writer now attempts clones only on known matching devices; known
cross-device copies use the existing exact prepared-byte write. Source validation,
post-clone equality, changed/generated fallback and write errors remain intact.
Synthetic actual-function-body tests cover both platforms, corrupted/failed clones,
unavailable filesystem checks and surfaced writes; the real-file independence tests
remain. The third ordinary build, source `3a1b5e3c348b4623caa949e23602fc5f9fc0b444`,
reached `.xonix-build-FXPjBJ` while the checkout was still clean at that source.
Only after preparation and immutable entry/manifest/ZIP-buffer creation did
observer-only changes resume. The writer retains those exact prepared bytes even
if source files later differ. The backup branch
`codex/practice-built-shell-3a1b-20261016` preserves the original clean source for
the strict production-browser observer; later harness commits are not relabelled
as its build source. The build subsequently **completes, exit 0**: 3,493 output
members, 1,072,077,940 bytes, distribution SHA-256
`147d78d5beba3713cb69e3b06a4b165e30a1afbb1cb0760bc9b3adb2d957ec09`.
The original manifest records source `3a1b5e3c3`; a native production journey is
still required and is not implied by build success. Hosting/capacity remain separate.

## Still open

The acceptance checklist remains authoritative. Next software priorities are the
full original-production directory journey with reliable bounded delivery,
package-bound native zoom/keyboard/reduced-motion checks, and remaining recovery
subcases (hash-in-progress cancellation and real eviction on an approved disposable
setup). All-three genuine migrations, imported-model offline flights and the
specific Academy PWA activation update now have the scoped passes above; all-app
active-flight protection is still separate. Measured performance needs an accepted
budget; spoken assistive behavior and participant/package approvals require actual
reviewers. World Studio's descriptor also needs its old menu wording synchronized
in the next exact candidate. Hardware and hosting are deferred, not passed. No local
test or PR populates the public catalogue.
