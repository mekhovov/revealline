# D1 bounded transition profiling

## The historical long stalls were not reproduced

A separate, visible and focused v2 browser experiment completed 36 preparations
and six imported loads on unchanged historical source
`e572026ba357f3194bf47e7137a0817cacb1a640`. Its maximum preparation was **77.4 ms**
and maximum imported load **11.2 ms**. This does not explain, fix or invalidate the
15–17 second waits retained in the original
[production qualification](fpv-d1-production-qualification.md). No production
optimization or performance acceptance follows from this narrower run.

The complete v2 receipt contains 248 completed timing spans, 36 observations,
236 RAF-heartbeat intervals, 96 timer intervals, 61 long tasks and 63 long
animation-frame records. Both observer types were supported. No records were
dropped; captured errors, warnings and unexpected context losses are empty.
Continuous visibility/focus observation records one visible/focused start and no
subsequent transitions. Registered geometry/material/texture ownership is zero
after disposal. All 31 source dependency hashes match before and after the run.

The run began at 2026-10-03 20:35:40.114Z and ended at 20:35:51.901Z, lasting
11.787 seconds including setup and verification. The complete trace was transferred
from the read-only DOM receipt field after completion. This is a distinct run
from the v1 summary-only observation below and from the full production matrix.

## Scope and observed costs

Three cycles visit Yard imported, Yard fallback, School Woodland imported
(`beginner-40`), then School Woodland fallback. Each visits low, balanced and high
quality, with one overview camera and three draws of the initial physics snapshot.
That gives 12 distinct arena/path/quality configurations repeated three times.
The prior high quality remains active during later course/scene loads, preserving
that part of the original order. There is no simulation stepping.

All measurements below are milliseconds; quantiles select sorted observation
`floor((n - 1) * p)`. Nested rows overlap and must not be added together.

| Measured boundary                                | Count | Median |   p95 | Maximum |
| ------------------------------------------------ | ----: | -----: | ----: | ------: |
| `setCourse`                                      |    12 |  149.2 | 278.8 |   294.9 |
| PMREM `fromScene`, inside course setup           |    12 |   39.4 |  85.4 |   101.1 |
| `setQuality`                                     |    36 |   51.6 | 168.5 |   195.5 |
| Awaited `prepare`                                |    36 |   49.5 |  77.0 |    77.4 |
| Synchronous Three `compile`, inside preparation  |    36 |    7.0 |  10.0 |    10.8 |
| Total Three `compileAsync`, inside preparation   |    36 |   49.5 |  76.8 |    77.4 |
| `loadScene`                                      |     6 |    6.3 |   7.5 |    11.2 |
| glTF `parseAsync`, inside scene loading          |     6 |    3.8 |   5.0 |     7.8 |
| ImageLoader callback lifetime, overlapping waits |    30 |    1.3 |   3.6 |     3.9 |

The original target, Yard fallback/low preparation, took **52.2 / 38.5 / 40.2 ms**
over the three cycles. Its synchronous compile took 7.4 / 7.0 / 7.1 ms. The
following School Woodland imported loads took **7.5 / 7.2 / 6.3 ms**, including
3.8 / 5.0 / 4.4 ms in glTF parsing. Those are complete measured targets, not a
selected subset of the slower historical run.

The largest course setup was School Woodland imported in cycle one at 294.9 ms.
The largest quality change was School Woodland fallback/high in cycle one at
195.5 ms. The largest environment-probe call was School Woodland fallback in
cycle two at 101.1 ms. The RAF-heartbeat maximum was 330.5 ms and the nominal
50-ms timer's maximum interval was 334.8 ms. All long-task records and their
overlap with measured boundaries remain in the complete receipt and analysis.

These results identify measurable synchronous course setup and quality-change
costs for a future focused investigation. `setCourse` includes resource
replacement, world construction, an environment probe and quality application;
the PMREM measurement is one nested component. Preparation is almost wholly
inside the observed `compileAsync` lifetime in this run: time outside that
lifetime is at most 0.2 ms, including final link checks, microtasks and observer
overhead. None of these observations attributes the missing historical long
waits to a renderer defect, image decoding or general tab scheduling.

The pinned Three compiler traverses hidden objects too. For each target Yard
fallback/low preparation, the helper counted 66 mesh/line/point materials, six
of them found only on hidden objects; Three returned 77 compiled materials.
The helper excludes sprites, so those counts describe different sets. They are
not evidence that any material can safely be omitted. Scope inspection cost at
most 0.4 ms per compilation in this run; other wrapper overhead is not isolated.

## Instrumentation and limits

Only the diagnostic harness installs wrappers around existing Three/loader APIs.
It observes `setCourse`, environment-probe generation, scene generation/loading,
quality changes, synchronous compilation, asynchronous compilation and image
callbacks. It adds no GL status polls, forced GPU synchronization or production
source edits. Original function receivers, arguments, returns and promise objects
are retained; wrapper property descriptors are restored after execution.

The smaller sequence omits three arenas, FPV/chase views and most draws from the
original qualification. It preimports the glTF loader, uses a single warm renderer,
does not serialize the full receipt during measured cycles, and adds bounded
timing/visibility observers. Those differences prevent a controlled performance
comparison with the original matrix. The optional outer-timing-only mode was not
run as a retained v2 comparison, so observer effects remain unquantified.

Image callback lifetimes combine resource access, decoding and scheduling;
overlapping waits are represented by unions rather than added. Long-task overlap
and heartbeat gaps localize observations but do not establish their cause.
All values are browser wall time or synchronous CPU submission, not GPU elapsed
time, hardware FPS, thermal qualification or named-device acceptance. The original
long stalls remain open; a later investigation should vary one transition factor
at a time before proposing a production change.

## Complete bounded evidence and the v1 limitation

The complete v2 receipt is retained losslessly as
[`fpv-d1-transition-profile-v2-receipt.json.gz`](evidence/fpv-d1-transition-profile-v2-receipt.json.gz):
**23,797 compressed bytes**, gzip `mtime=0`; original JSON **297,216 bytes**, SHA-256
`bd663fbd528273925a6bb82b6733a6a61d4b243f1830368c8373a4c2368de625`.
Its compressed SHA-256 is
`518158d7804385eb88eaa3f9c9ba001da47e95e4d707e70409e86c9db152090e`.

The complete 105,705-byte analysis is retained as a 7,247-byte deterministic gzip
archive. Rerunning the retained analyzer against the original receipt reproduces
the analysis byte-for-byte. The
[archive descriptor](evidence/fpv-d1-transition-profile-archive.json) pins raw and
compressed sizes/hashes, both exact harnesses and manifests, the analyzer and
the original browser screenshot. The v2 harness hash is
`3e1b0cc71c2e296765e3791319efc886d3641d3a2b6fc7a0bf0b5eebe0f6ae64`.
No individual span, long task, heartbeat or sample was removed from either archive.

V1's original harness and manifest are preserved separately. Its download attempt
timed out, and **its complete receipt was not recovered**. The retained
[operator summary](evidence/fpv-d1-transition-profile-v1-summary-observation.json)
reports 36 completed observations, visible/focused state without transitions,
maximum preparation 65.5 ms and maximum load 10.8 ms. These summary-only numbers
are not substituted for missing raw evidence or combined with v2 statistics.
V2 only adds a complete DOM export field and its own version/manifest identity;
its measurements remain a new experiment.

Decode and verify from the repository root:

```python
from pathlib import Path
import gzip, hashlib, json
base = Path("docs/evidence")
metadata = json.loads((base / "fpv-d1-transition-profile-archive.json").read_text())
for item in metadata["archives"]:
    compressed = (base / item["file"]).read_bytes()
    assert len(compressed) == item["compressedBytes"]
    assert hashlib.sha256(compressed).hexdigest() == item["compressedSha256"]
    assert compressed[4:8] == bytes(4)
    raw = gzip.decompress(compressed)
    assert len(raw) == item["rawBytes"]
    assert hashlib.sha256(raw).hexdigest() == item["rawSha256"]
    Path("/tmp", item["rawFile"]).write_bytes(raw)
```

Then run `node docs/evidence/fpv-d1-transition-profile-analyzer.mjs
/tmp/fpv-d1-transition-profile-v2-detailed.json /tmp/fpv-d1-profile-reanalysis.json`
and compare the output with the decoded original analysis. To reconstruct the
browser fixture, serve the manifest's pinned source paths at a local root, copy
the exact v2 harness to `profile-v2.html` and its manifest to
`profile-v2-manifest.json`. The retained localhost fixture is at port 8854. No
rerun is required to interpret this completed result.
