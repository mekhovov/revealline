# Practice recovery and controller reading — batch 21

Parent: `fb26b059798d7e15169d3ff9c7e4653d13384970` (PR761).
Status: source corrections; production review remains deferred. No public release
or new production approval is claimed.

## Practice can return after a failed start

If a Guide practice child failed before game initialization, its boot recovery
screen could retain iframe focus. The parent correctly stopped sampling the
controller while that child owned input, but the child had not installed its
Return action. Players could therefore lose the controller route back to the
paused campaign.

The Guide now uses the existing preview-readiness observer for that exact child.
A confirmed pre-ready failure adds a short EN/UK message and returns focus to the
existing Return action when the child still owns focus. Slow preparation alone
never returns, cancels or replaces the lesson. Readiness settles observation;
a running lesson retains its own input and recovery ownership.

Independent review reproduced a further defect: a visible but inactive browser
window can keep the iframe as its active element. Recovery now defers focus until
actual foreground return, rechecking the same generation, URL, Window and failed
Document. Choosing a different control cancels that pending focus request even
if the player later refocuses the iframe. New navigation, Return, close and
disposal also retire it. Held Confirm cannot activate Return; release and a fresh
press are required. Campaign state, temporary handoff and return-token authority
remain unchanged.

## Controller reading fixture follows deliberate input

The Versus reading test attempted a native Help click inside the controller-join
Confirm echo window, then focused a hidden reader in the modeled DOM. That click
was correctly suppressed by the existing guard. The fixture now completes 151
neutral frames at 120 Hz (1258.3 ms, beyond the existing 1250 ms window), checks
that both ready runs remain identical, and requires a visible Help action and
opened panel before focusing the reader. Existing reading, modality, scroll,
Pause and return-focus assertions remain. This changes no runtime input rule.

**Integration note:** the cumulative publisher has moved Versus Help under
Settings → Extras. Preserve that current visible route and its Back owner when
applying these neutral-boundary and visibility assertions. Do not replace newer
navigation with this older donor's direct Help path. The publisher's separate
mirrored-keyup correction in `couch-shell.test.mjs` is not part of this commit.

## Evidence

Node 22.22.2; all listed files ran completely:

```sh
node --test game/test/enemy-guide.test.mjs game/test/enemy-guide-panel.test.mjs game/test/enemy-guide-host.test.mjs game/test/encounter-guide.test.mjs game/test/studio-preview-readiness.test.mjs game/test/boot.test.mjs game/test/boot-host.test.mjs game/test/practice-render-failure-host.test.mjs
node --test game/test/couch-reading.test.mjs
```

- Guide/recovery cohort: **117/117**, zero failures, skips or cancellations.
- Separate complete Couch reading file: **16/16**, zero failures, skips or cancellations.
- Scoped ESLint, Prettier, syntax and whitespace checks pass. The one new message
  per EN/UK locale preserves all existing entries and matches the generated
  catalog bytes. The readiness helper already belongs to the shipped game tree.
- Independent source review verified final source/log hashes and the foreground,
  stale-child, cleanup and held-input paths. No blocker remains in this scope.

The host regression runs the actual classic boot source in a separate modeled
child realm with unavailable renderer dependencies; it observes the resulting
failed boot state. It also covers a slow child, post-ready ownership, temporary
handoff restoration, EN/UK status, exact paused checkpoints and no profile writes.

`guide-parent-red.tap.gz` preserves the original failed Return-focus assertion.
`visible-blur-red.tap.gz` records the independent follow-up failure before its fix.
`intermediate-guide-106.tap.gz` is the earlier passing source state; it is preserved,
not combined with or substituted for the final 117-case result. The initial test
campaign fixture error is kept separately and is not a product regression.
`reading-parent-diagnostic-red.tap.gz` uses an ID-only assertion diagnostic to
avoid serializing the modeled DOM; its assertion presentation is changed, so it
is not represented as an unmodified test log. It records Start instead of the
expected reader after the suppressed Help click. Final reading tests use the
ordinary complete file. The manifest records decoded hashes for every archive.

## Remaining acceptance

These checks model DOM, timers, Canvas and gamepad input; they are not native
layout, physical controller/touch or whole-game qualification. The older donor's
separate `couch-shell` failure is not claimed fixed here. Publisher integration
must adapt to its current menu and qualify that exact source. Required build,
provenance, frozen artifact and public-player checks remain with the canonical
publisher. Long suites remain waived rather than passed. A/B/C and C2 retain their
existing boundaries; this batch does not approve artwork or resume production review.
