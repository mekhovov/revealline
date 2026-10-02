import { createHuntDestruction, drawHumanoidPixelBody } from '../hunt/destruction.mjs';
import { drawCombatScrap } from '../ui/combat-presentation.mjs';
import { dataIdentity } from '../data-json.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { encounterVariantSource } from '../hunt/variants.mjs';
import { huntText } from '../hunt/copy.mjs';
import { missionEditContext } from './edit-context.mjs';
import { getLocale, onLocaleChange } from '../i18n/index.mjs';

const copy = {
  title: ['Author hunting for this mission', 'Створити полювання для цієї місії'],
  help: [
    'Inspect a finite population and goal, then apply it to the selected mission. Source export includes every placement; Undo restores the previous edition.',
    'Перевірте скінченну групу ворогів і мету, а потім застосуйте їх до вибраної місії. Експорт містить усі позиції; скасування відновлює попередню версію.',
  ],
  inspect: ['Inspect variant', 'Перевірити варіант'],
  apply: ['Apply to this mission', 'Застосувати до цієї місії'],
  quota: [
    'Required eliminations for Capture + hunt',
    'Потрібна кількість цілей для захоплення + полювання',
  ],
  select: ['Choose an active mission first.', 'Спочатку виберіть активну місію.'],
  changed: [
    'The mission or options changed. Inspect the variant again.',
    'Місія або налаштування змінилися. Перевірте варіант ще раз.',
  ],
  applied: [
    'The selected mission edition now includes this variant.',
    'Варіант додано до версії вибраної місії.',
  ],
  noPopulation: [
    'This map has no qualified space for the encounter population.',
    'На цій мапі немає придатного місця для групи ворогів.',
  ],
  quotaRange: [
    'The quota must fit the finite target population.',
    'Квота має відповідати скінченній кількості цілей.',
  ],
};
const text = (key) => copy[key][getLocale() === 'uk' ? 1 : 0];
/** Preserve every unrelated mission and propagate only actual membership ancestors. */
export function selectedMissionHuntSource(source, missionId, variant, quota = null) {
  const project = structuredClone(compileContentProject(source).source);
  const original = project.missions.find((mission) => mission.id === missionId);
  if (!original || original.archived) throw new Error(text('select'));
  const edition = encounterVariantSource(source, variant, { missionIds: [missionId] });
  const selected = structuredClone(edition.missions.find((mission) => mission.id === missionId));
  if (
    variant !== 'off' &&
    (!selected.combat?.enabled ||
      !selected.actors.some(
        (actor) => actor.role === 'optional-scout' || actor.role === 'optional-sentry',
      ))
  )
    throw new Error(text('noPopulation'));
  if (variant === 'capture-quota' && quota !== null) {
    if (!Number.isSafeInteger(quota) || quota < 1 || quota > selected.hunt.targets.length)
      throw new Error(text('quotaRange'));
    selected.hunt.quota = quota;
  }
  selected.revision = `draft-${dataIdentity({ original: original.revision, selected })}`;
  project.actorCatalogId = edition.actorCatalogId;
  project.missions = project.missions.map((mission) =>
    mission.id === missionId ? selected : mission,
  );
  const changed = new Set();
  for (const campaign of project.campaigns)
    if (campaign.missionIds.includes(missionId)) {
      campaign.revision = `draft-${dataIdentity({ campaign, mission: selected.revision })}`;
      changed.add(campaign.id);
    }
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => changed.has(id)))
      pack.revision = `draft-${dataIdentity({ pack, campaigns: project.campaigns.filter((campaign) => changed.has(campaign.id)) })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return compileContentProject(project).source;
}
export function createHuntEditor({ container, getSource, getMission, apply }) {
  const doc = container.ownerDocument,
    node = (tag, value = '') => {
      const element = doc.createElement(tag);
      element.textContent = value;
      return element;
    };
  const root = node('fieldset'),
    legend = node('legend'),
    help = node('p'),
    variantLabel = node('label'),
    variantName = node('span'),
    variant = node('select');
  const quotaLabel = node('label'),
    quotaName = node('span'),
    quota = node('input'),
    inspect = node('button'),
    commit = node('button'),
    status = node('p');
  root.dataset.huntEditor = 'true';
  variant.dataset.huntVariant = 'true';
  quota.dataset.huntQuota = 'true';
  quota.type = 'number';
  quota.min = '1';
  quota.max = '24';
  quota.step = '1';
  quota.value = '4';
  inspect.type = commit.type = 'button';
  inspect.dataset.huntInspect = 'true';
  commit.dataset.huntApply = 'true';
  status.setAttribute('role', 'status');
  for (const value of ['off', 'patrol', 'bonus', 'capture-quota', 'hunt']) {
    const option = node('option', huntText(value));
    option.value = value;
    variant.append(option);
  }
  variant.value = 'bonus';
  variantLabel.append(variantName, variant);
  quotaLabel.append(quotaName, quota);
  variantLabel.style.cssText = quotaLabel.style.cssText = 'display:grid;gap:.4rem;margin:.75rem 0;';
  root.append(legend, help, variantLabel, quotaLabel, inspect, commit, status);
  container.append(root);
  const presentationPreview = createHuntPresentationPreview(root);
  let identity = null,
    prepared = null,
    pendingKey = null,
    disposed = false;
  const context = () => missionEditContext(getSource(), getMission());
  const key = () => `${context()}|${variant.value}|${quota.value}`;
  function localize() {
    legend.textContent = text('title');
    help.textContent = text('help');
    variantName.textContent = huntText('variant');
    quotaName.textContent = text('quota');
    inspect.textContent = text('inspect');
    commit.textContent = text('apply');
    for (const option of variant.options) option.textContent = huntText(option.value);
    presentationPreview.localize();
  }
  function invalidated() {
    prepared = null;
    pendingKey = null;
    commit.disabled = true;
    quotaLabel.hidden = variant.value !== 'capture-quota';
  }
  function sync() {
    if (disposed) return;
    const mission = getMission();
    root.disabled = !mission || !!mission.archived;
    const current = context();
    if (identity !== current) {
      identity = current;
      invalidated();
      if (mission?.hunt) {
        variant.value = mission.hunt.mode;
        quota.value = String(mission.hunt.quota || 4);
      }
      status.textContent = mission ? '' : text('select');
      quotaLabel.hidden = variant.value !== 'capture-quota';
    }
    localize();
  }
  inspect.onclick = () => {
    try {
      if (identity !== context()) throw new Error(text('changed'));
      prepared = selectedMissionHuntSource(
        getSource(),
        getMission()?.id,
        variant.value,
        variant.value === 'capture-quota' ? Number(quota.value) : null,
      );
      pendingKey = key();
      commit.disabled = false;
      const mission = prepared.missions.find((entry) => entry.id === getMission().id);
      const actors = mission.actors.filter((actor) =>
        ['optional-scout', 'optional-sentry'].includes(actor.role),
      );
      status.textContent = `${huntText(variant.value)} · ${huntText('targets')}: ${actors.length} · ${huntText('runner')}: ${actors.filter((actor) => actor.role === 'optional-scout').length} · ${huntText('guard')}: ${actors.filter((actor) => actor.role === 'optional-sentry').length}${mission.hunt?.quota ? ` · ${getLocale() === 'uk' ? 'Квота' : 'Quota'}: ${mission.hunt.quota}` : ''}`;
    } catch (error) {
      invalidated();
      status.textContent = error.message;
    }
  };
  function accept() {
    try {
      if (!prepared || pendingKey !== key()) throw new Error(text('changed'));
      if (apply(prepared, accept) === false) return;
      identity = null;
      sync();
      status.textContent = text('applied');
    } catch (error) {
      status.textContent = error.message;
    }
  }
  commit.onclick = accept;
  variant.onchange = quota.onchange = invalidated;
  const unlocale = onLocaleChange(localize);
  localize();
  invalidated();
  return Object.freeze({
    sync,
    dispose() {
      disposed = true;
      unlocale();
      presentationPreview.dispose();
      inspect.onclick = commit.onclick = variant.onchange = quota.onchange = null;
      root.remove();
    },
  });
}

/** A draft-only presentation sandbox: no storage, mission edits, score or audio. */
function createHuntPresentationPreview(container) {
  const doc = container.ownerDocument,
    win = doc.defaultView ?? globalThis.window;
  const node = (tag) => doc.createElement(tag);
  const root = node('fieldset'),
    legend = node('legend'),
    help = node('p'),
    canvas = node('canvas');
  root.dataset.huntPresentationPreview = 'true';
  root.append(legend, help);
  const copy = {
    title: ['Preview enemy presentation', 'Перегляд вигляду ворогів'],
    help: [
      'These preview choices stay in this editor. They do not change the mission or your game settings. Clean presentation is selected initially.',
      'Ці параметри діють лише в редакторі. Вони не змінюють місію чи налаштування гри. Спочатку вибрано вигляд без відвертих ефектів.',
    ],
    kind: ['Character', 'Персонаж'],
    recipe: ['Defeat preview', 'Перегляд знищення'],
    ram: ['Contact', 'Дотик'],
    capture: ['Enclosure', 'Захоплення'],
    group: ['Group enclosure', 'Захоплення групи'],
    remains: ['Show enemy remains', 'Показувати залишки ворогів'],
    reduced: ['Reduced effects', 'Зменшені ефекти'],
    play: ['Play presentation preview', 'Відтворити вигляд знищення'],
    stop: ['Stop preview', 'Зупинити перегляд'],
    image: [
      'Presentation preview of the selected character and defeat recipe.',
      'Перегляд вибраного персонажа й способу знищення.',
    ],
  };
  const tr = (key) => copy[key]?.[getLocale() === 'uk' ? 1 : 0] ?? huntText(key);
  const choices = {
    kind: 'runner',
    recipe: 'ram',
    brutal: false,
    blood: true,
    remains: true,
    reduced: false,
  };
  const controls = new Map(),
    labels = new Map();
  let frame = null,
    disposed = false;
  const fx = createHuntDestruction();
  const media = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () =>
    choices.reduced || media?.matches || doc.body?.dataset.effects === 'reduced';
  function stop() {
    if (frame !== null) win.cancelAnimationFrame(frame);
    frame = null;
    fx.reset();
  }
  function clear() {
    stop();
    canvas.hidden = true;
  }
  for (const key of ['kind', 'recipe', 'brutal', 'blood', 'remains', 'reduced']) {
    const label = node('label'),
      title = node('span');
    const options =
      key === 'kind' ? ['runner', 'guard'] : key === 'recipe' ? ['ram', 'capture', 'group'] : null;
    const control = node(options ? 'select' : 'input');
    if (options) {
      for (const value of options) {
        const option = node('option');
        option.value = value;
        control.append(option);
      }
      control.value = choices[key];
    } else {
      control.type = 'checkbox';
      control.checked = choices[key];
    }
    control.dataset.huntPreviewOption = key;
    label.style.cssText = 'display:flex;align-items:center;gap:.5rem;margin:.5rem 0;';
    label.append(control, title);
    root.append(label);
    controls.set(key, control);
    labels.set(key, title);
    control.onchange = () => {
      choices[key] = options ? control.value : control.checked;
      controls.get('blood').disabled = !choices.brutal;
      clear();
    };
  }
  controls.get('blood').disabled = true;
  const play = node('button'),
    halt = node('button');
  play.type = halt.type = 'button';
  play.dataset.huntPreviewPlay = 'true';
  halt.dataset.huntPreviewStop = 'true';
  canvas.width = 480;
  canvas.height = 160;
  canvas.style.cssText = 'display:block;max-width:100%;height:auto;image-rendering:pixelated;';
  canvas.hidden = true;
  canvas.style.display = 'none';
  canvas.setAttribute('role', 'img');
  // Keep hidden semantics compatible with the explicit responsive display style.
  function hide() {
    clear();
    canvas.style.display = 'none';
  }
  for (const control of controls.values()) {
    const change = control.onchange;
    control.onchange = () => {
      change();
      canvas.style.display = 'none';
    };
  }
  play.onclick = () => {
    stop();
    const ctx = canvas.getContext('2d');
    if (!ctx || !win?.requestAnimationFrame) return;
    canvas.hidden = false;
    canvas.style.display = 'block';
    const owner = {},
      view = { valid: true, status: 'running', tick: 0, eliminations: [] };
    const targets = (choices.recipe === 'group' ? [11, 15, 19] : [15]).map((x, index) => ({
      id: `studio-preview-${index}`,
      kind: choices.kind,
      cause: choices.recipe === 'ram' ? 'ram' : 'capture',
      x,
      y: 5,
      tick: 33,
    }));
    let began = null,
      previous = null;
    const draw = (now) => {
      if (disposed || doc.hidden) {
        hide();
        return;
      }
      began ??= now;
      previous ??= now;
      const age = (now - began) / 1000;
      view.tick = Math.floor(age * 60);
      view.eliminations = age >= 0.55 ? targets : [];
      fx.advance(view, (now - previous) / 1000, {
        key: owner,
        brutal: choices.brutal,
        blood: choices.blood,
        reduced: reduced(),
        sources: [{ x: 13, y: 5, direction: 'right' }],
      });
      previous = now;
      ctx.fillStyle = '#181e25';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (!view.eliminations.length)
        for (const target of targets) {
          ctx.save();
          ctx.translate(target.x * 16 - 16, target.y * 16 - 16);
          ctx.scale(2, 2);
          drawHumanoidPixelBody(ctx, { kind: choices.kind }, { accent: '#79d7ce' });
          ctx.restore();
        }
      drawCombatScrap(
        ctx,
        view,
        {},
        {
          screenScale: 0.5,
          showScrap: choices.remains,
          brutal: choices.brutal,
          blood: choices.blood,
          reduced: reduced(),
        },
      );
      fx.draw(ctx, { unit: 2 });
      if (age < 1.8) frame = win.requestAnimationFrame(draw);
      else frame = null;
    };
    frame = win.requestAnimationFrame(draw);
  };
  halt.onclick = hide;
  root.append(play, halt, canvas);
  container.append(root);
  const visibility = () => {
    if (doc.hidden) hide();
  };
  doc.addEventListener('visibilitychange', visibility);
  win?.addEventListener?.('pagehide', hide);
  media?.addEventListener?.('change', hide);
  const localize = () => {
    legend.textContent = tr('title');
    help.textContent = tr('help');
    play.textContent = tr('play');
    halt.textContent = tr('stop');
    canvas.setAttribute('aria-label', tr('image'));
    for (const [key, label] of labels) label.textContent = tr(key);
    for (const control of controls.values())
      for (const option of control.options ?? []) option.textContent = tr(option.value);
  };
  localize();
  return {
    localize,
    dispose() {
      disposed = true;
      hide();
      doc.removeEventListener('visibilitychange', visibility);
      win?.removeEventListener?.('pagehide', hide);
      media?.removeEventListener?.('change', hide);
      for (const control of controls.values()) control.onchange = null;
      play.onclick = halt.onclick = null;
      root.remove();
    },
  };
}
