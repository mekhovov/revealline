const rect = (x, y, w, h) => ({ x, y, w, h });

// Original filled silhouettes, not traced textile pixels. Scanline rectangles
// have disjoint cells and leave no decorative hole that could auto-fill.
function star(cx, cy, scale = 1) {
  const points = [
    [0, -11],
    [2, -5],
    [8, -8],
    [5, -2],
    [11, 0],
    [5, 2],
    [8, 8],
    [2, 5],
    [0, 11],
    [-2, 5],
    [-8, 8],
    [-5, 2],
    [-11, 0],
    [-5, -2],
    [-8, -8],
    [-2, -5],
  ].map(([x, y]) => [cx + x * scale, cy + y * scale]);
  const rows = [];
  for (let y = Math.floor(cy - 11 * scale); y < Math.ceil(cy + 11 * scale); y++) {
    const cuts = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (a[1] > y + 0.5 !== b[1] > y + 0.5)
        cuts.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    cuts.sort((a, b) => a - b);
    for (let i = 0; i < cuts.length; i += 2) {
      const x = Math.ceil(cuts[i] - 0.5),
        end = Math.ceil(cuts[i + 1] - 0.5);
      if (end > x) rows.push(rect(x, y, end - x, 1));
    }
  }
  return rows;
}

// The owner composes these into a new immutable edition. These functions touch
// only cloned geometry and semantic design records, never physics, art or IDs.
export const ORNAMENT_OPTIONAL_UPDATES = Object.freeze({
  'four-motor-landings'(mission, map) {
    // Podillian eight-point star-cluster abstraction on an FPV assembly mat.
    // Four separate motor pads remain returns; filled stars remain components.
    map.walls = [...star(36, 18), ...star(8, 18, 0.4), ...star(64, 20, 0.4)];
    Object.assign(mission.design, {
      routeDecision:
        'Connect an adjacent motor pad through an opening between star points, or circle an outer cluster for a larger enclosure and a different return angle?',
      lesson:
        'The four assembly pads close cuts; the eight-point work-mat obstacles block craft and keepers but never become return surfaces.',
      counterplay:
        'Read the field keepers before choosing a point opening. Keep the next pad visible, and use the outside of a satellite cluster if the inner approach is pressured.',
      captureConsequence:
        'An earned pad connection supplies a departure on another side of the central cluster; occupied field still retains normally.',
      memorableMoment:
        'A short diagonal-looking gap demands a deliberate orthogonal route, while the next pad offers an entirely different angle around the star.',
      mastery:
        'Connect all four motor pads using both an inner opening and an outer-cluster approach without losing a life.',
    });
  },
  'circuit-lanes'(mission, map) {
    // Reshetylivka square-cutwork abstraction: offset, open component windows.
    // Both sides have staggered broad mouths; these are through routes, not
    // sealed decorative windows or single-entrance dead-end bays.
    map.walls = [
      rect(20, 7, 8, 2),
      rect(20, 9, 2, 2),
      rect(20, 17, 2, 8),
      rect(20, 25, 8, 2),
      rect(26, 9, 2, 4),
      rect(26, 21, 2, 4),
      rect(44, 9, 9, 2),
      rect(51, 11, 2, 8),
      rect(51, 25, 2, 2),
      rect(44, 27, 9, 2),
      rect(44, 11, 2, 4),
      rect(44, 23, 2, 4),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Thread the staggered square openings toward an interior work pad, or wrap a closed component-window end and earn a wider outside return?',
      lesson:
        'The offset cutwork shapes are walls, not circuit paths or safe ground. Their open mouths preserve ordinary enemy-retained field connectivity.',
      counterplay:
        'Choose a pad beyond one opening before leaving. The second window’s exit is lower, so reassess keeper positions instead of repeating the first crossing.',
      captureConsequence:
        'Capturing beside a square wall creates an earned shortcut along that side; the wall itself never closes a trail.',
      memorableMoment:
        'A reclaimed edge beside the first component window turns an awkward second-window approach into a short return.',
      mastery:
        'Close once through a square window and once around a closed end while visiting both interior pads.',
    });
  },
  'twin-lens-chambers'(mission, map) {
    // Opposing, offset figurative-panel silhouettes inspired by Kosiv ceramics;
    // still an FPV lens work mat, not literal new actors or collision artwork.
    const panel = [
      rect(10, 12, 3, 12),
      rect(13, 7, 3, 8),
      rect(16, 5, 7, 3),
      rect(23, 7, 5, 2),
      rect(16, 9, 4, 2),
      rect(7, 16, 3, 7),
      rect(13, 24, 8, 3),
      rect(19, 27, 2, 4),
      rect(21, 24, 5, 2),
    ];
    map.walls = [
      ...panel,
      ...panel.map(({ x, y, w, h }) => rect(72 - x - w, 36 - y - h, w, h)),
      // The eastern approach bends above or below this detached shoulder;
      // the western landing still permits a direct crossing. The bridge and
      // both original lens returns remain unobstructed.
      rect(46, 14, 2, 7),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Take the direct western lens approach, or bend above or below the eastern panel shoulder before returning to its landing?',
      lesson:
        'The opposing work-mat panels block movement but remain open field problems. Lens pads close cuts; keeper positions decide what fills.',
      counterplay:
        'Depart away from the frontier patrol. Read the keeper inside the chosen approach and keep the opposite lens pad available before extending around a shoulder.',
      captureConsequence:
        'Connecting a lens pad reshapes the patrol contour on that side without clearing the other keeper’s occupied field.',
      memorableMoment:
        'The eastern landing needs a dogleg around a detached shoulder after the direct western connection.',
      mastery:
        'Make a closure from each lens pad, using a facing opening and an exterior shoulder without losing a life.',
    });
  },
  'toolbench-weave'(mission, map) {
    // Poltavian staggered-branch abstraction. Branches obstruct, while the four
    // existing work mats remain separate returns and the middle rover sleeps.
    map.walls = [
      rect(24, 11, 3, 16),
      rect(20, 7, 3, 4),
      rect(22, 11, 2, 2),
      rect(28, 5, 3, 4),
      rect(27, 9, 3, 3),
      rect(18, 18, 6, 2),
      rect(20, 20, 4, 2),
      rect(45, 12, 3, 17),
      rect(41, 25, 4, 2),
      rect(39, 27, 4, 3),
      rect(48, 17, 4, 2),
      rect(50, 13, 3, 4),
      rect(48, 27, 5, 2),
      rect(51, 29, 3, 3),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Reclaim the aisle between staggered branches and wake the rover, or connect an outer work mat first so a parallel escape survives activation?',
      lesson:
        'Branching work-mat obstacles are walls, not reclaimed trunks. Capturing the sleeping rover’s field activates pressure on reclaimed ground after its warning.',
      counterplay:
        'Choose a departure and a second work mat before enclosing the sleeper. Use the unequal branch ends to keep a parallel escape rather than trapping yourself in one earned aisle.',
      captureConsequence:
        'An earned connection can extend both the craft’s return network and the awakened rover’s movement domain; the branch walls stay impassable.',
      memorableMoment:
        'The central shortcut becomes contested, making the previously established outer mat immediately useful.',
      mastery:
        'Wake the rover and then use three different work mats, including an outer escape, without losing a life.',
    });
  },
  'dnipro-crossings'(mission, map) {
    // Krolevets flower-and-bird branching-bank abstraction with open crossings;
    // no closed blossom pockets, literal combat actors or new terrain rules.
    map.walls = [
      rect(24, 6, 3, 12),
      rect(19, 7, 5, 2),
      rect(18, 5, 3, 2),
      rect(18, 16, 6, 2),
      rect(15, 18, 5, 2),
      rect(5, 20, 10, 2),
      rect(44, 19, 3, 12),
      rect(47, 23, 4, 2),
      rect(49, 28, 5, 2),
      rect(41, 30, 3, 3),
      rect(49, 13, 15, 2),
      rect(64, 11, 3, 2),
      rect(56, 15, 3, 3),
    ];
    Object.assign(mission.design, {
      routeDecision:
        'Link the central landing through the gap between branching banks, or take a wider shore-to-shore crossing around a flower-and-bird silhouette?',
      lesson:
        'The bank ornaments are walls, not shore returns. Separate reclaimed platforms close cuts; the field keepers retain their ordinary field regions.',
      counterplay:
        'Keep a second landing within reach and read the keeper beyond the next branch. The broad outer route is an alternative when the central passage is contested.',
      captureConsequence:
        'Each shore connection changes which branch end is a useful next departure; a connection between occupied regions may earn only its trail.',
      memorableMoment:
        'A small central connection opens a new crossing angle, while the far bank still needs a differently shaped enclosure.',
      mastery:
        'Connect both shores using a central passage and an outer-bank approach before clearing without losing a life.',
    });
  },
});
