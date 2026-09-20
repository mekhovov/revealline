---
name: presentation-release-pins
description: Verify exact compiled presentation bytes while preserving live attempt resources.
---

Use the reviewed manifest's SHA-256 as `expectedManifestSha256` when loading a retained collection. Check accepted snapshot `manifestSha256` alongside exact source/theme/collection identities and authoritative required slots. A hash is not proof of approval or asset quality.

Stage replacements in an independent host. Keep the live host usable until every required dependency is ready. Release only owned resources on cancellation/failure. Preserve historical unpinned callers and save readers. See `docs/presentation-manifest-pins.md`.

Prompt example: “Connect an exact reviewed presentation to staged attempt preparation. Verify original manifest bytes before asset acquisition. Prove wrong hash, stale completion, abort and malformed expectation leave the current attempt usable. Test actual compiler output and separate-host disposal; qualify real rendering and offline dependencies before release.”

Use `prepareVisualThemeLease` to connect owned catalogue selection to a new verified asset host. Required slots come from the code-owned mode registry. Treat its return as one dependency, not a ready attempt: prepare exact pictures/audio and run state before adoption, discard stale leases by request generation, and retain prior results throughout. Never reuse the shared page host. The caller owns explicit release after transfer; later preparation aborts cannot retire an adopted lease. See `docs/staged-visual-theme-lease.md`.

Retain a verified lease's `pin()` and restore it through `prepareRetainedVisualThemeLease` against actual accepted content. Never consult fresh theme preferences during Retry/restore or fall forward to latest. This compiled pin is one field of a future versioned complete attempt envelope; it does not replace picture/story/audio/session authorities. Keep all historical readers unchanged until an explicit migration is qualified. See `docs/retained-visual-theme-pins.md`.

When applying a replacement to the same DOM element, use shared DOM ownership so retiring the old lease preserves equal values and attributes owned by the new one. Exercise both release orders and partial-adoption rollback. Resolve actual Journey selections through `prepareHostSelection` and the real host’s guarded `visualThemeSelection`, never by relaxing raw entry equality or accepting copied rows.
