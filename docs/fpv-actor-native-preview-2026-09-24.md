# FPV actor candidate: native preview observations

This is current-source diagnostic evidence, **not public or frozen-release
acceptance**. The preview used the isolated candidate checkout served at
`http://127.0.0.1:8789/game/?journey=whole-spatial-v5` on 24 September 2026.
Shared source was committed through `df1e20bdf`; Solo host integration was still
uncommitted and production metadata still used revision 62. Repeat qualification
after the final source and production metadata are frozen.

Observed in the native in-app browser through normal controls:

1. Fresh Journey menu showed Actors = FPV drones & equipment. Starting First
   return decoded and displayed FPV craft/enemy sprites over its original picture.
2. A released S key initiated a complete cut. First return cleared at 67.1%
   earned coverage, 15,980 points and three lives. The full-picture result did
   not replace the displayed earned percentage.
3. One Next activation prepared and started Choose your share with FPV actors,
   original picture and the 65% target, without a separate selection menu.
4. In the main menu, changing Actors to Campaign artwork produced the truthful
   session-only preference warning. Continue returned to the same mission with
   its previously accepted FPV actors.
5. A released S key closed a nonterminal cut at 34.3%, 8,160 points and three
   lives. The craft stayed on its bottom return cell while the keeper continued
   moving. The nonmodal line-secured explanation requested a fresh direction.
6. Skip followed by Confirm skip started Two keepers directly, with campaign
   craft/enemy artwork reflecting the new preference, 0% coverage and a 60%
   target. The mission was left paused.
7. The browser console returned no warning/error records for this tab during
   these observations.

Limitations and preserved failures:

- The browser displayed unavailable Journey storage and a profile-lock warning.
  Physical disk exhaustion was independently present. No storage, locks, user
  tabs or saved bytes were cleared. This does not qualify reload/persisted
  Continue or storage recovery.
- The keyboard API supplied press-and-release commands, not a physically held
  keyboard, gamepad or touch gesture. This does **not** resolve the user's
  reported next-tick restart defect.
- An initial label-based selector for Actors matched no element. Inspecting the
  accessibility tree and using its settable Actors control succeeded. This was
  an automation locator correction, not a product failure.
- No performance timings, compact-device dimensions, physical controllers,
  human enjoyment or public-availability claims follow from this preview.

## After the production metadata update

With revision 63 metadata committed at `9eccd5e61`, the browser was reloaded
before further checks. The Solo host source remained a frozen, uncommitted
candidate at this point.

- Fresh Solo Start decoded the retained revision-62 FPV craft/enemy again.
- The normal Solo → Versus mode link and explicit leave confirmation opened
  the race menu. Start race displayed FPV craft/enemies on both boards with
  matching initial picture, actor positions, lives and score. No gameplay
  parity or complete-match claim is inferred from this starting view.
- The normal Versus → Team link and explicit leave confirmation opened Twin
  landings. After readiness, Start together showed both numbered, independently
  coloured Team craft and FPV enemies on the original shared picture. The
  mission was paused; no Team clear, rescue or earned-Next was tested here.
- The tab reported no warning/error console records through the Team pause.
  Visible persistence warnings remained. The confirmations discarded only the
  disposable attempts created by this verification, not a user's prior session.
