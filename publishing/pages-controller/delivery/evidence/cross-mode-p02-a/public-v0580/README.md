# P02-A · v0.58.0 public review

**Requires correction; this is not phase acceptance.** The public build passed source qualification and full deployed-byte verification. Native review found that Team's permanent explanation of available sound disappears after a successful preference edit. v0.58.1 separates that explanation from transient storage warnings and must pass its own gates.

## Release and public authority

- Source `c113a348ae69bd013b67f0d22a5391d604253545`, tree `7cdb91b4cdbf89256f4e0d430f0ec79f4a7e9486`; [source PR 62](https://github.com/mekhovov/revealline/pull/62).
- Complete hosted test families: 4,332 passing tests each; all six source gates, production reproduction/readiness and ordinary build pass. CI `35046829165`; frozen qualification `35046836531`. The two runtimes are repeat executions of the same cases, not 8,664 distinct tests.
- [Publication PR 69](https://github.com/mekhovov/revealline/pull/69), publisher `1167291e27773ef076ed64b6e06ba7c0339423a0`, Pages run `35052821808`, deployment `6473320472`.
- Complete public audit: **2,505 files / 637,489,480 bytes**, zero failures, retries or skipped rows. Fresh post-audit authority checks retain the same publication identity.
- [Playable v0.58.0](https://mekhovov.github.io/revealline/releases/v0.58.0/site/game/). This historical version remains available after correction.

## Native scope

The archive retains 60 numbered observation groups spanning labels 01–61. They contain 128 original public-native files, including preflight; the full native archive has 138 originals with diagnostic, peer-review and owned-media handoff records. These are correlated observations, not 60 independent test cases.

Observed journeys include Solo master controls and paused playlist continuity; actual owned MP3 import, muted audition, Pause and explicit Resume; two independent Asset Studio native previews; Versus paused options; Team preference changes; a genuinely earned First Signal victory, optional story and Collection replay; and reload with exact 13% master preference. Replaying the story does not visibly add another score. The source regression suite separately covers late playback, disposal, storage failure and concurrent preference events.

Team's explanatory sentence was initially visible, then disappeared after successful master edits (34–35 and 48–50). Independent peer review confirmed this is a product defect, not an observation gap. Natural story end and Skip also leave focus on the document; Close restores its opener. That separate navigation issue belongs to P03/P07.

## Retained unsuccessful observations

- Label 21 was intended for Studio but captured Solo because an old capture helper retained its original tab binding. Explicit-tab capture is used from 22 onward; 21 is not Studio evidence.
- Initial MP3 save and story/media restore observations show pending work. Later 37/40 records and actual earned-story playback establish completion; the pending records are not counted as successful completion.
- Native accessibility-action Play crashed the webview. A plain HTML audio control with the same owned MP3 and no game JavaScript reproduced the failure. Keyboard Space and visible pointer playback worked in the game. The raw diagnostic and peer review are retained; no speculative game workaround was added.
- Crashed browser pages could not be reopened or closed through the blocked data-URL surface. That tooling failure does not establish a gameplay or media failure.

## Evidence limits

No acoustic listening, physical touch/controller qualification, iPhone attenuation, full offline custom-media acceptance or album quality is asserted. The read-only media snapshot did not expose native `volume`; its absence is not a measured zero. A paused audition/story can retain its local mute intentionally until explicit Resume. Team currently has no audio producer; shared controls do not imply a delivered soundtrack. These limits remain in P02-B/P18.

## Retained originals

- `native-evidence.zip` and `native-manifest.json`: exact original observations, images, diagnostics and independent review, with per-file hashes.
- `public-bytes.zip`, `public-bytes-manifest.json` and `public-bytes-record.json`: the exact sealed 165-original public-byte evidence package. Every member was re-read against its manifest and original source before this copy.
- `review.json`: release bindings, correction, later finding and archive hashes. It remains a requires-correction historical record even after a successor is accepted.

The correction keeps permanent context outside a live status region; storage results remain independently announced without moving focus. This applies [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), inspected on 16 September 2026.
