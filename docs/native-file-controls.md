# Native file controls

P05 source candidate with bounded browser observations; wider acceptance and release remain pending.

Native file buttons can retain user-agent font and colour rules instead of inheriting input styling, so set their font and both colours explicitly. See [MDN’s file-selector-button reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::file-selector-button).

The shared Field Kit component stylesheet pairs the native file button's text and background tokens, including hover, active and disabled states. Its minimum inline/block size is the existing 44px target token. The compact recipe uses 8px padding and a 4px trailing gap to preserve filename space. Font inheritance follows the host's actual typography; Motion and Studio own Theme/Plain and Standard/Large preferences. The native input, visible filename, label, focus outline, accepted types and chooser/change handlers remain intact. No proxy button or new input behavior is added.

The shared selector outranks Motion's legacy pale button and Video Poster's local recipe without `!important`. Motion's more specific wrapping/geometry rule remains compatible. Disabled styling matches `:disabled`, including a disabled fieldset, and `aria-disabled`; enabled hover/active rules exclude both. ARIA styling does not implement disabled behavior for callers.

## Bounded browser observations

The browser owner retained scoped CUA observation receipts for these source candidates. They contain reduced observations transcribed from the tool transcript; screenshots were visually reviewed there, but no local screenshot bytes are claimed. This summary does not establish complete P05 or release acceptance.

- R2: all eight Motion combinations of Theme/Plain × Standard/Large × 390×844 portrait/844×390 short landscape passed the observed colour, 16px/20px text, 44px minimum pseudo-element target, 64px/67px input height and horizontal-overflow checks. Same-file reselection passed. Video Poster accepted a real MP4 and captured a poster. These observations apply to R2 before the final gap reduction.
- R3: CSS SHA256 `ab7e3291bf517c8eae031bf55015bbaf13ab13cc7f6f69fafa516d1cf714f497` changes only the trailing gap from 8px to 4px. Desktop Motion at 240px input width displayed the full “Choose File” and “No file chosen” labels. Theme/Large inputs at 844×390 (203×67px) and 390×844 (362×67px) showed no horizontal overflow. Enter activation and a real PNG upload succeeded; focus remained on `background-file`, and the status displayed the full filename and 1280×633 dimensions. The eight-cell R2 matrix was not repeated in full on R3.
- R3 Studio: Theme/Large at 390×844 retained a 354×47px replacement label and a roughly 186×47px import label, visible focus and a genuine transparent file input. Enter and a real PNG prepared a replacement with its full filename and original dimensions. The draft was discarded without staging or saving; document width remained 390px.
- R3 Still Media: a real PNG required provenance before preview, then verified 1280×633 dimensions and 243,034 original bytes. The preview was discarded and the dialog closed without saving an assignment. This route exposed portrait overflow, which was investigated separately.
- R5 Still Media: the one-line label-grid correction in `game/ui/still-media-panel.css` (SHA256 `9264a0ca9760c693507b8f32dbb8bc3cbfc48e3b0206a7d47539e92111b2e1c7`) uses `grid-template-columns: minmax(0, 1fr)` so native inputs and selects can shrink within the label. At 390×844, 844×390 and 1280×800, dialog scroll width equalled client width (342px, 796px and 914px), with no overflowing inputs, selects or textareas. All four file buttons retained a computed 44px minimum block size. Keyboard Enter, real PNG selection, provenance entry and preview succeeded; the 243,034-byte original was verified, then the draft and local connections were closed without saving an assignment.
- Supplemental Motion startup: a real 20-second module delay kept the containing fieldset disabled. The file input matched `:disabled` although its own `disabled` property was false; its native button showed muted text, a dashed border and a 44px minimum target. After the module loaded, the fieldset enabled and normal foreground/background/border returned. This is a separate exact-runtime observation, not a repeat of every R5 state.
- OS chooser **Cancel remains unverified**. Same-file reselection is distinct evidence. An unsuccessful empty-file automation attempt and blocked native-app access do not establish chooser dismissal behavior; no bypass was used.

Narrow native filename areas may display an ellipsis. Motion also exposes the complete uploaded filename in its status; its handler deliberately clears the file input after reading the selection. Keep this separate from the desktop empty-placeholder regression.

The unmodified baseline already overflowed in portrait: dialog client width 342px, scroll width 413px and file inputs 359px wide. R3 measured 521px scroll width with different selected history text; those two scroll widths are not a controlled regression comparison. R5 fixes the intrinsic label-grid sizing without hiding overflow or changing media handlers.

Retained local receipt identities (the coordinator retains the originals outside released source):

| Receipt                                                    | Bytes | SHA256                                                             |
| ---------------------------------------------------------- | ----: | ------------------------------------------------------------------ |
| `p05-native-file-controls-browser-r3/cua-observation.json` |  6461 | `5e2ef2c7819c7f5d501f27f4c974d8fa69e61f98b2b0784e41803b0a5fd5ebe1` |
| `p05-native-file-controls-browser-r5/cua-observation.json` |  3526 | `7bc8ca7730ca9d5a989bc02e0de968991a05ff38d0291d3f31590fda73979a17` |
| `p05-native-file-controls-baseline/cua-observation.json`   |   749 | `eedbd42966c221aec24923229cebfebe429eb381cc9de124dc493f3abbae8e9c` |

## Remaining checks and host scope

Before acceptance, inspect remaining normal/hover/active/focus variants, chooser Cancel, retained preview/draft/focus, long filenames, forced colours, zoom and additional engines. The retained Studio and Still Media checks cover the specific routes above; collection import, other file formats and exhaustive states remain separate checks. Physical touch/controller and OS-chooser behavior remain separate from browser viewport emulation. The OS chooser itself is outside page CSS.

Studio's real file inputs are transparent overlays on labelled `.file-button` controls. Check the visible label's contrast, target and focus, plus native chooser behavior; its pseudo-element is not a visible contrast specimen. Studio's operation lock uses inert regions, distinct from disabled input styling.

Standalone Video Poster and Still Media currently do not adopt the global Theme/Plain or Standard/Large preferences. Their shared presentation entry does not supply that ownership. Closing this gap belongs to broader P05 display-preference work; changing Solo Settings does not prove those variants on these routes. This contrast candidate changes no host preference behavior.

The CSS-only browser study also observed a settled Still Media preview leaving focus on `BODY`. The separately reviewed [Preview focus correction](operation-focus.md#still-picture-preview-actions) now composes in this v0.61.1 candidate: chosen, saved and authored Preview restore only their exact initiating action after the current preparation completes. Its separate modeled and CUA evidence must remain distinct from the preceding CSS observations; none establishes public acceptance.

Source-token contrast calculations describe declared colours only. They cannot establish inherited native pseudo-element paint, every theme, viewport fit, chooser behavior or physical input acceptance. No CSS-string mirror test substitutes for browser evidence. Preserve bounded media validation, state ownership, exact originals and focus/cancellation behavior in all consumers.
