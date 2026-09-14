# Phase 3 controller integration

This branch merges corrected P3 source `f4672a915e9495ed069e5e98a71e390f7b9ea7b0` (v0.47.0) onto P2 controller integration `54e0b71ef2b8bfee578c91c2bbfb034a154b8d4c`. It preserves accepted main actor-art build entries, both immutable metadata/source history formats and the intended per-anchor rotor blade-count renderer fix. Fixture trees copy both exact historical formats, including main’s archived actor module. No historical asset record is rewritten.

The controller commit is distinct from frozen release identity. Tags, frozen manifests and release bodies remain unchanged. Its exact-source workflow runs all six gates and production reproduction whenever the producer is available; hosted qualification is pending until this branch is pushed.
