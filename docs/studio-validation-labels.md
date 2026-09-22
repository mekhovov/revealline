# Studio validation labels

The timed-bonus form keeps the browser’s required-field validation and native error message. After the browser chooses the invalid field, one animation-frame callback reveals its complete associated label with an 8px scroll margin for the 3px focus outline and 3px outline offset. It never focuses a different control, cancels validation or submits a draft. Forward and reverse focus use the same bounded reveal. A label taller than the available viewport falls back to the control.

Pending work is owned by the current field in the connected form. New focus, disabled/hidden controls, a background page, teardown or reentrant layout changes cannot cause stale scrolling. The adapter is attached only to the timed-bonus form; modal focus helpers retain their existing contract.

## Verification

Source base: `af3bf0ff10c65ff6d172b6742819f2bb7df84b99`, with the three runtime overlays pinned in the native receipt. The original empty-form submission at 320×568 placed the required input at y=0.09..44.09 and its label at y=−22.91..44.09, clipping the label and outline. The mounted-editor regression fails with the original editor (4/5), then both complete form-focus and content-timed-bonuses files pass 13/13 on Node 20.19.5 and 22.22.2 with 81 exact read bindings and zero mismatches. Real add/replace/remove, invalid/stale draft behavior and Solo/Team timed schedules remain covered; event fixtures alone do not establish native geometry.

Native review on 2026-09-22 passed the actual empty submission at 320×568: the browser retained focus and its required-field bubble, the label occupied y=8.09..75.09, and the input remained 44px high. After entering only the ID and changing to 844×390, required Anchors kept its native bubble and complete label at y=7.78..280.78. Shift+Tab returned to Effect with its label visible. Neither submission changed the project JSON or applied a schedule. There was no horizontal overflow or console warning/error. All 173 requests matched the exact base and runtime overlays. The owned tab/server were closed and viewport reset.

Native receipt: `.cache/studio-timed-focus-af3-r1/native-validation-review.json`, SHA-256 `0d276e16ba5717198b1bf870967cb62a94369ab4ffb9dce2afd08b214a707704`; request log SHA-256 `b9438948f7bc1a298325b8f22ed116ada60869643ec9986188bd2a3c09109e6e`. These are scoped local observations. Opening the disclosure used a pointer; subsequent form traversal used keyboard input. Physical-device/controller, actual browser zoom, screen-reader, all-Studio-form and public/release acceptance remain separate. Version assignment belongs to final release integration.

## Recovery onto the current release line

The closed, unmerged PR242 is recovered onto main64ec9fd2 without changing its product bytes. [Integrated focused qualification](verification/studio-validation-recovery-20260922/README.md) passes13 checks per Node20/22; final native/source/version/public gates remain separate. Earlier native observations above retain their original source attribution.

The recovered source46dcdcdb also passes the [integrated native portrait/landscape follow-up](verification/studio-validation-recovery-20260922/README.md): native invalid-field messages and labels remain visible, reverse navigation works, project JSON is unchanged, and all173 served paths match source. This is candidate evidence, not public acceptance.
