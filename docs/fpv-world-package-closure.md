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
