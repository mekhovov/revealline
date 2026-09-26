import { freezeDesign } from '../content-design/catalogs.mjs';

const definitions = [
  [
    'coupa-spend-in-motion',
    'coupa',
    'Spend in Motion',
    'Brand adventure',
    [
      [
        'First Connection',
        'Light the first district by closing a safe loop.',
        'A welcoming plaza opens around the Coupa flower.',
        'Choose a short return to the central plaza before crossing the broad east field.',
      ],
      [
        'Supplier Square',
        'Connect the market courts while watching the paper drifters.',
        'Friendly supplier stalls surround two connected courtyards.',
        'Take the western arcade or split the two courts from the central landing.',
      ],
      [
        'Paper Jam',
        'Untangle the district around two wandering duplicate-paper knots.',
        'Folded paper ribbons become an orderly, playful city arcade.',
        'Separate the wandering knots before committing to the long middle aisle.',
      ],
      [
        'Shared Routes',
        'Bring the harbour and workshop into the same revealed network.',
        'Bright bridges join a busy harbour to a miniature workshop.',
        'Use the long dock as a return or cross between the smaller loading islands.',
      ],
      [
        'Quarter-End Weather',
        'Find a calm route through a familiar, busier district.',
        'An evening skyline glows above streams of orderly information.',
        'Use the inner refuges while the border patrol passes the outer rail.',
      ],
      [
        'Make Room for Tomorrow',
        'Reconnect the whole neighbourhood using the routes you have learned.',
        'The completed village celebrates beneath a clear blue night sky.',
        'Join the central plaza first or connect the two quieter outer gardens.',
      ],
    ],
  ],
  [
    'coupa-inside-village',
    'coupa',
    'Inside the Village',
    'Employee culture',
    [
      [
        'Hello, Village',
        'Meet the people and roles that make a shared outcome possible.',
        'An illustrated welcome square frames fictional reflections inspired by Coupa’s public culture page.',
        'Connect the welcome desk and the distant meeting nook in the order you prefer.',
      ],
      [
        'Listen, Then Link',
        'Discover two teams’ needs before completing their shared handoff.',
        'Two listening spaces connect through a bright collaboration garden.',
        'Read both sides of the courtyard before choosing your linking route.',
      ],
      [
        'Room for Everyone',
        'Make every participation point part of the finished picture.',
        'Different workspaces contribute to one welcoming community room.',
        'Connect the small side rooms as well as the large central gathering space.',
      ],
      [
        'Own the Handoff',
        'Bring evidence, an owner and a next step to a shared task.',
        'A visible handoff travels between friendly workshop stations.',
        'Build an interior return before crossing the exposed handoff lane.',
      ],
      [
        'Build Tomorrow',
        'Combine contributions into a shared prototype.',
        'An inventive workshop displays sketches, models and a finished collaboration.',
        'Link the separated benches through the central prototype island.',
      ],
      [
        'All of Us',
        'Celebrate what the community has built together.',
        'A six-part festival mosaic reunites the people and places of the journey.',
        'Choose a tour through familiar spaces without leaving the small corners isolated.',
      ],
    ],
  ],
  [
    'coupa-source-to-pay',
    'coupa',
    'From Need to Value',
    'Source-to-pay basics',
    [
      [
        'Find the Need',
        'Turn a fictional business need into a clear requirement.',
        'A small community workshop prepares a well-defined supply request.',
        'Reveal the requirement desk before crossing toward the supplier offers.',
      ],
      [
        'Choose Together',
        'Compare offers against the declared requirement.',
        'Friendly market pavilions display distinct offers rather than rival villains.',
        'Use the offer islands as short returns while inspecting all the evidence.',
      ],
      [
        'Terms Bridge',
        'Connect the chosen offer to the agreed scope and terms.',
        'A clear bridge links a supplier pavilion with a contract library.',
        'Connect the contract landing before reaching the far delivery district.',
      ],
      [
        'Request to Order',
        'Distinguish a request, its review and an issued order.',
        'Three labelled neighbourhoods show the handoff from request to order.',
        'Build a return at each handoff instead of committing to one long crossing.',
      ],
      [
        'Received in Part',
        'Record only the goods that arrived in the fictional delivery.',
        'Two dockside deliveries arrive at different times beside an open ledger.',
        'Use the first delivery landing before connecting the second, distant dock.',
      ],
      [
        'Close the Loop',
        'Reconcile the records and distinguish approved from paid.',
        'Order, delivery and invoice landmarks form a complete illuminated circuit.',
        'Join the three record islands while preserving a safe way back.',
      ],
    ],
  ],
  [
    'coupa-product-operations',
    'coupa',
    'A Day in Coupa',
    'Illustrative product operations',
    [
      [
        'Find Your Work',
        'Identify the task that needs action from your current role.',
        'A readable, fictional task desk sits within a bright operations courtyard.',
        'Reveal the task stations before taking the longer route around the desk.',
      ],
      [
        'Repair the Draft',
        'Correct a missing field and save a valid fictional draft.',
        'Loose request cards become a tidy, complete draft at the review desk.',
        'Visit the two evidence shelves using their short interior returns.',
      ],
      [
        'Review the Request',
        'Apply the scenario’s stated review policy to the evidence.',
        'A calm review room shows a request and its supporting documents together.',
        'Bring both evidence rooms into view before crossing the central review lane.',
      ],
      [
        'Handle the Change',
        'Route an order change to its owner while it awaits review.',
        'A marked change request travels between a supplier dock and a buyer desk.',
        'Use the change desk to shorten the return from the outer dock.',
      ],
      [
        'Record the Delivery',
        'Record the actual partial quantity against the right line.',
        'A delivery bay keeps arrived and outstanding packages visibly separate.',
        'Connect the arrived-goods bay without confusing it with the later delivery.',
      ],
      [
        'Clear the Exception',
        'Trace an invoice discrepancy and choose the appropriate handoff.',
        'A linked operations room makes one unresolved record stand out clearly.',
        'Reveal the three record stations before linking the exception desk.',
      ],
    ],
  ],
  [
    'coupa-developer-integration',
    'coupa',
    'Connect the Network',
    'Developer integration onboarding',
    [
      [
        'Resource Atlas',
        'Map a fictional integration requirement to its resources.',
        'A blueprint of the village exposes labelled resource districts and data routes.',
        'Link the input and output hubs through the smallest useful resource loop.',
      ],
      [
        'Scoped Access',
        'Select only the fictional permissions the task needs.',
        'Clearly labelled access stations protect distinct data districts.',
        'Take the narrow authorized route or inspect the broader perimeter first.',
      ],
      [
        'Beyond Page One',
        'Read every page of a filtered fictional record set.',
        'Three numbered data shelves fill a complete local response ledger.',
        'Use the page landings in sequence without mistaking the first for the whole collection.',
      ],
      [
        'Known References',
        'Resolve valid references before preparing a transaction.',
        'Supplier, requester and accounting nodes connect to one draft hub.',
        'Connect the reference islands before making the long return through the hub.',
      ],
      [
        'Draft, Validate, Explain',
        'Inspect an error and correct a fictional draft request.',
        'A transparent validation workshop shows inputs, feedback and a corrected draft.',
        'Use the validation landing to recover before crossing the second input lane.',
      ],
      [
        'Run Ledger',
        'Reconcile processed records and recover one failed item.',
        'A complete network lights up while one recoverable record is clearly identified.',
        'Connect all ledger stations without revisiting the long outside route.',
      ],
    ],
  ],
  [
    'droneaid-community-relay',
    'droneaid',
    'Community Relay',
    'Community support pilot',
    [
      [
        'Workshop Lights',
        'Connect the community workshop’s component stations.',
        'A warm workshop brings tools, frames and people into a shared project.',
        'Reach the centre bench or connect the smaller component tables first.',
      ],
      [
        'Community Relay',
        'Link the workshop, collection point and delivery hub.',
        'A friendly support route connects packing tables and community logistics.',
        'Use the collection dock as an intermediate return on the way to the far hub.',
      ],
      [
        'After the Storm',
        'Restore a fictional civilian support and communications route.',
        'Field notes and a recovering landscape celebrate emergency collaboration.',
        'Build a sheltered inner route before crossing the final exposed field.',
      ],
    ],
  ],
  [
    'droneaid-nl-workshop-lights',
    'droneaid-nl',
    'Workshop Lights',
    'Fictional Netherlands community adventure',
    [
      [
        'Open the Doors',
        'Light a welcoming route through the first workroom.',
        'A bright fictional Dutch workshop opens for a new day.',
        'Reach the centre bench before exploring the outer tables.',
      ],
      [
        'Find Your Bench',
        'Connect the shared bench and the quiet preparation table.',
        'Clear tables and yellow lamps give every maker room to begin.',
        'Choose either short table return before crossing the centre aisle.',
      ],
      [
        'Tool Library',
        'Bring the tool stations into one connected picture.',
        'An oversized tool wall becomes a playful collection of useful shapes.',
        'Connect the side shelves before attempting the broad middle field.',
      ],
      [
        'First Connections',
        'Join the separate work areas through a shared landing.',
        'Friendly makers connect their first fictional workshop project.',
        'Use the middle landing to split two exposed crossings.',
      ],
      [
        'Shared Worktable',
        'Make room for the busy workshop to work together.',
        'Warm lights reveal several contributions around one long bench.',
        'Read the outer patrol and return through the bench islands.',
      ],
      [
        'Lights Across the Room',
        'Complete the illuminated workshop network.',
        'Every table glows as the fictional community finishes its first chapter.',
        'Connect the inner tables before completing the larger outer loop.',
      ],
    ],
  ],
  [
    'droneaid-nl-parts-in-motion',
    'droneaid-nl',
    'Parts in Motion',
    'Fictional Netherlands community adventure',
    [
      [
        'Six Little Stations',
        'Connect the six component corners of the depot.',
        'Tools, frames, cameras, motors, power and electronics inspire oversized display stations.',
        'Choose a small sorting tray as the first return.',
      ],
      [
        'Frame Courtyard',
        'Link the central frame display to the storage courts.',
        'A playful lightweight-frame sculpture stands among tidy shelves.',
        'Use the lower tray to shorten the route between the two courts.',
      ],
      [
        'Eyes on the Shelf',
        'Reveal the observation-display corner and its neighbours.',
        'Camera-shaped display props overlook a bright fictional component library.',
        'Join the quieter side shelves before entering the long aisle.',
      ],
      [
        'Power Corner',
        'Connect the depot stations around the yellow power display.',
        'Sealed display cases and bright labels form a cheerful exhibition.',
        'Build an interior return before the border patrol reaches the loading side.',
      ],
      [
        'The Parts Parade',
        'Bring the separated sorting aisles into one picture.',
        'Colorful trays travel through an imagined miniature depot.',
        'Connect the staggered trays in two short crossings.',
      ],
      [
        'Everything in Place',
        'Complete the depot map from shelf to collection point.',
        'All six display categories reunite in a bright community-built mosaic.',
        'Use the centre tray to divide the widest remaining field.',
      ],
    ],
  ],
  [
    'droneaid-nl-makers-together',
    'droneaid-nl',
    'Makers Together',
    'Fictional Netherlands community adventure',
    [
      [
        'A Friendly Welcome',
        'Connect a welcome corner with the community table.',
        'Fictional volunteers greet new participants in a welcoming Dutch room.',
        'Choose either meeting nook as the first safe return.',
      ],
      [
        'Watch and Try',
        'Join the demonstration corner and the practice space.',
        'An illustrated mentor shares confidence beside a simple nontechnical display.',
        'Take the shorter route between paired learning tables.',
      ],
      [
        'Pass It On',
        'Bring three contributions into the same revealed space.',
        'Handmade badges celebrate the act of helping another maker.',
        'Connect the small side table before crossing the main room.',
      ],
      [
        'Room for Every Maker',
        'Connect both quiet and shared participation spaces.',
        'Different places to participate form one welcoming room.',
        'Keep an interior route open while the outer patrol passes.',
      ],
      [
        'Many Hands',
        'Reveal the community project assembled from many contributions.',
        'Paper shapes, sketches and shared tables form a collaborative mural.',
        'Link the paired tables through the central gathering island.',
      ],
      [
        'A New Instructor',
        'Complete a picture of confidence being passed forward.',
        'The fictional workshop celebrates a participant becoming a mentor.',
        'Revisit the familiar inner returns before the final wide crossing.',
      ],
    ],
  ],
  [
    'droneaid-nl-careful-handoff',
    'droneaid-nl',
    'The Careful Handoff',
    'Fictional Netherlands community adventure',
    [
      [
        'From Bench to Box',
        'Connect the workshop and the packing bench.',
        'A fictional community project moves into a carefully labelled case.',
        'Use the packing table before crossing to the far dock.',
      ],
      [
        'The Label Trail',
        'Link the label desk and the two packing stations.',
        'Large paper labels create a playful trail through the hall.',
        'Choose the upper or lower packing return around the central divider.',
      ],
      [
        'Collection Point',
        'Bring the nearby collection courts into one network.',
        'An imagined Dutch canal-side depot welcomes shared contributions.',
        'Connect the small collection court before the broad loading area.',
      ],
      [
        'Shared Manifest',
        'Connect each fictional handoff station before the last crossing.',
        'Simple illustrated records link boxes, people and a shared destination.',
        'Use the long inner dock to avoid an exposed perimeter return.',
      ],
      [
        'Across the Quay',
        'Join the near packing hall and the far collection bay.',
        'Violet signs and yellow windows brighten an imagined quay.',
        'Build the middle return before attempting the far side.',
      ],
      [
        'Ready for the Next Team',
        'Complete the handoff picture with every station connected.',
        'A fictional support team receives an orderly collection of prepared cases.',
        'Join the two inner docks before completing the outer loop.',
      ],
    ],
  ],
  [
    'droneaid-nl-signals-of-support',
    'droneaid-nl',
    'Signals of Support',
    'Fictional Netherlands community adventure',
    [
      [
        'A Story Worth Sharing',
        'Connect the story board and the listening corner.',
        'A fictional community noticeboard shares the purpose of learning together.',
        'Reach the noticeboard island before taking the longer outer route.',
      ],
      [
        'Poster Workshop',
        'Link the design tables around the central display.',
        'Violet and yellow paper shapes become a lively exhibition.',
        'Use the smaller poster table as a short return.',
      ],
      [
        'Invitation Square',
        'Bring the invitation stands into the community network.',
        'An imagined local event welcomes neighbours and new makers.',
        'Connect the two small stands before crossing the gathering space.',
      ],
      [
        'The Community Event',
        'Reveal the different corners of a shared celebration.',
        'A pavilion brings volunteers, visitors and workshop stories together.',
        'Use the inner stands while the outer patrol passes.',
      ],
      [
        'Open Ledger',
        'Connect the fictional activity and reporting displays.',
        'A friendly paper mural shows how shared effort becomes visible progress.',
        'Join the record tables before the final long display aisle.',
      ],
      [
        'Thank You, Together',
        'Complete the community thank-you mosaic.',
        'Original-shaped paper ribbons celebrate a fictional collective achievement.',
        'Connect all inner stands before closing the broad celebration loop.',
      ],
    ],
  ],
  [
    'droneaid-nl-shared-horizon',
    'droneaid-nl',
    'Shared Horizon',
    'Fictional Netherlands community adventure',
    [
      [
        'Canal Connections',
        'Join the imagined neighbourhood across two short bridges.',
        'Canals and workshop windows introduce a fictional Dutch setting.',
        'Use the near bridge landing before crossing to the far courtyard.',
      ],
      [
        'Courtyard Workshop',
        'Connect the open workshop with its surrounding courtyards.',
        'A neighbourhood brings its tools and ideas into a shared open space.',
        'Choose the upper or lower courtyard as the first return.',
      ],
      [
        'Evening Collection',
        'Link the collection corners as the windows begin to glow.',
        'Yellow lights guide a fictional local support relay through the evening.',
        'Connect the small collection bay before crossing the broad canal field.',
      ],
      [
        'Windows of Light',
        'Bring the separated rooms into one illuminated picture.',
        'Violet dusk reveals the people and places behind shared progress.',
        'Use the central light court to stay clear of the outer patrol.',
      ],
      [
        'The Whole Neighbourhood',
        'Reconnect the workshop, depot and gathering spaces.',
        'Familiar fictional places return as one connected neighbourhood.',
        'Join the staggered inner landings before crossing between the outer courts.',
      ],
      [
        'Tomorrow Starts Here',
        'Complete the shared horizon and open the next chapter.',
        'A fictional Dutch neighbourhood celebrates learning and helping together.',
        'Choose your route through all the familiar safe returns before the final loop.',
      ],
    ],
  ],
];

export const COMPANY_CAMPAIGNS = freezeDesign(
  definitions.map(([id, brandId, name, audience, rows]) => ({
    id,
    revision: brandId === 'coupa' ? '4' : brandId === 'droneaid-nl' ? '2' : '1',
    name,
    brandId,
    audience,
    publication: 'public',
    sourcePath: `game/content/company-campaigns/${id}.json`,
    assetIds: [],
    modes: ['solo'],
    missionIds: rows.map((_, index) => `${id}-${String(index + 1).padStart(2, '0')}`),
  })),
);
export const COMPANY_MISSIONS = freezeDesign(
  definitions.flatMap(([campaignId, brandId, , audience, rows]) =>
    rows.map(([name, brief, scene, routeDecision], index) => ({
      id: `${campaignId}-${String(index + 1).padStart(2, '0')}`,
      campaignId,
      brandId,
      audience,
      ordinal: index + 1,
      name,
      brief,
      scene,
      routeDecision,
      lessonId: [
        'coupa-inside-village',
        'coupa-source-to-pay',
        'coupa-product-operations',
        'coupa-developer-integration',
      ].includes(campaignId)
        ? `${campaignId}-${String(index + 1).padStart(2, '0')}-lesson`
        : null,
    })),
  ),
);
export function companyCampaign(id) {
  return COMPANY_CAMPAIGNS.find((entry) => entry.id === id) ?? null;
}
export function companyMission(id) {
  return COMPANY_MISSIONS.find((entry) => entry.id === id) ?? null;
}
