# Team catalogue initial focus visibility

When a player opens Browse Team arenas, keep the selected Play action fully visible inside the current modal and viewport, including after Large display text or Plain styling. Preserve the current attempt, chosen arena and search. Returning from a detail preview must retain its exact Preview opener and reveal it only while that return still owns focus. Do not activate an arena or move focus to another action to solve clipping.

Handle both native primary autofocus and explicit focus assignment. Use the actual dialog client scrollport, and recheck visit/focus ownership after geometry reads. Reveal only a clipped action; preserve a fully visible action's scroll position. A newer focus choice, panel close, hidden page or new visit must veto stale scrolling.

Reserve the thumbnail's final layout before image preparation starts while keeping its canvas hidden until actual paint. Do not schedule scrolling after a delayed image load: players may already have moved elsewhere. Preserve picture preparation, masking, cancellation and release ownership.

Exercise the initial open and the Preview → Return → Escape round trip, including newer focus choices during return. Run the complete panel and picture test files on supported Node versions, including native-autofocus, clipping and reentry cases. Separately inspect desktop 1280×720, portrait 390×844 and short landscape 844×390 after display preference changes. Keep generated assets, global document CSS and simulation unchanged.
