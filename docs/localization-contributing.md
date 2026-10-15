# Localization contributor workflow

Use this guide for a new screen, message or localization fix. The dated
[localization plan](localization-plan-2026-10-15.md) tracks delivery status;
[localization.md](localization.md) has runtime details and historical evidence.

## Keep messages in their canonical files

The editable source is `game/locales/en/*.json` and the matching
`game/locales/uk/*.json`. Use the existing i18next runtime. Do not add a second
translation system, a bilingual JavaScript dictionary, or English fallbacks inside
application logic. Marked HTML may retain its English fallback for initial render.

Choose a semantic key in the namespace that owns the screen. Reuse a common key
only when the meaning and grammar match. Write complete sentences with named
values, not concatenated translated fragments. Supply every interpolation value in
the caller. Counted messages need English `one`/`other` and Ukrainian
`one`/`few`/`many`/`other`, with `count` supplied to the unsuffixed key. Additional
Ukrainian plural forms are expected, not missing English translations.

Keep JSON keys unique, values nonempty strings, and catalogs flat. The catalog
reader rejects duplicate keys before their last value can silently win. Existing
catalog checks also validate both languages, placeholder agreement, plural forms,
unknown references and generated output freshness.

`game/i18n/catalogs.mjs` and `game/i18n/content-registry.mjs` are generated. Never
hand-edit them. Let one owner regenerate them after coordinated catalog edits.

## Bind presentation without changing state

- `t(key, values)` resolves immediately. Use it when a render happens now.
- `localizedMessage(key, values)` keeps a message lazy for supported DOM factories.
- `localizedText(node, producer)` and `localizedAttribute(node, name, producer)`
  repaint a retained element when the language changes.
- Static markup uses `data-i18n`, the matching attribute markers, or
  `data-i18n-rich` with named retained slots.

When a message includes an official mission or pack name, keep the accepted
destination record or identity in state. Resolve its current display name inside
the text producer with `contentText(record, fieldPath)` or the owning library's
`presentation(entry)`. A name translated once while preparing or arming an action
will become stale after switching language. A producer must read the accepted
destination, not a newly selected or mutable replacement.

Imported and user-authored names stay literal. Do not translate their stored
strings, rewrite canonical content to make a UI label change, or use translated
names as identifiers. Save formats, campaign data, replay identities, content
hashes and diagnostic identifiers remain unchanged.

Failures need a player-readable localized message or structured lazy message
descriptor. Keep raw exception details in diagnostics; do not interpolate
`error.message` into player copy as the generic fallback. Retained operation
statuses should use the existing status bindings and resolve their sentence and
official names at render time.

A locale refresh changes text only. It must not arm Skip again, restart
preparation, launch content, alter flight state, write saves, replace an unsaved
draft, change the selected content, move focus or reset scroll. Verify those
properties on affected screens, including success, pending and failure states.

## Make new calls inspectable

The extractor discovers namespaces from the canonical English catalog filenames;
there is no separate seven- or nine-namespace scanner list to update. Prefer a
literal full key. Named imports of `t`, `message` and `localizedMessage`, including
aliases, and the classic `RevealLineI18n.t`/`message` API are recognized.

Simple local wrappers that only add a namespace prefix and optionally forward
the values argument are supported, for example:

```js
const word = (key, values = {}) => t(`controllerEditor:${key}`, values);
word('help');
```

Use a finite constant registry for a state-to-key mapping. Literal conditionals
and immutable object registries are inspectable; arbitrary computed keys are not.
Unknown keys or argument objects appear as `unverified` in the report. They are
neither a proven failure nor evidence that the translation is correct. Add
focused runtime coverage or simplify the call. The scanner is deliberately
conservative and is not a type checker or general program evaluator.

`scripts/localization-sources.mjs` defines maintained source coverage for game,
website, authoring tools, optional practice and native presentation sources,
including classic `.js` files. Explicit library presentation paths are included;
immutable content, vendor code, archived releases, generated/staged copies and
source provenance are excluded. When adding a maintained surface, update this
policy and its fixture if necessary. Do not scan historical media archives merely
to increase a coverage count. In sparse worktrees only absent `skip-worktree`
sources are read from the Git index; ordinary local deletions stay deleted.

## Check the change against an explicit base

1. Confirm the release coordinator's ownership and approved base. Preserve the
   primary checkout and use the assigned isolated worktree. Fetch main before
   editing and again before final qualification when authorized by that lane.
2. Run `npm run i18n:extract`. Review `references`, statically provable caller
   `issues`, `unverified` dynamic calls, registered content and missing messages.
   Extraction reports findings; it does not rewrite catalog sources.
3. Edit both language catalogs and presentation bindings. Review the raw-copy
   inventory with `npm run i18n:audit`; metadata, errors and authored values need
   judgment and are not automatically product text.
4. Run `npm run i18n:build`, then `npm run i18n:check` after the catalog owner has
   finished the edits. Run focused tests for the behavior changed.
5. Run `npm run i18n:check:changes -- --base <approved-base-sha>`. This read-only
   check compares the committed base with the current working tree, including
   untracked maintained sources. It never chooses a base, fetches or rebases.

The change check fails newly introduced high-confidence raw DOM/HTML/attribute,
canvas/option and translation-interpolation copy, unknown literal keys, and
statically provable missing interpolation values. Existing occurrences are
counted against the base; adding another occurrence is still new debt. Changing
an English message's required values, adding plural requirements or removing keys
rechecks unchanged callers too; wording-only changes do not. Broad metadata,
technical errors and uncertain strings remain advisory in the raw audit.

An exceptional immutable literal may use a real adjacent comment:

```js
// i18n-allow: Original license title reproduced verbatim.
attribution.textContent = 'Original license title';
```

An equivalent HTML comment works. A nonempty reason is required, applies only to
the same or next line, and is retained in `exceptions` for review. Do not use this
to exempt owned product prose or a whole directory. Message strings that look
like comments do not create exceptions.

Exit success means there are no new provable failures. A
`passed-with-manual-review` status still has dynamic calls requiring evidence;
even `passed` is not full runtime or translation acceptance. The explicit-base
check is a separate command, not an implicit addition to every build or existing
CI job. A release lane should invoke it with its actual reviewed base.

For changes to the tooling itself, run:

```sh
node --test scripts/test-localization-guards.mjs scripts/test-localization-audit.mjs scripts/test-localization-bundles.mjs
```

On the final cumulative source head, record actual English/Ukrainian live-switch
results, custom-name preservation, Ukrainian glyphs and wrapping, compact and
large-text layouts, static/offline output and native staging as required by the
release plan. Mark unrun or timed-out checks as unverified, with the reason. A
tooling timeout is not a product failure or a passed check. Screenshots, audio and
other acceptance evidence must identify the source they cover. Release numbering,
merging, tags, publication and release metadata belong to the release coordinator.
