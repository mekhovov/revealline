# Bounded native motion workload — 2026-10-14

Nine manually started native browser runs completed: Mountain Reservoir, Harbor Docks and Coaster Park, each at Performance, Balanced and Quality. Every run executed 30 warm-up frames followed by 1,200 measured frames, advancing the production flight runtime once per frame and rotating through FPV, Chase and Overview for 400 measured frames each.

This qualifies one **synthetic recorded-input workload**, not real-time gameplay, hardware FPS, sustained-hour stability or the newer regional host. It follows the [static measurement receipt](fpv-native-render-measurement-20261014.md); it is not a controlled before/after comparison.

## Exact identity and method

- Frozen production compiler/runtime/renderer source: `25d086cbd580de5dc5b745ce088af283434df5ae`, from [the qualified cloud artifact](https://github.com/mekhovov/revealline/actions/runs/38615162179/artifacts/11919610810).
- Native Codex in-app browser; visible viewport 1280 × 800, DPR 1, canvas CSS/backing 1280 × 520 throughout all nine runs.
- Manual Load and Run buttons at the isolated external review page `http://127.0.0.1:9020/sustained.html`; no browser automation outside native CUA. The external harness is not a shipping UI.
- Explicit arm only when Run is clicked; deterministic recorded inputs (seed `0x51f00d`) in Self-level, no weapons, one 50 Hz simulation tick per rendered frame. Consequently 1,230 ticks are not tied to real elapsed seconds.
- Input file SHA-256: `5aa726775942d69f828a7305ede0f36da8c77d60f35b39313afb7277df2e9ff8`. [The companion receipt](fpv-native-sustained-render-20261014.json) binds all harness files, exact pack digests, user agent, individual measurements and raw receipt hash.
- No saved player stores, installed worlds, recordings or worker registrations were changed.

## Observed timings

Milliseconds, p95. Physics and draw are synchronous callback costs; combined CPU includes production tick/reset/draw work and excludes harness bookkeeping. They do not measure GPU completion. RequestAnimationFrame interval is reported separately and must not be presented as achieved gameplay FPS.

| World              | Tier     | Physics CPU | Draw CPU | Combined CPU | rAF interval |
| ------------------ | -------- | ----------: | -------: | -----------: | -----------: |
| mountain-reservoir | low      |         0.2 |      0.7 |          0.9 |         10.0 |
| mountain-reservoir | balanced |         0.2 |      0.8 |          0.9 |         10.0 |
| mountain-reservoir | high     |         0.2 |      0.9 |          1.0 |         10.1 |
| harbor-docks       | low      |         0.2 |      0.6 |          0.7 |         10.0 |
| harbor-docks       | balanced |         0.2 |      0.8 |          0.9 |          9.2 |
| harbor-docks       | high     |         0.2 |      1.0 |          1.1 |         10.1 |
| cc0-coaster-park   | low      |         0.2 |      0.5 |          0.6 |          9.9 |
| cc0-coaster-park   | balanced |         0.2 |      0.6 |          0.7 |          9.2 |
| cc0-coaster-park   | high     |         0.2 |      0.7 |          0.8 |          9.1 |

## State and cleanup checks

All nine runs completed 1,200 measured frames and 1,230 physics ticks with no terminal resets or unexpected context loss. Each final physics state, moving-frame count and peak contact count exactly matched the independent Node production-runtime preflight. Reservoir recorded 125 contacts and Harbor 143; Coaster recorded none. These scripted contacts are workload observations, not evidence of a clean pilot flight or mission completion.

Before/after resource snapshots showed the same registered resource counts during each run. After explicit disposal, all registered geometries, materials and textures were zero; renderer geometry/program counts were zero and its context was intentionally released. The renderer retained one internal texture counter in every run. Coarse JavaScript heap samples were captured without forced garbage collection; these observations do not establish memory-leak freedom or GPU-memory reclamation.

Each subsequent load uses a fresh canvas after disposing the previous renderer, avoiding reuse of an intentionally lost WebGL context. All published runs used positive, unchanged viewport and canvas dimensions. The earlier invalid zero-size static sample is not included.

## Remaining qualification

This covers three first courses, three quality tiers and three cameras in one desktop browser at one resolution. Human-input gameplay, controller/mobile/handheld hardware, long sessions, all world/course combinations, and the newer regional runtime remain separate acceptance work. No package contents, physics rules, rendering code or gameplay settings were changed for this measurement.
