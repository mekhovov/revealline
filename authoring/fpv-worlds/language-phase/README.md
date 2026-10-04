# Library repaint preserves the current flight's Home action

The native personal-best qualification exposed an existing navigation race.
After an EN/UK change, `renderPacks()` unconditionally replaced the current
flight's Home phase with the lobby's `ready` phase. An immediate primary action
could therefore open Start briefing while the aircraft was still disarmed. The
next native frame restored Continue, after the wrong action was already taken.
The original observation remains in the separate personal-best evidence.

Candidate `40ef6750cd876f6d06a71c559905c655dec9cfca`, based on main
`8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2`, gates only that lobby shell update on
the absence of a flight. All Library rendering continues. Existing flight HUD
updates retain their phase, current mission and resumability ownership. Initial
and saved-recovery lobby updates remain unchanged. `closeFlight()` already clears
the flight before calling `renderPacks()`; that path is source-reviewed.

This is 55 additional original source bytes. No physics, clocks, arming/pause
guards, ghost eligibility, scoring or storage schema changes. Syntax, existing
format/lint and independent source review pass. At this preparation checkpoint,
native browser acceptance, full validation and fresh admission remain pending.

## Bounded manual comparison

`prepare.mjs` binds all 95 original inputs against an exact retained admitted
102-member player. Baseline members remain exact; the candidate has one declared
committed host overlay of exactly 55 bytes. Other members are immutable hardlinks.
The frozen source descriptor is retained losslessly in
`source-r1-fixture.json.gz`; `preparation.json` records original/stored hashes.

Run with pinned Node 22:

```text
node prepare.mjs ABS_REPOSITORY ABS_ADMITTED_PLAYER ABS_SOURCE_INVENTORY \
  8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2 \
  40ef6750cd876f6d06a71c559905c655dec9cfca ABS_NEW_OUTPUT
python3 -m http.server PORT --bind 127.0.0.1 --directory ABS_NEW_OUTPUT
```

Open the fixture visibly and choose Run. It uses sequential native hosts and
same-realm native IndexedDB with isolated names. It reproduces the original
synchronous baseline action, then checks candidate initial lobby, disarmed,
paused, completed and replay states. A real diagnostic practice record and an
incomplete flight support normal disposal/navigation and exact saved recovery.
It does not invoke hidden legacy leave-flight controls. The public Settings path
deliberately pauses active flight before changing language; active-flight language
input is not invented. Controls are scripted DOM actions, with ordinary native
rendering, clocks and storage. The complete receipt appears in a readonly field;
failure is preserved before ordinary cleanup.

The ground hold/land diagnostic pack is not a published lesson or a flight-skill
proof. No new unit coverage, hardware-performance, offline, universal UI or
public-deployment acceptance is claimed by this preparation.
