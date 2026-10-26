# Radio action setup UX review and delivery

## Why the previous screen was misleading

The player believed the setup was correct based on the UI. Review confirmed that the generic **verified / ready** language did not distinguish stick calibration from their intended physical switch assignments. A preset could be valid and saved while a physical control the player called Fire was assigned to Deploy. The previous incident was diagnosed and corrected in #1805; this child improves the setup that allowed that misunderstanding.

The review also reproduced stale cancelled/unchanged feedback after applying a preset, old-binding hysteresis on swapped live indicators, and a JSON finite-number error on a pristine new controller. Browser inspection found generic fieldset flex wrapping displaced controls within cards. The prior live badge creation passed a class argument to a helper that accepted only three arguments; the explicit classes now apply correctly.

## Changes

- Saved profile labels and the final calibration stage say **sticks configured / sticks ready**. Their underlying profile and recovery formats stay unchanged.
- The switch section names each action: **Arm / Pause, Fire gun, Switch gun, Reload gun, Deploy payload, Detonate charge**. Each assignment button names its action.
- A prominent **ON now: Fire gun** summary shows what a moved switch actually activates. Unassigned actions say **Not assigned**; missing input is a different state.
- Instructions directly describe the Fire/Deploy mismatch and the existing swap repair. Applying suggested switches explicitly requests review of the physical actions; it never claims to infer the player's intended switch.
- USB axis/button numbers and raw endpoint values are in collapsed details. The live badge and assignment control have consistent positions and full-width buttons in each card.
- Fire/Deploy conflicts name the action already using the control and point to the swap. Conflicting capture leaves assignments unchanged.
- Saved and session-only messages remain accurate after silent autosave or repeated application. Live preview state resets when a binding changes.
- A new controller receives the next setup instruction instead of internal JSON validation errors. Empty switch assignments do not masquerade as all switches being OFF.

Autosave remains automatic. No confirmation checkbox, extra save button, forced remapping or new arming gate was introduced. The player's corrected localhost:8768 Fire/Deploy assignments were preserved; browser review used an isolated preview origin. Refresh the local SIM when ready to see the updated setup.

## Qualification

Five focused **action UX** tests passed; twelve legacy tests were excluded by the name filter. The new cases cover readiness labels, the actual Fire/Deploy mismatch, swapping while preserving calibration, conflict handling, denied storage and fresh-controller guidance. This is not a complete pass of the old radio suite, whose earlier workflow assumptions still need release qualification.

Syntax and whitespace checks passed. Both packages construct under unchanged policies: Academy 145 runtime/147 source files, 66,032 input bytes remaining; Worlds 208/210, 488,636 input bytes remaining. Zero local package identities are placeholders, not release evidence.

Browser review observed the active-action summary, Fire ON/Deploy OFF, hidden technical details and computed grid alignment. Full mobile/browser/layout qualification and new formative user sessions remain pending.

[Delivery receipt](evidence/fpv-combat/radio-action-ux-delivery.json) · [Package measurement](evidence/fpv-combat/radio-action-ux-package-measurement.json) · [Reviewed setup capture](evidence/fpv-combat/radio-action-ux-preview.png)

## Integration

Child of frozen #1805 at `070648ea0d0c8b533b9fcc566b6ee6ae5ff0f695`. Three runtime source paths, one test file, and scoped delivery evidence. Handwritten style additions are outside generated TOKENS/FULLSCREEN blocks. No generated shell/reaction body, simulation, calibration measurement algorithm or profile schema changed. Coordinate semantic integration after #1805 with Releases.
