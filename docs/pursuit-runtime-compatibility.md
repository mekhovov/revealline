# Pursuit runtime and chapter drafts

The optional **Running targets → Original / Varied** preference prepares a new attempt. Retry and restore retain the accepted population, behavior goals, scoring and seed. Blood, actor cast, remains and other presentation preferences never determine enemy policies.

## Version boundaries

- Original Capture running-enemy recipes remain `xonix-level.v10` / `xonix-core.v11` / replay v12. Existing authored Hunt recipes retain their old interpretation.
- Varied Capture pins `xonix-level.v12` / `xonix-core.v13` / replay v14, with `pursuit-goals.v1` accepted definitions and runtime phases in checkpoints.
- Varied Team pins level v11, rules v13 and pack v11. It inherits the exact prior Team edition, including native stronghold, support, impact and Hunt rules where present.
- `running-enemies.v2` inside these successors means an existing authored Hunt population is retained exactly. It does not replace guards or change required quotas.
- RunningEnemyPreferencesV2 uses a new storage key, reading V1 without rewriting it. Unfinished Team pursuit saves use team-hunt-attempt v3 or installed-team-attempt v5. Older records remain explicitly dispatched.

`MissionDesignV5` owns a `mission-pursuit.v1` policy with finite actor positions and bounded goals. The compiler preserves the referenced map's relay/directional capabilities and encounter presence. Team remains separately qualified; unsupported Solo mechanics are rejected rather than silently projected.

Ordinary Varied derives only Runner, Patroller, Refuge and Switchback policies. Pair routes require explicit partners. Explicit Courier routes carry parcel visuals and pause for six simulation ticks at delivery checkpoints; they remain optional quota-zero Bonus targets with standard 100-contact/50-enclosure Hunt points. Shield and Brace are explicit mission specialists, never automatically added by the global overlay.

## Content entry points

- Capture Solo: `/game/?journey=pursuit-campaigns-v1`
- Capture Versus: `/game/couch/?journey=pursuit-campaigns-v1`
- Team: `/game/couch/relay-rescue.html?journey=pursuit-campaigns-v1`
- Three initial prototype layouts remain separately available through `journey=pursuit-pilots-v1`.

`createPursuitCampaignCandidates({team})` returns the source catalogue. `createContentExecutionCatalog(source,{mode})` resolves exact campaign recipes and manifests for each difficulty. Online/private-room or installed-content consumers must use these accepted recipes, not reconstruct layouts from IDs or labels.

The full draft contains 24 Solo/Versus and 36 Team missions. Each owns explicit wall openings, safe islands and target routes. The 60 wall/foundation configurations are distinct. Specialist Circuit contains six Shield/Brace missions. Return Workshop contains six actual native anchor/core objectives, using TeamMissionV9 source data compiled through the existing foundation v2 stronghold engine; the source format does not invent new relay physics. Other chapters retain coverage completion and optional Hunt rewards.

## Validation and release limits

Production compiler admission and gameplay-tuning validation completed for all 72 Solo, 72 Versus and 108 Team difficulty recipes. Formatting and scoped lint completed. Relevant regression sources cover version separation, replay authority, behavior recovery and topology blockage, Team restore, preference migration, explicit specialists, authored guards and required strongholds. Automated suites were not run under the repository waiver.

These are playable content drafts, not human-qualified releases. Catchability, cooperative coordination, maximum-population frame cost, small-screen readability, difficulty pacing and mastery routes still require play review. New mission titles, chapter labels, briefings, mastery descriptions and native mission cards have English/Ukrainian exact-record translations. Locale changes preserve accepted source and replay identities. Studio round-trips accepted pursuit and Team stronghold source data; the pursuit panel edits actor routes, not native stronghold geometry.
