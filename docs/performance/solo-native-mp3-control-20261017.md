# Native MP3 control — declared, not yet executed

This control follows the captured finite-zero import in run 38998342774. The
implementation adds a separate one-shot diagnostic, with no game runtime change
or performance credit. Browser execution is still pending. The application's
finite, positive, at-most-720-second duration and
structural-duration agreement checks remain intact.

## Question and fixed inputs

Does the exact audio produce a later valid native duration or playback progression
when application cleanup is absent, and does the result depend on Blob delivery?
Use one isolated hosted Linux job with the same Playwright 1.62.1 / WebKit 2336
(`26.5`) WPE headless binary. Retain executable/registry, OS and available
GStreamer plugin/package identities; missing inventory tools are an explicit
diagnostic limit, not a reason to install an unreviewed media stack.

Reuse only the verified original bundle and assets; do not transcode or alter
tags, frames, headers inside the files or expected identities:

| Input           |     Bytes | SHA-256                                                            |
| --------------- | --------: | ------------------------------------------------------------------ |
| Original bundle | 3,124,928 | `aa25ae643608cfa9a2dd6aac1a3dcd7ba65d667f998144d0927c194df7c1e99f` |
| Bossa Nova      | 1,196,325 | `0ee835fd279ac5fa15f9346744cbafc2ba800c1c0671b78ca9abe2b4353402f7` |
| Party Sector    | 1,925,141 | `77e1ad0bd0a7c5625a12eaa1c8099408ede6959b2ee2dbf5bace85d09a602ada` |

Four declared controls, serial and without retries: Bossa/Blob, Bossa/HTTP,
Party/Blob and Party/HTTP. Each uses a fresh owned persistent context with the
original music observation's 1280 × 800 / DPR 1 desktop display and CPU factor 1. It
loads a small standalone diagnostic page; no game, imported playlist, save,
simulation, replay or production-build result is claimed. A production-package
download is unnecessary for this browser/codec control.

## Observation

1. Prepare the existing exact bundle through the explicit creator-download path,
   verify its pinned length/hash and every original recording byte/hash.
   The owned loopback server serves only these assets and the diagnostic page,
   with explicit `audio/mpeg`, exact length and validated single byte ranges (prefix, open-ended and suffix forms); malformed,
   multiple and unsatisfiable ranges remain rejected.
   Preserve bounded request/response metadata. Blob mode materializes the same
   verified bytes with MIME `audio/mpeg`; HTTP mode points to those same bytes. Each fresh context first fetches and hashes the full recording
   under `no-store`; HTTP playback then uses the same owned immutable file.
   This is a controlled delivery comparison, not a cold-cache benchmark.
2. Create a native audio element and attach listeners before source assignment.
   Set `preload=auto`, assign the source and call native `load()` exactly once.
   Keep the element and source alive for 5 seconds, even after an early zero,
   NaN or error. This observes the unmodified native element outside the game;
   it does not bypass the production import guard.
3. Use a visible public button to call native `play()` in its original gesture.
   Retain fulfillment/rejection and observe for 10 seconds. Record native playing,
   ended, error, pause, seek and duration/ready-state changes plus bounded
   currentTime samples every 500 ms. Do not seek, change playback rate, replace
   duration, decode whole recordings to PCM or retry after a failure.
4. Separate the first native duration, first finite-positive duration, duration
   at the 5-second boundary, terminal duration, native playback result and largest
   continuous monotonic currentTime advancement. Track seeks, resets and implausible
   jumps; none can count as playback progress. More than 1 second of native progress
   is a control observation only, with no speaker/output-device or full-file claim.
5. Pause, clear the source, load/reset and revoke only the owned Blob URL, then
   close the context/profile. Record cleanup separately from pre-cleanup metadata.

Each arm has a **60-second bound**, including native launch, page/source setup,
the fixed observation windows and cleanup. This corrects the initial proposed
30-second total before any execution: the reused native owner itself permits up
to 30 seconds for launch and 10 seconds for closure. The arm reserves 11 seconds
for native-source cleanup and context closure; insufficient remaining time fails
the arm rather than shortening either observation window. The owned browser
command has a **300-second limit**, with no automatic retry and one active
context. A failed arm remains retained; the next declared arm starts only after
confirmed context/profile closure. Uncertain closure aborts the remainder as
unobserved. The loopback server closes in the finalizer.

Existing process supervision retains 6 GiB RSS and 4 MiB per-command log limits.
Exact original-asset preparation has its own 180-second command bound. Maximum
64 event/sample records per arm, 8 time ranges per state, 32 HTTP request records
per arm and 1 MiB per report JSON. Additional event counts and dropped counts
remain explicit; saturation invalidates completeness. A pending `play()` promise
never extends the observation window. Native zero, error or failure to progress
can be a completely observed diagnostic outcome; none becomes an application pass.
HTTP failures stay distinct from native metadata/playback outcomes.

The evidence directory has a 16 MiB cap (12 MiB working allowance plus 4 MiB final
reservation), including both logs, fixture identity, source identities, process
receipts and final summary. Audio remains only in task-owned scratch, capped at
512 MiB, with at least 1 GiB free disk. The result artifact does not duplicate audio.
Contexts delete only their identity-checked profiles; the remaining exact scratch
is retained on the hosted runner until job teardown. Host package/available
GStreamer version inventory is bounded and labelled host-only; it does not prove
which bundled plugins the actual media pipeline loaded.

The executable entry point is `scripts/solo-native-mp3-control.mjs run <new-output>`.
The new workflow runs only on PR 1544's next synchronization from
`c9e637ad81fadf49caec884155d1bd0c2496c59c`, with no cancellation/retry. It checks out
that event's exact tooling revision, records its identities, installs only pinned
Playwright WebKit and always uploads failures. Its 22-minute job budget covers
2-minute checkout, 1-minute Node setup, 2-minute dependencies/contracts, 5-minute
WebKit installation, 9-minute preparation/control and 1-minute upload limits,
with two further minutes reserved for job initialization and post-job cleanup.
This independent native page uses the existing source preview and public CSP,
not a fabricated production-build identity.

Focused Node tests exercise original native returns/errors, zero before cleanup,
byte/MIME/origin rejection, bounded samples, progress discontinuities, request
saturation, owner cleanup and actual loopback range responses. They are contract
and transport tests, not native browser evidence. All original run results and
qualification gates remain separate.

## Interpretations that the control can support

| Observed result                                                       | Narrow implication and next action                                                                                                                                                                      |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Early 0 becomes a matching finite-positive duration before playback   | A transient native-metadata path is demonstrated. Consider bounded waiting within the existing import timeout, retaining all final validation, only after a controlled application regression proves it |
| Blob remains 0 but HTTP obtains matching duration and native progress | Investigate the Blob delivery/loader path; do not claim an MP3 decoder failure or replace the application's import transport without a reviewed fix                                                     |
| Bossa fails on both transports but Party succeeds                     | Investigate the exact recording's native parser/decoder interaction; original bytes and Chromium playback remain useful controls                                                                        |
| Both recordings fail on both transports                               | Native backend/dependency state becomes the priority; obtain narrowly bounded GStreamer duration/error diagnostics before changing the application                                                      |
| All raw controls pass without transient 0                             | Investigate application context, source lifetime and load ordering; the original failed import remains valid evidence                                                                                   |
| Playback advances while native duration stays 0                       | Native content progression exists, but the application's positive-duration/structural agreement requirement remains unsatisfied; structural duration alone cannot authorize import                      |

The control cannot qualify Safari on iPhone or Chrome on Steam Deck. It cannot
repair or promote the previous failed music recipe, historical first-eight,
raw timing gates or sustained observations. A production change must have its
own causal regression, unchanged validation contracts and actual-source native
confirmation.
