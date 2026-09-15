# P00 platform-reference check

Accessed **2026-09-15**. This is supplementary research for the accepted plan, not a new feature request or a conformance certificate. References are official Microsoft, W3C, and Apple material. Microsoft XAG/HIG recommendations and W3C informative explanations do not themselves prove this game's compliance. Project requirements remain those already approved in the execution plan.

## P03 — keyboard, controller, focus, and Back

[Xbox Accessibility Guideline 112: UI navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) recommends digital keyboard/controller navigation, consistent interaction prompts, logical spatial order, an available route to the initial menu, and updated navigation order when resolution or UI scaling changes the visual arrangement. Its Sea of Thieves example uses directionally predictable tile movement; Grounded illustrates keyboard-only access. Its looping recommendation applies to linear menus, not mandatory wrapping of multidirectional grids.

[XAG 113: UI focus handling](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113) calls for a highly visible focus marker that does not disappear or move to hidden/offscreen controls. Modal controls retain the active focus context. The retrieved page reports an update on 2026-03-04.

The [WAI-ARIA modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) specifies focus inside an opened dialog, contained Tab/Shift+Tab navigation, Escape dismissal, and focus restoration to the opener or a logical successor. It also recommends a visible closing action. Initial focus can be a static heading when that preserves reading context; it is not invariably the first button.

**Apply the existing acceptance:** traverse title → each lobby → setup/help/options → return with keyboard and modeled supported controller input; repeat after reflow. Verify visible focus, consistent Confirm/Back prompts, topmost-modal containment, and focus restoration. Keep the already agreed explicit Resume ownership: dismissing a submenu must not silently resume gameplay. The sources support coherent navigation; they do not mandate Reveal Line's exact three-mode labels, input bindings, or pause semantics.

## P03 / P08-A — touch targets and short landscape

[WCAG 2.2 SC 2.5.5, Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) is **Level AAA** and specifies 44×44 **CSS pixels**, with stated exceptions. The project independently adopted that minimum and prefers 48px. Do not describe 44px as the universal WCAG AA minimum or confuse CSS pixels with hardware pixels.

[XAG 107: Input](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107) additionally recommends large, separated touch targets in physical units: suggested mobile defaults include 15mm and tablet defaults 24mm, with DPI-dependent pixel examples. These are not direct CSS-pixel conversions. They reinforce the need for physical-device reach and accuracy testing; this review does not silently replace the approved 44/48px contract.

Apple's [Design advanced games for Apple platforms, WWDC24](https://developer.apple.com/videos/play/wwdc2024/10085/) recommends adaptive UI sections anchored to screen edges instead of shrinking the entire interface, keeping controls clear of device safe areas, using comfortable tap targets, and testing on actual devices. It distinguishes scrollable settings from in-game controls and stresses touch press feedback. Apple uses platform points, not web CSS-pixel terminology.

[WCAG SC 1.3.4: Orientation](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) concerns author-imposed orientation restrictions. It does **not**, alone, prove that all controls fit a particular small viewport.

**Apply the existing acceptance:** measure hit boxes and full arena/HUD/control bounds at 390×844 and 844×390, including safe-area insets and both players' controls. Reflow nonessential chrome before reducing essential controls. The P00 browser finding—40px Team direction widths and landscape controls beginning below the viewport—remains open for P03/P08-A. “Rotate your device” or a playable-field crop is not the agreed resolution. Physical simultaneous-touch and reach checks remain distinct from viewport emulation.

## P01 — waiting, progress, and cancellation

[Apple HIG: Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) recommends activity feedback during lengthy work, determinate indicators when the work can be measured, accurate progress, consistent placement, useful context, and cancellation when it can be offered without harmful side effects. The direct page uses client rendering; its current official indexed content was also retrieved to inspect the guidance.

[WCAG SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), Level AA, requires status information to be programmatically determinable so assistive technology can announce it without moving focus. Waiting, progress, success, and error summaries can be status messages; a context-changing modal is a different case.

**Apply the existing acceptance:** show a meaningful phase before waiting; announce phase changes without stealing focus or announcing each frame. Display measured bytes/files/work only when available, otherwise an indeterminate treatment. Exercise slow preparation, cancellation, failure, retry, and stale completion after navigation. Generation guards, immutable saves, the absence of fake percentages, and not aborting an atomic commit are project implementation choices that preserve the accepted behavior—not literal claims made by these sources. The reviewed guidance does not require an extra confirmation screen or minimum artificial loading delay.

## P02 / P08-B — mute and reduced motion

[WCAG SC 1.4.2: Audio Control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html), Level A, concerns audio that starts automatically and continues over three seconds; a pause/stop or independent volume mechanism is required. Its scope differs from explicitly requested playback. A conveniently placed sound control helps players hear assistive speech and manage distraction.

[XAG 117: Visual distractions and motion settings](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/117) recommends controls for distracting animated/auto-updating UI and secondary camera effects. It distinguishes core gameplay from decorative movement; it does not require stopping all actor motion during play. [WCAG SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) is Level AAA and addresses disabling nonessential interaction-triggered motion.

**Apply the existing acceptance:** keep Sound on/off accessible from each active screen/dialog, verify actual music/effect/media muting and stale-play races, and retain independent playback intent. The all-mode master authority is the project's stronger requirement, not merely the narrow automatic-audio criterion. Reduced motion uses static loading/status cues, restrained transitions, and reduced cosmetic effects while preserving essential warning meaning. No new default shortcut is inferred from platform guidance; the existing M=Stop binding remains protected.

## Release interpretation

These references strengthen the rationale for already assigned P01/P02/P03/P08-A/P08-B checks. They add no online features, new settings hierarchy, or gameplay-rule changes. The P00 source inventory and browser baseline remain separate evidence. Neither reading a guideline nor passing a DOM assertion establishes complete accessibility, physical-device usability, audio output, or public-release acceptance.
