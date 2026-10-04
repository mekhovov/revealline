# Library repaint preserves the current flight's Home action

The native personal-best qualification exposed an existing navigation race.
After an EN/UK change, `renderPacks()` unconditionally replaced the current
flight's Home phase with the lobby's `ready` phase. An immediate primary action
could therefore open Start briefing while the aircraft was still disarmed. The
next native frame restored Continue, after the wrong action was already taken.
The original observation remains in the separate personal-best evidence.

Initial candidate `40ef6750cd876f6d06a71c559905c655dec9cfca`, based on main
`8e5ad71e9b791b7c16bae1cb308026ed3e18d5c2`, gates only that lobby shell update on
the absence of a flight. All Library rendering continues. Existing flight HUD
updates retain their phase, current mission and resumability ownership. Initial
and saved-recovery lobby updates remain unchanged. `closeFlight()` already clears
the flight before calling `renderPacks()`; that path is source-reviewed.

The initial guard adds 55 original source bytes. No physics, clocks, arming/pause
guards, ghost eligibility, scoring or storage schema changes. Syntax, existing
format/lint and independent source review pass. At this preparation checkpoint,
the original native run retained 324 passing checks but timed out afterward.
It proved another same-turn defect: public Settings paused active flight while
Home retained `canResume=false` and Start from the active state. An immediate
primary action opened briefing; the next native frame restored Continue.
The complete failed receipt is retained under `evidence/source-r1-failed/`.

Candidate `bf3597703763584c79119bdeab50bfa03198ae6f` also calls the existing
`updateHUD(flight.snapshot())` after pausing in the native surface-open callback.
This synchronizes phase and resumability together before the action is exposed;
it does not change pause, arming, physics or clocks. Total growth is 105 original
source bytes. Root and independent source reviews found no blocker. The new
immutable `source-r2/` comparison adds explicit immediate Continue/Retry checks
and saved-recovery title checks; native acceptance and final admission are pending.

## Bounded manual comparison

The original `prepare.mjs` binds all 95 original inputs against an exact retained admitted
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

For the corrected comparison, run `source-r2/prepare.mjs` with the same baseline
and retained admitted player, replacing the candidate argument with
`bf3597703763584c79119bdeab50bfa03198ae6f`. It requires exactly the 105-byte
committed host overlay. The original descriptor/tools and failed run remain
unchanged.
