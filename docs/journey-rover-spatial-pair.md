# Rover Yard spatial successor pair

Status: candidate editions; route enrolment and human balance review remain separate.

This batch stacks on the accepted source of the first two spatial pairs. It changes only
`split-berths` and `stepped-return` through new map/mission revisions. Their IDs, names,
Journey positions, objectives, coverage targets, presentation assets, gameplay policy,
actor roles and supported modes are retained. Earlier editions remain untouched.

## Research boundary

The geometry is original rather than a coordinate copy of an external game or cultural
artifact. The design uses the Xonix/Xposed spatial vocabulary already established by the
project: blocked lines are walls, reclaimed pads are valid returns, unclaimed terrain
affects only the craft, field keepers retain regions, and reclaimed-ground roamers make a
useful connection carry a visible cost.

For the Ukrainian study, the closest documented reference is a 1930s gerdan in the
[Museum Fund of Ukraine](https://museum.mincult.gov.ua/collections/39754). Its catalogue
description identifies a diagonal lattice with alternating rhombi and X-shaped elements
and central symmetry. The successor translates that compositional rhythm into stepped,
broken wall bands and a central diamond-shaped return; it does not reproduce the object.
The [Kharkiv Historical Museum's survey of Slobozhanshchyna embroidery](https://museum.kh.ua/academic/sumtsov-conference/1996/article.html?n=799)
also documents rhombi, squares, crosses, rosettes, wavy lines and zigzags, including
rhombi extended by hooks or comb-like forms. These sources support the visual language,
not any claim that one motif has a single universal meaning.

## Split berths

Theme: an FPV workbench with a central flight-controller pad, two bracketed battery
berths, a marked cable tray and a lower service pad.

Distinct decision: the short central connection is mechanically useful but immediately
activates a roamer on the best hub. A long route through a bracket opening reaches a side
battery berth first, establishing a quieter return while the other field keeper remains in
play. Walls make the berth entrances deliberate; the slow cable tray makes the central
follow-up materially different without changing movement rules.

Two intended approaches:

1. **Workbench first:** close directly onto the central pad, then use its broad edges for
   short departures while reading the newly active roamer.
2. **Battery berth first:** travel along the perimeter, enter a side bracket through its
   open face, and establish a lateral return before connecting it to the workbench.

Capture consequence: joining pads improves return access and enlarges a roamer's usable
reclaimed network. A field keeper in either side still retains the connected field, so the
first straight connection cannot accidentally solve the mission.

## Stepped return

Theme: an original gerdan-inspired diagonal lattice surrounding a stepped central diamond,
with two separated bead-field landings.

Distinct decision: the short diamond connection offers many launch edges but activates a
roamer in the center. The longer side approach passes an alternating wall opening and can
neutralize a slow bead field, but spends more time exposed to the outer patrol and keeper.

Two intended approaches:

1. **Diamond first:** connect the narrow upper point, shift across the widening steps, and
   leave from the side opposite the approaching roamer.
2. **Lattice opening first:** move around the perimeter and descend through a broken wall
   band to a side landing, reserving the central diamond for a later connection.

Capture consequence: the diamond creates differently sized departure edges rather than
one repeated spoke. A side closure provides an escape beyond one slow field, while the two
keepers continue to retain the remaining field.

## Automated qualification

The focused test proves:

- copy-on-write preservation of all other missions, pictures, rules and authored order;
- one connected field, deliberate disconnected return islands and no unexpected topology
  diagnostics;
- actual retained-field behavior and unchanged actor-domain counts on Gentle, Standard
  and Expert;
- identical Solo and Versus level preparation on every preset;
- no opening life loss during 720 idle ticks over two deterministic seeds on every preset;
- two safe first closures per mission, over two seeds and both steering policies.

The scripted first closures are geometry/safety evidence only. They do not prove a complete
clear, route equivalence, enjoyment, readability on every device, or suitable human pacing.
Both candidates therefore remain **balance review pending**.
