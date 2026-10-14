const text = (en, uk) => ({ en, uk });

export const HUNT_UPGRADE_IDS = Object.freeze([
  'strike-width',
  'slow-wake',
  'rush-charge',
  'boost-cooldown',
  'boost-duration',
  'chain-window',
  'heavy-exposure',
  'guard-interrupt',
  'recovery-shield',
  'plating',
]);
const definitions = {
  plating: {
    title: text('Reactive plating', 'Реактивна броня'),
    direction: 'breaker',
    descriptions: [
      text('Unplated hull', 'Корпус без броні'),
      text(
        'Reduce hull damage by 10%; excludes Objective shield',
        'Шкода корпусу менша на 10%; несумісно з екраном за ціль',
      ),
      text(
        'Reduce hull damage by 20%; no recharge required',
        'Шкода корпусу менша на 20%; без перезаряджання',
      ),
    ],
  },
  'strike-width': {
    title: text('Broad pass', 'Широкий проліт'),
    direction: 'sweeper',
    descriptions: [
      text('Standard boost contact width', 'Звичайна ширина удару прискоренням'),
      text(
        '25% wider boost strikes; your vulnerable body stays the same size',
        'Удар прискоренням ширший на 25%; вразливий корпус не збільшується',
      ),
      text(
        '50% wider boost strikes; sweep a broader formation',
        'Удар прискоренням ширший на 50%; охоплюйте ширший стрій',
      ),
    ],
  },
  'slow-wake': {
    title: text('Slowing wake', 'Гальмівний слід'),
    direction: 'sweeper',
    descriptions: [
      text('No slowing wake', 'Без гальмівного сліду'),
      text(
        'Boost leaves a harmless slowing wake for 0.5 seconds',
        'Прискорення залишає нешкідливий гальмівний слід на 0,5 секунди',
      ),
      text('The slowing wake lasts one second', 'Гальмівний слід триває одну секунду'),
    ],
  },
  'rush-charge': {
    title: text('Sweep momentum', 'Імпульс зачистки'),
    direction: 'sweeper',
    descriptions: [
      text('One Rush point per defeated enemy', 'Один заряд Натиску за знищеного ворога'),
      text(
        'Three kills in one boost grant one extra Rush point',
        'Три знищення за одне прискорення дають додатковий заряд Натиску',
      ),
      text(
        'Three kills in one boost grant two extra Rush points',
        'Три знищення за одне прискорення дають два додаткові заряди Натиску',
      ),
    ],
  },
  'boost-cooldown': {
    title: text('Quick recharge', 'Швидке відновлення'),
    direction: 'pursuer',
    descriptions: [
      text('Boost recovers in 2.5 seconds', 'Прискорення відновлюється за 2,5 секунди'),
      text('Boost recovers in 2.2 seconds', 'Прискорення відновлюється за 2,2 секунди'),
      text('Boost recovers in 1.9 seconds', 'Прискорення відновлюється за 1,9 секунди'),
    ],
  },
  'boost-duration': {
    title: text('Long pass', 'Довгий проліт'),
    direction: 'pursuer',
    descriptions: [
      text('Boost lasts 0.3 seconds', 'Прискорення триває 0,3 секунди'),
      text('Boost lasts 0.35 seconds', 'Прискорення триває 0,35 секунди'),
      text('Boost lasts 0.4 seconds', 'Прискорення триває 0,4 секунди'),
    ],
  },
  'chain-window': {
    title: text('Connected hunt', 'Безперервне полювання'),
    direction: 'pursuer',
    descriptions: [
      text('Four seconds to connect your next kill', 'Чотири секунди до наступного знищення'),
      text('4.75 seconds to connect your next kill', '4,75 секунди до наступного знищення'),
      text('5.5 seconds to connect your next kill', '5,5 секунди до наступного знищення'),
    ],
  },
  'heavy-exposure': {
    title: text('Extended opening', 'Довше відкриття'),
    direction: 'breaker',
    descriptions: [
      text('Heavy recovery lasts three seconds', 'Відновлення важкої цілі триває три секунди'),
      text(
        'Heavy weak points stay open 0.5 seconds longer',
        'Слабкі місця важких цілей відкриті на 0,5 секунди довше',
      ),
      text(
        'Heavy weak points stay open one second longer',
        'Слабкі місця важких цілей відкриті на одну секунду довше',
      ),
    ],
  },
  'guard-interrupt': {
    title: text('Disrupt the guard', 'Зірвати атаку'),
    direction: 'breaker',
    descriptions: [
      text('Guards finish their attack warnings', 'Охоронці завершують підготовку атаки'),
      text(
        'First kill per boost interrupts one warning within 110 units',
        'Перше знищення за прискорення зриває одну підготовку атаки в радіусі 110',
      ),
      text(
        'First kill per boost interrupts one warning within 150 units',
        'Перше знищення за прискорення зриває одну підготовку атаки в радіусі 150',
      ),
    ],
  },
  'recovery-shield': {
    title: text('Objective shield', 'Екран за ціль'),
    direction: 'breaker',
    descriptions: [
      text('No protective shield', 'Без захисного екрана'),
      text(
        'Absorb one hit; completing an objective refills the shield',
        'Поглинайте один удар; завершення цілі відновлює екран',
      ),
      text(
        'Absorb two hits; completing an objective refills both',
        'Поглинайте два удари; завершення цілі відновлює обидва заряди',
      ),
    ],
  },
};

export function createOverflightHuntBuild() {
  // Retain shared presentation fields; Raid never runs Survivor automatic systems.
  return {
    primary: { rank: 1, branch: null, evolved: false },
    combat: [],
    support: null,
    reinforcement: 0,
    repair: 0,
    hunt: Object.fromEntries(HUNT_UPGRADE_IDS.map((id) => [id, 0])),
  };
}
export function overflightHuntUpgradeRank(build, id) {
  return build.hunt?.[id] ?? 0;
}
export function overflightHuntParameters(build) {
  const rank = (id) => overflightHuntUpgradeRank(build, id);
  return {
    strikeWidth: [1, 1.25, 1.5][rank('strike-width')],
    wakeDuration: [0, 0.5, 1][rank('slow-wake')],
    rushBonus: rank('rush-charge'),
    boostCooldown: [2.5, 2.2, 1.9][rank('boost-cooldown')],
    boostDuration: [0.3, 0.35, 0.4][rank('boost-duration')],
    chainWindow: [4, 4.75, 5.5][rank('chain-window')],
    heavyExposureBonus: [0, 0.5, 1][rank('heavy-exposure')],
    interruptRadius: [0, 110, 150][rank('guard-interrupt')],
    shieldCapacity: rank('recovery-shield'),
    armorReduction: rank('plating') * 0.1,
  };
}
export function overflightHuntUpgradeParameters(id, rank = 0) {
  if (!HUNT_UPGRADE_IDS.includes(id) || !Number.isInteger(rank) || rank < 0 || rank > 2)
    throw new RangeError('Unknown Raid upgrade or rank.');
  const build = createOverflightHuntBuild();
  build.hunt[id] = rank;
  return { id, rank, ...overflightHuntParameters(build) };
}
export function overflightHuntBuildItems(build) {
  return HUNT_UPGRADE_IDS.filter((id) => overflightHuntUpgradeRank(build, id)).map((id) => ({
    id,
    title: definitions[id].title,
    rank: overflightHuntUpgradeRank(build, id),
    direction: definitions[id].direction,
  }));
}
export function legalOverflightHuntUpgrades(build, allowedModules = HUNT_UPGRADE_IDS) {
  return HUNT_UPGRADE_IDS.filter(
    (id) =>
      allowedModules.includes(id) &&
      overflightHuntUpgradeRank(build, id) < 2 &&
      !(id === 'plating' && overflightHuntUpgradeRank(build, 'recovery-shield')) &&
      !(id === 'recovery-shield' && overflightHuntUpgradeRank(build, 'plating')),
  ).map((id) => {
    const def = definitions[id],
      rank = overflightHuntUpgradeRank(build, id) + 1;
    return {
      id: `${id}:${rank}`,
      system: id,
      kind: 'combat',
      direction: def.direction,
      rank,
      currentRank: rank - 1,
      title: def.title,
      current: def.descriptions[rank - 1],
      next: def.descriptions[rank],
      description: def.descriptions[rank],
      evolution: null,
    };
  });
}
export function draftOverflightHuntUpgrades(build, allowedModules, random, previousIds = []) {
  const candidates = legalOverflightHuntUpgrades(build, allowedModules);
  for (let index = candidates.length - 1; index > 0; index--) {
    const selected = Math.floor(random() * (index + 1));
    [candidates[index], candidates[selected]] = [candidates[selected], candidates[index]];
  }
  candidates.sort(
    (a, b) => Number(previousIds.includes(a.id)) - Number(previousIds.includes(b.id)),
  );
  return candidates.slice(0, 3);
}
export function applyOverflightHuntUpgrade(build, offer, allowedModules = HUNT_UPGRADE_IDS) {
  const legal = legalOverflightHuntUpgrades(build, allowedModules).find(
    (candidate) => candidate.id === offer?.id,
  );
  if (!legal) return false;
  build.hunt[legal.system] = legal.rank;
  return true;
}

export function overflightHuntInvestedRanks(build) {
  return HUNT_UPGRADE_IDS.reduce((sum, id) => sum + overflightHuntUpgradeRank(build, id), 0);
}

/** Same-rank exchanges keep campaign power bounded while later contracts still
 * offer a different approach. The source and destination are explicit cards. */
export function legalOverflightHuntRefits(run) {
  const build = run.build,
    allowed = run.compiled.upgrades.modules;
  const cards = [];
  for (const from of HUNT_UPGRADE_IDS) {
    const fromRank = overflightHuntUpgradeRank(build, from);
    if (!fromRank) continue;
    for (const to of allowed) {
      const toRank = overflightHuntUpgradeRank(build, to);
      if (from === to || toRank >= 2) continue;
      const transferred = toRank === 0 ? fromRank : 1;
      const next = structuredClone(build);
      next.hunt[from] -= transferred;
      next.hunt[to] += transferred;
      if (next.hunt.plating && next.hunt['recovery-shield']) continue;
      const fromTitle = definitions[from].title,
        toTitle = definitions[to].title;
      cards.push({
        id: `refit:${from}:${to}:${transferred}`,
        system: to,
        kind: 'refit',
        direction: definitions[to].direction,
        rank: toRank + transferred,
        currentRank: toRank,
        fromSystem: from,
        fromRank,
        fromNextRank: fromRank - transferred,
        transferred,
        title: text(`${fromTitle.en} → ${toTitle.en}`, `${fromTitle.uk} → ${toTitle.uk}`),
        current: text(
          `${fromTitle.en} ${fromRank} · ${toTitle.en} ${toRank}`,
          `${fromTitle.uk} ${fromRank} · ${toTitle.uk} ${toRank}`,
        ),
        next: text(
          `${fromTitle.en} ${fromRank - transferred} · ${toTitle.en} ${toRank + transferred}. Same total power; a new approach.`,
          `${fromTitle.uk} ${fromRank - transferred} · ${toTitle.uk} ${toRank + transferred}. Та сама загальна сила; новий підхід.`,
        ),
        description: definitions[to].descriptions[toRank + transferred],
        evolution: null,
      });
    }
  }
  return cards;
}

export function draftOverflightHuntRefits(run, random, previousIds = []) {
  const cards = legalOverflightHuntRefits(run);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  cards.sort((a, b) => Number(previousIds.includes(a.id)) - Number(previousIds.includes(b.id)));
  const field =
    run.player.hull < run.player.maxHull
      ? {
          system: 'field-repair',
          amount: Math.min(15, run.player.maxHull - run.player.hull),
          title: text('Field repair', 'Польовий ремонт'),
          current: text(`${run.player.hull} hull`, `${run.player.hull} міцності`),
          next: text(
            'Restore up to 15 hull; keep this build.',
            'Відновіть до 15 міцності; збережіть збірку.',
          ),
        }
      : run.progression.rerolls < (run.compiled.combat?.supplies.rerollCap ?? 2)
        ? {
            system: 'field-reroll',
            amount: 1,
            title: text('Recalibrate', 'Переналаштувати'),
            current: text(
              `${run.progression.rerolls} rerolls`,
              `${run.progression.rerolls} перевиборів`,
            ),
            next: text(
              'Gain one reroll; keep this build.',
              'Отримайте один перевибір; збережіть збірку.',
            ),
          }
        : {
            system: 'field-score',
            amount: 500,
            title: text('Keep the build', 'Зберегти збірку'),
            current: text('Ready for the next approach', 'Готові до наступного підходу'),
            next: text(
              'Gain 500 score without changing your build.',
              'Отримайте 500 очок без зміни збірки.',
            ),
          };
  return [
    ...cards.slice(0, 2),
    {
      ...field,
      id: field.system,
      kind: 'field',
      rank: 0,
      currentRank: 0,
      evolution: null,
    },
  ];
}

export function applyOverflightHuntRefit(run, offer) {
  if (offer.kind === 'refit') {
    const legal = legalOverflightHuntRefits(run).find((card) => card.id === offer.id);
    if (!legal) return false;
    run.build.hunt[legal.fromSystem] = legal.fromNextRank;
    run.build.hunt[legal.system] = legal.rank;
    run.player.shield = Math.min(
      run.player.shield,
      overflightHuntParameters(run.build).shieldCapacity,
    );
    return true;
  }
  if (offer.kind !== 'field') return false;
  if (offer.system === 'field-repair' && run.player.hull < run.player.maxHull) {
    run.player.hull = Math.min(run.player.maxHull, run.player.hull + 15);
  } else if (
    offer.system === 'field-reroll' &&
    run.progression.rerolls < (run.compiled.combat?.supplies.rerollCap ?? 2)
  ) {
    run.progression.rerolls++;
  } else if (offer.system === 'field-score') run.hunt.score += 500;
  else return false;
  return true;
}

export function describeOverflightHuntOffer(offer, run) {
  if (run.rulesVersion < 3) return offer;
  const next = {
    ...offer,
    rulesVersion: run.rulesVersion,
    baseExposure: run.compiled.combat.machinery.exposureSeconds,
  };
  if (offer.kind === 'combat' && offer.system === 'recovery-shield') {
    next.next = text(
      `Hold ${offer.rank} shield charge${offer.rank === 1 ? '' : 's'}; each objective restores one charge.`,
      `Місткість екрана: ${offer.rank}; кожна ціль відновлює один заряд.`,
    );
    next.description = next.next;
  }
  if (offer.kind === 'combat' && offer.system === 'guard-interrupt') {
    next.next = text(
      `First boosted kill disrupts one shield or uncommitted brace within ${offer.rank === 1 ? 110 : 150} units. Machinery and fired shots remain dangerous.`,
      `Перше знищення ривком зриває один щит або підготовку піхоти в радіусі ${offer.rank === 1 ? 110 : 150}. Техніка та випущені снаряди залишаються небезпечними.`,
    );
    next.description = next.next;
  }
  return next;
}
