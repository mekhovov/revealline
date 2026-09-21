# Home Signal: adapted-start routes and visible difficulty

2026-09-21. Follow-up to the [field-finale study](journey-apex-field-finale.md),
not a new map, runtime edition or release. Finale balance and human acceptance
remain open.

## What the delayed failures meant

The earlier six seed-2 delayed recordings all lost a life. Those exact recordings
still fail and remain in the original regression fixture. Repeating a timed log
after a different launch is not the same as choosing a route for the resulting
enemy positions. This follow-up tests that distinction without weakening actors,
capture rules, coverage, objectives, warning windows or collision.

The offline probe's `--no-wait` option limits newly proposed search waits to zero.
It does not change the engine. A declared initial delay and any immutable resumed
prefix remain in the public input log; its `searchWaitTicks` field is search
provenance, not a claim that a resumed recording contains no waiting. CLI tests
verify both behaviours. The default search choices are unchanged.

Six independently replayed adapted logs cover every preset/steering combination
on seed 2. Each waits only for its declared initial delay, then takes the same
short Up return and proceeds with **no additional neutral-input waits**. A separate
per-tick position check also finds no stationary ticks after the initial delay;
the log is not concealing waits against a wall. All six
clear without a life loss or collected bonus, match their saved checkpoints and
finish equal paired-board Versus races. They use unchanged `home-field-2`
simulation identities. This is omniscient feasibility evidence, not a human test
or proof of robustness at every timing.

| Preset / steering        | Initial delay | Clear time including delay | After last objective | Far-wing mastery |
| ------------------------ | ------------: | -------------------------: | -------------------: | ---------------- |
| Gentle / immediate       |         0.50s |                     40.45s |                13.0s | No               |
| Gentle / Grid + Buffer   |         0.50s |                     36.55s |                 8.7s | No               |
| Standard / immediate     |         0.25s |                     44.30s |                11.2s | No               |
| Standard / Grid + Buffer |         0.25s |                     49.70s |                20.2s | No               |
| Expert / immediate       |         1.00s |                     58.85s |                27.8s | Yes              |
| Expert / Grid + Buffer   |         1.00s |                     59.55s |                28.3s | Yes              |

Both Standard routes take the southern objective first, contrasting with the
northern-first base recordings. They eventually use the opened dock; recorded
cell entry/exit alone is not a complete crossing or necessity proof. Both Expert
routes meet the exact connected western/far-eastern platform mastery condition.
Gentle immediate never activates **or warns** the rover, and Gentle Grid only
warns it on victory. These counterexamples remain recorded: active-roamer
pressure is not demonstrated in those clears. Objective tails remain substantial
on Expert, and the earlier 28.75-second Standard shortcut remains legal.

There are now fourteen positive field-finale route samples, not fourteen new
missions or universally robust scripts. The original six failed delayed probes
are not relabelled successes. This closes the narrow question of whether each
preset/control has an observed adapted route without added waiting; it does not
close general pacing, mastered routes on all presets, human difficulty or P12.

## Studio: show what difficulty actually changes

The difficulty selector previously listed only lives, despite the selected
catalogue changing enemy speed and attack rests. It now derives its option labels
from the **applied** catalogue: v1 shows speed factors 0.85/1/1.1; pressure-v2
shows 1/1.4/1.75. Team labels explicitly say shared lives. Multipliers apply to
each moving actor's authored speed tier, not player speed or an invented absolute speed.
The selected rule text continues to explain rests, countdowns and unchanged
handling/warning lengths. `aria-describedby` links the selector to those details.

Label refresh preserves the selected preset and disabled state. It neither edits
the project nor creates history, changes a running game, changes a catalogue,
publishes a draft or silently applies inspected JSON. Valid empty projects clear
mission-owned facts as before. Unknown catalogues fail before partially changing
labels. Unit checks cover both catalogue editions, Solo/Team labels, switching
back to historical values, disabled-state preservation and applied-source wiring.

Native local Studio checks on port 8844:

1. The existing field-finale draft shows pressure-v2 factors; selecting Expert
   retains that value and matches the selected rule description.
2. Inspecting Horizon source leaves the pressure labels unchanged. Only explicit
   Apply changes them to v1 factors, with Expert still selected.
3. Explicit Team timed-study Apply shows shared lives and v2 factors. Returning
   to Solo removes the shared-life label and selecting Standard shows ×1.4.
4. Reapplying an already saved project ID raises the existing truthful conflict
   warning. A browser reload did not resolve it in this observation. Inspect
   saved → Apply reads checkpoint 1 and restores `Saved locally · checkpoint 1`
   without overwriting its history. No gameplay or awards were started.

These checks qualify the option text and applied-source boundary, not a
screen-reader, touch, controller, small-screen or whole-Studio usability pass.

## Verification and review

The combined 176-test cohort passes on Node 20.19.5 and Node 22.22.2. It includes
eight adapted-route checks, seven Studio-label checks and two new probe-contract
checks, alongside the existing capture, replay, compiler, Studio and route tests.
An independent review found no blockers, replayed all six adapted routes and
separately checked their per-tick movement. Its wording recommendation—identify
the speed multiplier as applying to moving actors—was incorporated. These are
technical checks, not human balance approval.

## Remaining work

Keep the existing finale's short-route, quota-tail, frontier usefulness and
roamer-bypass concerns open. More varied starts and actual human route adaptation
remain needed; successful offline search is not a substitute for readability,
voluntary retry or fun. The catalogue multipliers remain balance hypotheses.
No source enrollment, PR/version promotion or Pages deployment is claimed by this
follow-up. Release ownership stays coordinated with the existing release task.
