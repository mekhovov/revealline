# Team image preparation in the release host

The shared `createPresentationHost` must prepare every registered Team image before a painter can adopt its snapshot. Asset Studio has a separate inspection decoder; a successful Studio preview alone does not prove the published game's image-loading path.

[TEAM_RUNTIME_IMAGE_SLOTS](../game/presentation/team-runtime-slots.mjs) is the exact code-owned allowlist for **42 roles across eight families**:

| Family                                | Roles | States                                                                                               |
| ------------------------------------- | ----: | ---------------------------------------------------------------------------------------------------- |
| [Anchors](team-anchor-authoring.md)   |     2 | Available, captured                                                                                  |
| [Relay cores](team-core-authoring.md) |     3 | Shielded, exposed, secured                                                                           |
| [Support](team-support-authoring.md)  |     2 | Support pulse, slowed enemy                                                                          |
| [Emitters](team-emitter-authoring.md) |     2 | Warning target, travelling spark                                                                     |
| [Rescue](team-rescue-authoring.md)    |     2 | Contact rescue progress, player recovery                                                             |
| [Pilots](team-pilot-assets.md)        |    24 | Player 1 and Player 2 × normal, cutting, downed, crawling, rescuing, recovery × compact and detailed |
| [Enemies](team-enemy-assets.md)       |     5 | Drifter; Hunter patrol, warning, committed charge, recovery                                          |
| [Outcomes](team-outcome-assets.md)    |     2 | Joint capture, team reserve recovery                                                                 |

Only these registered IDs join normal runtime image preparation. An arbitrary `team.*` name is not permission to load a new visual role. Add a new role to this allowlist only with a real renderer contract and qualification.

All selected Team files use the existing hash-derived release paths, byte verification, dimension checks, decoded pixel budget, crop/geometry handling and resource lifetime. A missing, corrupt or malformed replacement must leave the previously accepted snapshot and images alive. A successful replacement disposes superseded images; Close releases all owned resources. Optional historical absence and source recipes do not trigger fetches. Reveal pictures remain under their existing exact-content and saved-original resolver.

Before release, compile a complete collection, load it through the actual shared host, verify every decoded slot/revision/hash, and pass that same snapshot to the real Team painter. Inspect applicable states and fail/retry preparation. Upload validation and Studio's own decoder cannot substitute for this check. Production artwork, approved content bindings and full public/offline acceptance remain separate requirements.

Admitting unchanged starter picture and actor bindings for a new current presentation revision is separate from admitting the later Team-role production. The latter must retain prior records and originals, review the added role artwork and changed reader behavior, and bind the actual reviewed successor through the exact content policy. A role count or a successful preview grants no artwork approval; historical presentations keep their recorded bindings. See [Team production review scope](team-production-review-scope.md).
