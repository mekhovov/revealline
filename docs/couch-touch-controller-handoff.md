# Couch controller-to-touch handoff

Status: prepared for the first patch release after v0.132.2.

## Player problem

Starting a Couch Versus race with a controller can leave the controller Confirm
guard active after play begins. A later touch gesture is then treated as a
mirrored activation instead of a new steering gesture, so the visible touch
pads do not move either craft.

## Contract

- Sample the assigned controller's Confirm state from the already captured
  frame while the race is running.
- Release the finite Confirm guard after the controller returns to neutral.
- Keep one hardware read per visible frame.
- Preserve controller assignment, held-input protection, keyboard steering,
  native settings controls, and both independent touch pads.
- Model the same monotonic clock in the Couch host tests that production uses.

The related navigation fixtures now enter setup and settings through the real
controller route and use the shared legal Team victory helper. This keeps the
focused gate aligned with current input ownership and authored Team rules.

## Verification

Focused verification covers controller menu ownership, setup select previews,
Back/Menu behavior, pad loss and reassignment, Settings controls, touch-pad
handoff, Team terminal navigation, and keyboard/controller cut behavior.

Physical Steam Deck and touchscreen checks remain separate from the modeled DOM
and controller evidence.
