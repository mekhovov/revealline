# Minimum239 readiness: source checkout failure

Run `39054543070` ended in failure before either native WebKit row ran. Tooling
was `92ff7ef800e542617b4fc3efad96bd07ce6cbecb`; the intended runtime remained the
verified `239c574ecddd5bb6d5896e621d9edc53e7f6a313` package, producer
`39049194998`, artifact `12107584924`. This run does not qualify either source.

The sparse tools checkout completed in four seconds and the exact normal 8b
baseline checkout in 46 seconds, materializing 43,388 files. The candidate checkout
started at 17:37:58 UTC and hit its unchanged three-minute step limit at 17:40:58.
Its last command was the exact 239 shallow Git fetch; no subsequent fetch,
materialization or network-error output was retained. The underlying network
cause is unobserved. This is a setup failure, not a native application failure.

| Declared WebKit row                               | Outcome | Readiness, raw timing, strict replay and journal |
| ------------------------------------------------- | ------- | ------------------------------------------------ |
| Warm Resume with compact-menu closure             | Not run | Unobserved                                       |
| Required-original Cancel with trusted Start latch | Not run | Unobserved                                       |

Node setup, dependency/browser installation, wrapper controls and the native
observation step were all skipped. The common runner never started, so there
are no command-owner reports or browser-owner closure results to credit.
All three checkout post steps and the final job step completed successfully.
The run API reports terminal failure, while the retained list and direct job
APIs still report `in_progress` with a null conclusion despite all steps being
completed. That metadata inconsistency is retained explicitly.

Artifact `12108863368` is 369 bytes, SHA-256
`0b68e1f91c12c1e47a82d1bdf718fb8ed46809c9a612eb9e435672d14a142fd2`.
Its single 665-byte member, `solo-linux-setup/retention.json`, marks all six
expected setup files absent because setup did not finish. The ZIP digest,
member CRC and every member hash were independently read back; no expanded
copy or full production archive was downloaded. The 60,181-byte job log has
SHA-256 `102279179755c4297c9af3865d87a11320d99239b8789073ddc2af7692a54738`.

The complete terminal receipt, raw API responses, log and verified ZIP are
under `.cache/solo-followup/minimum239-observations/`. Earlier failed 12-row
readiness evidence and the separately corrected Chromium font reader remain
unchanged. No native rerun has been launched. A source-checkout improvement
must be reviewed and declared separately; native deadlines and acceptance
gates remain unchanged.
