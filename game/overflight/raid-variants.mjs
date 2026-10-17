import {
  OVERFLIGHT_BATTLEFIELDS,
  applyOverflightBattlefield,
  overflightBattlefieldDefinition,
} from './battlefields.mjs';
import { createOverflightWorldPresentation } from './worlds.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createOverflightHuntRecords } from './raid-records.mjs';
import {
  legalOverflightHuntUpgrades,
  applyOverflightHuntUpgrade,
  overflightHuntInvestedRanks,
} from './raid-upgrades.mjs';

export const OVERFLIGHT_RAID_VARIANTS = Object.freeze(['time-attack', 'marathon']);
export const OVERFLIGHT_MARATHON_CONTRACTS = 5;
export const OVERFLIGHT_TIME_MEDALS = Object.freeze({
  gold: 90,
  silver: 150,
  bronze: 240,
});
export const OVERFLIGHT_MARATHON_TACTICS = Object.freeze([
  {
    id: 'opening',
    en: 'Read the formation · familiar patrol routes',
    uk: 'Прочитайте стрій · знайомі патрульні маршрути',
  },
  {
    id: 'crossing',
    en: 'Crossing columns · alternating packs reverse their route',
    uk: 'Колони навхрест · черговані групи змінюють напрямок',
  },
  {
    id: 'screen',
    en: 'Flank screen · escorts change their guarded approach',
    uk: 'Захист флангу · супровід змінює захищений підхід',
  },
  {
    id: 'counterflow',
    en: 'Counterflow · reflected interception routes',
    uk: 'Зустрічний потік · віддзеркалені маршрути перехоплення',
  },
  {
    id: 'combined',
    en: 'Combined command · crossed routes and shifted escorts',
    uk: 'Спільне командування · перехресні маршрути та зміщений супровід',
  },
]);
// V4 keeps routes and escort offsets inside each layout's authored cover. Its
// preview must not promise the reflected geometry used by legacy V3 contracts.
const marathonTacticsV4 = Object.freeze([
  OVERFLIGHT_MARATHON_TACTICS[0],
  OVERFLIGHT_MARATHON_TACTICS[1],
  {
    en: 'Guarded approaches · attached escorts screen the new layout',
    uk: 'Захищені підходи · супровід прикриває нову місцевість',
  },
  {
    en: 'Return approach · reordered routes through familiar cover',
    uk: 'Повторний підхід · новий порядок маршрутів серед знайомих укриттів',
  },
  {
    en: 'Combined command · selected columns reverse through familiar cover',
    uk: 'Спільне командування · окремі колони змінюють напрямок серед знайомих укриттів',
  },
]);
export function overflightMarathonNextContract(run, locale = 'en') {
  const next = run.raidVariant?.contract;
  if (!(next < 5)) return null;
  const language = locale === 'uk' ? 'uk' : 'en';
  const layout = overflightBattlefieldDefinition(run.raidVariant.sequence?.[next]);
  if (run.compiled?.rulesVersion >= 4) {
    // Custom V4 projects may omit both battlefield cycling and movement profiles.
    // Describe their retained geometry without promising built-in transformations.
    if (!run.raidVariant.sequence)
      return language === 'uk'
        ? 'Авторські маршрути · геометрія поля бою зберігається'
        : 'Authored routes · battlefield geometry is preserved';
    if ([2, 5].includes(next + 1)) {
      const upcoming = overflightMarathonProject(run.raidVariant.source, next + 1, run.seed);
      const reverses = upcoming.encounters.some((encounter) =>
        [...encounter.packs, ...encounter.objectives].some(
          (actor, index) => index % 2 && !actor.escortOf && actor.movement,
        ),
      );
      if (!reverses)
        return [
          layout?.title[language],
          language === 'uk'
            ? 'Авторські підходи · патрульна геометрія зберігається'
            : 'Authored approaches · patrol geometry is preserved',
        ]
          .filter(Boolean)
          .join(' · ');
    }
  }
  const tactics = run.compiled?.rulesVersion >= 4 ? marathonTacticsV4 : OVERFLIGHT_MARATHON_TACTICS;
  return [layout?.title[language], tactics[next][language]].filter(Boolean).join(' · ');
}
const words = {
  en: {
    'time-attack': 'Time Attack',
    marathon: 'Contract Marathon',
    timeBrief:
      'Finish the objectives quickly and cleanly. Every hull point lost adds 0.25 seconds to your medal time. Medal targets are authored per sortie; initial targets are provisional. Same-seed retry repeats the route.',
    marathonBrief:
      'Clear a contract, then bank your score or risk it on the next. Five contracts change their approaches and offer smaller repairs. Hull, airframes and upgrades carry forward. Revised sorties cap your build at eight invested ranks; later refits exchange equal ranks or offer field rewards. Losing all airframes loses every unbanked point.',
    adjusted: 'Medal time',
    penalty: 'Damage penalty',
    gold: 'Gold',
    silver: 'Silver',
    bronze: 'Bronze',
    unranked: 'Finished',
    failed: 'Not completed',
    clean: 'Clean clear',
    contract: 'Contract',
    contractCleared: 'Contract complete',
    risk: 'At risk',
    bank: 'Bank and finish',
    continue: 'Risk it · next contract',
    banked: 'Score banked',
    lost: 'Unbanked score lost',
    decision: 'Bank your score or risk the next contract.',
    max: 'All five contracts cleared.',
    multiplier: 'Contract score multiplier',
    saved: 'Records saved',
    session: 'Session records',
    best: 'Best score',
    fastest: 'Best medal time',
    elapsed: 'Total flight time',
  },
  uk: {
    'time-attack': 'На час',
    marathon: 'Марафон контрактів',
    timeBrief:
      'Швидко й чисто виконайте цілі. Кожна втрачена одиниця корпусу додає 0,25 секунди до залікового часу. Цілі медалей задаються для вильоту; початкові цілі попередні. Повтор із тим самим зерном зберігає маршрут.',
    marathonBrief:
      'Виконайте контракт і заберіть очки або ризикніть у наступному. П’ять контрактів змінюють підходи, а ремонт стає меншим. Корпус, апарати й покращення зберігаються. В оновлених вильотах збірка містить до восьми рангів; далі можна обміняти рівні ранги або взяти польову винагороду. Втрата всіх апаратів забирає всі незбережені очки.',
    adjusted: 'Заліковий час',
    penalty: 'Штраф за шкоду',
    gold: 'Золото',
    silver: 'Срібло',
    bronze: 'Бронза',
    unranked: 'Завершено',
    failed: 'Не завершено',
    clean: 'Чисте проходження',
    contract: 'Контракт',
    contractCleared: 'Контракт виконано',
    risk: 'Під ризиком',
    bank: 'Забрати очки й завершити',
    continue: 'Ризикнути · наступний контракт',
    banked: 'Очки збережено',
    lost: 'Незбережені очки втрачено',
    decision: 'Заберіть очки або ризикніть у наступному контракті.',
    max: 'Усі п’ять контрактів виконано.',
    multiplier: 'Множник очок контракту',
    saved: 'Рекорди збережено',
    session: 'Рекорди сеансу',
    best: 'Найкращі очки',
    fastest: 'Найкращий заліковий час',
    elapsed: 'Загальний час польоту',
  },
};
const copy = (locale) => words[locale === 'uk' ? 'uk' : 'en'];
const multiplier = (contract) => 1 + (contract - 1) * 0.25;
export function overflightRaidMedalTime(seconds) {
  const ticks = Math.round(seconds * 100);
  return `${Math.floor(ticks / 6000)}:${((ticks % 6000) / 100).toFixed(2).padStart(5, '0')}`;
}

export function overflightTimeAttackResult(run) {
  const penalty = run.stats.damageTaken * 0.25;
  const adjustedTime = run.time + penalty;
  const budgets = run.compiled?.medalBudgets ?? OVERFLIGHT_TIME_MEDALS;
  return {
    rawTime: run.time,
    penalty,
    adjustedTime,
    medal:
      run.phase !== 'won'
        ? 'failed'
        : (Object.keys(OVERFLIGHT_TIME_MEDALS).find((id) => adjustedTime <= budgets[id]) ??
          'unranked'),
    clean: run.phase === 'won' && run.stats.damageTaken === 0,
  };
}

function sourceOf(compiled) {
  const project = structuredClone(compiled);
  project.format = project.sourceFormat;
  delete project.sourceFormat;
  delete project.projectIdentity;
  delete project.visualIdentity;
  delete project.rulesVersion;
  if (project.format === 'OverflightHuntProjectV1') {
    delete project.difficulty;
    delete project.combat;
  }
  return project;
}

export function overflightMarathonSequence(source) {
  if (!source.battlefield) return null;
  const layouts = OVERFLIGHT_BATTLEFIELDS.filter(
    (entry) => entry.world === source.battlefield.world,
  );
  const first = layouts.findIndex((entry) => entry.id === source.battlefield.id);
  if (first < 0 || layouts.length !== 3)
    throw new TypeError('Marathon needs an authored three-layout world.');
  return [0, 1, 2, 1, 0].map((offset) => layouts[(first + offset) % 3].id);
}

export function overflightMarathonProject(source, contract, seed) {
  if (!Number.isInteger(contract) || contract < 1 || contract > OVERFLIGHT_MARATHON_CONTRACTS)
    throw new RangeError('Invalid Marathon contract.');
  const sequence = overflightMarathonSequence(source);
  const project = sequence
    ? applyOverflightBattlefield(source, sequence[contract - 1])
    : structuredClone(source);
  if (sequence)
    project.presentation = createOverflightWorldPresentation(
      project.battlefield.world,
      project.arena,
      { layout: project.battlefield },
    );
  project.seed = seed;
  for (const encounter of project.encounters) {
    for (const pack of encounter.packs) pack.speed = Math.min(140, pack.speed + (contract - 1) * 8);
    for (const [index, actor] of [...encounter.packs, ...encounter.objectives].entries()) {
      if (project.format === 'OverflightHuntProjectV4' && actor.escortOf) continue;
      const offset = (contract - 1) % actor.route.length;
      actor.route = [...actor.route.slice(offset), ...actor.route.slice(0, offset)];
      if (project.format === 'OverflightHuntProjectV4' && actor.movement) {
        // Route order varies within the authored geometry; never reflect cover independently.
        if ([2, 5].includes(contract) && index % 2) actor.route.reverse();
        actor.movement.anchors = structuredClone(actor.route);
      }
      if (project.format === 'OverflightHuntProjectV3' && !actor.escortOf) {
        if ([2, 5].includes(contract) && index % 2) actor.route.reverse();
        if ([4, 5].includes(contract))
          actor.route = actor.route.map((point) => ({
            ...point,
            y: project.arena.height - point.y,
          }));
      }
    }
    if (['OverflightHuntProjectV3', 'OverflightHuntProjectV4'].includes(project.format)) {
      for (const [index, wing] of encounter.packs.filter((pack) => pack.escortOf).entries()) {
        const target = encounter.objectives.find((actor) => actor.id === wing.escortOf);
        let dx = wing.x - target.x,
          dy = wing.y - target.y;
        if (project.format === 'OverflightHuntProjectV3' && [3, 5].includes(contract)) {
          dx = index ? 72 : -72;
          dy = index ? -68 : 68;
        }
        wing.x = target.x + dx;
        wing.y = target.y + dy;
        wing.route = target.route.map((point) => ({
          x: point.x + dx,
          y: point.y + dy,
        }));
        if (wing.movement) wing.movement.anchors = structuredClone(wing.route);
      }
    }
  }
  if (project.combat) {
    project.combat.guard.commitSeconds = Math.max(
      1,
      project.combat.guard.commitSeconds - (contract - 1) * 0.15,
    );
    project.combat.supplies.repairHull = Math.max(
      10,
      project.combat.supplies.repairHull - (contract - 1) * 5,
    );
  }
  return project;
}

const summedStats = ['kills', 'damageTaken', 'couriersCaught', 'couriersEscaped'];
function settle(run) {
  const state = run.raidVariant;
  if (
    state?.id !== 'marathon' ||
    !['won', 'lost'].includes(run.phase) ||
    state.settled === state.contract
  )
    return;
  state.settled = state.contract;
  state.totalTime += run.time;
  for (const key of summedStats) state.totals[key] += run.stats[key] ?? run.hunt[key] ?? 0;
  state.bestChain = Math.max(state.bestChain, run.hunt.bestChain);
  if (run.phase === 'lost') {
    state.forfeited = state.escrow + Math.floor(run.hunt.score * multiplier(state.contract));
    state.escrow = 0;
    state.status = 'lost';
  } else {
    state.escrow += Math.floor(run.hunt.score * multiplier(state.contract));
    state.status = state.contract === OVERFLIGHT_MARATHON_CONTRACTS ? 'banked' : 'decision';
  }
}

/** Records use the shared profile owner but a variant-specific content identity. */
export function overflightRaidVariantRecord(run) {
  const state = run.raidVariant;
  if (!state) throw new TypeError('A Raid variant is required.');
  settle(run);
  if (state.id === 'marathon' && !['banked', 'lost'].includes(state.status)) return null;
  const result = {
    ...run,
    compiled: {
      ...run.compiled,
      projectIdentity: dataIdentity({
        rules: `overflight-${state.id}.v${state.rules ?? 1}`,
        project: state.baseIdentity,
      }),
    },
    seed: state.seed,
    stats: { ...run.stats },
    hunt: { ...run.hunt },
  };
  if (state.id === 'time-attack') {
    result.rawTime = run.time;
    result.time = overflightTimeAttackResult(run).adjustedTime;
  } else {
    result.time = state.totalTime;
    result.hunt.score = state.status === 'banked' ? state.escrow : 0;
    result.hunt.bestChain = state.bestChain;
    result.stats.kills = state.totals.kills;
    result.stats.damageTaken = state.totals.damageTaken;
    result.hunt.couriersCaught = state.totals.couriersCaught;
    result.hunt.couriersEscaped = state.totals.couriersEscaped;
  }
  return result;
}

export function createOverflightRaidVariant(base, { variant } = {}) {
  if (!OVERFLIGHT_RAID_VARIANTS.includes(variant)) throw new RangeError('Unknown Raid variant.');
  const resultWrites = new WeakMap();
  let actions = null;
  let currentResult = null;
  const mode = {
    ...base,
    operationId: variant,
    studioPath: `../studio/raid.html?operation=${variant}`,
    name: { en: words.en[variant], uk: words.uk[variant] },
    fixtures: [],
    compileProject(project) {
      const compiled = base.compileProject(project);
      if (
        compiled.terrain &&
        !(
          compiled.rulesVersion >= 4 &&
          compiled.battlefield &&
          compiled.terrain.format === 'OverflightTerrainV2'
        )
      )
        throw new TypeError(
          'Experimental terrain is available in Single Raid only; this variant requires open arenas.',
        );
      return compiled;
    },
    projectForRun: (run) => sourceOf(run.compiled),
    text(locale, key) {
      if (key === 'title') return copy(locale)[variant];
      if (key === 'briefing')
        return copy(locale)[variant === 'marathon' ? 'marathonBrief' : 'timeBrief'];
      return base.text(locale, key);
    },
    createRun(compiled, options = {}) {
      if (
        compiled.terrain &&
        !(
          compiled.rulesVersion >= 4 &&
          compiled.battlefield &&
          compiled.terrain.format === 'OverflightTerrainV2'
        )
      )
        throw new TypeError(
          'Experimental terrain is available in Single Raid only; this variant requires open arenas.',
        );
      const run = base.createRun(compiled, options);
      run.raidVariant = {
        id: variant,
        rules: compiled.rulesVersion >= 4 ? 3 : compiled.rulesVersion >= 3 ? 2 : 1,
        sequence: overflightMarathonSequence(sourceOf(compiled)),
        seed: run.seed,
        baseIdentity: compiled.projectIdentity,
        source: sourceOf(compiled),
        options: structuredClone(options),
        contract: 1,
        status: 'playing',
        settled: 0,
        escrow: 0,
        forfeited: 0,
        totalTime: 0,
        bestChain: 0,
        totals: Object.fromEntries(summedStats.map((key) => [key, 0])),
      };
      if (variant === 'marathon' && run.rulesVersion >= 3) run.hunt.refitBudget = 8;
      return run;
    },
    step(run, input) {
      if (
        variant === 'marathon' &&
        !run.hunt.refitBudget &&
        legalOverflightHuntUpgrades(run.build, run.compiled.upgrades.modules).length < 3
      )
        run.progression.maxChoices = run.progression.choices;
      base.step(run, input);
      settle(run);
    },
    choose(run, id) {
      if (variant === 'marathon' && !run.hunt.refitBudget && run.phase === 'upgrade') {
        const offer = run.offers.find((card) => card.id === id);
        const nextBuild = structuredClone(run.build);
        if (
          offer &&
          applyOverflightHuntUpgrade(nextBuild, offer, run.compiled.upgrades.modules) &&
          legalOverflightHuntUpgrades(nextBuild, run.compiled.upgrades.modules).length < 3
        )
          run.progression.maxChoices = run.progression.choices + 1;
      }
      return base.choose(run, id);
    },
    bankContract(run) {
      settle(run);
      if (variant !== 'marathon' || run.raidVariant?.status !== 'decision' || run.phase !== 'won')
        return false;
      run.raidVariant.status = 'banked';
      return true;
    },
    continueContract(run) {
      settle(run);
      const state = run.raidVariant;
      if (
        variant !== 'marathon' ||
        state?.status !== 'decision' ||
        run.phase !== 'won' ||
        state.contract >= OVERFLIGHT_MARATHON_CONTRACTS
      )
        return false;
      const contract = state.contract + 1;
      const seed = (state.seed + (contract - 1) * 104729) >>> 0 || 1;
      const project = overflightMarathonProject(state.source, contract, seed);
      const next = base.createRun(base.compileProject(project), {
        ...state.options,
        seed,
      });
      next.build = structuredClone(run.build);
      if (run.hunt.refitBudget) next.hunt.refitBudget = run.hunt.refitBudget;
      next.airframesRemaining = run.airframesRemaining;
      next.player.hull = run.player.hull;
      next.player.shield = run.player.shield;
      next.player.armorReduction = run.player.armorReduction;
      next.progression.rerolls = run.progression.rerolls;
      next.progression.history = structuredClone(run.progression.history);
      if (run.flight) next.flight = structuredClone(run.flight);
      next.review = run.review;
      next.appearance = run.appearance;
      state.contract = contract;
      state.status = 'playing';
      next.raidVariant = state;
      base.resetPresentation?.();
      currentResult = null;
      Object.assign(run, next);
      return true;
    },
    recordQuery(run) {
      return {
        ...run,
        compiled: {
          ...run.compiled,
          projectIdentity: dataIdentity({
            rules: `overflight-${variant}.v${run.raidVariant?.rules ?? (run.compiled.rulesVersion >= 4 ? 3 : run.compiled.rulesVersion >= 3 ? 2 : 1)}`,
            project: run.raidVariant?.baseIdentity ?? run.compiled.projectIdentity,
          }),
        },
      };
    },
    createRecords(options = {}) {
      return createOverflightHuntRecords(options);
    },
    summary(run) {
      const summary = base.summary(run);
      const state = run.raidVariant;
      return {
        ...summary,
        variant:
          variant === 'time-attack'
            ? { id: variant, ...overflightTimeAttackResult(run) }
            : {
                id: variant,
                contract: state.contract,
                status: state.status,
                escrow: state.escrow,
                forfeited: state.forfeited,
                totalTime: state.totalTime + (state.settled === state.contract ? 0 : run.time),
              },
      };
    },
    updateHUD(context) {
      base.updateHUD(context);
      const { run, document } = context,
        text = copy(document.documentElement.lang);
      if (variant === 'time-attack')
        document.getElementById('hud-score').textContent =
          `${text.adjusted} ${overflightTimeAttackResult(run).adjustedTime.toFixed(1)}s`;
      else {
        const state = run.raidVariant;
        document.getElementById('hud-score').textContent =
          `${text.contract} ${state.contract}/5 · ${text.risk} ${state.escrow + (state.settled === state.contract ? 0 : Math.floor(run.hunt.score * multiplier(state.contract)))}`;
      }
    },
    renderResults(context) {
      const { run, document, formatTime: regularTime, records } = context;
      const formatTime = variant === 'time-attack' ? overflightRaidMedalTime : regularTime;
      settle(run);
      const state = run.raidVariant,
        text = copy(document.documentElement.lang);
      // Base UI is reused, but only the variant snapshot may enter records.
      base.renderResults({
        ...context,
        formatTime,
        run: { ...run, review: true },
      });
      const $ = (id) => document.getElementById(id);
      const stat = (label, value, { detail = false } = {}) => {
        const row = document.createElement('div');
        row.className = `overflight-result-stat${detail ? ' overflight-result-detail' : ''}`;
        const name = document.createElement('dt'),
          amount = document.createElement('dd');
        name.textContent = label;
        amount.textContent = String(value);
        row.append(name, amount);
        $('result-stats').append(row);
      };
      if (variant === 'time-attack') {
        const result = overflightTimeAttackResult(run);
        if (run.compiled.medalBudgets?.provisional)
          stat(
            document.documentElement.lang === 'uk' ? 'Цілі медалей' : 'Medal targets',
            document.documentElement.lang === 'uk' ? 'Попередні' : 'Provisional',
          );
        $('result-kicker').textContent = text[result.medal];
        stat(text.adjusted, formatTime(result.adjustedTime));
        stat(text.penalty, `+${result.penalty.toFixed(2)}s`);
        const budgets = run.compiled.medalBudgets ?? OVERFLIGHT_TIME_MEDALS;
        stat(
          document.documentElement.lang === 'uk'
            ? 'Золото · Срібло · Бронза'
            : 'Gold · Silver · Bronze',
          `${formatTime(budgets.gold)} · ${formatTime(budgets.silver)} · ${formatTime(budgets.bronze)}`,
        );
        if (result.clean) $('result-message').textContent = text.clean;
      } else {
        $('result-kicker').textContent = `${text.contract} ${state.contract}/5`;
        if (state.status === 'decision') $('result-title').textContent = text.contractCleared;
        $('result-message').textContent =
          text[
            state.status === 'decision'
              ? 'decision'
              : state.status === 'banked'
                ? state.contract === 5
                  ? 'max'
                  : 'banked'
                : 'lost'
          ];
        stat(
          state.status === 'lost' ? text.lost : state.status === 'banked' ? text.banked : text.risk,
          state.status === 'lost' ? state.forfeited : state.escrow,
        );
        stat(text.elapsed, formatTime(state.totalTime));
        stat(text.multiplier, `×${multiplier(state.contract)}`);
        if (run.hunt.refitBudget)
          stat(
            document.documentElement.lang === 'uk' ? 'Ранги збірки' : 'Build ranks',
            `${overflightHuntInvestedRanks(run.build)}/${run.hunt.refitBudget}`,
          );
        if (state.status === 'decision' && run.rulesVersion >= 3)
          stat(
            document.documentElement.lang === 'uk' ? 'Наступний контракт' : 'Next contract',
            overflightMarathonNextContract(run, document.documentElement.lang),
            { detail: true },
          );
      }
      if (actions) {
        actions.bank.hidden = actions.next.hidden =
          variant !== 'marathon' || state.status !== 'decision';
        actions.bank.textContent = text.bank;
        actions.next.textContent = text.continue;
      }
      const snapshot = overflightRaidVariantRecord(run);
      currentResult = run;
      if (!snapshot || run.review || run.fixture) {
        $('raid-records').textContent = snapshot ? context.text('automatedReview') : text.decision;
        return;
      }
      if (!resultWrites.has(run)) resultWrites.set(run, records.record(snapshot));
      void resultWrites.get(run).then((record) => {
        if (currentResult !== run) return;
        $('raid-records').textContent = [
          record.durable ? text.saved : text.session,
          variant === 'time-attack' && record.fastestClear
            ? `${text.fastest} ${formatTime(record.fastestClear.time)}`
            : null,
          record.bestScore ? `${text.best} ${record.bestScore.score}` : null,
        ]
          .filter(Boolean)
          .join(' · ');
      });
    },
    resetPresentation() {
      currentResult = null;
      base.resetPresentation?.();
    },
    installActions(context) {
      const disposeBase = base.installActions?.(context);
      const { document, getRun, onContinueContract } = context;
      const sibling = document.getElementById('raid-same-seed');
      const bank = document.createElement('button'),
        next = document.createElement('button');
      bank.type = next.type = 'button';
      bank.className = next.className = sibling.className;
      bank.hidden = next.hidden = true;
      sibling.parentElement.append(bank, next);
      actions = { bank, next };
      const bankAction = () => {
        const run = getRun();
        if (mode.bankContract(run)) {
          context.onVariantResultRefresh?.();
        }
      };
      const nextAction = () => {
        if (context.canContinueContract && !context.canContinueContract()) return;
        const run = getRun();
        if (mode.continueContract(run)) onContinueContract?.();
      };
      bank.addEventListener('click', bankAction);
      next.addEventListener('click', nextAction);
      return () => {
        bank.removeEventListener('click', bankAction);
        next.removeEventListener('click', nextAction);
        bank.remove();
        next.remove();
        actions = null;
        disposeBase?.();
      };
    },
  };
  return mode;
}
