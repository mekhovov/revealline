import { createOverflightRiyProject, compileOverflightRiyProject } from './riy-project.mjs';
import {
  createOverflightRiyLibrary,
  createOverflightRiyPackage,
  exportOverflightRiyPackage,
} from './riy-community.mjs';
import { overflightPreviewRequest } from './host-loop.mjs';
import { createOverflightRiy, stepOverflightRiy, overflightRiyTarget } from './riy-core.mjs';
import { overflightRiyBuildItems } from './riy-upgrades.mjs';
import { overflightWorldForEncounterSet } from './worlds.mjs';

const copy = {
  en: {
    title: 'Riy · Drone Squad',
    briefing:
      'Lead two escorts through the swarm. Sweeper covers your rear; Breaker fires ahead. Your squad shares the two combat slots: choose clearing or control for Sweeper, and bursts or linked strikes for Breaker. Press F, the controller Ability button, or Focus target to send both toward the marked priority target, leaving your formation uncovered until they return.',
    focus: 'F · Focus target',
    focusCompact: 'F · Focus',
    locked: 'Focusing priority target',
    approach: 'Escorts approaching target',
    returning: 'Escorts returning to formation',
    following: 'Escorts following',
    roles: 'Sweeper · wide cover  /  Breaker · concentrated hits',
    squadRoles: 'Sweeper · rear cover  /  Breaker · forward strikes',
    cooldown: 'Focus ready in',
  },
  uk: {
    title: 'Рій · загін дронів',
    briefing:
      'Ведіть два дрони супроводу крізь натовп. Зачисник прикриває тил, Пробійник стріляє вперед. Супровід займає два бойові слоти: оберіть зачищення або сповільнення для Зачисника, залпи або ланцюгові удари для Пробійника. Натисніть F, кнопку здібності на контролері або «Зосередити вогонь», щоб спрямувати обох на позначену ціль, залишивши стрій без прикриття до їхнього повернення.',
    focus: 'F · Зосередити вогонь',
    focusCompact: 'F · Зосередити',
    locked: 'Атака пріоритетної цілі',
    approach: 'Супровід наближається до цілі',
    returning: 'Супровід повертається у стрій',
    following: 'Супровід у строю',
    roles: 'Зачисник · групові атаки  /  Пробійник · зосереджені удари',
    squadRoles: 'Зачисник · прикриття тилу  /  Пробійник · удари вперед',
    cooldown: 'Команда через',
  },
};

/** Opt-in C1 proof on the native Survivor host. No alternate audio, theme,
 * renderer, package schema, upgrade catalogue or simulation clock. */
export function createOverflightRiyMode(base) {
  let queued = false,
    controls = null;
  const label = (locale, key) => (copy[locale] ?? copy.en)[key];
  const createProject = (options = {}) =>
    createOverflightRiyProject({
      ...options,
      rulesVersion: options.rulesVersion ?? 4,
      world: options.world ?? overflightWorldForEncounterSet(options.encounterSet ?? 'front'),
    });
  return {
    ...base,
    name: { en: 'Riy · Drone Squad', uk: 'Рій · загін дронів' },
    id: 'overflight-riy',
    defaultProject: createProject(),
    createProject,
    moduleIcons: {
      ...base.moduleIcons,
      'riy-sweeper': 'side-burst',
      'riy-breaker': 'scanner',
    },
    buildItems: (build) => [...(base.buildItems?.(build) ?? []), ...overflightRiyBuildItems(build)],
    selectCard(run, direction = 'fan') {
      if (run.riy?.version !== 2) return base.selectCard(run, direction);
      const control = direction.startsWith('echo'),
        chain = direction === 'systems';
      const wanted = [
        `primary:${control ? 'double' : 'wide'}`,
        `riy-sweeper:${control ? 'trail' : 'broad'}`,
        `riy-breaker:${chain ? 'chain' : 'burst'}`,
        chain || direction.endsWith('scanner') ? 'scanner' : 'shield',
      ];
      const score = (offer) => {
        const index = wanted.findIndex((prefix) => offer.id.startsWith(prefix));
        if (index < 0) return offer.kind === 'utility' ? 40 : 50;
        if (offer.kind === 'evolution') return -2;
        if (offer.system.startsWith('riy-') && offer.rank === 2 && run.build.primary.branch)
          return -1;
        return index * 5;
      };
      return [...run.offers].sort((a, b) => score(a) - score(b))[0];
    },
    compileProject: compileOverflightRiyProject,
    createLibrary: createOverflightRiyLibrary,
    createPackage: createOverflightRiyPackage,
    exportPackage: exportOverflightRiyPackage,
    studioPath: '../studio/overflight.html?operation=riy',
    previewRequest: (event, context) =>
      overflightPreviewRequest(event, { ...context, modeId: 'overflight-riy' }),
    fixtures: [],
    pilot(run, build) {
      const target = overflightRiyTarget(run);
      return {
        ...base.pilot(run, build),
        focus:
          run.riy.cooldown === 0 &&
          !!target &&
          (target.role !== 'common' || target.maxArmor > 0 || target.guardIntegrity > 0),
      };
    },
    text: (locale, key) => label(locale, key) ?? base.text(locale, key),
    createRun(compiled, options) {
      const run = base.createRun(compiled, options);
      run.riy = createOverflightRiy(run);
      queued = false;
      return run;
    },
    step(run, input, dt) {
      const before = run.tick;
      const focus = queued || input.focus === true;
      queued = false;
      base.step(run, input, dt);
      if (run.tick !== before) stepOverflightRiy(run, { focus });
      return run;
    },
    summary(run) {
      return {
        ...base.summary(run),
        operation: 'overflight-riy',
        escortCommands: run.riy.commands,
        escortEngagements: run.riy.engagements,
        escortShots: run.riy.escorts.map(({ role, shots }) => ({
          role,
          shots,
        })),
        escortUpgrades: run.build.escorts?.map((item) => ({ ...item })) ?? [],
      };
    },
    requestFocus() {
      queued = true;
    },
    releaseInput() {
      queued = false;
    },
    resetPresentation() {
      queued = false;
    },
    refreshOverlay(run, locale) {
      if (!controls) return;
      const state = run.riy;
      controls.title.textContent = label(locale, 'title');
      controls.roles.textContent = label(locale, state.version === 2 ? 'squadRoles' : 'roles');
      const compact = controls.compactTouchActions();
      controls.button.textContent = label(locale, compact ? 'focusCompact' : 'focus');
      controls.button.disabled =
        run.phase !== 'playing' || state.cooldown > 0 || !overflightRiyTarget(run);
      controls.status.textContent =
        state.phase === 'approach'
          ? label(locale, 'approach')
          : state.focusRemaining > 0
            ? label(locale, 'locked')
            : state.phase === 'returning'
              ? label(locale, 'returning')
              : state.cooldown > 0
                ? `${label(locale, 'cooldown')} ${state.cooldown.toFixed(1)}s`
                : label(locale, 'following');
      if (compact)
        controls.button.setAttribute(
          'aria-label',
          `${label(locale, 'focus')} · ${controls.status.textContent}`,
        );
      else controls.button.removeAttribute('aria-label');
    },
    installActions({ document, getRun, canAct, compactTouchActions = () => false }) {
      const root = document.createElement('aside');
      root.className = 'overflight-riy-controls';
      const title = document.createElement('strong');
      const roles = document.createElement('small');
      const status = document.createElement('span');
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-keyshortcuts', 'F');
      const request = () => {
        if (canAct() && getRun()?.riy.cooldown === 0) {
          queued = true;
          document.getElementById('render-host')?.focus({ preventScroll: true });
        }
      };
      const keydown = (event) => {
        if (
          event.code !== 'KeyF' ||
          event.repeat ||
          event.ctrlKey ||
          event.metaKey ||
          event.altKey ||
          !canAct()
        )
          return;
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName ?? '')) return;
        event.preventDefault();
        request();
      };
      button.addEventListener('click', request);
      document.defaultView.addEventListener('keydown', keydown);
      root.append(title, roles, status, button);
      document.getElementById('overflight-game').append(root);
      controls = { root, title, roles, status, button, compactTouchActions };
      return () => {
        document.defaultView.removeEventListener('keydown', keydown);
        button.removeEventListener('click', request);
        root.remove();
        controls = null;
        queued = false;
      };
    },
  };
}
