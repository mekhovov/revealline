# Enemy Workshop current input qualification

This receipt covers the bounded Phase 6 Enemy Workshop workflow developed on
`73537a4190eea4ec70f15a45e68585407319cfa7` plus the accompanying uncommitted changes.
It does not qualify every authoring tool or a physical controller.

## Capability and change

Enemy Workshop edits registered role availability, presentation family and
detail style. Its behavior descriptions and contact geometry are immutable;
Mission Playground and Content Studio own map/actor geometry editing.

The new collapsed **Catalog choices JSON** section provides a native multiline
textarea and the shared controller draft keyboard. Show current choices reads
the authoritative catalog. Validate and import uses the existing strict
`validateEnemyCatalogDraft` schema and a 64 KiB UTF-8 limit. Rejected source
remains editable and cannot replace the catalog. Imported choices stay unsaved
until the separate Apply authoring choices action. Text controls remain locked
while an active save finishes, including after Stop waiting.

## Automated evidence

Command, Node 20.19.5:

```sh
node --test game/test/enemy-catalog-panel.test.mjs game/test/enemy-workshop-host.test.mjs game/test/enemy-workshop-return.test.mjs game/test/enemy-catalog.test.mjs
```

Result: **60 tests passed**, log `/private/tmp/enemy-current-tests-20260929.log`.
The same cohort also passed **60/60** with Node 22.22.2, log
`/private/tmp/enemy-current-node22-tests-20260929.log`.
ESLint, Prettier and `git diff --check` passed for the owned source/tests.
The full localization check passed with Node 22.22.2: **10,898 EN/UK messages,
8,570 references**, log `/private/tmp/enemy-current-i18n-20260929.log`.
New regressions cover malformed/unregistered/extra-property/oversize JSON,
retained source and model, explicit Save isolation, editor locking, the actual
router's multiline cancellation and committed rejection, and native keyboard
activation in the actual workshop module. Existing tests continue to cover
authenticated preview Return, held Confirm after child ownership, stale import
cancellation, failed storage, startup focus leases, and close/reopen behavior.

These finite DOM tests do not prove browser layout, canvas painting, native
modal Tab behavior, actual file downloads, or hardware input. The keyboard
fixture models text entry at the native textarea boundary and native button /
summary activation; it does not call domain handlers for those commands.

## Current browser workflow

Route: `/game/test/manual/authoring-controller.html?tool=enemyCurrent`.
The fixture sends virtual standard-pad pulses into the production router. It
does not focus or click tool targets or invoke domain commands. Download Blob
observation preserves the real export path. Export bytes must pass the strict
production validator and match the exact persisted catalog. The fixture then
restores the original Enemy localStorage and Playground sessionStorage bytes
as explicitly labeled test cleanup, including absent keys.

The first browser attempt passed the two editing/save rows, then failed to
navigate to Enter preview during child boot/focus handoff. It did not qualify
preview return or export. The corrected runner waits for the actual
authenticated child Return control before entering and permits one bounded
neutral-gate retry during focus handoff. No production preview change was
needed.

On 2026-09-29 the fresh in-app-browser rerun on port 8985 passed all four rows:

1. Registered eroder role, presentation, style and availability changed;
   canceled select/JSON drafts remained unchanged; invalid JSON preserved both
   the catalog and storage.
2. Explicit Save persisted the exact choices; Reload and dialog close/reopen
   retained them.
3. Explicit practice entry and authenticated Return restored the same catalog
   and parent ownership. The actual export passed the strict production
   validator and matched the persisted choices.
4. Fixture cleanup restored exact original catalog and Playground storage.

Export receipt: **`fpv-line-enemy-catalog.json`, 814 bytes**, seven roles,
`enemy-catalog-draft.v1`, SHA-256
`5b94981297d6e4ca394e70374ab087bb635025709f1394ba1797027e066f612e`.
The actual OS-downloaded file was separately checked: **814 bytes**, the same
SHA-256, and seven roles accepted by the production validator. Thus this
receipt includes both exported Blob and OS download verification.

## Native keyboard evidence and limits

Native keyboard route adds `&keyboard=1`; no virtual pad is installed. After
Run established the fixture, native keys changed FPV presentation to Retro,
Hybrid detail to Props, and disabled role availability. Escape/close/reopen
retained the unsaved draft, as designed. Reload saved choices restored the
saved FPV/Hybrid/enabled state. A fresh Retro edit then survived malformed
`{ invalid` JSON rejection, Show current choices, valid import, explicit Apply,
Reload and close/reopen. Try selected role prepared a ready child game.

The fresh keyboard-only preview handoff is **not qualified** by this run. IAB /
CUA retained a stale child accessibility owner after the parent reclaimed DOM
focus to Open workshop. Four subsequent native Tab events were delivered to
the unentered child BODY and correctly prevented; parent DOM focus remained
unchanged. This matches the previously recorded Playground automation boundary.
It must not be represented as a full fresh keyboard-only workflow or a physical
device result.

A separate focused handoff **passed after one pointer reset** on the parent
Enter preview button. Native Return transferred into the child at `shell-menu`
(Return to workshop). Native Tab to Missions, Shift+Tab back, and Return took
the authenticated path back to the same catalog with Role focused. Thirteen
native Tabs reached Export; Return produced the actual OS download
`fpv-line-enemy-catalog (1).json`, **813 bytes**, SHA-256
`462911a9b6fa02005bc73cd36a6c288f993b2d2d19ae2823bc3a591a9867738e`
(observed modification time `03:07:07.205Z`). The production validator accepted
all seven roles, including enabled `bouncer` with `bouncer.retro.v1` skin.
This separately proves native edit/save/export and the focused child Return
path; the one pointer reset remains part of its evidence boundary.

Complete native steps and platform boundaries are in
`game/test/manual/authoring-current-workflows.md`. OS file-picker import,
physical-controller input and a full native-keyboard journey with a reliable
window owner remain separate pending receipts.
