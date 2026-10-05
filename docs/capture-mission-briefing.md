# Capture mission selection and briefing

Selecting a mission from the shared library prepares its exact native attempt and
artwork, then opens a briefing. Selection does not start the clock. Solo, local
Versus and local Team require a fresh **Start** action after that preparation.
This changes the launch boundary, not gameplay, scoring or replay rules.

| Mode   | Prepared state                                                                                  | Explicit activation                                         |
| ------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Solo   | Native mission briefing, Start focused, clock at `0:00`                                         | Start Mission activates the accepted attempt.               |
| Versus | Selected mission name, goal and both players' controls above the native menu; both boards ready | Start activates the prepared paired match.                  |
| Team   | Native READY overlay with the selected mission, objective and Start Together                    | Start Together activates the same prepared cooperative run. |

A restored Team attempt remains paused and offers Resume Together instead of
being reset. Merely viewing a briefing does not mark a Team mission started,
advance candidate progress, arm its durable attempt recorder or update the
last-played arena preference. Those actions belong to actual Start or Resume.

## Deliberate actions retain their meaning

- Mission cards and chapter choices prepare a briefing. Replacing a paused
  attempt still requires the existing replacement decision; Stay preserves it.
- Title Start and Continue remain explicit play authorizations. Resume retains
  the accepted paused attempt rather than selecting or preparing another one.
- Retry, Next and continuous mission continuation keep their existing direct
  activation behavior. They do not add another confirmation after an already
  deliberate action.
- Solo's new `briefingOnly` launch intent is separate from the older
  `prepareOnly` demo path, preserving demo eligibility and preparation rules.

## Attempt and input ownership

Preparation validates the native rules, chosen variant, population, seed and
picture before publishing the new attempt. Versus retains one accepted paired
recipe; Team Start receives the prepared run directly. Later setup edits cannot
silently alter either accepted attempt. Changing an attempt still uses the
host's explicit replacement or restart flow.

Existing cancellation and generation checks remain authoritative throughout
asynchronous artwork preparation. Cancel, Stay, superseding selection, focus
loss or disposed owners cannot activate a stale candidate or retire the retained
attempt's picture lease early. Successful adoption closes the chooser before
showing the native briefing and focusing its primary action.

Preparation clears steering and retires the selecting gesture. Controller
confirmation must return to neutral before a new Start activation. Holding a
direction or confirm through download/preparation cannot begin simulation from
the briefing. The native hosts continue to own keyboard, touch and controller
input, pause and focus handling.

## Verification

Manual browser review confirmed Solo ready at `0:00`, Versus showing the exact
Crossing Post briefing with Start focused, and Team showing Relay Rendezvous
READY at `0:00`, followed by explicit Start and Pause. These observations cover
the normal local selection path; they do not establish every imported package,
restoration or device case.

Relevant regression sources cover Solo candidate/library selection, result
supersession, Versus and Team library hosts, controller selection, and Team
discovery/input. They check that prepared boards remain stationary, held input
cannot authorize Start, bookmarks are deferred, and explicit activation retains
the prepared mission. Automated suites were **not run**, under the repository's
explicit waiver in `publishing/test-policy.json`. Scoped lint, formatting and
diff checks passed for the changed Capture hosts and regression sources. Broader
validation and committed-source build evidence remain part of the release
owner's checks.
