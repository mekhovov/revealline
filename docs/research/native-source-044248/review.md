# Combined interface review

Source parent `04424872a84ae0c5d08211b3f756f568261735bb` incorporates the observed main and phase-seven heads. Its game/authoring bytes match `068e26b` before the four-line focus-layout change. The preview is source code, not a packaged release.

## Observed

The 844×390 CSS iframe preserves Large text and a Left/Large D-pad. Arcade hides generic equipment; built-in Tactical shows its authored Scan and Boost on the opposite side. The board itself fits, but the original keyboard focus paint extended below the viewport. The authored landscape layout now reserves 8px below the board, enough for the compiled 7px outline/shadow extent. Native after-images show the full focused border for both 2:1 Arcade and 4:3 Tactical. Compiled styles, registry and collision geometry are unchanged.

Keyboard sequence: title Continue → ArrowDown → Missions → ArrowDown → Collection → Enter; Close Collection → Tab → search → Tab → Achievements and appearances → Enter opens the disclosure. Escape returns to the exact Collection title opener. Focus changes were observed between actions, not inferred from direct button activation. The retained disclosure snapshot documents the resulting content. The run stays paused throughout.

## Limits and open observations

This is viewport emulation, not phone/controller certification. It does not qualify all aspect ratios, warning phases, nonzero safe insets or a complete campaign win. On a repeated mission-dialog opening, its accessible names disappeared in the browser snapshot and one named-role key action timed out; a visible-card click worked. This remains an investigation, not a passed keyboard journey. The session-only warning still overlaps the compact header in this preview with another profile writer. The broader pending-picture cases and exact-head CI/build remain separate gates.

Screenshots are unmodified browser exports. `arcade-left-large.jpg` and `tactical-left-large.jpg` show the original focus clipping; the two focus-clearance images show the correction. No programmatic DOM rectangle measurements were used.

## Completion and follow-up

On integrated `e2d1f687`, a real Base game / First Signal Standard flight completed at 52.2%, 8,160 points, three lives and 0:03. The result correctly reported a session-only collection because another tab owned saving. ArrowRight moved from Next uncleared mission to View picture; Enter showed the full picture, and the Results action returned focus to View picture with unchanged score/coverage. The earned First Signal picture appeared in Collection. This verifies the legacy tutorial reward path, not the challenge of the Pressure chapter or a persistent/offline save.

Repeated direct-page Missions openings retained the proper title and card names. Read-only DOM inspection found the single open `shell-missions`, correct `aria-labelledby`, and no direct hidden/inert attribute. The iframe snapshot continued omitting names, but its actual ArrowDown focus and Enter chapter selection worked. No source navigation patch was justified by this evidence; wrapper accessibility serialization remains a review limitation.

The real win exposed a separate stale title success message. `a6485318` hides previous non-error operation feedback on a fresh Home opening while preserving errors and current operations. A subsequent real win at the same 52.2%/8,160 result verified the corrected title: Deploy correctly describes its Pressure Lines / Arcade destination without the old Base-game selection success. Its three complete host regressions pass on both Node versions.
