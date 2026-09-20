---
name: xonix-couch-music
description: Integrate Reveal Line Couch music with shared validated storage and exact accepted content identity without writing Solo progress.
---

# Couch music integration

For implemented changes, follow the shared [feature delivery workflow](../../../docs/feature-delivery-workflow.md): exact-source verification, reviewed phase PR, immutable release and verified Pages deployment. Preserve the active task's scope and release ownership; modeled transport and native navigation do not establish listening or human validation.

Read `docs/couch-music-adapter.md`, `docs/couch-music-host.md` and the existing soundtrack player/panel contracts before extending Team or Versus music. The library, session, panel and host adapters compose one integration; qualifying an adapter alone does not qualify the complete player journey.

- Reuse one persistent player and the global master authority. Keep session music and audition faders distinct. Never write Solo profile/progress from Couch.
- Use `createCouchMusicLibrary` with a v4/story-enabled managed owner; never open the legacy facade by accident. Load without autoplay, adopt complete bytes before metadata, retain expected-generation conflicts, and close only owned resources.
- Give the panel a supported pre-adoption path. Its existing `onLibrary` callback runs after metadata adoption and cannot reject stale metadata safely on its own.
- Derive compatible Solo/Versus context from accepted campaign metadata. Prepare Team's canonical pack hash once per accepted preparation, then fence stale completion at the host. Never infer identity from a title or insert audio fields into a historical Team pack.
- Do not block gameplay on music storage. Show actual loading/error/recovery state. Preserve explicit music Pause before first Start and across retry, results, Settings and Resume.
- Test complete affected suites, real prepared bytes with modeled transport, failure/conflict/cancellation, then actual browser modal/gesture/lifecycle paths. Model success is not listening or physical-controller certification.

## Example implementation prompt

> Extend the shared Couch music foundation into both Team and Versus Settings → Audio. Reuse one persistent player per page; install validated shared-library bytes before playlist metadata through a supported panel adoption hook. Keep master mute/volume origin-wide, music volume session-local at the documented default, and preview volume separate. Do not write Solo profile/progress. Use exact accepted content context, retain the current queue on Retry and preserve music Pause even before first Start. Provide visible nonblocking preparation/recovery, exact nested-dialog return focus, explicit gameplay Resume and safe lifecycle disposal. Qualify keyboard, touch, modeled and physical controllers separately; test real browser media permission/lifecycle behavior and perform an actual listening review before claiming production readiness. Keep Team gameplay effects scoped separately and report remaining gaps truthfully.

## Session policy milestone

Use `createCouchMusicSession` as described in `docs/couch-music-session.md` around the borrowed persistent player/library/Soundscape. Route explicit Play/Pause and Start through it; preserve Pause before first Start, coalesce pending playback requests, and never autoplay when a storage promise completes. Pump menu music once per frame, preserve gameplay-only pause/reset behavior, and dispose borrowed owners through the host. Verify host/panel wiring, native journeys and listening separately from session policy tests.

## Panel admission milestone

Follow `docs/couch-music-panel.md`: use the optional `adoptLibrary` hook before local reload replacement and `owner.adoptVerifiedSnapshot` for validated shared-store snapshots. Keep completed writes visibly saved even when host refresh fails; block follow-on playlist selection until adoption succeeds. Pass `musicSession` for explicit panel Play/Pause while preserving temporary audition holds. Use the returned exact modal `element`/`isOpen()` for host input ownership. Preserve default Solo behavior and test the actual Couch Settings/modal/lifecycle integration after every composition change.

## Modal lifetime guards

Keep repeated panel Open/Close idempotent and provide `canRestoreFocus` from the current Settings owner. Use silent close options only for terminal/abandoned visits; ordinary hidden-page suspension must retain remembered listening intent. Do not let a host `onClose` callback bypass its own foreground/run/visit checks.

## Actual Team and Versus hosts

Follow `docs/couch-music-host.md` and reuse `attachCouchMusicHost` inside Settings → Audio. Supply exact current-visit ownership for nested library focus/controller navigation. Pump the session from the existing host frame loop, adopt Team context only after attempt acceptance, and close borrowed Versus Soundscape ownership explicitly on terminal departure. Team published music uses `cues: false`; do not imply gameplay cue parity. Preserve separate modeled, native, physical-input, listening and final-release gates.

## Integrating a reviewed packet into newer source

Apply the reviewed adapter → session → panel → modal → host sequence in an isolated checkout. Preserve later gameplay, picture and menu changes; a clean patch application is not behavioral verification. Run complete affected host and transport suites against the combined source. If an older sparse test fixture omits a newly imported module, retain that setup failure and restore the exact current Git input before rerunning; never substitute an old passing fixture for the integrated implementation. Review related hunks, include this skill and its examples, then qualify the final intended commit before versioned publication.

## Compose with authored Journey

Candidate Versus rows carry their base authored campaign identity for music
assignments, exactly as Solo does. Difficulty-specific simulation/execution keys
must remain independent; a new preset must not silently lose its authored playlist.
Music, chapter catalog, mission chooser and backup dialogs each keep their own
keyboard/controller scope and return target. The top music modal owns Back first.

Prompt: “Open an authored Journey in Versus, enter Audio → Music library by keyboard,
press Escape and return to Audio, then Back and Find a mission. Verify opener focus
and both unchanged paused checkpoints. Compare all mission/preset music identities
with Solo. Test native modal Escape with one faithful lifecycle double: duplicate
showModal/close methods must not shadow the modal stack and focus restoration.
Advance real host frame boundaries between screen transitions. Validate in a real
browser as a separate gate; a finite DOM does not prove physical controller use.”

## Production provenance after composition

Changing a shared audio recipe input (including default-compatible options in
`published-audio.mjs`) changes its production fingerprint. Preserve the original
ledger, append the unreviewed source-stage successor, then record only a scoped
review backed by actual source/test/native evidence before generating its reviewed
successor. Run the complete production-history suite, reproduction and readiness
gates. A browser check under master mute proves navigation and transport state;
it is not audible listening or full audio approval.

Prompt: “After composing Team's music-only adapter, inspect all four audio recipe
inputs and the exact changed diff. Preserve the stale-ledger failure, append
compatible history, review the bounded cues option and test default Solo behavior
as well as Team's cues:false behavior. Record native keyboard Next/Retry music
Pause continuity separately from listening, offline and physical-controller gates.”
