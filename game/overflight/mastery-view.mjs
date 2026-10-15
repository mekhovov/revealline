import { overflightRunReport } from './mastery.mjs';

const words = {
  en: {
    title: 'World mastery',
    complete: 'Complete this sortie',
    intact: 'Complete without losing an airframe',
    supply: 'Complete after collecting a supply reward',
    focus: 'Complete after three Focus engagements reach attack range',
    chain: 'Complete with a chain of at least ten',
    session: 'Session achievements · saving unavailable',
    review: 'Review run · achievements are not saved',
    pending: 'Bank the Marathon to record these achievements.',
    progression: 'Progression',
    salvage: 'Salvage: earned / collected / left on the battlefield',
    gap: 'Longest gap before an upgrade choice',
    last: 'Time since the last choice',
    previous: 'Compared with your previous run on this seed and setup',
    first: 'First recorded run on this seed and setup.',
    time: 'Time',
    kills: 'Destroyed',
    damage: 'Hull lost',
    causes: 'Damage sources',
    lastContract: 'Damage sources · last contract',
    contact: 'Contact',
    lane: 'Aimed attack',
    fan: 'Fan attack',
    ground: 'Ground attack',
    finalTarget: 'Final tank',
    armorRemaining: 'Armor remaining',
    hullRemaining: 'Hull remaining',
  },
  uk: {
    title: 'Майстерність на полі',
    complete: 'Завершити цей виліт',
    intact: 'Завершити без втрати дрона',
    supply: 'Завершити після отримання припасів',
    focus: 'Завершити після трьох команд фокусу з виходом на дальність атаки',
    chain: 'Завершити із серією щонайменше десяти',
    session: 'Досягнення сеансу · збереження недоступне',
    review: 'Перевірочний виліт · досягнення не зберігаються',
    pending: 'Заберіть очки марафону, щоб зберегти досягнення.',
    progression: 'Поступ',
    salvage: 'Трофеї: здобуто / зібрано / залишилося на полі',
    gap: 'Найдовша пауза перед вибором покращення',
    last: 'Час після останнього вибору',
    previous: 'Порівняно з попереднім вильотом із тим самим зерном та налаштуваннями',
    first: 'Перший збережений виліт із цим зерном та налаштуваннями.',
    time: 'Час',
    kills: 'Знищено',
    damage: 'Втрачено міцності',
    causes: 'Причини пошкоджень',
    lastContract: 'Причини пошкоджень · останній контракт',
    contact: 'Контакт',
    lane: 'Прицільна атака',
    fan: 'Віялова атака',
    ground: 'Удар по землі',
    finalTarget: 'Фінальний танк',
    armorRemaining: 'Залишок броні',
    hullRemaining: 'Залишок міцності',
  },
};

/** Read the final actor by its stable identity. Missing/recycled snapshots are
 * unknown; neither absence nor an unfinished objective means zero health. */
export function overflightFinalTargetReport(run) {
  if (run.hunt || !run.goals?.finalSpawned) return null;
  const target = run.enemies?.find(
    (enemy) => enemy.id === run.goals.finalId && enemy.role === 'final',
  );
  if (!target || (!target.active && !run.goals.finalDefeated) || !(target.maxHp > 0)) return null;
  const bound = (value, maximum) => Math.max(0, Math.min(maximum, value));
  return {
    armor: bound(target.armor, target.maxArmor),
    maxArmor: target.maxArmor,
    hull: bound(target.hp, target.maxHp),
    maxHull: target.maxHp,
  };
}

export function renderOverflightRunReport({
  document,
  root,
  run,
  record = null,
  previous = null,
  locale = 'en',
}) {
  const text = words[locale] ?? words.en;
  const report = overflightRunReport(run);
  const make = (tag, content, className = '') => {
    const element = document.createElement(tag);
    element.textContent = content;
    element.className = className;
    return element;
  };
  root.replaceChildren(make('h3', text.title));
  const goals = make('ul', '', 'overflight-world-goals');
  for (const key of ['complete', 'intact', 'technique']) {
    const achieved = (record?.achieved ?? report.mastery)[key];
    const goal = make(
      'li',
      `${achieved ? '✓' : '○'} ${text[key === 'technique' ? report.technique : key]}${key === 'technique' ? ` · ${Math.min(report.techniqueProgress, report.techniqueGoal)}/${report.techniqueGoal}` : ''}`,
    );
    goal.dataset.achieved = String(achieved);
    goals.append(goal);
  }
  root.append(goals);
  if (run.review || run.fixture) root.append(make('p', text.review, 'micro-note'));
  else if (run.raidVariant?.status === 'decision')
    root.append(make('p', text.pending, 'micro-note'));
  else if (record?.durable === false) root.append(make('p', text.session, 'micro-note'));
  const causes = Object.entries(report.damageCauses).filter(([, value]) => value > 0);
  if (causes.length)
    root.append(
      make(
        'p',
        `${run.raidVariant?.id === 'marathon' ? text.lastContract : text.causes}: ${causes.map(([cause, value]) => `${text[cause]} ${Math.round(value)}`).join(' · ')}`,
      ),
    );
  if (!run.hunt) {
    const final = overflightFinalTargetReport(run);
    if (final) {
      const target = make('section', '', 'overflight-final-report');
      target.setAttribute('aria-label', text.finalTarget);
      target.append(make('h4', text.finalTarget));
      for (const [value, maximum, label] of [
        [final.armor, final.maxArmor, text.armorRemaining],
        [final.hull, final.maxHull, text.hullRemaining],
      ]) {
        if (maximum <= 0) continue;
        target.append(make('p', `${label}: ${Math.ceil((value / maximum) * 100)}%`));
        const meter = make('progress', '');
        meter.setAttribute('aria-label', `${text.finalTarget} · ${label}`);
        meter.setAttribute('max', String(maximum));
        meter.setAttribute('value', String(value));
        target.append(meter);
      }
      root.append(target);
    }
    const progression = make('details', '', 'overflight-run-progression');
    progression.append(make('summary', text.progression));
    progression.append(
      make(
        'p',
        `${text.salvage}: ${Math.round(report.salvageEarned)} / ${Math.round(report.salvageCollected)} / ${Math.round(report.salvageRemaining)}`,
      ),
    );
    progression.append(
      make(
        'p',
        `${text.gap}: ${report.longestChoiceGap.toFixed(1)}s · ${text.last}: ${report.sinceLastChoice.toFixed(1)}s`,
      ),
    );
    root.append(progression);
  }
  if (run.review || run.fixture || run.raidVariant?.status === 'decision') return;
  const before = record?.previous ?? previous;
  if (!before) return root.append(make('p', text.first, 'micro-note'));
  const comparison = make('section', '', 'overflight-run-comparison');
  comparison.append(make('h4', text.previous));
  const rows = make('dl', '');
  for (const [key, label, suffix] of [
    ['time', 'time', 's'],
    ['kills', 'kills', ''],
    ['damageTaken', 'damage', ''],
  ]) {
    const delta = report[key] - before[key];
    if (!Number.isFinite(delta)) continue;
    rows.append(
      make('dt', text[label]),
      make('dd', `${delta > 0 ? '+' : ''}${delta.toFixed(key === 'time' ? 1 : 0)}${suffix}`),
    );
  }
  comparison.append(rows);
  root.append(comparison);
}
