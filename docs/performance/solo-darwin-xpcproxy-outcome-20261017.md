# Darwin prerequisite: retained launcher ambiguity

The [34d95 execution](https://github.com/mekhovov/revealline/actions/runs/39057302520) remains **failed**. Its non-browser prerequisite retained an unattributed root `/usr/libexec/xpcproxy` process. The dependent Cocoa job was skipped; no browser or media observation followed.

The declared leader completed with exit code zero, measured peak owned RSS of 35,930,112 bytes, no resource/deadline violation, no forced cleanup and no surviving owned process. Nevertheless, ownership assessment failed `confirmed-closure` and `clean-native-owner`: the inventory also observed process 3615, parent PID and parent unique ID `1`, process group `1`, private identity `00000000000000003615`, exec version `7532`, and effective/real UID zero. The kernel executable path was complete; resource and owner-tag inspection were unavailable. The full first ambiguous row was retained. Both subsequent process-tree and deadline-negative cases were withheld.

The two separately identified root `/bin/ps` witnesses remain classifications only. Neither those witnesses nor the leader's clean exit resolves the launcher's identity. In particular, `xpcproxy` is not added to the non-browser allowlist: launch services can start WebKit processes, so an executable name without service identity and an observed exec successor cannot establish that a process is unrelated. [WebKit's launch-service example](https://bugs.webkit.org/show_bug.cgi?id=256278) motivates retaining this uncertainty, not inferring a browser leak from it.

| Retained item    | Identity                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Tooling source   | `34d95cb9fe471ca56c243f05c4330826ba822fb9`                                                              |
| Preflight job    | `117467788107`, failed                                                                                  |
| Cocoa job        | `117468216757`, skipped                                                                                 |
| Artifact         | `12109703912`, 10,252 bytes, SHA-256 `656f0276e2472995ad5874ce8e3b26189fd2c491e76aa77b9080aaf894f752dc` |
| Report           | 7,713 bytes, SHA-256 `efe0b504e7acad8fa7415e96d8f88ad7daff372b11839ceec014e9dd3f16dba6`                 |
| Inventory helper | 13,896 bytes, SHA-256 `489e05c3984c34f77e770ceac17e5b05c08b0b2a41266bbae32e5e627b0c1d19`                |

All nine archive members (49,190 expanded bytes) were read and checked against their retained identities. A separate invocation of the unchanged `assessDarwinOwnerCase` reproduced the original failed assessment; all four relevant local source hashes match the report. Receipts are retained under `.cache/solo-followup/darwin-34d95-outcomes/preflight/`. Only the small evidence archive was downloaded; no local native process experiment or full production download was performed.

The next useful prerequisite must observe the missing service/exec identity with bounded read-only collection before browser admission. Repeating the same run or progressively exempting launchers would not address this missing evidence. The current result establishes neither Cocoa compatibility nor a game performance failure.
