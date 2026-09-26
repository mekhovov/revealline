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
];

export const COMPANY_CAMPAIGNS = freezeDesign(
  definitions.map(([id, brandId, name, audience, rows]) => ({
    id,
    revision: '1',
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
