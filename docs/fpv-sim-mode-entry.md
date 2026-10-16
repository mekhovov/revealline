# FPV SIM landing destination

The shared landing mode chooser now shows Solo, Versus, Team and FPV SIM, in that
order, in all three game hosts. SIM is a navigation destination; it does not add
an arcade mode identity, alter Journey progress or start an arcade attempt.
Small screens wrap the choices without clipping labels; EN/UK and native focus
styles use the existing main-game components.

Selecting FPV SIM pauses the host and opens the existing optional-practice panel,
filtered to World Studio. A bounded, same-origin check first confirms the expected
bundled simulator entry. Its Open Flight School & Worlds link preserves locale
and opens the learning catalogue in the same window. This also allows a gamepad
confirmation to navigate without a browser popup permission. When the entry is
absent, the existing validated optional-package catalogue supplies the supported
launcher. Ordinary optional-package/source-preview links retain their behavior.
The check does not claim offline installation, verify an entire package or replace
package admission. No automatic download or installation is introduced.

Back restores the actual opener without resuming gameplay. Async checks are
cancelled when closing or disposing; late results cannot replace a later visit.
Menu input remains owned by the current dialog in Solo, Versus and Team.

Verification receipts under `docs/evidence/fpv-sim-entry-*` distinguish current
source/build evidence, browser menu checks and controlled controller navigation.
Existing assertions expecting exactly three landing choices were updated for the
fourth destination; no additional unit coverage was introduced. Additional unit
coverage and physical Steam Deck/iPhone/controller qualification remain in R7.
The browser fixture's Solo gate uses a separate loopback-only public test credential
through the real gate implementation; production credentials, code and access
storage are unchanged. It qualifies the post-access menu, not the production gate.

Design follows the same [Valve controller-completeness guidance](https://partner.steamgames.com/doc/steamhardware/compat)
used for the handheld work and reuses the game's existing navigation rather than
creating a competing launcher style. The public site already redirects into this
landing page, so no duplicate top-level route is necessary.

## Completed qualification — 2 October 2026

Runtime `e936e94f91e96286a9f6ebc28f5d91758095218e` passes the full main build
(2,719 files), with all 15 changed emitted runtime files matching the frozen
source. All three optional packages pass admission, committed-input and ZIP
checks and two byte-identical builds. The final receipt is
`docs/evidence/fpv-sim-entry-final-20261002.json`; it supersedes pending items
in the earlier working-source receipt without treating earlier builds as final.

Actual-browser checks pass for all three landing hosts, EN/UK and 390/1280px
widths (12 cases). Two additional controlled-gamepad runs navigate Solo →
FPV SIM → Flight School without pointer input, retain EN/UK and display all58
lessons. This caught and fixed World Studio ignoring an explicit launch locale;
changing language in the simulator also updates that explicit URL preference.
Package fallback links retain their existing new-window behavior, so this
controller-launch evidence applies to the checked same-build route.

The 62 applicable existing assertions,28 functional boundary checks, locale scan,
focused lint/format/syntax and independent source review pass. The refreshed
continuous-school player was opened at390×844, flown using its touch entry and
left safely paused. Hardware/browser-engine acceptance remains outstanding.
