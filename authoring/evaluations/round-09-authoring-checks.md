# Round 09 authoring checks

12 September 2026. This records executed skill, prompt and isolated ability-authoring checks. It does not establish production territory gameplay, complete assets, real progression, tested enjoyment or physical-device performance.

## Scope and guide updates

- Reviewed the new [Ability Designer](../skills/xonix-ability-designer/SKILL.md), its [handoff reference](../skills/xonix-ability-designer/references/ability-handoff.md), the actual [ability data](../motion-lab/ability-presets.json), [pure evaluator](../motion-lab/ability.mjs), [lab README](../motion-lab/README.md), and the existing authoring contract/gameplay plan.
- Updated the kit and prompt READMEs to **nine skills / 124 templates**, linked the Round 09 direction, reference atlas, ability workflow and this record, and corrected “a implemented” to “an implemented” in the Round 09 prompt guide.
- Kept gameplay class/equipment selection separate from cosmetic ownership, body/attachment choices and the configurable turn policy. The new lab registry remains independent of the existing pack/media formats.
- This authoring subtask did not edit runtime code, ability presets, gameplay fixtures, schemas or media tools. It created no images, audio or animation. A separately requested research follow-up added sourced infantry/patrol and drone-operator role categories to the ground reference catalog, bringing it to 34 entries; these remain reference-only.

## Executed package and prompt checks

| Check | Execution | Result |
|---|---|---|
| Catalog loading | Loaded the base catalog plus Round 06, 07, 08 and 09 supplements through `authoring/prompt.py`; checked unique IDs, unique declared variables and exact placeholder agreement | **124 records passed** |
| Full CLI rendering | A local Python harness invoked the actual `prompt.py render ID --set NAME=value` command for every template through subprocess argument lists; compared output to the renderer | **124/124 passed** |
| Invalid input | Missing, unknown, duplicated, empty and malformed assignments; unresolved delimiters; unknown ID; unmatched family/type | **9/9 rejected** with exit 2, empty stdout and `Prompt error:` stderr |
| Literal text preservation | Rendered Ukrainian text, a newline, literal `$HOME`, `$(do_not_run)`, backticks, single braces and repeated equals signs | Preserved as text; no shell evaluation |
| Discovery | Ran `prompt.py list` and `show ability-03-bomber-pickup-drop` | **124 listed**; expected JSON returned |
| New supplement | Inspected all 20 `ability-*` templates and checked their state | **20 templates**, 79–107 words each, all `template_not_executed` |
| Official skill validation | Ran Skill Creator's `quick_validate.py` on all nine source skill directories, including new Ability Designer and changed Character Collection, Level Designer and Pack Reviewer | **9/9 passed** |
| UI metadata | Parsed all nine `agents/openai.yaml` files; checked nonempty display names, 25–64-character short descriptions and explicit `$skill-name` in each default prompt | **9/9 passed**; normal implicit discovery retained |
| Authorized installation | Ran `python3 authoring/install-skills.py --install` | Eight correct links retained; ninth skill installed without replacing an existing path |
| Ability regression suite | Ran `node --test authoring/motion-lab/test-ability.mjs` | **19/19 passed** |
| Independent authoring forward test | Ran a temporary Node harness against the actual pure evaluator and an in-memory configuration copy | **15/15 scenario checks passed**, detailed below |
| Final guide/skill references | Resolved local Markdown links in ten touched/relevant guides, skill entrypoints and handoffs after the Round 09 root document landed | **127/127 local links resolved** |
| Reference follow-up | Checked 34 unique ground-catalog IDs, normalized atlas fields, access dates, source URLs and the two added personnel categories | **34 entries / 34 primary URLs**; both new roles keep empty operator arrays and reference-only status |

The prompt/skill harness used `/tmp/xonix-skill-check-20260912/bin/python` and the official validator at `/Users/oleksandr.mekhovov/.codex/skills/.system/skill-creator/scripts/quick_validate.py`. Its [temporary JSON report](/tmp/xonix-round09-authoring-hhj6r1fe/prompt-skill-report.json) retains the executed counts and case names; temporary files may later be removed by the host. The essential results are recorded here.

Installation created `/Users/oleksandr.mekhovov/.codex/skills/xonix-ability-designer` as a symlink to the versioned workspace source. The prior eight source links were preserved. A client may need to refresh its skill catalog to discover the new skill.

Skill Creator's validator checks package structure, naming/frontmatter and unfinished scaffolds. Metadata checks add discovery checks, while the forward test below examines a concrete workflow. Neither guarantees every future agent decision. Local template rendering does not send prompts to a model; the 124 templates remain reusable examples rather than 124 executed AI runs.

## Independent ability-authoring forward test

The independent review applied the new skill to this bounded request: **try a three-charge heavy carrier with a smaller fictional fiber budget, retain separate cosmetic/turning choices, and reject a requested unregistered ability**. The actual lab README was inspected for current class, input, reset, link and movement semantics; the module and its validator determined the accepted fields.

The [temporary harness](/tmp/xonix-round09-ability-forward-legacy5.mjs) imported the actual evaluator and created a structured clone of its checked-in definitions. Only that in-memory copy changed:

```json
{
  "classId": "heavy-carrier",
  "capacity": 3,
  "equipmentId": "fiber",
  "budgetCapacity": 18,
  "costPerCell": 0.5
}
```

This is an experiment summary, not a complete accepted configuration file. The harness changed the corresponding existing class/equipment fields and validated the full copied document. It retained the `drop` primitive, zero initial carrier charges, one charge per action, existing cooldown and marker domains. The quantities are fictional game units. No preset file, save, browser storage or collection profile was modified.

All 15 checks passed:

1. The existing registry accepted the alternate carrier capacity/link tuning without changing the source definitions.
2. The carrier began empty; distant pickup rejected without mutating the supplied prior state or filling charges.
3. A nearby supply-pad pickup filled exactly three charges and the alternate link budget.
4. A drop updated an eligible ground marker and spent one charge; airborne markers remained unchanged.
5. Cooldown, pause and duplicate input prevented another spend. Pause froze the toy state.
6. Legal misses still spent charges; an empty attempt rejected without a negative balance.
7. Returning to a supply pad refilled the authored three-charge/18-unit loadout.
8. An unknown `teleport` primitive and an unsupported primitive/outcome pair failed validation.
9. Capacity beyond the validator's accepted bounds and unknown equipment were rejected.
10. Changing the preferred body and adding decorative heading, scale, blade-count and terrain-style inputs produced identical ability results **within each turn policy**. The supplied player object remained unchanged.
11. The policies were preserved rather than normalized: the same dash from x=6.9 ended at x=10.9 in immediate mode and x=10.5 in grid-center mode for this fixture.
12. Explicit class/equipment switching removed transient fields/projectiles/effects, reset the toy resources and preserved event deduplication. It added no cosmetic ownership field.
13. Radio/fiber changed only the synthetic signal-display readout in the tested haze case; body/movement data were unaffected.
14. Toy completion exposed no captured-area, real-level-result or cosmetic-unlock state.
15. SHA-256 comparisons confirmed the actual source module and checked-in ability definitions were unchanged during the run.

The [temporary result record](/tmp/xonix-round09-ability-forward-legacy5.json) retains the scenario names and source hashes. After the module author finalized the ability data and README, the forward test passed again against module hash `287f08add0aacfaf7f5ecb7bf686179f25716c489dbfaa3dc1a54e339af6daf5` and ability-preset hash `05e956de444eb4ff0ff9867f8438b5dcf18702868d42bf781a98ff7e92d7858a`. Final checks also re-rendered all 124 templates, revalidated all nine skills/metadata files and verified all nine installed symlinks.

The separate 19-test ability suite additionally exercises timed scan expiry, relay/delivery filtering, valid dash centers, outbound-only fiber dash charges, projectile swept contact order, net dwell/expiry boundaries, frame-rate comparisons and authoritative reversal-distance budgeting. These are pure module tests. They do not prove browser key/touch behavior, focus cleanup, rendered body switching or physical-device usability; those require the main demo's separate interaction review.

No new concrete defect was found in this bounded authoring workflow. The evaluator's internal functions assume a validated configuration and appropriate simulation context; these checks do not certify an arbitrary untrusted-object API or an authenticated production results service. The skill correctly routes an unsupported primitive to a separate implementation proposal instead of inventing accepted data.

## Remaining boundaries

Pack and media regressions were not repeated in this subtask because those tools/contracts were untouched. Their previous evidence remains historical in the earlier evaluation records. No full game implementation, production ability adapter, territory fill, damage system, real unlock event, exportable sprite atlas or finished animation is established by these authoring checks. The source catalogs and generated concept work have their own provenance/review records.
