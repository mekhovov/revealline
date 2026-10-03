# World Studio package dependency closure

World Studio inherited three Academy-era admission entries that its application does not load: `civilian-fpv/copy.mjs`, `civilian-fpv/studio.mjs`, and `game/key-bindings.mjs`. Its own `world-app.mjs` supplies UI copy and the World editor; its FPV input runtime owns the flight/menu bindings. The older shared key helper remains used by Civilian Flight.

The policy now excludes these three paths **only from `fpv-worlds`**. Their repository files and the Academy/Civilian Flight packages remain intact. All source text, licenses, provenance, imagery, scenes, demonstrations, Snake content and shared appearance code are preserved. No byte or file-count limit changes.

## Functional qualification

The [receipt](evidence/fpv-world-package-closure.json) binds the policy and actual build inputs on HEAD `7d64e9ba8adbab90f731eb964e1ef138323868b5`. This is mutable working-tree evidence, including the concurrently prepared optional-example host. Frozen-mode construction supplied that HEAD/tree to the normal builder; it is **not** a claim of committed-input or release qualification.

| World artifact                     |                                                 Before |                    After |     Existing limit |
| ---------------------------------- | -----------------------------------------------------: | -----------------------: | -----------------: |
| Development runtime                |                                97 files / 14,365,093 B |  94 files / 14,317,834 B | 104 files / 16 MiB |
| Runtime with installation launcher |                    105 files / 14,522,699 B — rejected | 102 files / 14,475,440 B | 104 files / 16 MiB |
| Source archive                     | 107 files, derived; runtime guard stopped construction | 104 files / 14,508,974 B | 104 files / 16 MiB |

The source count includes the committed worker and launcher templates plus `source-inventory.json`, in place of the runtime's `optional-package.json`. Fixing only one runtime file would still leave the source package oversized.

The initial in-memory policy proposal and then the actual edited policy passed the unchanged `buildOptionalPractice → createOptionalPackageCandidate → validateOptionalPackageAdmission` flow for all three packages, with ZIP members verified. Academy remains 67 runtime / 69 source files; Civilian Flight remains 35 / 37. Their package bytes and revisions match the before measurement. The dependency audit follows static imports, re-exports, literal dynamic imports, and HTML/CSS references from the World entry and guide. The normal builder independently rejects any reference outside the explicit admission list. Launcher navigation/context and all required documentation remain admitted.

The actual source archive has **no spare file slots**. Future modules require another reviewed dependency or packaging change. The syntax, ESLint and formatting checks for the policy pass. Browser acceptance, physical devices, release publication and additional unit coverage are separate; none is claimed by this change.

## Independent company-edition blocker

The company engine closure has 804 files and **zero FPV runtime files**. The largest `droneaid-nl-community` edition still fails the unchanged 64 MiB guard at 899 files / **67,134,498 bytes**, an overrun of **25,634 bytes**. Filtering World admission entries, or repacking World demonstrations, cannot reduce this separate output. This change neither fixes nor bypasses that guard. No history-referenced asset was recompressed and no global JSON projection was added.

### Actor expansion follow-up (3 October 2026)

The preceding numbers belong to the historical receipt, not the current tree.
The normal `collectEditionEngineFiles → collectEditionSelectedFiles → compileEdition`
pipeline was measured again for `droneaid-nl-community`, with its offline launcher,
version `v0.142.4`, and the same manifest source-revision label for comparison.
The baseline uses exact Git blobs from `66d83c4249cfa0240b9fedf95baa176c74fcc20b`;
the two expansion measurements use mutable source. These are capacity and source
validation results, not frozen-input release or gameplay qualification.

| Company output                       | Files |      Bytes | Over unchanged 64 MiB limit |
| ------------------------------------ | ----: | ---------: | --------------------------: |
| Main baseline (`66d83c424`)          |   921 | 67,423,717 |                     314,853 |
| Actor expansion before closure fixes |   932 | 67,603,307 |                     494,443 |
| Actor expansion after closure fixes  |   931 | 67,559,900 |                     451,036 |

The expansion originally added 179,590 compiled bytes. The scoped fixes remove
43,407 bytes; 136,183 bytes of additional supported gameplay/presentation code
remain. **The largest Company edition is still rejected.** Its inherited size
failure is not waived and the 64 MiB limit and brand assets are unchanged.

The new 48 actor speech clips total 868,186 bytes and were never in the approved
Company asset closure. Previously the copied actor catalogue nevertheless
advertised those absent URLs. A declared Company runtime adapter now exposes no
built-in actor originals, so they cause no missing-asset requests. Actor captions,
visuals, all 16 existing pilot originals, and locally imported custom recordings
remain supported. Built-in actor speech in Company editions requires a future
separately admitted optional recording pack. The canonical game and FPV speech
catalogues are unchanged.

The Snake hub reads only optional FPV course titles, playlist titles and launch
IDs. A source-pinned build projection now copies exactly that menu metadata,
instead of including unused flight geometry and the expressive-course rules in
every Company edition. The canonical FPV package retains those rules. The
Company engine inventory has 836 files; its single FPV-named module emits menu
metadata only. Closure, selected assets and source eligibility validation reached
the final unchanged capacity guard. Relevant regressions were authored but not
executed under the current automated-suite waiver; scoped ESLint and formatting
checks passed.
