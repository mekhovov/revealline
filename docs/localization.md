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

- Translate the remaining tools catalog and all uncatalogued dynamic sentences.
  Inspect `game/studio`, classic `.js` tools, generated current-version pages, and
  user-facing errors; extraction of existing keys alone is not a raw-text coverage audit.
- The registry now includes the current default authored Journey and Team sources,
  compiled executions, navigation records, cards and manifest design fields. These
  catalog entries are translated. Finish their presentation adapters; add maintained nondefault editions,
  optional first-party packs and derived Classic metadata. Preserve hashes.
- Finish live bindings for derived labels, statuses, canvas text, dropdown options, and
  presentation adapters. Check unsaved editor data, selections, focus, and scroll.
- Verify offline inventories and native staging after the remaining catalogs pass.
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

The focused localization/library/startup/generated-page suite passes 118 tests. A further
29 boot/briefing checks pass (46 with locale and generated-page checks after formatting),
including live Ukrainian rule-derived briefing text while
preserving custom-authored text. Full lint and the full formatting check pass.
Browser checks confirm Ukrainian Journey-name search, retained mode controls, restart
persistence, cross-tab refresh without clearing typed search, translated current Journey
route/mastery text, live menu counts and destination labels, and Ukrainian startup status.
The main branch was fetched again and remains fully included (524c989c2).

Catalog validation deliberately fails for **724 missing Ukrainian tool messages**. The
current interface and registered content catalogs are fully translated. This is not yet
full game coverage: the browser still exposes raw current-Journey difficulty prose,
Classic library metadata, and an unregistered theme currency label. Other dynamic/tool
surfaces need auditing. Do not declare completion from catalog coverage alone.

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
