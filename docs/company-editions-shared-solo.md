# Company editions on the shared Solo player

The company entry is now an adapter to `game/index.html`. It supplies a validated content
provider to the existing Solo player. Rules, movement, enemy AI, capture, difficulty,
controls, session recording, mission selection, collections, settings, controller practice
and replay playback have one implementation. Brand selection cannot change simulation code.
The compact overlay retains the original Skip/Confirm skip and Watch first cut controls,
including their shared confirmation, practice and progression behavior.

The player provider keeps the selected audience boundary at boot and in lazy-loaded tools.
A compiled standalone edition cannot use a query string to enable a campaign that its
catalogue omits. The source hub can switch between the declared editions. Switching pauses
the current flight; Continue and Retry retain its recorded gameplay and presentation
references. An additive actor/replay presentation receipt binds the selected themes, presets and
approved asset digests; mismatches leave the saved bytes or current playback intact and offer
recovery guidance. Older company-preview saves are kept separately when their format cannot be
opened by the canonical host.

## Presentation

Brand packs supply palette, typography, official identity artwork, home composition,
character recipes and campaign-specific enemy appearances. Cosmetic body rotation does not
change collision geometry. The Coupa flower rotates at half a revolution per second; its
original exterior transparency is retained while enclosed interior holes receive an opaque
white backing at render time. The Dutch propeller rotates twice per second. Reduced effects
stops continuous rotation. Menu marks stay upright.

The arena fits the largest rectangle of the map's existing aspect ratio into the available
viewport, reserving measured room for HUD, notices, safe areas and visible touch controls.
Portrait phones use the full available width. Short landscape screens put touch steering
beside the board. The layout never stretches the world or changes input coordinates.

Official 2024 Coupa wallpapers furnish the home menu. Three representative generated
compositions provide a city, a network atlas and a Dutch workshop; prompts and provenance
are recorded in `game/editions/art-prompts-2026-09-26.json`. These are fictional illustrations.
The wider raster-art catalogue remains pending human review; procedural interim pictures
are not described as finished artwork.

## Learning and tools

A completed-picture reveal can offer an optional learning bonus. The bonus opens only after
the earned image is available, pauses input, and uses the exact lesson and fixture revisions.
It does not block arcade progression, Next, Retry or replay. Completion is recomputed from
bounded actions rather than a stored flag. Practice never awards campaign mastery.

Controller Practice and Replay Theater use the same selected-content provider. Practice
launches the ordinary Solo iframe, including the branded First Flight course. Standalone
archives include these tool pages and their dependency closure. Unshipped examples and
workshop authoring data are excluded. Replay Theater preserves verified company actor presentation
but remains a silent route viewer: original background pictures, music and interface are not
restored, and the UI states that limitation.

## Storage and delivery

Logical edition progress stays stable across engine releases. Profile recovery and transfer
accept exact edition-scoped channels. A live writer lease can be borrowed only by the same
in-memory owner, verified before and after asynchronous reads; a foreign tab cannot forge a
lease. Installation selection also respects the stable edition writer. Historical default
profile keys and recovery remain supported.

Candidate CI selects all 14 declared editions, compiles twice, compares archive bytes and
independently inspects the original ZIP members. Source archives contain selected inputs
and explicit projections: each projection binds its original input hash to its shipped
output hash. Runtime media uses an exact approved dependency ledger, not a broad assets
folder allowlist. Launcher publication checks transitive module closure as well as cache
ownership.

Before freezing archives, candidate CI boots the real content provider against both the
selected source inventory and its compiled player inventory. Closed fetchers reject any
undeclared dependency; both providers must produce the same presentation receipt. This
checks the runtime boundary as well as the compiler's own dependency report.

## Acceptance boundary

Engineering checks cover shared-host startup, mission filters, canonical rules and tuning,
cosmetic rendering, deterministic routes, persistence, packaging and offline ownership.
Local browser checks exercise source and compiled entry points and responsive layouts.
Those observations do not establish human pacing, comprehension, physical controller
support, OS installation or same-device performance qualification.

The unchanged shared engine hashes exact floating-point replay state. A reproduced
arm64/x64 difference in collision steering changed an enemy velocity by about
`2 × 10^-15` while leaving every discrete outcome unchanged. Fixed route witnesses therefore
pin exact outcomes, event timing and board cells; full checkpoint equality is checked
between independent runs on each runtime. Historical raw checksums retain their reference
runtime metadata. Exported replay or learning-proof transfer across different runtimes can
still be rejected by the shared engine's strict checkpoint check. A portable-math engine
would need a separate gameplay revision with retained readers; company editions neither
round that authority nor introduce their own physics to conceal the limitation.

The 2026-09-26 local browser review exercised Coupa and Dutch home menus, mission selection,
the Band 12 Run Ledger encounter, settings and Controller Practice in both source and
compiled editions. At 1280×720 the arena measured 1243×621; at 390×844 it measured 382×191
with controls below; at 844×390 it measured 652×326 with controls beside it. HUD and touch
controls did not overlap the board in those views. These are bounded viewport observations,
not a claim that every physical device was tested. Automated startup, Missions and first
launch passed for all 14 editions; the shared save/backup compatibility cohort passed 63
checks. After rebasing onto main `a8881ac17`, the company cohort passed 172 checks and the
shared-contract/upstream-presentation cohort passed 230. The final control relocation has
its own actual-host regression. Full release qualification remains separate from these
focused checks.

A keyboard follow-up reproduced a missed-release edge case when an embedded view becomes
hidden without a window blur. The shared Solo input adapter now clears its physical key
ledger on either departure event, retaining the normal explicit-resume and held-repeat
guards. Three actual-focus host regressions cover launch, Settings return, letter-key
fallback, blur and visibility-only recovery. Together with the continuous input, UI input
and controller boost recovery suites, all 138 checks pass. Browser checks also confirmed
arrow and WASD steering and Escape pause/resume in Coupa; the user confirmed keyboard
controls were working before this additional lifecycle fix.

The delivery sequence remains: shared-host candidate → advanced encounter proofs →
14-edition reproducible freeze → human review of the representative artwork and gameplay →
final art in small batches → installation/performance/rollback qualification → exact-byte
release promotion. Public promotion remains closed until the recorded gates pass.
