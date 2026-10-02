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
