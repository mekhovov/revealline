# Offline restart qualification: source `8c1af9d1`

Offline qualification **failed before gameplay** on the verified `8c1af9d1` package in Chrome 155.0.8059.85. After public Starter preparation reported success, the browser closed completely and the local server stopped. A fresh browser process using the same persistent profile could not navigate to the manifest's `/app/` launch URL. The observed error was `net::ERR_FAILED`.

This result is relevant to the reported installed-PWA use, but it does not reproduce the iPhone's warmth or prove a regression introduced by this branch. The desktop profile lives on the explicitly recorded RAM filesystem; it is not an iPhone Home Screen installation. No offline capture, continued flight or strict replay was reached.

## Observed sequence

The test used the original package HTML, manifests and generated deployment security policy. The existing production-preview server validated `_headers` and served the unchanged `PUBLIC_SECURITY_HEADERS`; access used the separately declared remembered-verifier fixture, without changing HTML or evaluating an invented password. Authentication itself is not qualified.

The public download flow verified 1,701 core files (72,021,985 bytes), 189 Starter content files (71,713,611 bytes), and the launcher. Its activation status said the selected edition would open from the app icon on the next launch. The launcher preparation source waits for activation and requests hash verification of its files. The test then observed the root game worker controlling the game, closed the entire browser, stopped its owned server and confirmed an uncached request could not reach that server.

The offline `/app/` navigation failed. The initial failed profile was archived with complete member readback before subsequent diagnostics. Those diagnostics reopened that same profile without installing, clearing caches or starting a server:

- Both offline emulation enabled and disabled produced the same failed launch with the server still stopped.
- The `/app/` worker registration remained activated with the expected script and scope. Its exception occurred at the existing cache-match-or-network-fallback expression.
- Worker-target inspection confirmed the expected configuration, scope and cache name. The named cache had zero request keys, so its launcher document did not match. No stored response existed to test a `Vary` explanation.
- Origin usage was 146,926,538 bytes against a reported quota of 2,576,980,377 bytes. These origin totals do not prove launcher-specific persistence or exclude every form of storage pressure.

Cache-name presence after the failed navigation is not proof that the cache survived restart: the production fetch handler calls `caches.open()` and can recreate an absent cache. The evidence establishes that the worker found no launcher entries after restart. It does not establish when or why those entries disappeared, or whether the cause is browser storage, test filesystem, premature shutdown or application behavior.

The launcher worker template and installed-app owner are byte-identical to original main `b1174522`. This is source comparison only; no baseline offline run has yet been executed. A bounded baseline comparison remains follow-up work.

## Evidence and disposition

The original offline report has SHA-256 `9d4d2b92973fad69b4602ea322d449d97aad9ebc32e61282c2dfa096443ea213`. The two diagnostic reports have SHA-256 `f90ced979bc2b0eda2d70eb46f61e51275bdcd1c25815cbd18fccc6feb625b03` and `30ed3ff8b676eca93161b800d95144f3d60e57c1aa0f385cfb46d70d3489a8b5`. The interpretation receipt is `2b1509e437e1f052f0167cc4fc82ff4c8d983a0e6a04f24cea0ce2325e831085`. All attempts closed their owned browser/server processes cleanly.

An earlier attempt stopped before opening a browser because its harness used the generic preview server while asserting the deployment policy. That failed attempt remains retained. The versioned harness correction selected the existing production server and preserved the strict deployment-policy check; it did not alter the game or relax CSP.

Offline readiness remains failed and unresolved. Independent online performance observations may proceed after these diagnostic processes and evidence copies close. Ordinary timing contexts block service workers. The separately scoped Demo observation uses a fresh owned Chrome profile without installing an offline package or reusing this failed profile. Neither observation qualifies offline behavior. This sequencing decision changes no numerical gate, does not admit a failed offline run as a pass, and cannot establish complete plan or physical-device qualification.

Complete preservation closed at 18:38 UTC on 16 October. All four attempts, executed helpers, plans and the post-diagnostic profile were archived with independent readback of all 4,023 members (243,027,438 logical bytes). Preservation receipt SHA-256 is `5b5bee74841da70c1f666c43fb6e23eac78c0f71c453af111022c19d3c992d74`; archive SHA-256 is `f86d4450223217e1dcdd97b2c9e11aaaf98cc071e754ac0fc8082d86f2a71e1b`. Only after that proof was the exact owned RAM profile retired, with device/inode and content identity rechecked. Retirement receipt SHA-256 is `eabd0971abd0f964ca173f9804e4e359c7eeb59bdf5e221c62aec524b100e476`. The original pre-diagnostic archive remains unchanged.

The next causal check is one declared baseline attempt and one candidate attempt, each with a fresh persistent profile. It will inspect the existing launcher cache immediately after public readiness and again after full browser shutdown and server-stopped restart. It adds no repair, installation retry or arbitrary flush delay. This instrumented comparison can narrow when entries disappear, but cannot relabel the original failed qualification or establish offline gameplay. It remains separate from the online timing lane.
