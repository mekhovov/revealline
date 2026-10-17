# Correct the two connected-root host retirement paths

Status: the user approved preparing this narrow correction specification on
2026-10-17. Independent review and user review of this written specification
precede implementation. This document does not authorize another speculative
fixture/cache optimization, a test waiver or a larger timeout.

## Objective and established evidence

Make the two inconsistent finite browser fixtures establish a retired,
disconnected document before restoring the previous JavaScript browser globals.
Keep production page-hide handlers and storage disposal authoritative. A passing
targeted regression is not completion: qualification still requires the complete
original 16-file host-integration phase and all applicable exact-head gates.

Investigation froze PR1456 at
`b71d20781f3224e7d015c0d2dfb20d067a9b84b6`. The exact manifest
`788b7942f7d485e20280aadecf8ba8aa2415538e` lists 16 original files. A bounded
AST map captured those files, all 21 recursively reached helper modules and the
manifest: 38 Git-blob/SHA256-bound files, 344746 bytes. No candidate module was
executed by that collection. Application imports are explicit review boundaries,
not a claimed complete runtime closure.

The relevant exact fixture blobs are:

| Fixture                                     | Git blob                                 | Observed retirement                                                                      |
| ------------------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------- |
| game/test/helpers/couch-host.mjs            | 04566923d58d7b279c0dce52203704cfdcf91d77 | pagehide, then restore globals/prototypes; root remains connected                        |
| game/test/display-preferences-host.test.mjs | 0471dc53eef4412a3f6d58cce7bd260f39875c8f | private teamPage emits pagehide, clears frames, restores globals; root remains connected |
| game/test/helpers/solo-dom.mjs              | 8c32b26602a936850daedb76c5158d673279e038 | existing pagehide/immediate/DB close/root detachment/global restoration                  |
| game/test/helpers/coop-host.mjs             | f2880662c47942038c6e6833aa6bd06e400883a4 | pagehide/frame clearing/root detachment/global restoration                               |

The finite DOM defines connection through the document parent chain. Production
i18n bootstrap `0c50bf1b0e05d12987507a048cf56edec7506581` skips disconnected
element bindings during locale refresh. Restoring globalThis.document alone does
not disconnect an old fixture root. These are demonstrated source semantics, not
proof that this inconsistency caused the 600000 ms phase timeout.

Important counter-evidence is retained: Solo's pagehide disposes its explicit
locale subscription. Versus deliberately flushes statistics asynchronously before
closing them. The statistics service captures its database/storage at creation;
its backend has a default 1500 ms operation timeout, closed guards, pending-open
cancellation and late-connection closure. Do not invent a next-global database
lookup, replace this with an arbitrary promise drain, or close storage early.

The investigation record is `host-lifetime-review-b71d2078-source-boundaries.md`
and its immutable source map `host-lifetime-static-helper-map-b71d2078.json` in
the approved external evidence directory. Both distinguish observations from
unproven causality. Implementation must refresh PR1456/main and confirm the two
fixture identities before using this evidence. Main was
`20459d449713ffc4d20143e39a8ea0cd0be90bb2` when this specification was drafted.
On that main, couch-host retains the same blob. The display-preferences file is
instead `218ce6f403fe898b9438762495a38184554dbd09`; its inspected retirement
block still lacks detachment. Do not overwrite those unrelated source differences
when updating a PR branch, and do not pretend the entire files are identical.
The unchanged phase runner is `scripts/verify-industrial-features.mjs`, blob
`b82547ce7a227ff589dded4dae1238c9273c7cf1` at the frozen PR head.

## Selected correction and alternatives

Selected: normalize only the two inconsistent fixture retirement boundaries.
This corrects a demonstrated model inconsistency without altering game behavior.
Alternative: observation-only diagnostics, preserving the inconsistency while
collecting more runtime evidence. A realm-per-page rewrite or global asynchronous
work drain is not selected: either would introduce substantially broader behavior
and could hide application lifecycle defects.

The correction belongs in the existing two files above. Add the new regression
cases to the already registered display-preferences-host.test.mjs; do not add a
new test route or change focused-test-map, test policy, the phase manifest,
runner, workflow, dependency installation or merge controller. Do not change
Solo/Co-op paths that already detach, transport caches or production modules.

## Retirement contract

Each affected fixture's registered teardown must retain this order:

1. Emit the real nonpersisted pagehide while the original document remains
   connected and its globals/prototype bindings are still installed. Existing
   production observers therefore retain their normal opportunity to dispose.
2. Clear only that fixture's explicitly owned frame-callback map. Do not cancel
   application promises, IndexedDB transactions, timers, workers, media reads or
   another page's callbacks under this label.
3. Remove that fixture's document root, using the existing finite DOM operation.
   Its descendants must now report isConnected false; do not fake the property,
   replace nodes, clear application storage or mutate locale registries.
4. Restore the captured original global descriptors and, where already used,
   BoardPainter prototype methods. Preserve the original hook ordering and
   restore exactly the values captured by this fixture, not guessed defaults.

Cleanup must not silently absorb an exception from a real pagehide observer.
Root detachment and restoration must still be attempted if an observer throws;
the original error remains observable, and any restoration failure is also a
failure. This is exception-safe fixture ownership, not suppression of product
errors. Keep it local to these teardown callbacks; do not introduce a global
cleanup framework, new application close hook or promise-drain protocol.

The fixture callback is normally registered once and invoked once by node:test.
Do not add a new repeated-retirement contract or shared retired-state registry
without a demonstrated need. A test-held old page is a deliberately retained
reference for assertions, not a page the next fixture may treat as connected.

## Regression design

Exercise the actual existing fixture constructors and their registered teardown
callbacks, not a copied teardown implementation. A bounded test context may
capture the callback through the existing t.after interface, provided every
captured callback is invoked and all globals/prototypes are restored even if an
assertion fails. Do not create an untracked live application or skip its cleanup.

For both couchPage and the private teamPage, prove:

- An appended pagehide observer sees the original document connected, the correct
  active globals, and persisted false. Do not move detachment before the event.
- After teardown the retained root and child controls are disconnected, the
  fixture-owned pending frames cannot be dispatched, and original global
  descriptors/prototype methods have their exact prior identities.
- A retained ordinary localized element producer is not invoked by a subsequent
  real locale refresh after retirement, while a live control still refreshes.
  Use existing localization APIs and restore the previous locale with persist
  false; never write player preferences or stub the refresh implementation.
- A throwing pagehide observer still results in root/global restoration and its
  error is observed by the test. Do not turn such an error into successful app
  disposal or bypass application callbacks to satisfy the regression.
- Sequential fixture creation/retirement does not restore one page over another
  active owner. These same-realm fixtures remain serialized; do not introduce
  overlapping pages as though they were independent browser realms.

Use existing observable fixture boundaries or a minimal test-only accessor for
the owned frame count if necessary; do not expose production internals or change
frame scheduling. The current teamPage tick assumes a frame exists, so a retired
empty frame map must not be tested by invoking that unsupported tick path and
mistaking its exception for successful cancellation.

Preserve every original test declaration/body/assertion/options byte-for-byte
apart from the private fixture teardown outside those bodies; record original
AST source-range hashes before editing. New regression cases are additive. In
particular, no error-message fallback, longer settle allowance, substituted
catalogue or reduced simulation work may make existing tests pass.

## Verification and failure interpretation

1. Reproduce the new connected-root regressions against exact unchanged fixture
   sources before the fix. Record failures honestly; do not rerun the full phase
   solely to recreate its already retained timeout.
2. After implementation run the new actual-fixture regressions and the complete
   original display-preferences test file, with zero failures/skips. Run scoped
   lint/format checks and verify all original test source-range hashes remain.
3. Run the existing verifier/phase-policy tests and the unchanged original
   command `node scripts/verify-industrial-features.mjs --phase host-integration`.
   Preserve 16 original files, concurrency two, process boundaries, initial
   readiness allowances, 600000 ms deadline and complete source/TAP receipts.
   A diagnostic subset or partial passing prefix cannot replace this result.
4. Capture fresh exact-head CI, ordinary installed-main source admission,
   dependencies/reviews and production/source/capacity safeguards before any
   readiness or merge. Do not use a successful regression to waive a failed or
   pending phase. Local/hosted results must identify runtime and source pins;
   local SMB timing is not a controlled Linux performance result.

If the complete phase still times out, preserve the failed receipt and report
that the retirement inconsistency was corrected but the timeout remains
unexplained. Do not declare this the root cause, iterate speculative cache
patches, increase deadlines or shrink tests. Any next diagnostic requires its
own evidence-backed scope review. Other eligible PRs continue independently.

## Preservation, publication and completion boundary

All source, fixtures and retained receipts stay on the approved external volume;
no large internal checkout/build/artifacts or dependency installation is implied.
Keep the human checkout, local HEAD/index and unrelated browser evidence intact.
Use normal history-preserving exact-head publication only after implementation
approval; do not blindly commit/push/reset the intentionally unreconciled local
checkout. This specification may be published as a separate docs-only commit.

No gameplay, Studio, SIM, saves, original assets, release archives, installer,
origin/CSP, worker/storage protocol or Pages guard changes belong to this work.
No new capacity savings, native/offline/physical qualification or 950/900 MB
attainment follows from a fixture correction. The overall goal remains open.
