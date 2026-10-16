# Confirm integration batch

This source verification follows the replay of the Demo Back follow-up onto the
current aggregate at `f194e3aa6761fd9e69b200200cfbc1f2d268a546`. It covers Creator and Demo
native-input integration and shared Confirm lifecycle changes. It does not
qualify a published build or claim physical Steam Deck acceptance.

## Behavior

Demo installs a window-capture keyboard listener so its Back action can consume
the complete native key gesture after focus returns to Home. That listener runs
before the document Confirm guard. Previously it could invoke Back on a Steam
Input Enter/Space echo before the shared release-committed transaction saw it.

The Demo input adapter now asks the host's shared Confirm owner before invoking
a fresh, unmodified native Back action. If the controller owns the gesture, the
event continues to the document guard, which owns its key lifecycle and release
commit. The probe uses the router's read-only Confirm snapshot; it does not
consume navigation, Back, Menu or flight edges.

If a trusted native Back action wins before Gamepad A becomes visible, the host
records that actual activation before closing the dialog. The lifecycle accepts
an explicit activation marker on the original event, preserving its target,
scope and assignment without fabricating a click. A later matching Gamepad hold
then drains as the same native winner, including a five-second hold and the
transition back to Home. The existing 250 ms association window is unchanged.

The default lifecycle behavior remains unchanged for document guard callers:
trusted click events are native activations, and down events are only candidates.
Untrusted events cannot become native winners. An already-held controller
Confirm still owns release. Ignored key repeats do not report an activation;
modified keyboard handling remains outside the Confirm hook.

The same host hook records Demo's actual pointer-down Back action after the
document guard has had its turn. Controller-owned touch-derived pointer/click
echoes remain suppressed, while native-only touch can still exit Demo.

Creator Start now keeps the owned release tail across a transition into flight.
Its native capture handler does not poll a menu Confirm while flight owns input,
and state refresh cancels softly so the original release cannot escape into the
new screen. Scope-changing commits cannot dispatch leftover navigation edges into
the new scope. An iframe focus cancels menu ownership. The guard retains its
programmatic call-stack depth if activation synchronously blurs or hides the page.
These changes port the reviewed Creator boundary correction from #782 onto #783.

## Automated evidence

Node v20.19.5. Focused commands run from the source checkout:

```sh
node --test --test-concurrency=1 game/test/controller-confirm-guard.test.mjs game/test/creator-player-navigation.test.mjs
```

22 passed, no failures or skips. Coverage includes Creator Start release tails,
native Confirm between render frames, flight isolation, and synchronous blur or
visibility changes inside guarded programmatic activation. Scoped lint, formatting
and diff checks passed. Log: `/tmp/creator-confirm-boundary-integration.tap`.

```sh
node --test --test-concurrency=1 game/test/controller-confirm-lifecycle.test.mjs game/test/demo-input.test.mjs game/test/demo-confirm-host.test.mjs
```

78 passed, no failures or skips. The new combined host tests run the actual Solo
app, Demo window-capture listener, document guard, coordinator, router and menu
navigation. Only the browser/hardware boundaries are modeled. They cover:

- Gamepad-first and native-before-RAF Enter/Space sequences, including a complete
  short tap between render frames and five-second holds with key repeats.
- No Back action on controller down; one exit on release, retained Home focus,
  and no release click that opens Settings or reopens Demo.
- Native-first Back before the delayed Gamepad edge, with diagnostics confirming
  the native winner at the original Back target through the menu transition.
- Touch-derived compatibility events and native-only touch after controller
  release, including a later Gamepad hold associated with native pointer Back.
- Genuine native activation after the release grace period.

The lifecycle tests separately cover explicit native-down winners across scope
changes, untrusted-event rejection and already-held controller ownership. Existing
Demo input tests retain ordinary keyboard/pointer behavior, remapped controller
actions, neutral/disconnect handling and unrelated gameplay commands.

```sh
node --test --test-name-pattern='controller gameplay action takes over while preserving one hardware read per frame' game/test/demo-host.test.mjs
```

One selected actual-host test passed; 16 unrelated tests skipped. The Demo flight
handoff retains its existing single hardware read per ordinary frame and does
not change the ordinary run/save while taking over isolated practice.

```sh
node --test --test-concurrency=2 game/test/controller-lab.test.mjs game/test/controller-navigation.test.mjs game/test/steamdeck-menu-confirm-host.test.mjs game/test/steamdeck-menu-confirm-race-host.test.mjs game/test/touchscreen-controller-host.test.mjs
```

231 passed, no failures or skips, in 91.9 seconds. This retains the controller
lab, menu navigation, real Solo menu actions, native-event race orderings and
touchscreen/controller handoff coverage.

Scoped ESLint completed with no warnings. Prettier was run on the changed Demo,
lifecycle, app and test files. Local TAP logs are named
`revealline-demo-confirm-focused-20260929.tap`,
`revealline-demo-flight-preservation-20260929.tap` and
`revealline-confirm-boundaries-20260929.tap` under the temporary evidence directory.

## Acceptance boundary

These tests model trusted native events and Gamepad snapshots; they are not
Chrome pixel, browser default-action or physical Steam Input certification.
Release qualification must use the final integrated source, production bindings
and packaged build. On the Steam Deck's fullscreen Game Mode Chrome shortcut,
verify short taps and long holds of A on Demo Back, then ordinary keyboard and
touch after release. If hardware behavior still differs, capture the opt-in
controller trace from that same displayed release before changing ownership
logic again.
