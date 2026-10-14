import { dataIdentity } from '../data-json.mjs';
import { createOverflightHuntRecords } from './raid-records.mjs';
import { legalOverflightHuntUpgrades, applyOverflightHuntUpgrade } from './raid-upgrades.mjs';

export const OVERFLIGHT_RAID_VARIANTS = Object.freeze(['time-attack', 'marathon']);
export const OVERFLIGHT_MARATHON_CONTRACTS = 5;
export const OVERFLIGHT_TIME_MEDALS = Object.freeze({ gold: 90, silver: 150, bronze: 240 });
const words = {
  en: {
    'time-attack': 'Survive: Time Attack',
    marathon: 'Survive: Contract Marathon',
    timeBrief:
      'Finish the objectives quickly and cleanly. Every hull point lost adds 0.25 seconds to your medal time. Gold 1:30 · Silver 2:30 · Bronze 4:00. Same-seed retry repeats the route.',
    marathonBrief:
      'Clear a contract, then bank your score or risk it on the next. Five contracts become faster and offer smaller repairs. Hull, airframes and upgrades carry forward. Losing all airframes loses every unbanked point.',
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
    'time-attack': 'Вижити: На час',
    marathon: 'Вижити: Марафон контрактів',
    timeBrief:
      'Швидко й чисто виконайте цілі. Кожна втрачена одиниця корпусу додає 0,25 секунди до залікового часу. Золото 1:30 · Срібло 2:30 · Бронза 4:00. Повтор із тим самим зерном зберігає маршрут.',
    marathonBrief:
      'Виконайте контракт і заберіть очки або ризикніть у наступному. П’ять контрактів стають швидшими, а ремонт — меншим. Корпус, апарати й покращення зберігаються. Втрата всіх апаратів забирає всі незбережені очки.',
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
  return {
    rawTime: run.time,
    penalty,
    adjustedTime,
    medal:
      run.phase !== 'won'
        ? 'failed'
        : (Object.keys(OVERFLIGHT_TIME_MEDALS).find(
            (id) => adjustedTime <= OVERFLIGHT_TIME_MEDALS[id],
          ) ?? 'unranked'),
    clean: run.phase === 'won' && run.stats.damageTaken === 0,
  };
}

function sourceOf(compiled) {
  const project = structuredClone(compiled);
  project.format = project.sourceFormat;
  delete project.sourceFormat;
  delete project.projectIdentity;
  delete project.rulesVersion;
  if (project.format === 'OverflightHuntProjectV1') {
    delete project.difficulty;
    delete project.combat;
  }
  return project;
}

export function overflightMarathonProject(source, contract, seed) {
  if (!Number.isInteger(contract) || contract < 1 || contract > OVERFLIGHT_MARATHON_CONTRACTS)
    throw new RangeError('Invalid Marathon contract.');
  const project = structuredClone(source);
  project.seed = seed;
  for (const encounter of project.encounters) {
    for (const pack of encounter.packs) pack.speed = Math.min(140, pack.speed + (contract - 1) * 8);
    for (const actor of [...encounter.packs, ...encounter.objectives]) {
      const offset = (contract - 1) % actor.route.length;
      actor.route = [...actor.route.slice(offset), ...actor.route.slice(0, offset)];
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
        rules: `overflight-${state.id}.v1`,
        project: state.baseIdentity,
      }),
    },
    seed: state.seed,
    stats: { ...run.stats },
    hunt: { ...run.hunt },
  };
  if (state.id === 'time-attack') result.time = overflightTimeAttackResult(run).adjustedTime;
  else {
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
    name: { en: words.en[variant], uk: words.uk[variant] },
    fixtures: [],
    text(locale, key) {
      if (key === 'title') return copy(locale)[variant];
      if (key === 'briefing')
        return copy(locale)[variant === 'marathon' ? 'marathonBrief' : 'timeBrief'];
      return base.text(locale, key);
    },
    createRun(compiled, options = {}) {
      const run = base.createRun(compiled, options);
      run.raidVariant = {
        id: variant,
        rules: 1,
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
      return run;
    },
    step(run, input) {
      if (
        variant === 'marathon' &&
        legalOverflightHuntUpgrades(run.build, run.compiled.upgrades.modules).length < 3
      )
        run.progression.maxChoices = run.progression.choices;
      base.step(run, input);
      settle(run);
    },
    choose(run, id) {
      if (variant === 'marathon' && run.phase === 'upgrade') {
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
      const next = base.createRun(base.compileProject(project), { ...state.options, seed });
      next.build = structuredClone(run.build);
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
            rules: `overflight-${variant}.v1`,
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
      base.renderResults({ ...context, formatTime, run: { ...run, review: true } });
      const $ = (id) => document.getElementById(id);
      const stat = (label, value) => {
        const row = document.createElement('div');
        row.className = 'overflight-result-stat';
        const name = document.createElement('dt'),
          amount = document.createElement('dd');
        name.textContent = label;
        amount.textContent = String(value);
        row.append(name, amount);
        $('result-stats').append(row);
      };
      if (variant === 'time-attack') {
        const result = overflightTimeAttackResult(run);
        $('result-kicker').textContent = text[result.medal];
        stat(text.adjusted, formatTime(result.adjustedTime));
        stat(text.penalty, `+${result.penalty.toFixed(2)}s`);
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
