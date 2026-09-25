# Neon Contours spatial successor pair

Status: candidate editions; default-route enrolment and human balance review are separate.

This fourth batch stacks on the first three spatial successor pairs. It changes only
`dogleg-return` and `staggered-circuit` through new map and mission revisions. Mission IDs,
names, Journey positions, objectives, coverage, presentation, gameplay policy, modes and
enemy roles remain intact. The source factories for all earlier editions remain unchanged.

## Research and cultural boundary

The layouts use the project's established Xonix-style contract: walls obstruct but never
close a cut, foundations are valid returns, slow field affects the exposed craft rather than
enemies, field keepers retain regions, and frontier/perimeter patrols have visibly different
domains.

Dogleg return uses an original hooked-rhombus composition. The
[Kharkiv Historical Museum survey of Slobozhanshchyna embroidery](https://museum.kh.ua/academic/sumtsov-conference/1996/article.html?n=799)
documents geometric combinations of rhombi, squares, crosses, rosettes, wavy lines and
zigzags, and notes rhombi extended by hooks and comb-like forms. The mission translates
that broad visual grammar into broken wall bands around a dogleg. It does not reproduce a
specific textile or assign a single universal meaning to the motif.

Staggered circuit is an original FPV-workshop abstraction. Its walls suggest staggered PCB
traces and its foundations suggest contact/controller pads; they are gameplay geometry,
not a diagram of a real flight controller.

## Dogleg return

The previous geometry was one broad reclaimed dogleg with no wall obstruction. Its useful
return was available from the opening, so both stated approaches frequently collapsed into
the same low-risk movement along a large foundation.

Distinct decision: connect the short upper point of the central dogleg and immediately
accept changing-frontier pressure, or spend a longer exposed route through an outer hook
opening to establish the east landing first.

Two intended approaches:

1. **Central hook first:** reach the central dogleg, shift around its elbow, then launch from
   the edge opposite the frontier patrol.
2. **Outer opening first:** travel along the perimeter and descend past a broken wall band
   to the east landing before connecting the central return.

Capture consequence: the central connection provides three differently oriented launch
edges but moves the frontier around the most useful return. The side landing offers a quiet
fallback beyond one hook; two keepers still retain the remaining field.

## Staggered circuit

The previous three broad vertical foundations made returns plentiful while walls played no
part. The successor makes the alternating openings, rather than parallel platform length,
determine the next departure.

Distinct decision: take the short controller pad and later cross slow central field, or
follow a longer clear line through the right trace opening while its frontier patrol is
favourably positioned.

Two intended approaches:

1. **Controller first:** establish the short top pad, then choose a left or right trace end
   instead of repeating a vertical cut through the slow middle.
2. **Right trace first:** move around the perimeter and descend directly to the side rail,
   creating a clear outer return before joining the controller pad.

Capture consequence: the controller creates a short but slowed central follow-up. A side
rail changes the useful order of the remaining staggered trace openings without removing
either retaining keeper.

## Focused qualification

The deterministic test proves:

- copy-on-write preservation of all other missions, art, policy/catalog identities and
  authored campaign/pack order;
- one connected field, deliberate disconnected returns and no unexpected topology errors;
- retained-field semantics and unchanged keeper/frontier/perimeter counts on Gentle,
  Standard and Expert;
- identical Solo and Versus runtime preparation for every preset;
- 720 safe idle ticks over two seeds on every preset;
- both first-closure approaches over two seeds, all three presets and both steering styles.

Those closures establish reachability and opening fairness, not a complete clear. They do
not prove whole-mission pacing, route equivalence, device readability, enjoyment or player
understanding. Both candidates remain **balance review pending**.
