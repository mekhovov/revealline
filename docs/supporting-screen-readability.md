# Studio and Replay readability

This named P05 delivery extends the existing shared display settings to Asset Studio and Replay Theater. The unpublished v0.60.0 candidate is integrated on main cutoff `10df6751b0f31d3f8ed68ee0132c830b6eefbec8`. **Focused checks pass; Replay browser corrections are integrated; final qualification and release are pending. Full P05 remains incomplete.** The public baseline is still v0.59.1.

## Player and creator behavior

- **Interface → Text style:** Theme uses the game's readable themed fonts; Plain uses its plain-text option.
- **Text size:** Standard and Large update instructions and controls without resizing the arena or altering collision geometry.
- **Reduced effects:** the saved choice and the system request combine. The checkbox shows the saved choice; nearby text explains an active system override.
- Settings are shared with the game. A read or system change does not save anything. A failed save keeps the local choice usable and displays an explanation.

Studio's host controls stay readable independently of the asset being inspected. A selected font specimen still uses that exact file, appropriate role weights and English/Ukrainian examples. Compatible uses share one registration keyed by original font bytes, including weight-range expansion and failed-load retry. Inspecting a font does not grant production approval.

Changing Interface preserves selection, prepared original bytes, dirty pixels, Undo/Redo history and audio ownership. Effective motion changes affect only owned preview frames. Clearing the cap resumes a locally Playing preview with a fresh clock; locally Paused or Reduced previews remain still. Keyboard selection retains focus on the replaced selected inventory row on wide layouts; narrow layouts keep the existing Inspector handoff. Rejected selections preserve the current work.

Replay's Interface remains usable before content finishes loading and after a startup error. Jump to playback preserves browser fragment navigation and then focuses a usable transport action, unless newer input, focus or backgrounding supersedes it. Completion hands focused Play/Step to Restart; unrelated editor focus stays in place. Display changes preserve recording identity, playback position, verification and play/pause intent. They cannot earn rewards or write progress. A terminal exit prevents late startup from rebuilding the closed page.

## Return and lifetime

A persisted return rereads shared storage and current system reduction. An unsaved local choice remains authoritative until explicitly saved; a foreign record cannot silently replace it. Repeated delivery of the same storage value does not create another preference revision. Page return does not imply explicit Resume.

These rules apply to the existing shared authority used by Solo, Versus and Team. Tests must include those hosts and the composed Studio/Replay routes. Modeled page events establish handler behavior; they do not establish actual browser cache admission, physical controllers or touch hardware.

## Verification and boundaries

The initial committed candidate `02127f1` failed a hosted Replay startup test that counted event-loop turns before cold module loading completed. The [startup correction](verification/cross-mode/p05-supporting-readability/startup-correction/README.md) retains the original failed shard and replaces that wait with the actual held-fetch boundary, preserving every preference assertion. Production is unchanged; the corrected source needs fresh complete qualification.

The implementation combines 13 Studio source/test paths, eight disjoint Replay source/test paths and a five-path Replay successor (three overlap with that Replay candidate). Separate candidate totals overlap and must not be summed. Their original patches, failures, logs and native observations remain bound to their source snapshots. The current combined source needs its own affected tests, native checks, six source gates, production/build checks, reviewed release, public inventory and affected public journeys.

This delivery does not complete P05, change replay/save formats, alter gameplay or adopt new art. P04's cold Back filter/selection behavior and focus after a successful mutation disables its trigger remain separate. Other supporting routes, disabled transport styling and physical qualification remain in the execution register.

## Research used in review

- [MDN: pageshow](https://developer.mozilla.org/en-US/docs/Web/API/Window/pageshow_event), inspected 17 September 2026: persisted returns can restore frozen pages; the event alone does not prove foreground visibility. The game keeps explicit Resume independent.
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion): system motion preference informs the effective cap while preserving authored/user intent.
- [W3C: Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): inspect reflow and usable controls at enlarged text/zoom rather than relying on a font-size assertion. This record is not a compliance certification.
