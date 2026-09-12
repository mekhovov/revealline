# Round 07 authoring integration checks

Executed 12 September 2026 from the project root. These results cover prompt tooling, skill packaging, installation and existing authoring regressions. They do not certify game-runtime integration, completed animation assets, a played production clip, actual audio, collision, responsiveness or device performance.

## Changes under review

- Added the 16-template [animation supplement](../prompts/round-07-animation-variants.md) to `authoring/prompt.py`: **88 templates**, comprising 56 base + 16 asset-variation + 16 animation templates. The base catalog retains 28 additional variation options.
- Added **xonix-animation-director** to the installer, removed its stale fixed skill-count docstring and updated the kit/prompt guides. The six existing skills now consult Animation Director when their requested work involves motion, synchronized cues or playback review.
- Added [Round 07 reference lessons](../REFERENCE-LESSONS.md) from the [Reloaded motion/UI audit](../../docs/research/round-07-reloaded-ui-motion.md): small bright head, independent live cut, compact/detailed/hybrid appearances, progress-preserving loss/respawn, medal expiry distinct from failure, and separate gallery/artwork/results states. Fast-repeat and reduced-effects treatments remain proposed choices.
- Linked the [current direction](../../docs/round-07-motion-and-balance.md), [motion lab](../motion-lab/README.md) and [live viewport comparison](../../docs/concepts/round-07-device-preview.html). The viewport comparison is a browser preview, not an iPhone emulator.

No content schema, primitive implementation, base prompt contracts, pack data or media CLI implementation was changed by this integration.

## Executed checks

| Check | Executed scope | Result |
|---|---|---|
| Catalog and placeholders | Imported `authoring/prompt.py`; loaded all three JSON catalogs; checked 88 unique IDs, unique variable declarations and exact token/variable agreement | Passed: 56 + 16 + 16 |
| Prompt rendering | One local `python3` harness launched `python3 authoring/prompt.py render ID` for each of the 88 records, with every declared `--set NAME=value`; compared stdout with `render()` plus its CLI newline and rejected remaining template delimiters | **88/88 passed** |
| Negative CLI behavior | Nine invalid calls listed below; each required exit 2, empty stdout and `Prompt error:` on stderr | **9/9 passed** |
| Literal text preservation | Rendered a value containing Ukrainian text, a newline, literal `$HOME`, `$(do_not_run)`, backticks, single braces and multiple equals signs through a subprocess argument list | Passed; text retained without shell interpretation |
| List/show integration | `python3 authoring/prompt.py list` and `python3 authoring/prompt.py show animation-02-state-contract` | 88 listed records; selected JSON record returned |
| New-template content checks | Checked every Round 07 prompt length and execution-status field | 16 templates remain `template_not_executed`; shortest prompt is 132 words |
| Official Skill Creator validator | Ran its `scripts/quick_validate.py` for each of the seven `authoring/skills/xonix-*` directories | **7/7 passed** |
| Authorized installation | `python3 authoring/install-skills.py --install` | Six existing correct links retained; seventh skill installed |
| Draft content examples | `python3 authoring/scripts/validate_pack.py` | **4/4 drafts passed**; 41 planned assets remain explicitly planned |
| Pack validator regressions | `python3 authoring/scripts/validate_pack.py --self-test` | **27/27 passed** |
| Media regressions | `python3 -m unittest discover -s authoring/media -p 'test_*.py' -v` | **24/24 passed** |

The negative cases were: a missing required variable, an unknown variable, a duplicate assignment, an empty value, an assignment without `=`, unresolved `{{...}}` delimiters inserted into a value, an unknown prompt ID, an unmatched family filter and an unmatched asset-type filter. Animation prompt `animation-01-component-map` exercised the render failures. These are text/tool checks; no template was sent to an AI model during this verification.

Official skill validation used the existing Python environment `/tmp/xonix-skill-check-20260912/bin/python` and validator `/Users/oleksandr.mekhovov/.codex/skills/.system/skill-creator/scripts/quick_validate.py`. The seven validated sources are Theme Designer, Asset Creator, Level Designer, Audio Director, Pack Reviewer, Background Stylist and Animation Director. This verifies package structure/frontmatter, not the quality of hypothetical future executions.

Installation created `/Users/oleksandr.mekhovov/.codex/skills/xonix-animation-director` as a link to this repository's versioned source. The other six links already pointed to their correct source directories. No existing path was replaced. A client may need to refresh its skill catalog before discovering the new entry.

After the Animation Director's CLI guidance was updated, its official validator was run again and passed. A read-only `python3 authoring/install-skills.py` then reported all seven skills linked.

After the motion-lab handoff, the root's final Markdown link audit checked **155 local references across 23 documents**: kit/prompt guides, all skill Markdown, Round 07 evaluations, direction, visual review, lab README and research audit. Every target exists; no missing local link remains.

## Interpretation and remaining proof

The new templates and skill make motion work reviewable: independent component IDs and anchors, state priority/cancellation, clock choice, source provenance, actual occupied pixel size, reduced effects and proposed versus measured device budgets. They require playback of an assembled clip before a claim that animation was reviewed. A generated contact sheet is still a keyframe artifact.

No game or production animation playback was performed by these authoring integration checks. The lab's own tests and browser review belong to its separate evidence, and must be read before making claims about that preview. Native iPhone, controller, engine integration, audio playback and hardware performance remain outside this record. Existing draft validation explicitly does not establish solvability, image decoding, enjoyment or retention.
