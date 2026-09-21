# Team event artwork

Asset Studio → Prepare Team event slots registers two optional, exact 32×32 transparent HUD icons. This family is separate from actors, anchors, persistent feedback and threats. Defaults retain the existing status text and have source-stage quality; registration is not production approval.

| Slot                       | Meaning                                                                      | Field context specimen              |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| `team.event.joint-capture` | Both pilots joined their lines; only a meaningful cut earns Joint Cut credit | Joint capture in either arena       |
| `team.event.team-recovery` | Both pilots returned through one shared reserve                              | Team reserve recovery in Relay Yard |

Use distinct silhouettes with two participants recognizable by shape, not just colour. No words, numbers, medals, reward symbols or invented protection range. Artwork sits beside the authoritative status caption outside playable cells. Keep a centered pivot, transparent background and deliberate pixel clusters; inspect at native 32px and runtime 24 CSS pixels. The live short-landscape layout hides decorative artwork to preserve board, text and controls.

The host ingests events immediately after every completed simulation step, before another step clears the event list. An immutable receipt lasts 1.25 seconds of simulation time. Pausing cannot advance its clock. The icon enters from 26 to 32 pixels over 0.14 simulation seconds; reduced effects uses its full size immediately. Existing status announcements, audio and reward handling stay authoritative. A newer status message hides the old icon; receipt expiry hides artwork without erasing useful text. Retry and new attempts clear receipts. Individual rescue, grace timers, reserve counters and presentation preview state never fabricate shared recovery events.

Every declared image must decode at its exact immutable asset revision and centered 32×32 frame before a complete snapshot is accepted. Invalid images reject the new presentation atomically. Historical collections without these optional slots retain their previous status treatment. Imports require both exact slot contracts, while published selections require both roles to pass production review. Source recipes are intentionally not certified artwork.

In Field context, select Couch Team and an earned specimen. Paused and Reduced effects preserve the chosen scene; Play motion advances the actual simulation in bounded fixed steps. The per-step observer retains transient events between display frames. A personal Recovered player specimen correctly leaves the shared recovery icon inactive. The separate event canvas keeps the entire 2:1 board intact; it is decorative and does not duplicate screen-reader announcements. Native size is for pixels; Field context is for role and placement. Both current and draft views use their own exact snapshot and private simulation.

Use Upload or the sprite editor to replace each prepared slot. Review current/draft, prompts, Undo/Redo, save/reload and bundle import/export. A browser draft changes only local Studio storage; releases still adopt validated bundles. Keep PNG bytes, provenance, asset revision and theme lineage together.

Qualification covers real command-earned events, multiple steps per display frame, exact image decoding, atomic failure, history and byte-preserving round trips, live status replacement, pause, expiry, reduced effects, Retry and responsive layouts. Record native browser evidence separately from modeled input, physical devices and deployed play. Completing this framework does not complete all edition artwork or P08-B audio/animation qualification.
