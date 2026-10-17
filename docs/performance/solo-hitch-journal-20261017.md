# Opt-in individual hitch evidence — 17 October 2026

The qualifier now has an explicit `--hitch-journal` option, requiring `--work-probe` and a scenario bounded to forty minutes. This changes measurement tooling only. Existing recipes, deadlines, first-eight assertions, game runtime, default report fields and historical evidence remain unchanged. No workflow is enabled by this change, and failed candidate `c9e637ad8` has no package to qualify.

## Evidence retained and default compatibility

The pre-fix actual browser collector was exercised in an isolated JavaScript environment with 1,000 consecutive 40 ms callbacks. Its histogram counted them, but its individual tail retained **zero**: the tail began at 50 ms and held only 256 records. The work ring also retained only the most recent 5,000 durations. These are demonstrated evidence omissions, not native-browser performance results.

| Local receipt under `.cache/solo-followup/hitch-journal-implementation/` | Bytes | SHA-256                                                            |
| ------------------------------------------------------------------------ | ----: | ------------------------------------------------------------------ |
| `pre-fix-omission.mjs`                                                   |  1482 | `9e9d8d87fdad86ae72e8450be8c9975567e8b92713ec131e9ef9bbf1f1f8d3cc` |
| `pre-fix-omission.log` (expected exit 1)                                 |   595 | `ad13f706209bcaaadd0fb3e0ca54cfb7c77a98fece9042da44878edf36f00e35` |
| `combined-v4.tap`                                                        | 27973 | `0079c413ff74ab8f85c1deec2a24a2f91b5691b348ffad74e5c49143e23e09ac` |

The final six-file pure tooling group passed **126/126**, including 21 journal tests. It covers more than 5,000 work windows, 30–144 Hz and changing cadence, exact fractional timestamps, interruption/phase boundaries, asynchronous native delivery, buffer overflow, lost/replaced documents, corruption/truncation, exclusive files, disk readback, encoded metadata limits, ordered initialization and child frames. The actual collector produces identical pre-existing report fields with the option enabled or disabled. Earlier failed test receipts remain in the same directory. Scoped lint and formatting checks passed.

## Fixed representation and limits

Each append-only record is 24 bytes: Float64 start/end timestamps, a Uint32 kind/phase/foreground word, and a Uint32 sequence. It records every observed callback interval over 33 ms and every observed application-work window of at least 50 ms, including intervals crossing a pause. Sparse phase, visibility and focus boundaries support later attribution. It preserves timestamps without Float32 conversion or rounding and validates frame/work streams separately.

One document owns a numeric buffer of at most **4,176,000 bytes**. Across the entire row, at most **174,000 records**, **64 document descriptors**, **65,536 serialized descriptor bytes** and **40 minutes** are admitted; navigation never renews those allowances. A document releases its binary-buffer references after its single export. The one-time base64 transport and disk readback allocate additional bounded transient memory while paused; this is not a claim that total process memory is 4 MiB.

Snapshots contain fixed-size counters and metadata, never cumulative binary payloads. Export occurs only at existing non-running navigation/final boundaries; it adds no Pause, Resume, unload transport, timer, animation loop, active DOM query or upload. Every binary is written exclusively, synced, then read back with an exact size/SHA check. Metadata reserves room for all failure records and lost-document descriptors, including escaped control characters and multibyte text.

The fixed allowance can still overflow under unusually dense boundary activity. Overflow, unexpected document loss, incomplete work, invalid clocks, native observer failure, known native drops, failed export/readback or exhausted bounds make the journal **incomplete** and the performance verdict **invalid-evidence**. Existing raw scenario/replay/numeric verdicts remain available; no record is silently overwritten to make a run pass.

## Browser coverage and remaining qualification

A feature-detected `longtask` observer retains delivered native entries and drains queued entries before export. Native entries may arrive after later frame/work records: append order is not chronological across kinds. Native phase attribution uses their timestamps with the recorded phase boundaries, not the phase at callback delivery. Unsupported APIs remain `unobserved`; absent drop-count capability remains `null`, not zero. Later or unreported browser delivery is outside the recorded coverage. [Long Tasks specification](https://www.w3.org/TR/longtasks-1/), [Performance Timeline observer processing](https://www.w3.org/TR/performance-timeline/).

Long Animation Frames are not a substitute for this journal: their threshold misses ordinary 33–50 ms gaps, and the browser timeline's LoAF buffer is finite. The implementation does not add a LoAF observer. [MDN LoAF timing and buffering](https://developer.mozilla.org/en-US/docs/Web/API/Performance_API/Long_animation_frame_timing#observing_long_animation_frames).

Playwright also installs initialization scripts in child frames and does not guarantee order between separate calls. The opted-in helpers, journal and dependent probe therefore use one ordered script restricted to the main page; the default installation path stays unchanged. [Playwright `addInitScript`](https://playwright.dev/docs/api/class-page#page-add-init-script).

Future opted-in declarations must freeze this helper and the qualifier in their tool/source closure, include the binary files in retained evidence, and preserve existing owner/evidence caps. Matched native enabled/disabled runs still need to establish the diagnostics-overhead gate. No overhead, GPU/presentation, physical input-to-photon, Steam Deck OLED or iPhone 17 Pro Safari performance claim follows from these tooling tests.

## Declared preparation documents and active-play coverage

A further explicit `--hitch-journal-preparation=first-return-anchored-v1` policy supports the held anchored soak. It requires the original journal/work flags and the exact 4,737-byte anchored fixture (`079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff`), including its id, playground entry and public follow action. It does not enable a workflow or change first-eight/short-preflight flags.

Only the initial admitted `playground/` document and existing `follow-4` into the admitted Solo path are authorized. Node and browser check origin, path, action, document id and role; relocation, replacement, restored old ids and extra navigation fail coverage. Preparation retains rAF/native timing and sparse boundaries but labels application work `unobserved-preparation`. Only this declared document may export without a Solo flight state, and only after its phase is known to be other, with no observed running phase, application callback or work subscription. Missing state elsewhere remains a failure.

The final Solo document requires a normal paused/result/picture boundary, real subscribed work, positive active-frame and active-work counts, positive elapsed active time and valid active timestamps. These are bounded scalars recorded on existing callbacks. Preparation-only, all-paused, zero-duration, unsubscribed, lost or backwards-clock observations cannot make the row complete. Nonfinal Solo documents may be correctly measured nonplaying segments; positive active coverage is required on the final Solo document. The anchored preparation policy admits only one followed Solo document, which is also final. Captured preparation is never credited as gameplay; existing scenario, replay, duration, sample and numeric gates remain necessary.

The original byte/record/time/document limits remain unchanged. Document identity metadata is checked before each allocation, preserving the reserved encoded failure budget even with long paths or escaped text. New tests also exercise valid preparation→Solo binary readback, invalid role/path/action/recipe, unreported preparation work and timestamps outside the document observation. The subsequent six-file pure tooling group passed **134/134**, including **29 journal tests**; its retained receipt is `preparation-combined-v1.tap` in the directory above (29,931 bytes, SHA-256 `1a6e1b5b2143c1fb8a89e3163bdfeaae890928c9927af6060727385d0f31b594`). Scoped lint passed. Native overhead and the new package remain unqualified until their separate hosted checks finish.
