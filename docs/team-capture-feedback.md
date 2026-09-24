# Team capture feedback parity

Status: source candidate; frozen-build and human board review pending.

Team now retains the same short newly reclaimed-cell illumination used by Solo and Versus. The
effect is drawn only inside cells that are still authoritatively reclaimed, below bonuses, hazards,
actors, active cuts and travelling impacts. It therefore makes a successful capture easier to read
without hiding the next threat or changing earned coverage.

The Team host observes each fixed-step `cells.claimed` event as well as rendering frames. A bounded
visual-only tracker keeps the two most recent captures for 0.65 seconds, deduplicates repeated
observation of one tick, resets on a new or rewound attempt and derives age from authoritative run
time. Painting never advances the effect or mutates a run.

Reduced Effects and a presentation motion scale of zero omit the optional illumination. Reclaimed
cells, active trails, travelling line impacts and functional danger cues remain present. Existing
shared trail rendering still provides the dark outline, player-colour middle, bright core and exact
head, while Team line-impact rendering continues to use authoritative impact positions.

Focused automated checks cover fixed-step retention, duplicate observation, expiry, attempt
isolation, malformed indices, layer order, reduced effects and unchanged run state. They do not
establish real-device contrast, animation preference or human readability; those remain frozen
public-build and human review gates.
