# Round 04 verification record

Checked 12 September 2026 against the files in this workspace. These are authoring-tool and content-contract checks. There is no playable game build to test yet.

| Check | Result | Evidence / boundary |
|---|---|---|
| Four example packs | 4 passed draft validation | `python3 authoring/scripts/validate_pack.py`; every asset remains planned |
| Contract regression checks | 27/27 passed | `python3 authoring/scripts/validate_pack.py --self-test`; includes invalid refs, primitive parameters, missing capabilities, unreachable pockets, crop/frame metadata and ready-file tampering |
| Independent JSON Schema validation | Passed | Maintained `jsonschema.Draft202012Validator` checked the pack schema, 14 parameter schemas, four examples and 32 primitive invocations |
| Ready gate | Correctly rejected current drafts, exit 1 | `--mode ready` reports planned assets and unmet ready metadata; this is the expected result |
| Skill package validation | 5/5 passed | Official skill-creator `quick_validate.py` run on all five source folders |
| Skill UI metadata | 5/5 passed | YAML parsed; short descriptions 25–64 characters; default prompts invoke their own `$xonix-...` name |
| Local skill installation | 5 links created | `python3 authoring/install-skills.py --install`; sources retained in project; existing unrelated skill paths untouched |
| Prompt catalog | 56/56 parsed and rendered | Eight per family plus 24 shared; unique IDs; declared variables match tokens; all edit prompts have reference requirements |
| Prompt failure handling | Passed | Missing, unknown, empty, duplicate and unresolved variable cases rejected; six successful/error CLI cases checked |
| Independent skill usability | Two scenarios exercised | Carpathian watercolor/photo reskin and five-level ordered-supplier challenge; see the [forward-test report](round-04-forward-test.md) |
| Generated concept | Produced and visually inspected | [Comparison board](../../docs/concepts/round-04-theme-system.png); [effective prompt and caveats](../../docs/concepts/round-04-theme-system-prompt.md) |

The official skill validator required PyYAML; the independent standards check required jsonschema. Both were installed only in a temporary virtual environment at `/tmp/xonix-skill-check-20260912`. They are not dependencies of the project's standard-library authoring commands.

## Issues found and resolved

- Prompt defaults could override a requested watercolor chapter or level count. The catalog/guide now explicitly require adapting defaults; painterly medium and level count are variables in the shared prompts. All affected skills repeat that the user's request and current contract take precedence.
- A reskin could accidentally inherit a different fill policy from another example. Theme Designer now requires an explicit source/output comparison of rulesets and gameplay fields.
- The ordered-supplier scenario exceeded the existing primitive catalog. The skills produced a separate extension brief; they did not claim a new goal ID would execute.
- Initial forward testing started while `CONTRACT.md` and `prompt.py` were being assembled. Both were subsequently read/run; those temporary gaps are resolved.

## Remaining proof

No dynamic cut/enemy simulation, real sprite animation, audio playback, target-device performance, controller/touch interaction, actual editor import, procedural generator, cache update or save migration was tested. Planned background files, soundtrack briefs and concept montages are not a complete production asset set. Structural validity and attractive concept art do not establish level fairness, accessibility or replay appeal.
