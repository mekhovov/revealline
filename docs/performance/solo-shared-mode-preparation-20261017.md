# Team and Versus preparation follow-up

The shared-component review found two runtime defects in the integrated source. Both occur in preparation or menus; the changes add no recurring gameplay work.

## Required base artwork

Versus base missions carried validated authored picture metadata, but their rows supplied no authored background or borrowed chapter backdrop. Selection could therefore reject the required original before Start. The host now passes the accepted level/global background to the existing static-picture owner. When no chapter owner supplies a borrowed image, that owner decodes the exact registered authored source during preparation.

Saved-picture and release-picture precedence is unchanged. The existing deadline, generation, cancellation and identity checks remain in force. Header and decoded dimensions must agree. The owner releases its own image on cancellation, failure or retirement and never releases a borrowed chapter image. Cancellation controls establish owned-reference cleanup and late-result rejection; they do not prove that browser decoding immediately frees native allocations.

## Visible progress and cancellation

Advanced setup can start mission preparation, but the existing progress status and Cancel action remained under the hidden Main screen. The shell now places those same nodes in the visible Setup screen and returns them to their original parents and sibling positions when leaving it. Teardown restores both nodes before destroying the menu owner, and repeated teardown is inert. This changes neither preparation ownership nor focus.

The public-route test opens Settings → Gameplay → Advanced setup, retains the accepted checkpoint, observes visible pending progress and Cancel, returns with Back, and confirms that late completion cannot revive the abandoned action. The real-markup teardown/remount control verifies exact node restoration. Both defects have retained failing controls before the fixes.

## Regression evidence

Eleven complete host files pass 238 cases across separate retained invocations: Team host 79, lobby 20, picture recovery 18, shared settings 16, encounter help 6, gameplay pressure 4, installed chapters 27, reading 16, static-picture host 36, offline retention 2, and shared reading 14. Some complete passing files were part of otherwise failed invocations; no single successful aggregate is claimed. The final artwork owner passes 36/36 and the final shell passes 26/26. The installed public-progress control was also checked against the final teardown correction.

Fixture changes use current visible Settings routes, the visible Home departure action and the actual localized text-node publication boundary. They retain state, save, focus, replay and cancellation assertions. The shared-settings import explicitly verifies a visible, non-inert, focused Gameplay control. No timeout was widened.

The exact sixteen-path inventory, per-file receipts, original failures and intermediate corrections are retained locally in `.cache/solo-followup/team-versus-397/final-review.json` (20,744 bytes; SHA-256 `c0e63666630e191461362c13ba6fd77598caa341086b02b8b05f1d4665857577`). The earlier incomplete static-picture run remains unexplained; the later complete file result does not rewrite it.

These are source/model controls. Production397 predates these fixes. Final-package native Team/Versus checks, repeated-transition resource plateaus and device performance remain open.
