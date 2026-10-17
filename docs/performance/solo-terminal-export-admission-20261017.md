# Terminal Journey identity and optional export admission

The failed [239 CPU observation](solo-first-victory-cpu-239-outcome-20261017.md) sampled terminal campaign revalidation and replay checkpoint work. This correction addresses those source paths; it does not turn the failed observation into a pass or establish a native speedup.

The existing `candidateHost.owns(activeEntry)` branch now uses that exact entry's `executionKey`. The execution owner computed the key while accepting the campaign and froze the campaign transitively. Controls use the actual opening host at all three difficulties, prove its membership/key/frozen data, and retain rejection of forged entries and mutable invalid campaign inputs. Public `campaignKey` validation is unchanged.

Optional Journey capture now owns the recorder fields, summary and selected authoritative checkpoint sections before yielding. The existing main-work preparation owner admits canonical checkpoint hashing and final replay copying. It rejects aborted, skipped, duplicate or retired work. Caller mutations cannot change the saved snapshot. Required synchronous public/save exports remain unchanged. The accepted-clear checks, verifier, binding, saving lease and durable transaction remain authoritative. A changed clear or disposed Journey owner between queued export and capture cannot publish evidence.

Journey's existing JSON inspector permits at most 4,096 items in any array. That same limit is now shared with the optional caller, which rejects an overflowing segment array before exporting data that can never be retained. This does not reduce the public replay limit. The actual app expression is tested at 4,096 and 4,097 segments: the boundary retains exact bytes, while the overflow still exports publicly but fails Journey admission without invoking optional export.

## Source and modeled evidence

The actual public first-return terminal/Retry host control preserves the run/checkpoint. Under exact preceding 92ff app/replay source, the winning frame performs one campaign rescan and 16 checkpoint encodings; the corrected frame performs zero of each. Fifteen replay/checkpoint versions retain exact synchronous-versus-admitted bytes after input mutation. This is modeled source evidence, not native timing.

Immediate copying remains real work. Local Node readback retains these byte sizes:

| Recording                               |               Owned record bytes |       Owned projection bytes | Optional caller             |
| --------------------------------------- | -------------------------------: | ---------------------------: | --------------------------- |
| Opening, 645 ticks / 3 segments         |                            3,979 |                       36,196 | Full validation retained    |
| 30 minutes / 1 compressed segment       |                            3,389 |                        6,294 | Full validation retained    |
| 4,096 alternating segments              |                          521,399 |                        6,293 | Full validation retained    |
| 5 minutes / 36,000 alternating segments | 4,557,257 before early admission | 6,295 before early admission | Rejected before either copy |

The initial local 36,000-segment export prefix took 69–74 ms; the actual early-reject caller performed no encoding or hashing and took about 0.064 ms in a later concurrent Node run. Supported 4,096-segment input still took about 17.5 ms before admission in that run. These local, uncalibrated timings are sensitive to other test processes and are not performance gates. No claim is made that all dense replay cost is removed. The opening measurement reconstructs the retained native commands under Node, whose separate enemy checkpoint mismatch remains recorded.

Demo's opt-in automatic and manual collection still use their original synchronous export and existing generation owner. Moving that export ahead of `keep` would require preserving clear/disable/dispose authority before the new wait; that path is deliberately unchanged. Immediate bounded copies, required public/save exports and other terminal bookkeeping remain residual work.

Receipts are under `.cache/solo-followup/terminal-export-admission/`: `before-host-v2.tap`, `after-host-v2.tap`, `admission-limit-v2.tap`, `snapshot-cost.json`, `snapshot-cost-with-limit.json`, and the retained initial harness failures. Final stable-source checks pass 142/142 across 11 complete files, including the public terminal/Retry and durable Journey result hosts; scoped lint, formatting and whitespace checks pass. The earlier 12-file group retains 154 passes and three nonterminal candidate-host failures (preparation and saved-theme expectations). Original-source controls reproduce one exact saved-theme failure; two stop earlier in the modeled menu route and are not claimed as matching failure causes. Both complete opening/authored campaign continuation paths passed. Final source hashes and all receipts are recorded in `final-receipt.json`. No browser, package download, native redispatch or push was performed for this correction.
