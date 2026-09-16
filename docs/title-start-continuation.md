# Title Start and Continue

Internal P03 work package. It does not close P03 or establish a public release. The current execution register remains authoritative.

The [scoped candidate evidence](verification/cross-mode/p03-title-entry/README.md) retains the final 187/187 checks on both Node runtimes, 15 final desktop keyboard observations, and the separately pinned predecessor failures and native observations.

Start launches the mission named on the title screen with one deliberate action. Missions is the separate action for choosing a different chapter, mission, world or setup. A fresh source profile currently names First Signal; the preferred Arcade benchmark entry and the common three-mode lobby remain separate work. Start must not silently choose another campaign.

Continue first uses an unfinished flight already retained in the page. Otherwise it verifies the captured saved flight and its original artwork before adopting it. Successful title Continue explicitly resumes the verified flight. Ordinary Library and Load saved flight actions retain their existing paused result. Both Immediate and Grid + buffer retain their checkpoint and pending turn. Focus return alone never resumes.

Preparation status and Cancel stay inside the title. Cancel returns to the action that started preparation while preserving newer focus choices. Navigating away, hiding the page, losing focus, replacing a saved slot or changing the mission invalidates the old request. Late image preparation cannot start a flight. A stale restore detected after adoption remains paused. Storage or media failures keep recovery available; malformed saved bytes are not silently overwritten.

After a win or loss, Start can prepare a fresh attempt of the named mission. It preserves earned results and still validates the saved slot before replacing the terminal run. Cancelled preparation leaves the new attempt ready for a later explicit action.

The shell owns the current title visit and visible focus. The Solo host owns the captured run/recorder/selection, saved bytes, media preparation, audio gesture and final Resume. The optional restore hooks check currentness before adoption and report the adopted identities before final reconciliation. They do not reinterpret old saves, recordings or generic restore callers. During final reconciliation an adopted title continuation holds automatic save writes until its ownership is resolved.

Verification must distinguish actual action focus from a synthetic test click. Model the primary action receiving focus before activating it; do not make every synthetic click focus its target or weaken runtime focus ownership. Test cancellation whose cleanup synchronously changes focus or backgrounds the page. A late completion must preserve the newer choice.

Reusable prompt: “Extend a title launch using the existing visit and host ownership checks. Show preparation and Cancel inside the active title, capture exact run and saved identities, preserve generic paused restores, and prove that cancellation, backgrounding, changed saves and synchronous focus changes cannot cause late Start or focus theft. Retain failing evidence and qualify the final combined source.”

The interaction follows [W3C modal-dialog focus guidance](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) and [Xbox guidance for consistent keyboard/controller navigation](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112), reviewed 15 September 2026. Scoped source and desktop browser checks do not establish accessibility conformance, physical-controller, touch-device or public-release acceptance.
