# Deliberate Team terminal retry

This unversioned candidate is based on local Team stack commit
`4b33773bda9cb4cfa35ae8090152a63caf073db6`. It reconciles the player contract
from draft PR545 commit `459c1acbf88056b0bf4419578d56362de2f68a5e`
with the current controller, touch, pause, result and picture lifecycles.

## Player contract

- A terminal Team loss remains on its finished result for any amount of
  foreground time. There is no timed restart.
- **Retry same arena** remains the focused primary action. Retry starts only
  after a fresh keyboard, controller or touch activation.
- Keyboard activation and primary touch held across the loss are consumed
  through release. A held controller Confirm must return to neutral before a
  later Confirm can activate Retry.
- Retry keeps the accepted pack, arena, difficulty, setup, actor choices and
  prepared picture. It does not reread the accepted artwork.
- Ordinary paid reserve recovery remains immediate and still clears held flight
  directions. Only the no-reserve terminal outcome changed.
- Blur, hidden state and persisted pagehide keep the terminal or stopped result.
  A failed first paint after deliberate Retry stays on the stopped recovery
  result instead of entering a loop.

The native fresh-activation guard records keyboard and primary-pointer
lifecycles before the terminal boundary. It blocks only gestures already in
progress and their release click. Controller activation continues through the
existing Confirm guard and is re-enabled only after its neutral frame.

## Localization

The existing English and Ukrainian result copy remains authoritative. The two
timer-only keys for “starts shortly” and automatic “new attempt” directions
were removed from both locale sources, then `game/i18n/catalogs.mjs` was
rebuilt. No replacement timer copy was introduced.

## Focused evidence

- `game/test/content-team-recovery-host.test.mjs` covers indefinite result
  retention, unchanged reserve recovery, exact setup and artwork reuse, held
  keyboard/controller/touch rejection, fresh controller/touch Retry, lifecycle
  retention and stopped painter recovery.
- `game/test/fresh-activation-guard.test.mjs` covers held keyboard and touch
  transactions plus controller independence from a stale native click tail.
- The selected lost-Journey Skip case proves the retained result remains
  available for deliberate Skip confirmation.
- The existing co-op core recovery cases prove one reserve still redeploys the
  team and zero reserves still freezes one terminal defeat.
- `npm run i18n:check`, scoped syntax/lint/format checks and
  `git diff --check` qualify the changed surface.

The controller and touch checks use the repository’s modeled browser and
Gamepad boundaries. Physical-device and assistive-technology certification
remain manual release qualification.
