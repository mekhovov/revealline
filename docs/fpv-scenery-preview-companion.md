# Scenery preview terrain companion

The authoring scenery preview accepts `companion=/path/to/terrain/region.json` and the existing handoff alias `terrain=/path/to/terrain/region.json`. A nonempty canonical `companion` value takes precedence when both are present. Both use the same manifest validation, verified mixed-window preparation and collision source. Invalid companions stop preparation rather than falling back to scenery alone.

The visible status now identifies **terrain + scenery** or **scenery only**. Previously, a handoff using `terrain=` silently omitted its terrain, so apparently floating scenery could be mistaken for a grounding defect. Omit both parameters only when intentionally inspecting scenery alone. This affects the authoring review tool; player imports, scenery payloads, collision, budgets and normal Library launch are unchanged.

Native authoring verification (fresh port9160): the legacy alias and canonical parameter both loaded nine mixed cells /153 meshes /1,449,992 geometry bytes. Omitting both deliberately loaded scenery only /144 meshes /993,584 bytes. A nonempty valid canonical parameter took precedence over an invalid alias; an invalid canonical parameter stopped on HTTP404 even when a valid alias was also supplied. This validates preview composition and error handling, not packaged-player admission.
