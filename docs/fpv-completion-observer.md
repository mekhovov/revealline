# Frozen FPV completion observer

`scripts/observe-fpv-completion.mjs` repeats one bounded software observation of
the optional civilian FPV package. It admits original release bytes, mounts those
unchanged modules in a separately recorded observation document, and uses ordinary
automated keyboard controls to complete Self-level drill `flight-01`. It never
imports a proof, sets progress, steps the model or repeats a failed route.

Create a plan beside an already downloaded optional bundle:

```json
{
  "format": "revealline-fpv-completion-plan.v1",
  "caseId": "candidate-first-completion",
  "protocol": "civilian-fpv-airborne-completion.v1",
  "deviceLabel": "Record the actual computer and operating system",
  "quietWindow": "Record known concurrent work; do not claim complete machine isolation",
  "bundle": "./optional-flight",
  "envelopeSha256": "EXACT_SHA256_OF_OPTIONAL_PACKAGES_JSON",
  "sourceRevision": "EXACT_40_CHARACTER_SOURCE_COMMIT",
  "sourceTree": "EXACT_40_CHARACTER_SOURCE_TREE",
  "packageRevision": "EXACT_CIVILIAN_FPV_REVISION_FROM_ENVELOPE",
  "trace": "cpu"
}
```

The placeholders must be replaced with independently selected exact identities.
The bundle path is relative to the plan. `trace` accepts `none`, `timeline` or
`cpu`; these are different instrumentation conditions and must not be pooled as
an equivalent timing sample. The tool uses the existing optional-package
admission and ZIP verifier; a self-consistent bundle is still not release
approval or independent evidence of a GitHub tag.

```sh
node scripts/observe-fpv-completion.mjs plan.json /absolute/path/to/playwright/index.mjs /new/evidence/directory
node --test scripts/test-observe-fpv-completion.mjs
```

Playwright is an external validation dependency. The observer does not install
it, download a browser or add it to the game. It uses the installed Chrome channel
in a fresh headless context at 1440 × 900, DPR 1. Coordinate a quiet measurement
window before starting. A run uses one attempt of at most 45 seconds and a new
output directory; existing evidence is never overwritten.

The adaptive driver reads position and velocity through the app's observation
API and changes throttle using ArrowUp/ArrowDown. These are automated browser
keyboard events, not physical inputs or human pacing. It waits for the ordinary
accepted proof/save callback, then records at least one second with no Notebook,
Retry, screenshot or other locator action. After ending that window and trace,
it opens the Notebook, exports the verified proof, clicks Retry and confirms the
same drill is disarmed with zero commands. It compares exact proof bytes after
Retry and after reloading. Only then does it dispose the app and close its browser,
server and temporary extracted site.

The server uses the existing packaged-preview security headers. Those include
explicit soundtrack origins beyond the public policy; the report records exact
headers. This is not a deployed-origin, installed-PWA or production-cache test.
All admitted runtime members are fetched back and hash-checked before the browser
measurement. Tool authority hashes, observation HTML and wrapper hashes are
recorded separately from the frozen runtime.

## Read the separate outcomes

- `functionalStatus` covers the genuine completion, Retry and unchanged proof
  after Retry/reload. A trace error cannot suppress these checks.
- `timingStatus` is `observed` only with the full passive interval, airborne
  activity, ordinary saved proof, keyboard events and visible/focused frames.
  Raw slow intervals and long-task entries are retained, never filtered away.
- `trace.status` records capture success separately. Capture is bounded to
  40 MiB and 15 seconds of stream reading. Overflow, timeout and stream-close
  failure retain `trace.json.partial` with its exact byte/hash record. A partial
  file is not complete JSON and is never analyzed or represented as passing.
- `traceAnalysis` requires unique named boundaries on a verified renderer thread
  and one nonoverlapping complete task family. It supports Chrome's exact
  `RunTask` and `ThreadControllerImpl::RunTask` names without rewriting the trace.
  Missing coverage or ambiguous boundaries fail analysis. Whole, completion and
  passive windows retain full durations and overlaps of tasks crossing boundaries;
  profiler startup and other long tasks are not silently subtracted.
- `completed` requires the procedure and every owned cleanup to succeed. The CLI
  also exits unsuccessfully for incomplete timing or a requested but unavailable
  trace/analysis. A functional success alongside capture failure remains visible.

Every report has `qualified: false`. Inclusive main-thread task durations do not
prove exclusive reward cost, input-to-photon latency, GPU or decoder ownership,
heap retention, a 5% regression target or performance across all drills. A prior
unexplained frame gap is not resolved just because this run does not reproduce it.
Physical radios, other browsers/devices and human learning remain separate.

`observation.json` and the raw proof backup are local evidence. Publish only a
reviewed compact summary and hashes, not the backup or incidental local paths.
Retain failed attempts alongside successful ones; a changed protocol receives
its own plan and output directory.
