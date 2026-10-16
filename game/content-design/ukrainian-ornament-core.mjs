const rect = (x, y, w, h) => ({ x, y, w, h });

// Original, low-resolution abstractions of the cited compositions. These are
// routing obstacles, not traced museum objects or claims about universal symbols.
// The owning successor wrapper supplies clones and owns revisions/publication.
export const ORNAMENT_CORE_UPDATES = Object.freeze({
  'two-districts': (mission, map) => {
    map.walls = [
      rect(28, 12, 2, 12),
      rect(22, 10, 8, 2),
      rect(15, 12, 4, 2),
      rect(10, 21, 8, 2),
      rect(28, 24, 4, 2),
      rect(32, 17, 2, 3),
      rect(44, 7, 2, 9),
      rect(44, 19, 2, 10),
      rect(49, 7, 10, 2),
      rect(50, 20, 10, 2),
      rect(62, 13, 3, 7),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Work around the western branch ends to bank the small island, or pass the eastern flower gap toward its taller return and lethal pocket?',
      lesson:
        'The alternating kilim-inspired branches are walls, not returns. Both districts retain an eroder and a keeper; the permanent center spine still lets you change districts without losing that refuge.',
      counterplay:
        'Inspect the short wall beside the center start, then choose an opening above or below it. Compare the two western branch ends with the eastern middle gap; use the spine when an earned approach erodes.',
      captureConsequence:
        'A connection around a branch creates a shorter departure, not a free district clear. Neutralizing the eastern hazard creates usable ground until erosion restores its underlying danger; foundations stay protected.',
      memorableMoment:
        'The open flower on one side offers a middle mouth while the longer branch on the other demands a choice of ends.',
      mastery:
        'Close a cut in each district, use a branch end and the eastern middle gap, and neutralize the eastern hazard without losing a life.',
      combines: [
        'territory-eroder',
        'frontier-patrol',
        'slow-field',
        'lethal-field',
        'field-keeper',
        'walls',
      ],
    });
  },

  'two-ways-home': (mission, map) => {
    map.walls = [
      rect(33, 14, 6, 2),
      rect(20, 9, 12, 2),
      rect(20, 4, 2, 5),
      rect(46, 10, 2, 16),
      rect(52, 24, 7, 2),
      rect(18, 24, 7, 2),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Turn through the short split below the upper island, or work around a longer branch while keeping the broad home landing as your fallback?',
      lesson:
        'The Petrykivka-inspired noncrossing branches block the direct upward link but never close cuts. Choose which real landing will receive the cut before leaving the home platform.',
      counterplay:
        'Inspect the branch immediately above reclaimed home ground. Leave around its left or right tip, watch the impact carrier before the upper turn, and keep an exterior return available when the frontier pressures the small island.',
      captureConsequence:
        'Joining the upper island changes the frontier and shortens later returns. The right-hand branch still separates an inner approach from the outer shoulder; a wall impact cannot substitute for either landing.',
      memorableMoment:
        'A short fork connects the upper return, while the longer outer branch keeps a visibly different fallback route around the same two landings.',
      mastery:
        'Connect both foundations, use an inner fork and an exterior branch approach, and close a cut with an active impact without losing a life.',
      combines: ['impact-carrier', 'field-keeper', 'frontier-patrol', 'walls'],
    });
  },

  'second-approach': (mission, map) => {
    map.walls = [
      rect(4, 12, 4, 2),
      rect(10, 6, 2, 6),
      rect(12, 6, 10, 2),
      rect(33, 11, 7, 2),
      rect(43, 7, 2, 6),
      rect(31, 4, 8, 2),
      rect(18, 24, 10, 2),
      rect(44, 25, 12, 2),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Enclose the near relay around its open vase shoulder and use the earned middle launch, or reach the eastern trigger around its upper negative-space opening from the boundary first?',
      lesson:
        'The open vytynanka-inspired vase forms are walls around capture links. Each relay still opens only its own permanent connector; the shapes do not create new triggers or return surfaces.',
      counterplay:
        'Go around the wall above the west landing to enclose its relay. After opening that bridge, the middle platform offers a shorter approach around the eastern lower hook; the outer rail remains a longer alternative.',
      captureConsequence:
        'The two original gates become the same permanent, unscored connectors. Each earns a useful launch beside a different wall opening, so relay order changes the next approach rather than merely collecting two markers.',
      memorableMoment:
        'A relay reached from outside the first open vase turns the middle landing into the inside approach to the second.',
      mastery:
        'Open the eastern connector before the western connector, using its upper opening, and clear without losing a life.',
      combines: ['field-keeper', 'frontier-patrol', 'permanent-relay-connectors', 'walls'],
    });
  },

  'windbreak-weave': (mission, map) => {
    // Every arrow cell and broad landing stays unchanged. Broken ring segments
    // occupy only unmarked quadrants; they never interrupt a boosted straight.
    map.walls = [
      rect(23, 9, 8, 2),
      rect(21, 11, 2, 2),
      rect(41, 9, 8, 2),
      rect(49, 11, 2, 2),
      rect(41, 25, 8, 2),
      rect(49, 23, 2, 2),
      rect(23, 25, 8, 2),
      rect(21, 23, 2, 2),
      rect(28, 13, 3, 2),
      rect(41, 13, 3, 2),
      rect(41, 21, 3, 2),
      rect(28, 21, 3, 2),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Take an unchanged fast spoke into a broad windbreak, or thread an unmarked break between carved-ring shoulders to approach another return without opposing its arrow?',
      lesson:
        'The broken concentric composition uses walls only in the unmarked quadrants. All four arrow directions, strengths and broad landings stay fixed; the frontier changes after a capture, not the speed-field rules.',
      counterplay:
        'Turn on the central platform before taking a straight boosted spoke. Compare a return against its arrow with the unmarked gap around a ring end; read the frontier before connecting the next windbreak.',
      captureConsequence:
        'A captured spoke becomes ordinary reclaimed movement. An earned corner approach links different windbreaks around the broken arcs, changing the patrol frontier without rotating or covering an arrow with a wall.',
      memorableMoment:
        'An outward fast crossing and an unmarked corner return solve different halves of the same broken-ring route.',
      mastery:
        'Connect three outer windbreaks and complete an unmarked ring-gap approach without losing a life.',
      combines: ['field-keeper', 'frontier-patrol', 'directional-speed-fields', 'walls'],
    });
  },
});
