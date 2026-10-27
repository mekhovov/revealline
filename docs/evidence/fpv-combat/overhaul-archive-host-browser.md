# Combat archive host browser checks

2026-10-20. Isolated Playwright Chrome 155.0.8059.85 context against the local
application at `127.0.0.1:8768`. The user's browser and radio tab were not used.
The served archive modules matched the workspace SHA-256 values recorded in
each report. The browser harness did not patch production source, the
simulation clock, or accepted tick sequences.

## Results

| Check | Result |
| --- | --- |
| Actual IndexedDB minute capture | Passed: 3,000 accepted ticks in one durable segment; UI showed “Saved through 60 s · recording.” |
| Export current recording | Passed: complete 3,056-tick package, including the current partial minute. Durable archive remained open. |
| Continue flying after export | Passed: same run advanced to 3,163 ticks. |
| Close and saved recording list | Passed: archive became `ended` at 3,163 ticks and was selectable in Settings → Gameplay → Combat recordings. |
| Watch selected recording | Passed: all 3,163 ticks verified through the production playback path. Closing playback returned to the lobby. |
| Watch downloaded file | Passed: the bounded follow-up verified all 3,056 accepted ticks from the existing minute export and closed playback cleanly. |
| Continue downloaded archive | Passed in the final follow-up: original run, tick 3,056, position and self-level mode were restored while the current launch was acro; flight advanced to tick 3,111. |
| Continue retains full archive history | Passed: the resumed store retained tick 0–3,000; the new complete export preserved the original sealed minute and all 56 original partial-minute commands exactly, then appended new play. Close saved an ended row at tick 3,111. |
| Settings handoff | Passed after the fix: selected Watch, file Watch, and Continue closed Settings before handing control to the flight. |

The full-minute run had no page errors. Its only console resource error was the
local server's missing `favicon.ico`. It was interrupted by `ENOSPC` while
writing the approximately 66 KB evidence report, and the browser closed in the
script's cleanup. This original run is explicitly recorded as incomplete. A
later imported-file follow-up completed playback with component updates and
background networking disabled and 1 MiB disk/media caches. Continue was held
behind an explicit staging-confirmation gate, which expired after three
minutes; that follow-up closed its browser without attempting Continue.
A subsequent Continue-only run, after the runtime projection was confirmed
and the actor profile finished, passed and closed its browser. Together these
bounded runs complete the native archive host checks listed above.

The initial browser check found that Watch left Settings open and playback
stalled at tick zero. The host fix closes Settings after file/map validation
before Watch or Continue launches. The passing short cycle covers the fix.

## Evidence

- [Final frame-path Fire, pause, archive Watch and Continue regression](overhaul-frame-path-browser.md) ([JSON](overhaul-frame-path-browser.json))
- [Repeatable browser script](overhaul-archive-host-browser.cjs)
- [Passing short cycle](overhaul-archive-host-browser-short.json)
- [Short-cycle screenshot](overhaul-archive-host-browser-short.png)
- [Short-cycle downloaded package](overhaul-archive-host-browser-short-current.json.gz)
- [Full-minute run, interrupted by host disk space](overhaul-archive-host-browser.json)
- [Full-minute downloaded package](overhaul-archive-host-browser-current.json)
- [Passing full-minute file playback; Continue staging wait expired](overhaul-archive-host-browser-followup.json)
- [Passing full-minute Continue and resumed-history export](overhaul-archive-host-browser-continue.json)
- [Continued archive screenshot](overhaul-archive-host-browser-continue.png)
- [Continued full-history package](overhaul-archive-host-browser-continue-continued.json.gz)
- [Original modal failure report](overhaul-archive-host-before-modal-fix.json)
- [Original modal failure screenshot](overhaul-archive-host-before-modal-fix.png)
- [Original actual-minute export](overhaul-archive-host-minute-before-fix.json.gz)

Run the default script from the repository root for a full minute and two real
playbacks. Set `ACCEPTED_TICKS=250` and a distinct `REPORT_STEM` for the short
cycle. It launches its own temporary browser context and closes it in cleanup.

For an existing minute package, set `FOLLOWUP_PACKAGE` to its path; `.gz`
packages are also supported. Set `FOLLOWUP_CONTINUE_ONLY=1` to skip replay and
check only Continue, resumed archival, export and Close. `CONTINUE_GATE` can
name a readiness file; when supplied, the script waits up to three minutes,
reloads the page after confirmation, and compares served/workspace module
hashes before continuing.

These are native `stadium-01` hunting checks with twelve enemies, assisted
invulnerability and scripted keyboard hover. They do not qualify regional
launches in a browser, quota behavior, twelve-minute history rollover, physical
radio, human usability, or CPU/GPU performance. No isolated browser from these
checks remains running.
