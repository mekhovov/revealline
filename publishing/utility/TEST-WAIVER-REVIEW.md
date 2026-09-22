# Temporary automated-test waiver review

Authorization: explicit user request on 2026-09-22 to make automated tests
optional temporarily and prioritize merging and publishing completed changes.

Base: `e0f99c9642355aa3daf62ce3e551675b8c9d2e14` (v0.83.0 selector PR271).
Policy SHA-256:
`b6887ba7f2b84a007b96de14fc867ac38ac8135d7c231c7ade7ebc52ba31704a`.

## Scope and restoration

PR and manual qualification shards and utility/controller self-test suites may
be skipped under the committed policy. Five non-test source gates, actual build,
source identity, production provenance, frozen-artifact integrity, immutable
upload checks, archive preservation and public verification stay mandatory.
There is no `continue-on-error` conversion of failing checks into success.
Incomplete owner-held drafts still need owner handoff and review.

Restore all suites with policy mode `required` in a reviewed PR. A manual
qualification can opt in immediately with `run_tests=true`. Existing passing
v1 release evidence remains unchanged; waived releases use v2 with null test
counts and actual skipped-job evidence. Skipping tests increases regression risk;
this change does not promise bug-free releases.

No game code, version, selector, catalog, allocation, historical release or
published asset changes are included. The first actual waived release still
needs its own source/build/freeze/inspection evidence. Local fixtures are not
release qualification.

## Bounded implementation checks

- Root ran the policy, workflow, assembler-controller and metadata-sync Node
  checks: 44 passed on Node20.19.5 before the final extra pin-bound cases.
- Root ran the new Python waiver consumer checks: 10 passed.
- The Python-produced v2 fixture was accepted by the JavaScript Pages consumer.
- The Python owner confirmed the unchanged real v0.83.0 seven-asset package
  still passes the legacy consumer, resolving all83 evidence originals.
- The owner's broader legacy run had25 passes and one local Git-AI temporary
  directory cleanup permission error. That is not represented as a passing
  complete suite. The unchanged focused legacy classes passed23 checks.

These fast implementation checks do not restore the long release test gates
the user explicitly waived. Hosted mandatory build and publication preview
results must be checked on the PR's final head before merge.

Final bounded rerun: 44 Node checks and17 Python waiver/adapter checks passed.
An intermediate fixture failed after optional generic pins were added because
its `pop()` removed an optional pin instead of the intended required pin. The
negative fixture now removes the specific required pin; the validation rule was
not weakened to hide that failure. Generic originals permit0..64MiB, while
policy remains positive<=16KiB and raw run/jobs remain positive<=4MiB.
