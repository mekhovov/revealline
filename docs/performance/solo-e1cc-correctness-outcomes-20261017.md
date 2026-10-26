# e1cc native correctness and short timing observations

[Run 39044567174](https://github.com/mekhovov/revealline/actions/runs/39044567174), attempt 1, used tooling `7c7cc2648331870683ac7b76850bbeff859f802e` and the independently admitted e1cc production package. Baseline source remained `8b01991942dc764b8aa4726851699ce1985e53ae`. All eight declared correctness rows passed. This cohort explicitly excludes performance qualification; it contains only one baseline/candidate pair per engine.

## Correctness and ownership

Both engines passed static MP3 worker validation, malformed/truncated input rejection, paused drawing suppression and retained pixels. Their baseline and candidate keyboard workloads completed and passed strict replay reconstruction in the same native engine/version. Four separately retained Node portability checks report mismatches; those are not rewritten as passes. Worker reports retain the expected external soundtrack-catalogue request blocked by the self-only content policy; they do not report a worker-policy violation.

All fourteen command owners closed without forced cleanup, ambiguous ownership, survivors or budget violations. Eleven exit codes were zero. The baseline first-30-second commands and candidate WebKit command retain exit code 2 for their reported numerical/portability outcomes. Correctness success does not mean every command exited zero.

## Short observed windows

Both engines ran on hosted Linux x64 at 1280 × 800, DPR 1 and CPU rate 1. Chromium was 151.0.7922.34; WebKit was 26.5. WebKit's Safari-shaped user agent does not establish Cocoa or iPhone execution.

| Candidate observation                  | Chromium           | Linux WebKit |
| -------------------------------------- | ------------------ | ------------ |
| Lightweight baseline B                 | 16.7 ms            | 16 ms        |
| Retained running work samples          | 1,813              | 1,772        |
| Exact application-work p50 / p95 / p99 | 2.7 / 5.5 / 7.5 ms | 3 / 4 / 7 ms |
| Maximum application work               | 16.5 ms            | 16 ms        |
| Missed opportunities                   | 0.0551%            | 5.4933%      |
| Combined observed-window timing        | Pass               | Fail         |

WebKit fails callback p95/p99, missed opportunities and application keyboard-to-render latency. Its retained 57 ms interval is entirely within running. A second 251 ms prior-running interval spans 47,719–47,970 ms, crossing explicit Pause at 47,757 ms; it is not a wholly active 251 ms stall. No application overload interruption or failure was recorded in either candidate window. Ordinary missed frames still fail the gate despite low synchronous work.

Startup is retained separately, not discarded. Candidate boot intervals reached 1,770.8 ms in Chromium and 4,665 ms in WebKit. WebKit also records ready-phase intervals of 2,425, 1,791 and 1,698 ms, plus preparation intervals of 135 and 116 ms. Those observations remain attribution work; the running-window table does not claim smooth startup or measure their cause.

Baseline application-work p95 was 10.6 ms in Chromium and 10 ms in WebKit, with maxima 411.8 and 229 ms. Baseline prior-running callback gaps reached 7,449.6 and 76,600 ms respectively. Preserve these observations without claiming a statistically qualified improvement from a single pair, or attributing every callback gap to synchronous application work.

## Retained evidence

Artifact `12104684723`, `solo-linux-e1cc-correctness-39044567174-1`, contains 79 members. The 809,576-byte ZIP has SHA-256 `739b1a22c7e21844fe911b8bd2d0fc8d2b136a93ead26ad255437d608a40d29e`. Every CRC, member size/hash and expanded readback was verified. The 16,754-byte inventory has SHA-256 `efecc4317ccaf6ef960807c92e625af2da5c8ae7c340862afa849cc87933992e`.

Independent analysis retains owner fields, all four native replay results, original numerical gates, exact work quantiles and phase-correlated callback tails. Its 48,285 bytes have SHA-256 `9c2ea3919a0b4f41fbb8cd17400f57b3d0273e465992396df8624b2f0a117a79`. Local evidence is under `.cache/solo-followup/e1cc-first-eight-observations/39044567174/`; the original archive remains available. Production/device qualification and the three-run requirement remain open.
