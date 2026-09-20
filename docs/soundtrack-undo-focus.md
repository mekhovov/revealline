# Sound Studio Undo focus

Undo restores the saved draft and disables Save/Undo. Previously, activating Undo
with the keyboard left focus on the document body. It now moves to the adjacent
enabled **Reload latest saved** action when Undo owned focus in the current visible
visit. It does not activate Reload, change playback or write the library.

The transfer respects a hidden/unfocused document, the host's return-focus guard,
and a newer focus owner. Capture ownership before rendering: browsers may blur a
button as soon as it becomes disabled. Retain the existing asynchronous operation
focus rules separately.

This applies the [WAI keyboard interface guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernible-and-predictable-keyboard-focus)
to keep a visible, logical focus target after an action becomes unavailable.

## Verification

- All 72 soundtrack-panel cases passed on Node 20.19.5 and 22.22.2. Seven new
  cases cover immediate/deferred disabled blur, saved-data and playback retention,
  another active control, hidden/unfocused pages, a refusing host and a host callback
  that moves focus. ESLint and formatting checks passed.
- In the actual Team Music library preview, a disposable unsaved playlist was
  cloned, reached through Tab and undone with Return. Focus moved to enabled Reload,
  its full outline was visible at 1280×720, saved generation 1 and the original
  track/playlist counts returned, and music remained paused. Escape restored the
  exact Music library opener, then Settings. Setup included pointer input.
- The preview used source `508a638f556b80817f4c872b9950d7de7b207b17` with only
  the reviewed panel override. All 225 served source responses matched that binding.
  This is not public deployment, physical-controller, touch, listening or offline
  acceptance. The original browser failure remains in the earlier recovery report.

Original logs, patch, source pins and summarized native observations are in
`docs/verification/soundtrack-undo-focus/`. The initial test launcher failed because
its synthetic entry path was not a disk file; the corrected importer ran the full
file and reproduced three new assertion failures before the correction. Neither
failure was suppressed. Native screenshots were inspected inline, not exported.

## Maintenance prompt

“Open Music library, create an unsaved change and reach Undo with the keyboard.
After activation, verify a visible enabled successor, unchanged playback and saved
library, and Escape to the exact opener. Model both disabled-blur timings and
hidden, unfocused, host-refused and newer-focus cases. Do not use programmatic
handler invocation as proof of actual keyboard navigation. Keep source-preview,
integrated release and public acceptance separate.”
