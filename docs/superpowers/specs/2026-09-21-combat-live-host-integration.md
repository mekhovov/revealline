# Optional combat: accepted-source live-host integration

Base: accepted main `595fdadddf3cf5c4240c430b78d27772915df83d`, released source
`e9434d03`. Release owner explicitly unlocked this isolated successor; current
v0.79 device freeze, version, publisher and accepted music revision 50 are untouched.
The earlier D2a/D2b/C1 engine, authoring and presentation are dependencies, not a
substitute for this live integration. No whole Team/art-ledger adoption.

## Required result

One optional-robot choice shared by Solo and Versus, persisted independently of
release version. Default follows authored content. Choosing Off or On sets an
explicit next-attempt intent; current flight/race, warnings, projectiles, recorder
and saved checkpoint remain exact. An explicit existing Restart/Retry or Next
applies the new choice; ordinary Continue restores the saved edition even if the
pending preference differs. No extra inter-level confirmation/menu. Versus uses
one visible party choice and compiles equal boards/seeds, not per-player toggles.
Ordinary recovery and automatic exhaustion restart retain the current edition.
A first-to-two Versus series keeps its edition through every round; apply pending
intent only to a fresh race/rematch or Next mission, not Start round. Existing
Versus pause/resume is tested; it has no durable Solo-style suspended restore.

The setting does not add robots to unauthored maps. A three-mission explicitly
labelled combat test route uses the D2b shared catalogue and source. Keep the
default released Journey and immutable old editions unchanged. Both on/off
executions remain owned and available for saved-state resolution. Recorded
campaign/level identities and mastery receipts distinguish on/off; navigation may
still show that the mission was cleared, but cannot fabricate the other edition's
mastery or replay. All prospective async preparations pin the selected edition;
preference changes cancel stale preparation, never mutate an existing run.
Construct authored/on/off variants independently from canonical source, deduplicate
identical variants, retain their ownership union, and pin execution keys in async
requests. Repeated toggles must not create revision-ancestry churn. Preference
changes cancel prospective replacement preparation, never a Continue restore.

Studio keeps normal Inspect/Apply/preview paths. Enable live combat preview only
after actual renderer and feedback exist and failure handling is verified. No
special simulator, injected browser state, hidden control or debug-only renderer.

## Presentation and failure contract

Use the reviewed BoardPainter projection and robot sprites in actual Solo,
Versus, replay and practice paths. Bodies, locked aim and projectiles remain
visible without sound, particles or color. Scrap is an independent cosmetic
preference and never changes simulation identity. Bounded synthetic effects and
short captions acknowledge warning, shot, elimination and projectile damage;
existing death/closure captions win over decorative eliminations. Preserve music
transport, catalogue, ledger, controls and master attenuation.

Invalid active combat projection stops/pauses the affected attempt with a visible
diagnostic; it cannot silently render no enemies while simulation keeps damaging
the craft. Disabled/absent data preserves old rendering and gameplay. All input
recovery uses existing fresh-direction/transition rules.

## Persistence and verification

- Preference: strict bounded schema, separate durable key, load never writes,
  unknown/corrupt stored data preserved, session-only warning/retry/export,
  cross-tab events reconciled only when current and no local unsaved choice.
- Actual hosts: choose off during active combat; current checkpoint unchanged;
  pause/reload/Continue retains on; explicit Restart uses off; turn on for Next;
  same action/seed on both Versus boards; pending-load cancellation and failures
  preserve the previous attempt, party, selected mission and focus.
- Render/captions/SFX: real public warning/shot/ram/capture frames, reduced/muted,
  terminal scrap, replay, malformed active state and no duplicate event effects.
- Old compatibility: historical capture/replay hashes and no-combat host tests;
  no accepted music behavior or publication metadata changed by intake.
- Native: normal Studio import/preview and actual player settings/restart/Next,
  screenshots of live threat cues, clear labelled test scenery and no hidden
  browser-state writes. Human/controller/touch acceptance remains separate.

All final phase PR/version/release/Pages actions remain release-owner coordinated.
Technical integration may be committed after review without claiming final human
balance, final mission artwork, Team semantics or complete P00–P15 delivery.
