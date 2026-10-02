# Hunt presentation and voice follow-up

This continuation closes concrete presentation and recording lifecycle gaps after merging main `e48adf318`. It does not change Hunt rules, scoring, population, collision order, or replay inputs. Desktop observations are evidence for the bounded workloads described below; they are not human play, listening, or low-end device approval.

## Changes

- Destruction now obtains a page-owned lease from the immutable presentation catalog's budget. Two gameplay painters receive equal quotas of 64 particles and two envelopes each. Settings and Studio previews yield before gameplay takes a slot; a third painter cannot exceed the page cap. The renderer also caps settled clusters at 24 per board, independently of supplied presentation records. Brief clean hit effects remain separate.
- Ordinary pause retains burst ages and their existing bounded lease, producing a frozen image. Reset, invalid/concealed state, reduced effects, hidden/pagehide, or an abandoned frame interval clear the dynamic owner. The 250 ms stale-frame boundary seeds existing marks as already seen, so a later host does not replay old bursts. Switching off blood removes an existing bloody burst before any new neutral recipe. Preview cancellation increments a revision so an interrupted RAF callback cannot schedule itself again.
- A page-owned spoken channel covers character speech, radio, and Studio auditions. An incoming character line ends an existing spoken owner; critical warnings interrupt it even when the warning recording is unavailable. Mute/zero master volume, pause, disable, disposal, failed source start, and replacement release speech ownership. Caption expiry is independent of interrupted audio. A portrait's short animation is cancelled on replacement, reduced-effects change, and disposal. Studio auditions stop on blur, including focus moving into its gameplay iframe; Studio also suspends auditions when launching that preview.
- Character voice loading is bounded to two outstanding resolve/inspect/decode requests. A cache retains at most 24 buffers and 12 MiB of PCM, evicting least recently used buffers. Each expected decode is admitted below 6 MiB before decoding. Input is capped at 2 MiB, mono/stereo and 15 seconds. The conservative container reader accepts PCM WAV and AAC-LC M4A only; it examines WAV format/data sizes or M4A audio descriptors, unedited timing and packet counts before browser demux/decode. Fragmented M4A is excluded from this subset because fragment sample counts are outside the classic timing table. Unknown containers and unsupported formats remain untouched and use captions until converted. Studio's file picker and EN/UK help state the admitted formats.
- Native decoder bookkeeping is browser-owned; the 12 MiB cache limit is not a total browser-memory claim. A started `decodeAudioData` operation is not cancellable by the web platform. Cancellation invalidates its result and keeps its slot occupied until it settles, avoiding a burst of replacement decodes. Metadata/fetch timeouts, generation checks, bounded reads, and explicit disposal prevent late speech or retained stale buffers.
- Recording storage retries failed/blocked database opens, closes old connections on version changes, retains immutable original metadata and byte hashes, reads portable records within the 32 MiB bundle limit, and validates every imported recording before an atomic write. Stop/pagehide aborts the actual pending write transaction as well as fetch/inspection. Replacing an identical recording retains its existing provenance; conflicting imported metadata is rejected. A disposable database and disabled notification channel are injectable for review without writing the production library.

## Recorded desktop observations

The [manual workbench](evidence/humanoid-hunt-presentation-workbench.html) starts nothing automatically. The reviewer separately activated destruction, reduced effects, silent pilot inspection, and disposable persistence. It never writes production preferences or recording databases. The saved [browser observation](evidence/humanoid-hunt-presentation-observation.json) identifies Chrome 154, viewport 1280×720, DPR 2. Native resource inspection ran on an Apple M4 Pro, macOS 26.7.1.

The synthetic canvas is 960×320 pixels: two 30×20-cell boards, with the real renderer's 16-pixel cell pitch. Each board holds 24 settled marks. The workload introduces simultaneous mixed runner/guard contact and enclosure removals, repeatedly exercises a competing preview, and measures 180 frames. The `unit: 1` argument controls fragment artwork detail; it does not reduce the cell pitch. Final board guides are drawn after the measured loop.

| Observation                                 | Recorded value                                                       |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Maximum dynamic particles/envelopes         | 128 / 4 per page; 64 / 2 per board                                   |
| Preview preemptions                         | 1; no third owner admitted beside gameplay                           |
| Graphic draw CPU p50 / p95 / maximum        | 0.5 / 1.0 / 2.3 ms                                                   |
| Graphic RAF interval p50 / p95 / maximum    | 8.3 / 9.9 / 10.8 ms                                                  |
| Reduced-effects dynamic particles/envelopes | 0 / 0; retained dynamic owners 0                                     |
| Reduced draw CPU p50 / p95 / maximum        | 0.4 / 0.7 / 0.9 ms                                                   |
| Ordinary pause                              | Newest burst age stayed 0.0908 seconds on both boards                |
| Reset                                       | 0 owners, particles and envelopes                                    |
| Bundled recordings decoded                  | All 16, mono, resampled to 48 kHz                                    |
| Maximum simultaneous voice loads            | 2                                                                    |
| Retained pilot PCM                          | 6,440,820 bytes for both locales together                            |
| Speech replacement                          | Previous source ended, exactly one spoken owner remained             |
| Warning and pause                           | Dialogue ended; spoken owner count returned to 0                     |
| Simulated missing recording                 | No buffer admitted, no pending load retained                         |
| Voice disposal                              | 0 buffers / 0 PCM bytes / 0 pending requests; audio context released |

After conservative container admission was added, the reviewer repeated only the two voice actions. The [post-admission observation](evidence/humanoid-hunt-voice-admission-observation.json) again records 16 successful clip loads, 6,440,820 retained PCM bytes, matching replacement/restoration/import hashes, deleted temporary storage, and no browser errors reported by the reviewer.

The isolated recording action used a PCM copy of the original generated Guide line, preserving the exact transcript. Its replacement hash remained selected after closing and reopening IndexedDB; restoring selected the original bundled hash. Export/import restored the replacement with one retained revision, and the temporary database was deleted. This demonstrates storage behavior with a generated fixture, not a human recording audition.

The [native resource inventory](evidence/humanoid-hunt-voice-resources-20261002.json) records all 16 file hashes, byte sizes, exact EN/UK transcript correspondence, provenance and `afinfo` metadata. The files total 343,420 bytes, contain mono AAC at 22,050 Hz, and last 1.379637–2.792608 seconds. The browser's larger decoded size is expected because Web Audio resamples to the context's 48 kHz rate. The pilot remains labelled `pilot-review-required`; UK roles share Lesya with different pacing.

## Qualification still required

The bounded desktop workload does not establish full-game frame timing, GPU completion, slow-device behavior, long-session memory trends, controller comfort, or legibility during real warnings and combat. Native decoder overhead and browser-specific AAC handling still need constrained-device observation. The 16 recordings need English and Ukrainian human listening for pronunciation, delivery, level balance, and subtitle alignment. No listening approval is inferred from silent decode, metadata, hashes, or a generated-recording storage roundtrip. The expanded unrecorded lines continue to use captions.

Source syntax and targeted ESLint checks were run for these edits. Automated suites remain **WAIVED_SKIPPED_NOT_PASSED** under `publishing/test-policy.json`; no suite or test policy was changed. Root owns the final repository build and artifact validation. The workbench reports measurements and errors, not an automated suite verdict.
