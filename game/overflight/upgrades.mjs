const localized = (en, uk) => ({ en, uk });
const names = {
  primary: localized('Overflight payload', 'Заряд прольоту'),
  wide: localized('Wide Fan', 'Широке віяло'),
  double: localized('Double Pulse', 'Подвійний імпульс'),
  'slow-field': localized('Slow field', 'Поле сповільнення'),
  'proximity-pulse': localized('Proximity pulse', 'Ближній імпульс'),
  'side-burst': localized('Side burst', 'Бічний залп'),
  scanner: localized('Salvage scanner', 'Сканер трофеїв'),
  shield: localized('Recovery shield', 'Захисний екран'),
};
const evolutions = {
  wide: localized('Saturation Fan', 'Насичене віяло'),
  double: localized('Echo Cascade', 'Каскад відлуння'),
};
const combatSystems = ['slow-field', 'proximity-pulse', 'side-burst'];
const supportSystems = ['scanner', 'shield'];

// Runtime attacks and upgrade previews share these values. Control modules buy
// time to fly through a gap; they must not erase a full-health opening crowd.
const moduleParameters = Object.freeze({
  'proximity-pulse': [1, 2, 3].map((rank) =>
    Object.freeze({
      radius: [62, 78, 84][rank - 1],
      damage: [14, 18, 18][rank - 1],
      cooldown: [3, 2.8, 2.8][rank - 1],
      chargedCooldown: [2.4, 2.1, 1.6][rank - 1],
      chargeDistance: 90,
      chargedRadius: [76, 98, 120][rank - 1],
      chargedDamage: [26, 36, 52][rank - 1],
      chargedPush: [17, 22, 27][rank - 1],
      chargedReturnDamage: rank === 3 ? 38 : 0,
      chargedReturnPush: 22,
      delay: 0.3,
      push: [12, 14, 14][rank - 1],
      returnDamage: rank === 3 ? 6 : 0,
      returnDelay: 0.9,
      returnPush: 6,
    }),
  ),
  'slow-field': [1, 2, 3].map((rank) =>
    Object.freeze({
      radius: [58, 74, 90][rank - 1],
      duration: [1.6, 2, 2.4][rank - 1],
      cooldown: 3.2,
      tickInterval: 0.5,
      damage: rank + 1,
      slowDuration: 0.55,
      slowMultiplier: 0.55,
    }),
  ),
  'side-burst': [1, 2, 3].map((rank) =>
    Object.freeze({
      speed: 340,
      radius: 7 + rank * 2,
      duration: 0.9,
      damage: 22 + rank * 12,
      piercing: rank === 3,
      cooldown: 1.45 - rank * 0.15,
    }),
  ),
  scanner: [1, 2, 3].map((rank) =>
    Object.freeze({
      targetRadius: 280,
      markDuration: rank === 1 ? 2 : 3,
      damageMultiplier: 1.3,
      chainTargets: rank === 3 ? 3 : 0,
      chainRadius: 120,
      chainDamage: 24,
      cooldown: rank === 3 ? 1.6 : 2.2,
      collectionRadius: 62 + rank * 23,
    }),
  ),
  shield: [1, 2, 3].map((rank) =>
    Object.freeze({
      recharge: [10, 7, 5][rank - 1],
      pulseRadius: rank === 3 ? 100 : 0,
      pulseDamage: rank === 3 ? 30 : 0,
      pulsePush: rank === 3 ? 35 : 0,
    }),
  ),
});

export function overflightModuleParameters(id, rank) {
  return moduleParameters[id]?.[rank - 1] ?? null;
}

export function createOverflightBuild() {
  return {
    primary: { rank: 1, branch: null, evolved: false },
    combat: [],
    support: null,
    reinforcement: 0,
    repair: 0,
  };
}

export function overflightModuleRank(build, id) {
  if (id === 'primary') return build.primary.rank;
  if (build.support?.id === id) return build.support.rank;
  return build.combat.find((module) => module.id === id)?.rank ?? 0;
}

export function overflightPayload(build) {
  const rank = build.primary.rank;
  if (build.primary.branch === 'wide') {
    return {
      cooldown: [0, 0, 1, 0.95, 0.85][rank],
      // Two correctly overlapped evolved charges can clear a 120-hull late
      // pursuer without requiring Proximity Pulse as a compulsory finisher.
      damage: [0, 0, 30, 38, 60][rank],
      radius: [0, 0, 40, 46, 48][rank],
      count: rank === 4 ? 5 : 3,
      spacing: [0, 0, 56, 60, 68][rank],
      echoes: 0,
    };
  }
  if (build.primary.branch === 'double') {
    return {
      cooldown: rank === 4 ? 1.1 : 1.3,
      damage: [0, 0, 40, 52, 65][rank],
      radius: 44 + (rank - 2) * 8,
      count: 1,
      spacing: 0,
      echoes: rank === 4 ? 2 : 1,
    };
  }
  return { cooldown: 1.2, damage: 30, radius: 48, count: 1, spacing: 0, echoes: 0 };
}

export function overflightBuildItems(build) {
  const primary = build.primary;
  const title = primary.evolved ? evolutions[primary.branch] : names[primary.branch ?? 'primary'];
  return [
    { id: 'primary', title, rank: primary.rank },
    ...build.combat.map((module) => ({
      id: module.id,
      title: names[module.id],
      rank: module.rank,
    })),
    ...(build.support
      ? [{ id: build.support.id, title: names[build.support.id], rank: build.support.rank }]
      : []),
  ];
}

function primaryOffer(branch, rank) {
  const evolved = rank === 4;
  const title = evolved ? evolutions[branch] : names[branch];
  const current =
    rank === 2
      ? localized(
          'A stationary charge dropped behind the drone',
          'Нерухомий заряд, скинутий позаду дрона',
        )
      : branch === 'wide'
        ? localized('Three overlapping impact areas', 'Три зони ураження, що перекриваються')
        : localized('One impact followed by an echo', 'Удар і відкладене відлуння');
  const next =
    branch === 'wide'
      ? rank === 2
        ? localized(
            'Three impacts spread across your flight direction',
            'Три удари поперек напрямку польоту',
          )
        : rank === 3
          ? localized('Wider impacts with stronger damage', 'Ширші та потужніші удари')
          : localized(
              'Five rapid overlapping impacts carve a broad opening',
              'П’ять швидких ударів відкривають широкий прохід',
            )
      : rank === 2
        ? localized(
            'A second, wider pulse follows each impact',
            'Після удару виникає другий, ширший імпульс',
          )
        : rank === 3
          ? localized(
              'Both pulses gain radius and damage',
              'Обидва імпульси стають ширшими й потужнішими',
            )
          : localized(
              'Three expanding pulses clear a moving crowd',
              'Три розширювані імпульси розчищають натовп',
            );
  return {
    id: `primary:${branch}:${rank}`,
    kind: evolved ? 'evolution' : 'combat',
    system: 'primary',
    branch,
    rank,
    title,
    description: next,
    current,
    next,
    evolution: evolutions[branch],
    evolutionRank: 4,
    currentRank: rank - 1,
  };
}

function moduleOffer(id, rank) {
  const descriptions = {
    'slow-field': [
      localized(
        'Leave a short field that slows and wears down pursuers',
        'Залишайте поле, що сповільнює й послаблює переслідувачів',
      ),
      localized(
        'The field lasts longer and covers a wider area',
        'Поле діє довше й охоплює більшу площу',
      ),
      localized(
        'A longer, wider field slows pursuit for a return pass',
        'Довше й ширше поле стримує переслідувачів для зворотного прольоту',
      ),
    ],
    'proximity-pulse': [
      localized(
        'Fly to charge a stronger pulse; an idle pulse only buys a brief opening',
        'Летіть, щоб посилити імпульс; без руху він лише ненадовго відкриває прохід',
      ),
      localized(
        'Charged pulses reach farther; keep flying to refill each pulse',
        'Заряджені імпульси дістають далі; продовжуйте політ для нового заряду',
      ),
      localized(
        'Flight also charges a return pulse at the original release point',
        'Політ також заряджає зворотний імпульс у початковій точці випуску',
      ),
    ],
    'side-burst': [
      localized(
        'Automatic shots protect both flanks',
        'Автоматичні постріли захищають обидва фланги',
      ),
      localized('Stronger, wider shots on both sides', 'Потужніші й ширші постріли з обох боків'),
      localized(
        'Piercing bursts pass through every enemy in their path',
        'Пронизливі залпи проходять крізь усіх ворогів на шляху',
      ),
    ],
    scanner: [
      localized(
        'Mark priority threats for extra damage and collect salvage farther away',
        'Позначайте пріоритетні загрози для сильніших ударів і збирайте трофеї здалеку',
      ),
      localized(
        'Longer priority marks and wider salvage collection',
        'Триваліші позначки пріоритетних цілей і ширший збір трофеїв',
      ),
      localized(
        'Marks trigger a bounded chain through three nearby targets',
        'Позначки запускають ланцюг між трьома близькими цілями',
      ),
    ],
    shield: [
      localized(
        'Absorb one hit; the shield recharges after ten seconds',
        'Поглинайте один удар; екран відновлюється за десять секунд',
      ),
      localized('The shield recharges in seven seconds', 'Екран відновлюється за сім секунд'),
      localized(
        'Faster recharge; boosting leaves a protective departure pulse',
        'Швидше відновлення; прискорення залишає захисний імпульс',
      ),
    ],
  };
  const next = descriptions[id][rank - 1];
  return {
    id: `${id}:${rank}`,
    kind: supportSystems.includes(id) ? 'support' : 'combat',
    system: id,
    rank,
    currentRank: rank - 1,
    title: names[id],
    description: next,
    current: rank === 1 ? localized('Empty slot', 'Вільне місце') : descriptions[id][rank - 2],
    next,
    evolution: null,
  };
}

function utilityOffers(build) {
  // A valid project may expose only the primary module. These distinct choices
  // keep drafts useful without granting a capability the project did not admit.
  return [
    {
      id: `reinforce:${build.reinforcement + 1}`,
      kind: 'utility',
      system: 'reinforce',
      rank: build.reinforcement + 1,
      title: localized('Workshop plating', 'Майстерне бронювання'),
      description: localized(
        'Add 12 maximum hull and repair 12 hull',
        'Додайте 12 міцності корпусу та відновіть 12 міцності',
      ),
      current: localized('Current hull', 'Поточна міцність'),
      next: localized('+12 maximum hull and +12 hull', '+12 максимальної та поточної міцності'),
      evolution: null,
    },
    {
      id: `repair:${build.repair + 1}`,
      kind: 'utility',
      system: 'repair',
      rank: build.repair + 1,
      title: localized('Field repair', 'Польовий ремонт'),
      description: localized(
        'Repair 35 hull and clear nearby threats with a pulse',
        'Відновіть 35 міцності та відштовхніть близькі загрози імпульсом',
      ),
      current: localized('Current hull', 'Поточна міцність'),
      next: localized('+35 hull and a protective pulse', '+35 міцності й захисний імпульс'),
      evolution: null,
    },
    {
      id: 'recovery',
      kind: 'utility',
      system: 'recovery',
      rank: 1,
      title: localized('Salvage sweep', 'Збір трофеїв'),
      description: localized(
        'Collect nearby salvage and refill your boost',
        'Зберіть близькі трофеї та відновіть прискорення',
      ),
      current: localized('Local salvage', 'Трофеї поблизу'),
      next: localized(
        'Wide salvage sweep; boost ready',
        'Широкий збір трофеїв; прискорення готове',
      ),
      evolution: null,
    },
  ];
}

export function legalOverflightUpgrades(build, allowedModules) {
  const allowed = new Set(allowedModules);
  const candidates = [];
  if (allowed.has('primary') && build.primary.rank < 4) {
    if (!build.primary.branch) candidates.push(primaryOffer('wide', 2), primaryOffer('double', 2));
    else candidates.push(primaryOffer(build.primary.branch, build.primary.rank + 1));
  }
  for (const id of combatSystems) {
    if (!allowed.has(id)) continue;
    const rank = overflightModuleRank(build, id);
    if (rank < 3 && (rank || build.combat.length < 2)) candidates.push(moduleOffer(id, rank + 1));
  }
  for (const id of supportSystems) {
    if (!allowed.has(id)) continue;
    const rank = overflightModuleRank(build, id);
    if (rank < 3 && (!build.support || build.support.id === id))
      candidates.push(moduleOffer(id, rank + 1));
  }
  return candidates;
}

export function draftOverflightUpgrades(build, allowedModules, random, previousIds = []) {
  const legal = legalOverflightUpgrades(build, allowedModules);
  const guaranteed = legal.filter(
    (offer) =>
      offer.kind === 'evolution' || (build.primary.rank === 1 && offer.system === 'primary'),
  );
  const candidates = legal.filter((offer) => !guaranteed.includes(offer));
  for (let index = candidates.length - 1; index > 0; index--) {
    const selected = Math.floor(random() * (index + 1));
    [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
  }
  // Prefer fresh reroll options, but do not hide a legal evolution or invent cards.
  candidates.sort(
    (a, b) => Number(previousIds.includes(a.id)) - Number(previousIds.includes(b.id)),
  );
  const offers = [...guaranteed];
  for (const offer of candidates) {
    if (offers.length === 3) break;
    offers.push(offer);
  }
  for (const offer of utilityOffers(build)) {
    if (offers.length === 3) break;
    offers.push(offer);
  }
  return offers;
}

export function applyOverflightUpgrade(build, offer, allowedModules) {
  if (!offer || typeof offer.id !== 'string') return false;
  if (offer.kind === 'utility') {
    const legal = utilityOffers(build).find((candidate) => candidate.id === offer.id);
    if (!legal) return false;
    if (offer.system === 'reinforce') build.reinforcement++;
    if (offer.system === 'repair') build.repair++;
    return true;
  }
  const legal = legalOverflightUpgrades(build, allowedModules).find(
    (candidate) => candidate.id === offer.id,
  );
  if (!legal) return false;
  if (legal.system === 'primary') {
    build.primary = { rank: legal.rank, branch: legal.branch, evolved: legal.rank === 4 };
  } else if (legal.kind === 'support') {
    build.support = { id: legal.system, rank: legal.rank };
  } else {
    const existing = build.combat.find((module) => module.id === legal.system);
    if (existing) existing.rank = legal.rank;
    else build.combat.push({ id: legal.system, rank: legal.rank });
  }
  return true;
}
