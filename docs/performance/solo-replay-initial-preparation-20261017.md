# Optional replay initialization follows preparation admission

The earlier chunk-admission change still called `prepareReplay()` before the first yield. That function constructs the complete initial simulation, so an optional verifier could start this work during a later active flight even though all subsequent simulation chunks waited.

The replay module now separates its private source snapshot from preparation. It still copies bounded, descriptor-checked input before yielding, including the existing independent limits for a JSON document and its string fields. When an optional preparation owner is supplied, structural validation and initial simulation construction use the same exactly-once synchronous admission closure as the later chunks. Abort, duplicate invocation, delayed invocation and swallowed-error protections remain in that owner boundary. The ordinary required verifier retains its previous preparation behavior and result contract. Replay formats and simulation rules are unchanged.

This does not eliminate all pre-yield work: owning caller input still requires a bounded copy. Journey/Demo/mastery callers also have their own inspections, identities and storage work; those remain separately audited. No old native interruption is attributed to this change without a profile.

The same update computes the accepted Journey gameplay identity once for the completion and its optional picture receipt. Both previously traversed identical authoritative data in the same synchronous terminal handler. It changes neither receipt identity nor timing rules.

## Verification

The original source at `239c574ecddd5bb6d5896e621d9edc53e7f6a313` passes eight and fails two controls in the expanded complete admission file. The failures demonstrate that a core-constructor-only invalid seed is processed during play and that it wins over cancellation before the optional owner can admit work. With the change, initialization stays queued, the original seed validation still rejects after Pause, and cancellation removes the queued work without constructing it.

Additional controls preserve a call-time input snapshot after immediate caller mutation, identical reconstructed state, and a valid JSON replay document larger than the individual-string limit. Four complete core files pass 52/52; eleven complete consumer and public-host files pass 76/76. These 15 distinct files total 128 controls, with no skips or failures. The public Next/Retry cases retain the original pending reward while the next flight advances 120 ticks, then finish on Pause. Source hashes were unchanged throughout that consumer run. Independent source review found no actionable issue.

| Retained local evidence                        |  Bytes | SHA-256                                                            |
| ---------------------------------------------- | -----: | ------------------------------------------------------------------ |
| `replay-initial-admission/before.tap`          |  4,320 | `5f67c5903ae83c0e0eefbacd548bd30857540d68977bae9c6d4bfacebe8d8634` |
| `replay-initial-admission/after-core.tap`      | 12,783 | `97933adb50545dd34b8fcbf0b633f48f187e3e24efec2538290395a01568ff5b` |
| `replay-initial-admission/after-consumers.tap` | 19,828 | `51e4d620ae956f64fa4ddcbb7d59df3fbbc41df926bb7bc78386522ea4fc8018` |
| `replay-initial-admission/review.json`         |  2,656 | `0f9cfd24ab60a5f740e373983705490cf528c77c48d836073699653768597ce4` |

Paths are under `.cache/solo-followup/`. These are source/model correctness observations, not native frame-time measurements. The existing production admission job already includes the expanded complete test file. A later package and source-bound native qualification are still required.
