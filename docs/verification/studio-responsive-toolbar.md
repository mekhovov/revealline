# Responsive Asset Studio preview toolbar

At 390x844, the toolbar previously compressed seven selects and Geometry overlay into one row. Its narrow-screen labels used a zero flex basis while a later host rule reset their logical minimum width; anywhere-wrapping then split labels into letter fragments. The preview canvas itself remained readable.

The toolbar now uses bounded auto-fit columns at widths up to 700px. Labels wrap at words, native selects remain on one line, and selects plus the Geometry label have at least 44 CSS-pixel target rows. The wide flex layout, DOM/tab order, canvas dimensions and runtime behavior are unchanged.

## Verification

Native browser verification ran against PR236 source 516e9e60faeb688cd194eababd5d61052c82b603 with the CSS-only patch babdd6bbe240c84964f355f7454d40f44dfd8ba95c9c15f1bb62a81530839afc and its unchanged generated Team preview. This is not a claim that the final main-based commit was loaded in that session. The original studio.css is byte-identical at that source and main a5d878ec323c417a45970550dcd183e02772322f: SHA256 54843c7075b5de46b6417fc53b19cd5f78e011a642c2948feabca261bee87f13.

- 390x844 portrait: seven selects 354x44px; Geometry label 354x44px; document and scroll widths 390px. Labels and selected values were readable.
- Plain/Large portrait: selects 354x45.5px, Geometry row 44px, no horizontal overflow.
- 844x390 landscape and 1600x900 desktop: existing wrapped layout retained; control heights 44px, minimum measured select width 101px, no horizontal overflow.
- Actual Tab order: Preview, Game mode, Team arena, Team scene, Backdrop, State, Motion, Geometry overlay.
- 317 HTTP 200 requests, empty console, no native findings. Preferences and viewport restored; browser tab and preview server closed.

The serialized local native receipt is `.cache/p08-studio-mobile-toolbar-516e-r1/native-review-root-r3.json`, SHA256 `0193bd5f1e78f98fda7df986318679d33c170d2cd0e5073e1e28796f0af64609`; its request log SHA256 is 98ea4686068f32362e9d0b540839be1db9d3f8eec7bb4aed7d1f3e89f5f9504b. The source CSS passed Prettier parsing/format checks and exact forward/reverse patch checks. No CSS-only mirror test was added; repository ESLint targets JavaScript.

The final generator read audit and declared recipe-source inputs exclude studio.css. No production regeneration or Team quality promotion is needed. Assign the next unused game patch version during final release integration. The separate Team inventory count correction is not included.

This is responsive viewport evidence with pointer setup and actual Tab checks. It is not an entirely keyboard-only authoring journey, physical touch/controller certification, 200% browser-zoom verification, full Studio workflow acceptance or a public release. Follow the [responsive authoring prompt](../../authoring/prompts/studio-responsive-toolbar.md) for future changes.
