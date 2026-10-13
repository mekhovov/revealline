import { createOverflightRiyProject, compileOverflightRiyProject } from './riy-project.mjs';
import {
  createOverflightRiyLibrary,
  createOverflightRiyPackage,
  exportOverflightRiyPackage,
} from './riy-community.mjs';
import { overflightPreviewRequest } from './host-loop.mjs';
import { createOverflightRiy, stepOverflightRiy, overflightRiyTarget } from './riy-core.mjs';

const copy = {
  en: {
    title: 'Riy · escorts',
    briefing:
      'Lead two escorts through the swarm. Sweeper clears nearby packs; Breaker delivers concentrated hits. Press F, the controller Ability button, or Focus target to send both toward a visible priority target briefly. Move closer to create a new attack angle. Escorts are support equipment; your hull and airframes remain the risk.',
    focus: 'F · Focus target',
    locked: 'Focusing priority target',
    following: 'Escorts following',
    roles: 'Sweeper · wide cover  /  Breaker · concentrated hits',
    cooldown: 'Focus ready in',
  },
  uk: {
    title: 'Рій · супровід',
    briefing:
      'Ведіть два дрони супроводу крізь натовп. Зачисник атакує групи поруч, Пробійник завдає зосереджених ударів. Натисніть F, кнопку здібності на контролері або «Зосередити вогонь», щоб ненадовго спрямувати обох на видиму пріоритетну ціль. Зближуйтеся для нового кута атаки. Супровід — це допоміжне обладнання; ризикуєте своїм корпусом і запасними дронами.',
    focus: 'F · Зосередити вогонь',
    locked: 'Атака пріоритетної цілі',
    following: 'Супровід у строю',
    roles: 'Зачисник · групові атаки  /  Пробійник · зосереджені удари',
    cooldown: 'Команда через',
  },
};

/** Opt-in C1 proof on the native Survivor host. No alternate audio, theme,
 * renderer, package schema, upgrade catalogue or simulation clock. */
export function createOverflightRiyMode(base) {
  let queued = false,
    controls = null;
  const label = (locale, key) => (copy[locale] ?? copy.en)[key];
  return {
    ...base,
    name: { en: 'Riy · escorts', uk: 'Рій · супровід' },
    id: 'overflight-riy',
    defaultProject: createOverflightRiyProject(),
    createProject: createOverflightRiyProject,
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
        escortShots: run.riy.escorts.map(({ role, shots }) => ({ role, shots })),
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
      controls.roles.textContent = label(locale, 'roles');
      controls.button.textContent = label(locale, 'focus');
      controls.button.disabled = run.phase !== 'playing' || state.cooldown > 0;
      controls.status.textContent =
        state.focusRemaining > 0
          ? label(locale, 'locked')
          : state.cooldown > 0
            ? `${label(locale, 'cooldown')} ${state.cooldown.toFixed(1)}s`
            : label(locale, 'following');
    },
    installActions({ document, getRun, canAct }) {
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
      controls = { root, title, roles, status, button };
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
