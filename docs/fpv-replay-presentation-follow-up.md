# Follow-up: recorded FPV appearance in Replay Theater

Successor implementation prepared and locally verified, not a published feature. This is separate
from the actor default/menu work in PR338. It targets the remaining standalone
replay boundary in increment 1; it does not authorize a new capture policy or
change raw historical simulation recordings.

## Implemented

- `replay-presentation.mjs` implements the strict outer envelope and preserves
  every inner raw recording. Independent metadata, actor-pin and replay budgets
  cannot borrow space from one another. Accessors and unknown fields are rejected.
- The envelope's 15 focused cases passed independently; the combined raw replay
  regression cohort passed 29/29 with no skips. These are overlapping cohorts,
  not 44 separate cases. Lint, formatting and diff checks passed for the leaf.
- This parser makes no installed-source, asset-readiness or outcome claim. Those
  remain separate mandatory host gates.

- Solo snapshots the accepted attempt's actor pin, never today's preference.
  Recorded FPV export and explicit raw download preserve the same inner replay.
  Campaign-style, historical unpinned and modified Custom attempts remain raw.
- The read-only resolver accepts registered Journey editions and exact trusted
  Classic sources, reconstructs their installed rules using the shared session
  comparison, and derives actual presentation ownership before comparing pins.
  It does not fabricate prepared-pack authority or decode reveal pictures.
- Theater stages verified input playback, an independent exact actor lease and
  preview painting before replacing the accepted recording. Cancel, failure,
  supersession and page exit release owned resources; the previous recording
  survives failed replacement. Preview changes and transport retain the pin.
- Raw replay readers, simulation versions, recorded outcomes and historical
  session end-state restrictions are unchanged. No progress is awarded.

No version, immutable release or public acceptance has been assigned to this
successor. Its dependency PR338 must be accepted and reconciled with the release
owner's production metadata before promotion. This does not resolve the reported
stop-on-capture restart or complete increment 1's public/device gates.

## Previous gap

Before this successor, Solo exports the raw result of `exportReplay`. Theater verifies its rules,
inputs and checkpoint, then uses an independently selected preview world and no
recorded actor lease. A v6 saved attempt retains actors, but a standalone raw
replay does not. Do not describe raw export as retaining the new FPV appearance.

## Bounded contract

Add `revealline-replay-presentation.v1`, containing only:

- `execution`: exact campaign key and optional source pack ID.
- `actorAppearancePin`: the existing strict 8 KiB actor pin.
- `replay`: the unchanged raw simulation recording.

Keep the inner 32 MiB and 216,000-tick limits. Permit at most 4 KiB additional
wrapper metadata, checked separately; no embedded images, audio, CSS or fonts.
Historical raw versions remain supported exactly as before. Expose raw export
alongside recorded-actor export, and label which one the player is downloading.

For the initial successor, scope to accepted Solo FPV recordings. Versus/Team
have no equivalent standalone recorder/export path. Do not imply they do.

## Authority and staging

1. Resolve the exact Journey edition or trusted Classic owner from the
   application's accepted registries, not uploaded `pin.content`.
2. Reconstruct recorded gameplay tuning, level and class recipes and compare
   them with the recording. Reuse existing pure reconstruction logic without
   copying a second rules implementation. Do not directly call `restoreSession`:
   that API rejects finished attempts, which are valid replay inputs.
3. Derive the actual presentation context, compare the uploaded pin, and acquire
   its exact approved actor source/hash. A missing old owner or asset does not
   authorize substitution with today's preference.
4. Stage the verified simulation player, painter and actor lease atomically.
   Failure/cancellation keeps previous playback. Dispose staging on supersession
   and the accepted lease only when replaced or closed.

Playback controls and world-preview changes retain the accepted actor lease.
Never read the global actor preference or write player progress. This wrapper
records actors only—not reveal-picture/media ownership, music, chrome or proof
of an authentic player performance.

## Focused acceptance

- Real Journey and Classic export → Theater with identical final checkpoints.
- Exact actors survive pause, stepping, seeking/restart and playback speed.
- Reject changed map/class/source/actor hashes, including same-ID substitutions.
- Preserve previous playback through failed decoding and superseded imports;
  close each staged/accepted resource once.
- Reject oversized inner replay even when the outer envelope is within its
  aggregate limit; keep raw-example/navigation coverage.
- Verify retained revision-62 fetch and rendering on the frozen public build.

The implementation boundaries are the envelope parser, a read-only replay
actor-context adapter, shared installed-rules matcher, Solo export wiring and
Theater's transactional load/draw paths. Keep this separate from PR338's initial
default-actor delivery.

## Verification on 2026-09-24

- Envelope: 15/15 focused checks; independent review found no blocker.
- Actual Solo export: 7/7, including legally earned terminal Classic checkpoint
  `d8b55c21a6756634`, accepted-pin retention and actual downloaded JSON bytes.
- Resolver plus historical sessions: independently repeated 29/29 (16 resolver,
  13 historical/continuous session cases). Registered Journey presets, Base,
  Night Shift and original Pressure Lines source bytes were exercised.
- Theater: 27/27, including a genuine Solo Journey input/export → actual Theater
  import → completion/restart, plus unchanged raw/display/navigation cases.
- Final broader cohort: 93 cases, **92 passed, one sparse-fixture startup
  failure**, no skips, 84.12 seconds. The existing replay-player file could not
  import `scripts/verify-specialty.mjs`; it did not run in that cohort. After
  hydrating eight exact-HEAD text dependencies (465,935 bytes), its isolated
  13/13 rerun passed in 0.42 seconds. No full-cohort rerun is claimed.
- Earlier development failures remain recorded: the first resolver cohort was
  13/15 before correcting two fixtures (untracked generated endpoint; a terminal
  replay incorrectly passed to suspendSession). The initial Theater development
  cohort was 11 passed/13 failed while resolver/transport setup was incomplete;
  do not assign all those failures to one unproven cause. Review separately
  corrected Journey's theme-catalogue selection to match the real Solo host.
- Scoped lint, formatting and diff checks passed. These cohorts overlap and
  must not be added as independent test counts. No long/full suite pass is claimed.

### Native source-preview receipt

At `http://127.0.0.1:8790`, the ordinary `whole-spatial-v5` entry started FPV
actors. A released-keyboard downward cut legally cleared First return with
34.3% coverage, 8,160 points and three lives. Workshop → Export replay exposed
both recorded-actor and raw buttons. The DOM's exact 5,494-byte recorded export
contained 835 ticks and checkpoint `67aa5fd976ac3efb`.

The ordinary Workshop link opened Theater; pasting those exact bytes resolved
the real Journey owner and loaded retained revision-62 FPV sprites. Playback
reached tick 835 and displayed the same final checkpoint. Restart returned to
zero; changing preview to Ukraine Atlas retained FPV craft/enemy rendering.
Changing only the uploaded actor hash to zeroes produced an explicit unapproved
release error while preserving the accepted paused recording. No warning/error
console entries were observed during the successful playback check.

Source hashes at this check:

- Solo app: `041aa8ca090465bc7bade62babebef96cb9b6f5aba6ec05686f782af5ada8529`.
- Theater app: `7c922c26e3e1b3bf0bd9245f70a6bc63bd996da9cff7b42dbefce77981078f29`.
- Resolver: `7faf5d0818bba1e994f29fd0388b9816ed87b5d7c480d0705e7d22ca6f3e950a`.

This is a current-source diagnostic with real browser decoding, not a frozen
build, public deployment, physical-controller/touch or human enjoyment test.
The native profile reported session-only storage; no storage, locks or user
media were cleared. A browser download was requested; this receipt does not
claim that a filesystem download was completed or reopened.

## Remaining release gates

- Integrate accepted PR338 and canonical production metadata without replacing
  historical revision 63; allocate the next version with the sole publisher.
- Mandatory exact-head validation, lint/format, build/source provenance, frozen
  hashes, archive preservation, Pages and bounded public export/playback checks.
- All 110 indexed Classic missions / 34 source paths fit the fixed allowlist,
  but 16 generated external chapter endpoints remain unqualified here. Path
  coverage is not HTTP readiness. The optional mastery suite requiring an absent
  11.4 MB `homeward-skies.json` fixture was not completed.
- Frozen/public raw examples, indexed downloadable owners, retained hash fetch,
  keyboard/controller/touch, small screens and failure/retry qualification.
- Original six-increment plan: capture-restart reproduction/fix; shared travelling
  impacts and Team ownership; pursuit/interception arcs and erosion review;
  sprite animation/size and trails; UI skins/Tiny5; Team authoring and final
  human/device work all remain open as documented by their owners.
