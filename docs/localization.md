# English and Ukrainian localization

The localization migration is **in progress**, on `codex/english-ukrainian-localization`.
Do not treat English fallback as completed Ukrainian coverage or publish this checkpoint.

## Keep the work on current main

Before changing translations, fetch and rebase onto `origin/main`, preserving local work.
After each rebase, rerun extraction: new screens, generated content, and presentation
adapters can introduce text outside the previous inventory. Recheck main before the final
verification. `npm run i18n:check:main` fetches main and rejects a branch that does not
contain it, then runs the catalog checks. It does not stash, reset, or rebase work itself.
The ordinary offline build/check commands do not need a Git remote.

Keep localization in its isolated worktree. The original checkout contains unrelated
staged and untracked work and must remain intact.

## Runtime and catalogs

Pinned i18next 26.4.2 is vendored under `game/vendor`. Canonical JSON catalogs live in
`game/locales/en` and `game/locales/uk`. `npm run i18n:build` generates the classic-script
catalog bundle and the first-party content registry. The same initialized instance is
available to ES modules through `game/i18n/index.mjs`. The catalog bundle uses pinned,
locally vendored lz-string 1.5.0 to restore exact JSON synchronously before initialization.
Its original MIT notice ships both in the generated script and in public credits.

Use semantic `namespace:key` names. Reuse `common` keys for the same meaning, but keep
separate messages when grammar differs: Standard difficulty and Standard text size need
different Ukrainian adjectives. Translate whole sentences, with named interpolation
values. Count messages require Ukrainian `one`, `few`, `many`, and `other` forms.

- `t(key, values)` resolves a message now.
- `localizedMessage(key, values)` defers resolution for DOM factories.
- `localizedText(node, producer)` and `localizedAttribute(node, name, producer)` bind
  presentation text in place. Caption bindings retain controls appended to the element.
- `data-i18n`, attribute markers, and `data-i18n-rich` bind static HTML. Rich messages use
  named slots for retained links and controls. Do not replace rendered English text.
- `onLocaleChange` is for presentation refreshes only, never simulation, saves, or drafts.
- `contentText(record, fieldPath)` translates an exact registered first-party record.
  Modified imports retain their original authored text. Do not translate canonical
  campaign/pack data before hashing, validation, saving, or replay recording.
- Mission-library sources may expose `presentation(entry)` for live display fields.
  The library delegates through the original owner, including combined Solo/Versus
  sources. Search includes translated names without replacing canonical rows or
  launch objects. Edition labels must be deferred separately from source identity.

Explicit choices use `revealline.locale.v1`, outside game saves and exports. Resolution is
saved `en`/`uk`, then the first supported browser preference, then browser language, then
English. Regional browser tags normalize to their language. Detection is not persisted.
Storage failures retain a session choice and display a localized notice. Storage events
share explicit choices between same-origin tabs without writing game progress.

## Commands

- `npm run i18n:extract` reports references, explicitly registered content fields, missing
  content messages, and duplicate candidates for shared keys.
- `npm run i18n:audit` inventories possible raw DOM, canvas, attribute, error, and metadata
  text with source locations and matching existing keys. Review candidates: technical values,
  authored imports, legal notices, and bilingual specimens are not automatically translated.
- `npm run i18n:build` regenerates bundles after catalog/source changes.
- `npm run i18n:check` verifies references, language coverage, interpolation, plural forms,
  and generated artifacts. Missing Ukrainian is an error even when English fallback works.
- `npm run i18n:check:main` also checks the fetched main ancestry.

The extractor uses Acorn and parse5, compatible with supported Node 20, rather than
requiring a frontend bundler or a newer Node-only extraction CLI.

## Remaining migration work at this checkpoint

The original checkout was over 1,700 commits behind main. The rebase retains main's
Journey, Team, soundtrack, and editor changes. New English keys are explicitly present
and missing Ukrainian remains detectable. Complete these before marking the task done:

- Translate all uncatalogued dynamic sentences. The existing tools catalog is complete.
  Inspect `game/studio`, classic `.js` tools, generated current-version pages, and
  user-facing errors; extraction of existing keys alone is not a raw-text coverage audit.
- The registry now includes the current default authored Journey and Team sources,
  compiled Solo/Versus executions, navigation records, cards, manifest design fields,
  current theme/actor-theme labels, and difficulty presets. These
  catalog entries are translated. Finish their presentation adapters; add maintained nondefault editions,
  optional first-party packs and derived Classic metadata. Preserve hashes.
- Finish live bindings for derived labels, statuses, canvas text, dropdown options, and
  presentation adapters. Check unsaved editor data, selections, focus, and scroll.
- Refresh native staging and finish route checks against each final rebased build.
  Generated privacy/credits pages and current-entry aliases now load the same local
  runtime, use translated messages and retained attribution links, and rewrite root
  asset paths. Historical frozen releases stay unchanged.
- Review shared keys and Ukrainian grammar, especially reused nouns/adjectives.
- Run full validation, lint, formatting, tests, builds, native staging, and route checks.
  Current-main baseline checks reproduce the legacy session-v4 expectations against
  session-v6 output and the old 201-mission expectation against 279 available missions.

The active checkout's temporary sparse exclusions have been removed. The full suite
finished with failures still under investigation. A clean main checkout reproduces
the Team Studio initial-state hash mismatch, Custom-pack chooser timeout, Team artwork
registration failure, combat study's missing `player-locator.mjs` dependency, controller
snapshot-key mismatch, Team terrain missing-exception assertion, continuous-host
session-version mismatch, default-entry mission-count mismatch, and the Controller
practice teardown storage-listener assertion. The First Flight
handoff timeout is intermittent here and remains unresolved; do not dismiss it as a
baseline failure.

At this checkpoint, catalog validation covers **7,215 messages** in both languages.
The current interface, content, and tools catalogs are fully translated. This is not full
coverage: the source audit still finds dynamic messages, Classic library metadata, tool
JavaScript, and user-facing errors outside the catalogs. Do not declare completion from
catalog coverage alone. Twenty-nine reviewed repeated meanings now use common keys.

The latest focused suite passes 99 locale, paused-flight, couch navigation, music, encounter,
controller-confirmation, and compact-bundle tests. Earlier source-audit and generated-page
checks pass as recorded in the preceding checkpoint. Native staging/resource tests pass
23 cases; markup integration checks pass 58 cases. Validation, lint, and the full formatting check pass.
The completed full suite's failures require focused reruns after fixes and
comparison against main. A localization-aware HTML assertion must still verify its
original labels, associations, and actions instead of dropping the behavior check.

Browser checks confirm Ukrainian Journey-name search, restart persistence, cross-tab
refresh without clearing typed search, current Journey guidance, menu counts, and startup
status. Switching a paused flight Ukrainian → English → Ukrainian retained the 0:11 clock,
HUD values, settings tab, and language-selector focus. The browser exposed a previously
captured status sentence; accepted warning bindings now preserve the message producer.
A real host test confirms unchanged simulation checkpoints, flight ownership, raw saved
slot bytes, pause state, and control focus across language changes.

The web build passes the existing 64 MiB offline limit. Canonical JSON sources remain in
the full distribution; offline play caches their complete generated bundle once. The
content registry shares identical fields across exact identities, reducing its runtime
size from about 1 MiB to 240 KiB. Source references remain in extraction reports.
Desktop staging and resource reads verified all 1,161 files / 598,917,869 bytes in the
first passing build, including every localization asset. Current full distributions
include optional chapter/music originals and require the updated 768 MiB / 4,096-file
native bounds; per-file integrity and 64 MiB bounds remain enforced. iPhone staging found
one source review page without an explicit head/body; its markup is now explicit.

The branch is rebased onto main f02e94c9f, retaining the v0.112 publication and plan updates plus the new couch optional-setup flow,
controller confirmation guard, and character presentation changes. The relocated controls
retain their native behavior and translated labels. Repeated fetches still show no missing
main commits. Continue checking before each translation checkpoint.

The catalog bundle now stores each semantic key once across languages, reconstructing the
same namespaces synchronously. Bundle tests compare every entry, including Ukrainian-only
plural forms and intentionally missing values. Validation now checks interpolation in those
extra plural forms and rejects orphan Ukrainian keys as well.

Couch lobby, setup choices, results, HUD states, and music credit controls now use live
presentation bindings. Shared music prefixes and duration/status labels use common keys.
Current Journey chapter/mission names use verified record identities; abbreviated actor-theme
names require the exact generated theme before resolving their original theme label. Music
locale changes only refresh presentation, retain transport/volume/library state, and unsubscribe
on disposal. Rebinding identical text keeps the native gesture target while accepting the new
message producer. Encounter guidance translates complete sentences with locale-aware counts.

Current-main web builds now complete successfully after disk space was recovered. The
latest verified offline inventory has 992 files / 67,018,785 bytes, below the existing
64 MiB cap. Desktop staging verified all 1,161 files / 598,853,770 bytes; iPhone staging
verified 1,166 files / 598,934,049 bytes, including the repaired review-page markup.
Both native stages byte-verified all 21 localization assets. These are staging checks,
not a native GUI or simulator certification. Disposable stage directories were removed
after verification to retain shared disk space. Refresh these checks after further changes.

Compact Ukrainian Settings labels now stack above full-width controls on narrow screens,
including Large text. Both couch modes expose language controls within controller menu
navigation. A built-browser check exposed an old rich-text subscription reclaiming a
host-owned link; the binding now relinquishes ownership without restoring removed slots
or displaying slot placeholders. Regression tests cover both directions of switching.

The original full suite has completed. One old VM fixture omitted the
translator and spun forever waiting for admission; only that proven-stuck child was
terminated after the corrected fixture passed all three cases. Its bounded wait now
fails explicitly if admission never begins. The canvas renderer's local animation clock
also shadowed the imported translator on error paths; it now uses an unambiguous name,
and lint checks prevent the same collision. Remaining suite failures are still being
triaged. No mergeable PR exists yet.

Startup locale assets now follow the inline dark-screen guard; the locale stylesheet
uses the same deferred, monitored loading as other game styles. The failure/launch
screen has its own language selector. Build validation rejects missing translations and
stale bundles for current localized distributions, while small fixtures and historical
releases without catalogs retain their previous behavior.

## Design references

- [i18next namespaces](https://www.i18next.com/principles/namespaces)
- [i18next plural forms](https://www.i18next.com/translation-function/plurals)
- [i18next translation best practices](https://www.i18next.com/principles/best-practices)
- [Ordered browser language preferences](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages)

## Team and active-reader checkpoint

Team instructions, goal/HUD projections, reserves, shield/crawl states, recovery feedback,
and timed-bonus windows now resolve complete messages at presentation time. Safe-ground
and reclaimed-ground sentences use context variants for Ukrainian case agreement.
Starter Team pack/arena names are registered by exact identity; custom edits stay authored.
Accepted bonus projections retain their original clocks and data while rendering the new
language, and current artwork-status messages retain their translation producer.

Language refresh now brackets controller reading ownership. A reader must be current before
translation starts and retain its exact region, scope, focus, and lifecycle afterward.
Unrelated text changes before the refresh still invalidate it, even if translation restores
the old caption. This prevents the next controller frame from moving focus to Resume solely
because the translated reading text changed. Reading prompts and labels translate live.

The final localization/controller, operation-status, and lobby-preview checkpoint suite
passed 266 checks; the additional accepted-status producer regression passed five checks. The Team regression run passed
104 of 107 checks. Three lifecycle-resume cases fail at the final Resume assertion; a separate current-main
checkout reproduces all three at the same assertion. Sampled Team pressure, timed-bonus,
and partner-return golden checkpoints also reproduce the exact observed hash mismatch on main.
The original full suite finished: 13,138 tests, 11,776 passed and 1,362 failed.
It began before the latest fixes and rebases, so those totals describe that run rather than
the current checkpoint. Long v3/v4 host scenarios reported timeouts; do not discard them as baseline failures without evidence.
A browser cross-tab language switch retained Team reading focus, the active reader, the 0:03
paused clock, and HUD state in both directions. The built More menu also now shows the
correct translated All missions link without raw slot markers. The refreshed web distribution and both native stages pass for this Team checkpoint:
1,162 web/desktop files / 598,900,053 bytes, and 1,167 iPhone files / 598,980,332 bytes.
All 21 localization assets match source bytes in both native stages. The web archive SHA-256
is ae50a8c92b6cffef840d219d896f07b6e2a99b7d44ddbdeabb7351055e26f023.
The core offline inventory is 993 files / 67,043,819 bytes, with 65,045 bytes remaining
under its existing limit. Disposable native stages were removed after verification.

Browser offline preparation verified all 993 files. With the local server stopped, the game
reopened from the prepared cache and switched English/Ukrainian. Launching the current
Journey then failed fetching its original artwork: the existing offline policy excludes that
optional artwork. This is not a successful offline flight check. The optional-artwork note,
phase/verification messages and picture-fetch failure still contain uncatalogued English and
must be localized. The preview server was restored after the check; no external service was
changed. Full downloaded/native distributions contain the originals.

## v0.113.0 rebase and offline presentation

Rebased all localization commits onto main `0395ddbda` (v0.113.0), preserving the new
spatial-edition disposal paths and v10 entry selection. The current cultural triptych's
route/mastery text and Studio links are translated. The three manually selectable prior
v9 missions now have exact registry coverage for both their bounded selector records and
full launch records. Their edition labels resolve live while canonical IDs and owners stay
unchanged. The previous native/build figures above are v0.112.0 checkpoints and must be
refreshed before release.

Offline availability and worker reports expose semantic message codes. The panel translates
these codes and older workers' structured outcomes without matching rendered English.
Measured files/tracks/chapters/ticks have shared plural-aware progress messages, including
localized accessible progress labels. Completion, detach, failure and unavailable-state
messages update in place. Original diagnostic reports remain intact in the details view.
Exact release metadata identifies first-party optional pack names. The optional artwork
limitation is now visible above the verification details, before a player prepares the cache.

The focused offline/core-worker, operation-status and current/prior-edition suite passes all
54 tests, including language changes during an active observation, unchanged progress/focus,
terminal diagnostic retention and unchanged mission identities. This does not establish
complete offline flight coverage; original Journey pictures are still excluded from the
browser's core cache, as described above.

The broader localization/controller/build-page regression run passes 254 tests. The final
picture/offline/progress/edition subset passes 33 tests, and the real failed-picture host
regression passes after switching both ways, retaining focus and the authoritative paused
checkpoint, and retrying the decoder exactly once. Phase reports carry translation keys
without changing their canonical string diagnostics; the host resolves accepted phases live.
Picture-load recovery notices are translated and keep the existing retry action.

Optional release metadata now includes the pack's SHA-256. Catalog registration requires
that complete metadata, so a changed payload with the same path, ID and title keeps its
authored name. The build fixture verifies exact source/ZIP bytes and this digest. UI-skin
assertions now parse the native label/select/options and verify their translation markers;
map-diagnostic assertions check Ukrainian coordinates and mechanics. The minimal Solo DOM's
Option label/text properties now reflect its text like a browser, restoring the chapter
installation assertion. A remaining native-summary controller test fails at line 205 on
both this branch and baseline main `f02e94c9f`; it is not being hidden by a weakened assertion.

Full validation, lint, formatting and catalog checks pass at this checkpoint. The completed
full-suite log is retained at `/tmp/rl-i18n/rebase/full-tests.log`; the completed failure
inventory is `/tmp/rl-i18n/rebase/full-suite-completed-failures.tsv`. Unclassified failures
and the remaining owned-text audit still prevent a completion or merge-readiness claim.

The completed v0.113.0 rebuild passes: 1,166 files / 598,984,442 bytes; archive SHA-256
`8a9e9f8468291a2e2de81f34ac23ca579de493646d04b5f775d5f98f5507dcbb`.
Desktop staging verifies the same inventory; iPhone staging verifies 1,171 files /
599,064,721 bytes, including its bridge and diagnostics. Runtime/catalog assets match
source bytes (21 on desktop; 22 including the runtime license on iPhone). The offline
inventory verifies 997 files / 67,106,838 bytes, only 2,026 bytes below the existing cap.
Disposable native stages were removed after verification.

Storage-retention results and Playground map descriptions now keep live translation
bindings. Fourteen focused retention/host/diagnostic checks pass, including no repeated
storage calls, unchanged draft bytes and retained diagnostic rows. A source-browser check
confirms English → Ukrainian → English storage status in the same Settings category,
with focus retained. Extraction reports no missing registered content. This does not
resolve the uncatalogued source audit or the unclassified full-suite failures.

## Classic presentation checkpoint

Classic mission-library adapters now translate the original verified index records while
retaining separate canonical Current/Original-rule owners. Names, campaign titles, edition
labels and numeric rule summaries resolve at presentation time; modified metadata keeps
its authored text. Lives and enemy counts use shared Ukrainian plural forms. Download
size labels use locale formatting; accepted completion, cancellation and launch messages
retain live producers. Catalog coverage is 7,215 messages / 5,798 referenced keys.

The generated catalog now shares sorted message prefixes and repeated values, preserving
complete source sentences and synchronous initialization without another runtime dependency.
Round-trip tests compare all namespaces and include missing values, Unicode, escapes and
plural forms. The current bundle is about 66 KiB smaller despite the new Classic messages.

The focused Classic/picker/catalog suite passes 85 tests. Validation, lint and formatting
pass. The broader host/pages run finishes with 36 passes and 14 failures. All 14 reproduce
with identical errors and assertions on main `0395ddbda`: stale mission-count/default-route
expectations, the late Base First Flight handoff and the bundled Versus retry timeout.
Do not treat this as a clean test run or generalize it to unclassified full-suite failures. Browser
cross-tab switching updates an open Classic card in both directions while retaining search
text and focused input. A 375-pixel Large-text check finds the search field squeezed to
33 pixels by its translated adjacent controls; fix this before closing the checkpoint.
The session-only display-preference notice also remains English and needs a live binding.

The Classic web build passes with 1167 files / 598928762 bytes. Its archive
SHA-256 is `624c9ef9d598d73926a4410bdf34e24004c8269bcfcdf3e5c5377fc3c43fdf17`.
The offline inventory has 998 files / 67046281 bytes, leaving 62583
bytes under the unchanged limit. Native figures above predate the Classic adapters and
need refreshing after the remaining browser fixes.

## Live display notices and compact search

Display preference diagnostics now carry semantic keys while preserving their canonical
English service messages. Solo, Couch, Replay Theater, practice tools, Asset Studio and
Motion Lab render accepted warnings live. The ordinary shared-tool notice also resolves
the current locale. Catalog coverage is 7,218 messages / 5,801 referenced keys.

The mission search now occupies the full compact row. Browser checks at Large Ukrainian
text measure a 343-pixel input at a 375-pixel viewport and a 288-pixel input at 320 pixels;
the dialog has no horizontal overflow. The session-only Settings notice switches both
ways with focus and the Large selection retained.

Both real paused-Solo localization tests pass, including the session-only notice. Sequential
host tests exposed a locale observer surviving terminal page teardown; it is now removed,
while persisted pages retain it. The minimal Solo document fixture disconnects its retired
root before restoring globals. Sixty-one non-Solo display/tool tests pass. Full validation,
lint and formatting pass; the final two teardown files also pass the targeted formatting
check. A broader host regression has 38 passes and six failures; baseline comparison is
still running, so these failures are not yet classified. The web/native artifacts above
predate this batch and must be refreshed.

## Optional chapter browser checkpoint

Rebased onto publication main `06308312a`. That update adds v0.113.0 publication
records; immutable release artifacts were left unchanged. All six display-host failures
reported above also reproduce on baseline `0395ddbda`, including the Controller storage
listener assertion; no assertion was weakened.

Optional chapter filters now use canonical Arcade/Tactical/Other values independently
of their translated labels. Labels, descriptions, page counts, byte sizes, recovery
instructions, accepted preparation phases, cancellation and picture-review messages
update in place. Complete flight/race sentences preserve grammatical context. Exact
source-edition adapters retain the original serializable descriptor and gameplay/picture
digests separately from host callbacks; edited content keeps its authored text. All 16
source editions are registered. No content record, gameplay rule or save format changed.
Catalog coverage is 7,275 messages / 5,846 referenced keys.

The latest panel suite passes 95 of 97 checks; two real Solo tests timed out waiting for
initial picture loading while other validation work was active. Both pass in the isolated
four-test description-host rerun. Six new localization tests pass, covering Ukrainian-first
filters, immutable content identities, retained controls/files/focus/page, pending downloads,
cancellation, plural categories and live errors/frozen phase reports. Full validation,
lint and formatting pass for this checkpoint.

The current Solo and Versus menus route to the unified library. An isolated browser
preview of the actual optional component verifies Ukrainian and English presentation,
filter/recovery/focus retention and live missing-file errors. At 320 pixels with Large
text, its dialog measures 286 pixels with matching scroll width (no horizontal overflow).
This component preview does not certify a real optional-chapter launch. The separate
full-flight checks above remain the relevant simulation evidence. The preview tab and
server were closed; the viewport override was reset.

A new audit finding remains: Solo's profile-writer warning about another saving tab is
still English. Also, the full-suite failure inventory and uncatalogued owned text remain
open; this is not a merge-readiness claim. Build/native artifacts above predate this batch.

## v0.113.1 and saving-tab notices

Rebased onto main `7c6f84a47`, retaining the Classic installer projection fix and its
new regression cases. The new unsupported-Classic-rules error is translated. Profile
writer leases now expose stable reason codes beside unchanged canonical diagnostics.
Solo resolves these codes at presentation time, including accepted save warnings;
locale changes never acquire a lease or write player data.

All ten focused lease/real-Solo localization tests pass. Targeted lint and formatting
pass. The actual source browser switches the occupied-writer warning Ukrainian → English
→ Ukrainian across tabs, retaining focused Learn by playing, three lives, zero score and
the 0:00 ready state. The broader v0.113.1 installer/host regression and rebuilt web
distribution are still running; their results and native staging remain to be recorded.
The old task-owned v0.113.0 distribution was hash-verified and removed to make room for
the replacement; its manifest and archive identity are retained under the verification
log directory. No user checkout or historical published artifact was removed.

## v0.113.1 distribution and audit precision

The focused installer/host run passes 47 of 48 cases. Its sole failure is a five-second
initial-picture timeout in the explicit Workshop-context test; that case passes in an
isolated rerun. This is a combined-run timeout, not a clean combined suite. No assertion
was weakened. A subsequent fetch still reports zero commits behind main `7c6f84a47`.

The web build at localization commit `3cd33aff0` passes: 1,170 files / 598,974,609 bytes,
archive SHA-256 `549d6bc4c2f43209dcd2a9b391057499a7d67ccd788ef1428ef1b30deb193a0e`.
The offline inventory contains 1,001 files / 67,069,670 bytes, leaving 39,194 bytes
under the unchanged 64 MiB limit. Desktop staging verifies the same file/byte counts;
iOS staging with bridge and diagnostics verifies 1,175 files / 599,054,888 bytes.
All 22 runtime/catalog/license assets match the web distribution byte for byte in both
stages. Verified temporary native stages were removed after saving verification receipts
to conserve disk space. Native GUI/simulator execution was not exercised.

The source audit now resolves local DOM-helper parameter positions and lexical shadowing,
so IDs passed to `node(tag, id, text)` do not appear as displayed labels. Comparisons inside
text producers remain lower-confidence review candidates. All seven audit tests and its
targeted lint/format checks pass. This improves review precision; it does not certify
complete translation coverage. Collection reward presentation is the next open batch.

## Collection reward presentation

Code-owned achievement and milestone IDs now resolve localized presentation without
changing canonical progress records, campaign thresholds or award rules. Collection and
appearance hints share milestone names; body and campaign names use verified content
records. Mission accessibility labels also update live. Remaining/progress counts use
complete plural messages, including Ukrainian one/few/many/other forms.

All 36 Collection, reward, appearance-rule and difficulty-access tests pass. The added
host case keeps the open context, row nodes, focus, simulation checkpoint, stored bytes
and write counts unchanged across repeated switches; custom chapter names remain authored.
The minimal DOM fixture now recognizes numbered heading tags in selectors. Catalog checks
pass with 7,301 messages / 5,865 referenced keys; targeted lint and formatting pass.

The source browser confirms cross-tab Ukrainian → English → Ukrainian updates in an open
Collection while retaining its reading control focus and expanded section. A compact-screen
review exposed overly narrow reading buttons and appearance columns. Reading actions now
stack when their container is narrow, and appearance pictures stack above text below
480 pixels. At a 320-pixel viewport, both Standard and Large Ukrainian text have a
304-pixel dialog with matching scroll width; the reading controls no longer split labels
inside words. The viewport override was reset. The distribution/native figures above
predate this Collection batch.

## Controller instructions and retained drafts

Solo controller help now resolves complete action instructions for the current Arcade or
Tactical capabilities, including menu shortcuts and navigation help. Shared button/stick
presentation covers unknown buttons, custom axis pairs and inversion labels while keeping
physical mappings and sampling unchanged. Controller editor captions, choices, summaries,
threshold formatting and accepted status messages update in place. Option producers retain
the accepted glyph family after Apply/Cancel instead of dereferencing a discarded draft.
The status presenter owns its label without an obsolete empty parent-text binding.

All 53 focused binding, editor, presentation and real paused-Solo tests pass, including
28 editor cases. Unsaved field values, option nodes, focus and pending Apply ownership
survive switches; hidden fields remain safe after Cancel and Apply. Browser checks confirm
both directions in open help and an unsaved PlayStation/axes 2–3 draft, retaining the
expanded stick section and focused vertical-axis selector. The test draft was cancelled,
and switching still works afterwards. No controller preferences were applied in the browser.

Full validation, lint and formatting pass at this checkpoint; the final editor changes
also pass their targeted lint/format checks. Catalog checks pass with 7,320 messages / 5,887 referenced keys. The broader
equipment/device regression passes 44 of 47 cases; three craft-switch cases time out
waiting five seconds for initial picture loading. All three pass in an isolated rerun (four unrelated cases skipped). Generic host/validation diagnostic details
still require presentation review; this is not a claim that every controller error is
translated. Distribution/native artifacts above predate the Collection and controller
batches. A fresh fetch remains zero commits behind main `7c6f84a47`.


## Design Atlas studies and scroll continuity

The Design Atlas now translates every preview template, study/state descriptor, palette,
coverage row and illustrative asset brief. Action routing uses stable intents rather than
English button labels. Dynamic text binds to explicit DOM slots; translated values are
never parsed as markup. The independent English/Ukrainian font specimen retains its
chosen language when the page locale changes, with matching `lang` attributes.

Browser checks cover all 18 study states in each language, including picture-preview and
asset-brief actions. No empty text slots or exposed translation keys appeared. Cross-tab
switches preserve the selected study/state/width and focused width control. The check
exposed browser scroll anchoring fighting the existing position restoration. Locale
refresh now suppresses anchoring for its synchronous layout update and restores each
prior CSS declaration afterwards. A fresh browser page holds its exact 1,442.5-pixel
scroll position through English → Ukrainian → English; the font specimen also retains
its independent selection and the illustrative brief translates fully.

Catalog checks pass with 7,396 messages / 5,957 referenced keys. Targeted lint and
formatting pass. All 47 focused locale, controller-editor, paused-flight and operation-status
tests pass.
The scroll regression covers translated layout, retained offsets, original CSS priority,
and cleanup when an observer throws. The full-game suite and remaining owned-copy audit
remain open; prior distribution/native artifacts predate this batch.

## Motion playback and story controls

After rebasing cleanly onto publication main `a7084aafa`, Motion Lab playback events,
paused/running readouts, numeric slider descriptions, startup states and accepted image
import notices now resolve live translations. Locale changes re-render presentation without
resetting the preview clock, input, selected controls, image ownership or test collection.
Ukrainian coordinate pairs use semicolons to distinguish them from decimal commas.
`common:actions.playback` separates media playback («Відтворити») from starting a game
(«Грати»); Replay Theater, soundtrack preview and victory stories share that meaning.

A Ukrainian-first story test exposed translated labels being used as button IDs. Story
controls now retain canonical action IDs, and accepted status/error reasons retain message
keys. Locale refresh only changes their bound text; it does not call play, seek, pause,
restart timers, allocate URLs or emit a new presentation-state event. Snapshot reason
fields remain rendered strings, preserving the existing API shape.

The Motion regression passes 84 of 87 checks. All three remaining failures (two terminal
listener assertions and a shared-preference-read assertion) reproduce on baseline main
`0395ddbda`; the involved Motion and shared-surface files are unchanged from that baseline
through `d8910d416`. Two obsolete English-only fixture expectations were resolved by making
the modeled document language match the real bootstrap locale. The added real-host case
preserves paused coordinates, edited values, option nodes, focus, request/write counts and
a pending PNG import across repeated switches, then verifies the same accepted image URL.
The browser confirms Ukrainian → English → Ukrainian at scale 1.05, with unchanged paused
coordinates, focused scale slider and 3,172.5-pixel panel scroll.

All 163 playback/soundtrack/replay checks pass. All 37 final story UI checks also pass,
including Ukrainian-first creation, playing/paused/error text updates and unchanged media
ownership. Catalog checks pass with 7,465 messages / 6,026 referenced keys; targeted lint
and formatting pass. Full validation, lint and formatting pass for this playback checkpoint. Motion collection and
ability metadata/messages still need translation; this batch does not certify whole-tool
coverage. Distribution/native artifacts still predate these batches.


## Motion source identities and localized study data

Registered all three supplied Motion definition files and 107 additional presentation
fields, including vocabulary maps and original-source provenance. A definition root is
registered even when it contains no display fields of its own: this lets a modified
custom file retain all authored child labels. Validated definitions are frozen inside
the lab; selections, overrides and simulation records remain separate and mutable.
The registry caches verified immutable identities instead of hashing definitions per frame.

Menus, character descriptions, source notices, unlock requirements and canvas/DOM stage
labels resolve from those records. Hidden notes remain concealed before either renderer
receives their text. Unlock alternatives have separate groups, avoiding a repeated “or”
when an authored criterion already begins with it. Ability counters use all four Ukrainian
plural categories and locale-aware decimals; accepted ability feedback keeps live keys.

All 18 content/canvas checks pass, including byte-equivalent serialized definitions and
state, custom-file ownership, concealed text, and counts 0, 1, 2, 5, 11, 21, 22 and 1.5.
The two live-host cases retain paused coordinates, options, requirement rows, focus,
unsaved values, pending/accepted images and write counts. The real scan case passes after
updating its obsolete English “1 notes” expectation to singular “1 note.” The final combined Motion run passes 67 of 70 checks, with only the three documented
baseline lifecycle failures remaining. Source/key/interpolation and classic-bundle checks pass with 7,637 messages /
6,087 referenced keys; the unchanged content registry passed the preceding full catalog
check. Targeted lint and formatting pass.

The browser shows translated class/link vocabularies for all four families, collection
metadata, source provenance and stage labels. Locked-character selection and requirement
groups survive both language directions. Remaining collection mutation notices and generic
validator details are still outside this completed batch. This is not whole-tool coverage.

Rebased onto documentation main `d8910d416` after recovering from a full disk. Only the
older task-owned, manifest-verified distribution was removed; verification receipts remain
under `/tmp/rl-i18n/rebase`, and its two temporary servers/tabs were closed. No original
checkout or historical release was removed. Main now contains v0.114.0 `10190539b`; the next
rebase must register its v11 defaults and newly curated v10 predecessors before validation.
Current distributions and native stages need to be regenerated.

## v0.114.0 Horizon rebase

Rebased all localization commits onto `origin/main` `10190539b` (v0.114.0).
Resolved the Couch default link and Studio selector against main's v11 changes, retaining
v10 as a separate prior edition. The prior-card adapter keeps main's two bounded projections
and its full-route launch ownership. Its display label now derives the prior version at
presentation time. Extraction reads that same immutable edition-history registration,
including both v10 and v9 full launch records and bounded navigation records.

Added eight new Horizon content translations and four Studio messages. The generated
registry preserves authored JSON and simulation identities; same-named edited records
keep their authored text. The updated source/key/interpolation/plural and generated-bundle
check passes with 7,649 messages / 6,091 referenced keys. Validation caught the preceding
Motion copy helper missing from the explicit distribution inventory; it is now included.

The initial 62-check edition/default-route run passed 59 checks. One localization test
started before the content bundle finished; the other failures were a Studio assertion
bound to exact HTML formatting and an upstream tag-reader dereference of an omitted
`level`. The reader now tolerates a metadata-only manifest, and the Studio test parses
actual option values/selection. All five affected checks pass in focused final reruns,
including current/prior names, guidance, manual launch ownership and unchanged identities.
Full lint and formatting pass. The full game suite and distribution/native checks remain
outstanding for this checkpoint.

The browser verifies Ukrainian-first v11 startup and mission guidance, the new Studio
selector/description/link labels, and distinct translated v10 prior cards. Cross-tab
Ukrainian → English → Ukrainian preserves the selected prior campaign and focused card.
Studio still has older untranslated dynamic authoring diagnostics; this checkpoint does
not certify whole-tool coverage. No gameplay was started or progress exported in this check.


## Offline catalog packaging and Motion mutation feedback

The first v0.114.0 build rejected the existing 64 MiB offline limit. Catalogs now use the
pinned [lz-string 1.5.0 runtime](https://github.com/pieroxy/lz-string/releases/tag/1.5.0)
for lossless packaging. The generated classic script contains its local decoder and full
original MIT notice; it does not use a network fetch, asynchronous initialization or eval.
Canonical JSON, semantic shared keys and exact content identities stay unchanged. The
catalog is 708,679 bytes before the final Ukrainian credit wording adjustment, compared
with 1,348,893 bytes before compression and the new feedback messages. The existing offline
file/byte cap remains unchanged. Build failures now report actual file and byte counts.

All 20 catalog, generated-page, preference and Motion-content checks pass, including
exact reconstruction of every namespace/plural, unsupported/missing values, Ukrainian
letters, astral characters, a lone surrogate, original decoder/license bytes and isolation
from host CommonJS/AMD/Angular registries. Source/key/plural checks pass with 7,675 messages /
6,117 referenced keys. Full lint/format and final changed-file checks pass. A new browser
page starts immediately in Ukrainian and switches live after synchronous decoding.

Motion equip, class-appearance, fixture, reset and storage-failure notices now retain live
message keys. The real-host regression exercises accepted and rejected test results,
more-specific appearance choices and failed writes. Four language changes per notice
leave stored profile bytes, write/read/request counts, paused coordinates and focused
controls unchanged. The model's reason codes and test-profile format stay canonical.
Corrupt-profile recovery details and other model validation prose remain to be translated.

The previously reproduced three baseline Motion failures are resolved. Auto-mounted shared
tool chrome now destroys its appearance/preferences owner on terminal page departure and
retains it for bfcache. Strict zero-listener terminal assertions remain intact. The harness
now models the separate menu-style preference read performed by that real shared owner;
failed application loading still cannot read or write a collection/game profile. All 74
Motion/collection/content checks and all 49 shared-surface/appearance/preference checks pass.

The complete game validation and presentation-metadata check passed after adding Motion's
copy helper to the distribution inventory. The long Ukrainian v11 card has no horizontal
overflow at a 390-pixel viewport. A new distribution build and native staging are pending;
this remains an incomplete migration, not merge-ready certification.

## v0.114.0 distribution verification and Studio preview labels

Rebased the 25 localization commits onto `dce04f9ea` (the v0.114.0 publication merge).
Its changes are publication records only; no current game, tool, site or build-script
text changed. Immutable publication metadata remains as published.

The compressed-catalog distribution built successfully at `99531f88e` (rebased equivalent
`072178fa2`). All 1,176 distribution files and every offline entry passed hash/size checks.
The core offline inventory contains 1,007 files / 66,552,725 bytes, leaving 556,139 bytes
under the unchanged 64 MiB limit. Its catalog has 14 canonical JSON files and 24 localization
assets in total. The current Motion copy helper and both translation runtimes/licenses
are present in the offline inventory.

Desktop staging and subsequent verification passed for all 1,176 files / 598,542,572 bytes.
iPhone staging with the official bridge and subsequent verification passed for all 1,177
files / 598,612,865 bytes. All 24 localization assets matched the web build byte-for-byte on
both platforms. These are staging checks, not desktop GUI or iPhone simulator tests. Receipts
are retained under `/tmp/rl-i18n/rebase/v114-*`; generated archives/native staging copies were
removed to conserve disk space. An exact core-offline fixture is retained for browser checks;
it deliberately omits optional originals and is not a complete distribution.

A fresh browser origin verifies the packaged v0.114.0 menu, the v11 default route, immediate
English-to-Ukrainian switching and generated Ukrainian credits with the original runtime
attribution links. The previous test origin still served its explicitly prepared older
release, so current-build checks use a fresh origin. Browser cache preparation initially
failed with a Cache API internal write error while the disk had about 220 MiB free; its
retry after freeing generated artifacts is recorded separately below.

Studio difficulty options now share the mission-browser difficulty names and use whole
localized life/speed labels, including Ukrainian plural forms and decimal commas. Frozen
capture explanations and inactive canvas labels translate at presentation time. A locale
change only repaints the last accepted snapshot; it does not recompile the project or rerun
editor synchronization. The underlying capture record and canonical assumption remain intact.

All 25 focused Studio/difficulty/capture tests pass, including live option identity, focus,
unapplied source text, cursor/scroll state, plural counts and identical capture/canvas geometry.
Changed-file lint and formatting pass. Source/key/interpolation/plural checks pass with 7,688
messages / 6,127 references. Browser cross-tab Ukrainian → English → Ukrainian preserves an
unapplied JSON edit, cursor, selected Expert difficulty and the saved checkpoint while updating
both difficulty labels and the capture explanation. The temporary JSON text was restored.
This Studio increment postdates the verified distribution; its next full build is still due.
Other Studio dynamic authoring text and wider migration/test work remain incomplete.

The offline retry succeeded: all 1,007 files verified with no missing or corrupt entries.
With the localhost server stopped, reloading reaches the Ukrainian v0.114.0 main menu and
switching English → Ukrainian still works from the cached catalog. Time remains at 0:00.
The uncached optional Journey picture correctly produces its translated paused/retry notice;
this checks core offline startup/localization, not availability of optional original artwork.

## Studio candidate discovery and checkpoint feedback

Candidate discovery indexes its semantic HTML translation markers in English and Ukrainian,
plus the existing authored keywords, control IDs and route links. Named rich-text slots are
excluded from search terms. Either language can find a study regardless of startup locale;
switching languages updates the result count without rebuilding entries or changing the query.
The library accepts live inspection messages and clears their bindings when the source changes.

Studio's normal checkpoint, current-source, unapplied-edit and inspection messages are now
localized. Registered project names resolve by content identity at presentation time; custom
names and JSON remain authored. Storage/startup recovery sentences translate while underlying
model/browser error details still require the remaining error-localization work.

The initial surrounding run passed 34 of 36 checks. Both failures were in new test cases that
used an internal option value as a search query; discovery has always indexed control IDs and
published route links, not option values. Those cases now use the actual v11 route. All 16
candidate-library checks pass in the final rerun, alongside the 20 unchanged surrounding
Studio/preview/navigation checks from the initial run. This includes both startup locales,
query/result/node identity, focused search input, unsaved source, checkpoint and selected edition,
all Ukrainian count forms, literal authored names and cleared-feedback ownership. Changed-file
lint/format and source/key/plural checks pass with 7,703 messages / 6,140 referenced keys.

A real browser finds the inner-receiver study with a Ukrainian query, retains it across both
language directions, and updates checkpoint/current-draft text. Inspecting an unapplied custom
project name containing Ґ Є І Ї translates the feedback but preserves that name and source.
Editing again clears the accepted inspection; changing language does not revive it or enable
Apply. No inspection was applied or saved, and the temporary source text was restored.

## v0.114.1 Studio board and current pressure

Rebased onto `cdefaef72` (the merged v0.114.1 effective-pressure inspector). Resolution keeps
both authored preview and fresh-attempt pressure inspection, including browser tuning, its
canonical report and its cleanup subscription. The accepted draft is compiled once for both
projections. Locale changes refresh presentation from accepted snapshots only.

Studio now translates mission rules, geometry, actor descriptions, empty states and the new
current-gameplay inspector. This includes every current pressure warning, shared Team lives,
countdowns, relay gates, timed pickups and directional fields. Canonical actor recipes, reports,
identities and source JSON are unchanged. The exact default starter project is registered;
changing its owner, ID or nested map preserves all authored child text. Built-in names are
resolved at presentation time. Ukrainian coordinate pairs use semicolons with decimal commas.

Focused testing covers source/draft/cursor/focus preservation, empty-to-selected transitions,
both difficulty editions and modes, all actor families used by these captions, warning codes
and Ukrainian life plurals (including 0, 11, 21, 22 and decimals). The final affected rerun passes
30/30 tests; previously passing surrounding compilation, capture, combat, emitter, sentinel,
empty-board and current-rules checks remain valid. Two source-contract assertions were updated
for legitimate cleanup additions and HTML whitespace; they still enforce the original behavior.
Changed-file lint and formatting pass; source/key/plural checks report 7,784 messages and 6,213
references. Logs are under `/tmp/rl-i18n/rebase/v1141-studio-board-*` on this validation host.

A real browser on the no-cache source server shows Ukrainian starter names, board facts and
v0.114.1 pressure values. Selecting Expert produces the authored 2-life preview alongside the
actual fresh-attempt 2-enemy projection. Cross-tab Ukrainian → English → Ukrainian changes
both displays while retaining an unapplied JSON edit, focused source control, cursor and Expert
selection. Temporary JSON text was restored without applying or saving a draft change.

This is a source checkpoint, not a full-coverage or merge-ready claim. Dynamic structure/editor
copy, remaining owned errors and wider migration validation are outstanding. The earlier
v0.114.0 build/native receipts do not certify these post-build changes.

## Studio structure and diagnostics

The v0.114.1 board checkpoint passed the full generated-catalog/content-registry check before
this follow-up. Studio structure summaries, ordered pack/campaign/mission outlines, selector
captions, removal dependency guidance and action feedback now use live translations. One item
caption helper serves all three content kinds. Exact built-in owners translate; custom names
and stable IDs remain literal. Diagnostics translate their structured meaning and numeric
coverage facts while retaining the canonical machine code and untouched compiler report.
The outline and manual-geometry queue also have localized accessible names.

The surrounding run passed 53 of 54 tests. Its only failure was a new expectation using a
synonym for the existing Ukrainian archived label; the corrected focused suite passes 6/6.
All 54 cases are covered by those runs, including real structure deletion guards, remote
chamber/relay diagnostics and unchanged authored/source identities. Changed-file lint and
formatting pass. Source/key/plural checks pass with 7,816 messages / 6,245 references.

In-browser cross-tab switching updates summaries, outlines and diagnostics in both directions
while retaining a typed Ukrainian name, its cursor/focus and the chosen parent campaign. Test
fields were restored without applying changes; the saved checkpoint remains 1. The final
reload confirms both accessible names in Ukrainian and no captured console warnings/errors.
Remaining dynamic subeditor text and final whole-project validation are still outstanding.

## Studio contact-bonus editor

Bonus selection/options, guidance, qualification, action/confirmation labels and feedback now
use live translations. The editor reuses board bonus names and the shared item-caption pattern.
Primary authoring failures carry explicit message descriptors; the API still throws the same
TypeError with its canonical English message. UI consumers resolve that descriptor on each
locale refresh. This changes neither valid content records nor serialized errors/identities.
Deeper shared compiler errors remain part of the remaining error migration.

All 6 existing bonus tests and 3 new locale-behavior tests pass. The new tests verify unchanged
option nodes, selection, coordinates, focus/cursor, no draft reads/writes on locale changes,
translated existing failures, unchanged canonical errors, and an armed two-action removal that
remains armed through switching. Changed-file lint/format and source/key/plural checks pass
(7,836 messages / 6,265 references).

Browser validation with an invalid bonus ID displays the corresponding Ukrainian error, then
switches that existing message to English and back from another tab. Typed coordinates, ID and
cursor/focus remain unchanged; draft bonuses remain empty and checkpoint 1 is unchanged. Test
fields were cleared afterwards. Full repository validation is running at this checkpoint;
final builds, native staging and full coverage are not implied by the focused checks.

## Studio actor editor and validation checkpoint

Actor placement now translates pinned role names, tiers, effective speed/cadence descriptions,
placement help, damage/retention facts and counterplay. Role labels reuse existing shared copy;
actor domains reuse the pressure inspector's labels. Message producers capture accepted catalog
and timing facts when the editor is synchronized. Locale changes do not repeat synchronization,
inspect a draft, replace option nodes, reset fields or disarm removal. Primary actor authoring
errors use the same explicit metadata path as contact bonuses; canonical API messages stay intact.

All 30 existing actor/encounter/combat-authoring tests pass. The new catalog matrix verifies the
English counterplay against every pinned catalog role, both difficulty editions, all presets and
both optional-combat states. Ukrainian output has no unresolved keys or invalid numbers. The
initial new UI removal test exposed the minimal DOM fixture's non-browser default selection of
its first nonempty option; explicitly choosing New actor fixes the fixture. All 3 new actor
locale tests pass, with the 13 unchanged board-copy tests also passing. Changed-file lint and
formatting pass; source checks report 7,903 messages / 6,334 references.

A browser verified Ukrainian roles, counterplay, placement instructions and speed tiers. An
unapplied frontier patrol with the brisk tier retains its ID, coordinates, focus and cursor when
another tab selects English. The subsequent Ukrainian validation/reset interaction timed out in
the browser tool; its outcome is not counted as verified. Follow-up inventory and reconnect
calls also timed out. The request contained an invalid ID, so it could not apply a valid actor
change. Browser verification must resume with a fresh state observation, not assumed success.

`npm run validate` completed successfully during this checkpoint: canonical content/assets and
presentation metadata validation pass. Its initial localization phase covered the committed
bonus checkpoint (7,836 messages / 6,265 references); the new actor catalog check is separate.
Log: `/tmp/rl-i18n/rebase/v1141-validation.log`. This does not replace the remaining full-suite,
final-build/native and route-coverage work. Remaining direct Studio copy sites were inventoried
in `/tmp/rl-i18n/rebase/v1141-studio-remaining-copy.txt` for continued migration.

## Studio schedules, combat, objectives and map editors

The branch remains based on main `cdefaef72` (v0.114.1); the latest fetch found no newer main
commits. Timed bonus, combat, objective, directional-field, relay-gate and rectangle editors now
translate their live options, guidance, action/confirmation labels and primary validation.
Direction, surface and bonus names reuse existing shared keys. The coordinate-required message
is shared with the contact-bonus editor. Canonical content models retain English TypeErrors and
attach hidden, immutable translation descriptors, including the objective-to-gate dependency.
No canonical source fields or identity inputs were translated.

All 57 surrounding model/editor/preview tests and 7 new locale tests pass. The new tests switch
both ways with unsaved inputs, focus/cursors, selections, option nodes, scroll position and pending
removal intact; switching makes no draft reads or writes. Existing failures update immediately.
Combat state describes the accepted edition while retaining an unapplied checkbox. Invalid model
commands preserve source data and canonical English diagnostics. Changed-file lint and formatting
pass. Source/key/plural validation reports 8,013 messages / 6,444 references. The preceding actor
checkpoint also passed the complete generated-catalog/content-registry check (7,903 / 6,334).

The browser provider now reports no available browsers; both inventory and opening a fresh local
Studio tab were attempted. Browser verification of this batch is outstanding, alongside the
remaining Studio host/encounter copy, deeper shared compiler errors and whole-project release
checks. This focused checkpoint is not a claim of full coverage or merge readiness.

## Studio Sentinel encounter editor

The previous six-editor checkpoint passed the full catalog/content-registry check (8,013 messages
and 6,444 references). The Sentinel editor now translates its fixed timings and qualification,
core/shield placeholder options, replacement/removal controls, feedback and primary authoring
errors. Actual objective and actor IDs remain authored identifiers. Its 7 existing encounter tests
and all 8 editor locale tests pass (15/15), including a new live-switch test preserving pending
shield links, option nodes, focus, visible model failures and armed removal without draft reads or
writes. Removing after confirmation preserves objectives and map geometry. Changed-file lint
and formatting pass; source/key/plural validation reports 8,035 messages / 6,466 references.

## Studio launch, recovery and export copy

Studio host validation, loading/readiness/retry messages and export feedback now switch in
place. Loading captions use the accepted compiled owner and verify first-party identity before
translating the mission name; later source edits and custom owners retain their authored text.
Structured errors use the same live renderer in subeditors, status and preview recovery. Unknown
host/OS diagnostics are still exposed, so deeper error translation remains an explicit gap.
Platform export outcomes have shared keys selected by status codes; Team campaign counts include
all four Ukrainian plural categories. Neither native result objects nor exported data are changed.

All 42 surrounding Studio launch, readiness, preview and editor tests pass. Three new tests cover
accepted/custom loading captions, existing error retranslation, platform outcomes and counts
0/1/2/5/11/21/22/1.5. The first run's sole failure was a test expecting title case in the canonical
`Nearby shore` name; after correcting that expectation, all 3 pass. Changed-file lint/format pass;
source/key/plural checks report 8,060 messages / 6,490 references. Browser verification remains
unavailable. A new fetch found two main publication commits, which add immutable v0.114.1 release
records but no new game copy; the branch is being rebased onto that publication head.
