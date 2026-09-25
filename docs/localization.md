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
available to ES modules through `game/i18n/index.mjs`.

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
- Finish native staging and route checks against the latest rebased build.
  Generated privacy/credits pages and current-entry aliases now load the same local
  runtime, use translated messages and retained attribution links, and rewrite root
  asset paths. Historical frozen releases stay unchanged.
- Review shared keys and Ukrainian grammar, especially reused nouns/adjectives.
- Run full validation, lint, formatting, tests, builds, native staging, and route checks.
  Current-main baseline checks reproduce the legacy session-v4 expectations against
  session-v6 output and the old 201-mission expectation against 279 available missions.

The active checkout's temporary sparse exclusions have been removed. The full suite
is running, with failures still under investigation. A clean main checkout reproduces
the Team Studio initial-state hash mismatch, Custom-pack chooser timeout, Team artwork
registration failure, combat study's missing `player-locator.mjs` dependency, controller
snapshot-key mismatch, Team terrain missing-exception assertion, continuous-host
session-version mismatch, default-entry mission-count mismatch, and the Controller
practice teardown storage-listener assertion. The First Flight
handoff timeout is intermittent here and remains unresolved; do not dismiss it as a
baseline failure.

At this checkpoint, catalog validation passes **6,954 messages and 5,598 referenced keys**.
The current interface, content, and tools catalogs are fully translated. This is not full
coverage: the source audit still finds dynamic messages, Classic library metadata, tool
JavaScript, and user-facing errors outside the catalogs. Do not declare completion from
catalog coverage alone. Twenty-nine reviewed repeated meanings now use common keys.

The latest focused suite passes 59 locale, paused-flight, presentation, source-audit,
registry, and generated-page tests. Native staging/resource tests pass 23 cases; markup
integration checks pass 58 cases. Validation, lint, and the full formatting check pass.
The full suite remains active; its older failures require focused reruns after fixes and
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

Main advanced by 24 commits to eca4e32ba during this checkpoint. Rebase this saved work
before continuing translation, regenerate catalogs, and rerun affected checks.

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
