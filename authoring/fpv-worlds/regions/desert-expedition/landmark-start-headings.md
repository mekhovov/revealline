# Face the nearby Desert rock route

The landmark revision preserves the natural study's six launch positions. Facing the
centre of the 16.384 km region made several nearby practice areas appear behind the
pilot, especially the mesa crown and rocky plain. The exact reviewed `landmarks-r1`
Library pin now supplies a heading for each stable authored start ID.

The heading is resolved when starting or restarting flight, including after choosing
another authored start. The normal host consumes that value instead of overriding it
with the region-centre default. A saved place keeps its own heading. The original
`natural-r1` pin, other regions and unknown revisions keep the existing region-centre
behaviour. Resolving a different pin clears previous heading hints.

The immutable delivery, terrain, scenery, positions, collision meshes and physics are
unchanged. Headings are integer centidegrees validated against the verified manifest's
start IDs. No additional runtime module, asset or byte allowance is introduced.

## Verification

`verify-landmark-start-headings.mjs <delivery-landmarks-r1>` exercises all six starts
in both flight modes through the production presentation and session interfaces.
Every prepared body is paused with zero ticks, zero input and the original position;
its heading points within 0.1 degree of the local authored composition centre. It also
checks saved-heading restoration, switching from a saved place to an authored start,
invalid hint rejection, stale-hint clearing for old/unknown pins, resource disposal
and the normal host's launch mapping.

The initial local verification uses the unchanged exact `0d51ca5c` optional runtime
with only the two proposed runtime files overlaid from parent `d7f48f24`. This is a
functional source-composition check, not a frozen-package or browser receipt for the
new heading behaviour. Those release checks remain pending. The earlier ordinary
Library native review on `0d51ca5c` remains valid for its unchanged source only.

The route areas are still bounded composition studies within sparse broad terrain;
this usability correction does not establish final environment quality.
