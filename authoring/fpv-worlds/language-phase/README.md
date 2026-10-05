# Library repaint preserves the current flight's Home action

Current publication candidate includes main
`5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28` with only the focused 105-byte host
fix as its runtime change. The exact admitted candidate remains
`d1d48b2b7ad67a0915532a1489f300abccd778ae`, built on main
`5cde6dbc97c3067b6023d2bf7fd97fe251805347`. Full Node 22 validation, all 16
existing appearance/texture checks, and all three package admissions pass. Two
builds are identical, committed inputs and ZIP members are verified, and Worlds
retains 95 original inputs and 102 admitted members. Its original inputs total
16,777,085 bytes, leaving 131 bytes under the unchanged source ceiling before the
separate visual-source capacity preparation. The zero-overlay admitted candidate
lifecycle passed all 283 checks with no recorded warnings, errors or dropped
observations. Its full receipt and screenshot are retained under
`evidence/admitted-r1-passed/`; the raw receipt is 137,460 UTF-8 bytes
(137,174 characters).

The corrected source comparison passed all 433 checks with no recorded warnings,
errors or dropped observations. That run is bound to the earlier exact source
`bf3597703763584c79119bdeab50bfa03198ae6f`, not silently relabeled as the integrated
candidate. The integration brings only the already-qualified warm-frame and
personal-best access changes in the host and renderer; all other original inputs
are exact. `evidence/integrated-d1d-admission/` retains the complete 95-input bridge.
The original 324-check timeout remains preserved as a failed run.

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
and saved-recovery title checks. Its native run passed 433 checks: immediate
language changes retain disarmed, paused, results and replay ownership; public
Settings pauses active flight with Continue already correct in the same event
turn; a genuine 60-tick practice and ordinary saved-flight reopening retain their
state. The no-flight recovery lobby still localizes its saved mission and offers
Continue. The full source receipt is 241,026 UTF-8 bytes (240,697 characters),
retained losslessly with SHA-256 in `evidence/source-r2-passed/`.

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

## Integrated admitted lifecycle

`admitted-r1/prepare.mjs` verifies every committed original input and all 102
admitted player members before immutable hardlink staging. It uses the unchanged
source-r2 candidate lifecycle, omitting only the historical baseline reproduction.
The runtime has no overlays. A separate host HTML mounts the ordinary application
at its native directory depth; the original admitted HTML remains unchanged.

```text
node admitted-r1/prepare.mjs ABS_REPOSITORY ABS_ADMITTED_PLAYER ABS_SOURCE_INVENTORY \
  d1d48b2b7ad67a0915532a1489f300abccd778ae ABS_NEW_OUTPUT
```

Each evidence manifest names the exact source, original bytes/SHA-256 and stored
bytes/SHA-256. JSON and logs use deterministic gzip; `gzip -dc FILE.json.gz`
recovers the original bytes. Screenshots are retained unchanged. The separate
`public-warm-1a/` archive records the parent's actual public launch at the earlier
warm-frame deployment, and does not claim this language fix is deployed.

## Main capacity integration and publication boundary

Normal merge `d1ebca5a2c55687b142bbff2ae6134d71cd32809` incorporates merged
capacity PR #1085. Of the 95 admitted original input paths, only the generated
`world-visuals.mjs` differs from the historical d1d admission. Its readable
canonical source is byte-identical to the admitted original module; the existing
generator check and independent AST/token/comment/line-terminator comparison
pass. The qualified lexical projection recovers exactly 41,026 bytes. The host
and the other 93 original inputs remain byte-identical. No rendering behavior,
limits, dependency counts, licenses or original recordings change in that bridge.

Current original inputs total 16,736,059 bytes, leaving 41,157 bytes under the
unchanged source limit. The resulting exact publication head must pass normal CI
admission. The local build and native browser receipt retain their exact d1d
identity; they are not presented as a fresh build of the capacity-integrated head.
The bridge and semantic receipt are retained under `evidence/main-capacity-bridge/`.
