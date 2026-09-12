# Round 09 — abilities, equipment and world references

Twenty new templates bring the shared CLI to **124** templates. They are reusable instructions, not executed AI runs. Four actual new body generations are separately recorded in [the asset provenance](../../docs/concepts/round-09-generated-prompts.json).

Use [Ability Designer](../skills/xonix-ability-designer/SKILL.md) for class/equipment mechanics, [Character Collection](../skills/xonix-character-collection/SKILL.md) for cosmetic ownership, and the actual [motion/ability lab](../motion-lab/README.md) for accepted configuration. A curated military reference entry does not establish an implemented enemy or production asset.

| Template | Purpose |
|---|---|
| `ability-01-reference-taxonomy` | Build an expandable sourced reference catalog |
| `ability-02-class-components` | Separate classes from bodies and equipment |
| `ability-03-bomber-pickup-drop` | Specify a fictional pickup and drop loop |
| `ability-04-fiber-module` | Make fiber a swappable equipment module |
| `ability-05-scout-reveal` | Design a scan that supports territory decisions |
| `ability-06-strike-intercept` | Specify bounded strike and intercept actions |
| `ability-07-net-emitter` | Compare a capture net and projectile emitter |
| `ability-08-fixedwing-identity` | Create an original fixed-wing body concept |
| `ability-09-heavy-rotor-body` | Create a carrier body with a specified motor layout |
| `ability-10-equipment-attachments` | Create interchangeable readable equipment concepts |
| `ability-11-ground-role-mapping` | Translate equipment references into game roles |
| `ability-12-personnel-objectives` | Design distinct military and support role markers |
| `ability-13-ew-and-radar` | Design readable signal and detection challenges |
| `ability-14-world-silhouettes` | Create a family of original world-role silhouettes |
| `ability-15-four-theme-remap` | Carry one ability across all four themes |
| `ability-16-teaching-challenges` | Plan a readable ability-learning sequence |
| `ability-17-class-progression` | Reward play styles without conflating skins and power |
| `ability-18-ability-integration` | Review event order and ownership of ability effects |
| `ability-19-ability-visual-review` | Verify actual body and ability switching |
| `ability-20-catalog-maintenance` | Update references without silently changing balance |

```sh
python3 authoring/prompt.py show ability-03-bomber-pickup-drop
python3 authoring/prompt.py render ability-04-fiber-module --set 'LINK_BRIEF=radio and fiber presets for scout and carrier classes; synthetic display haze only'
python3 authoring/prompt.py render ability-15-four-theme-remap --set 'PRIMITIVE_BRIEF=one charge picked up at a supply pad and delivered at an objective'
```

Keep class, equipment, cosmetic body and turn policy explicit in tests and future challenge/result identities. Research dates and maker claims are separate from fictional tuning. No template invokes AI automatically or grants permission to invent runtime support.
