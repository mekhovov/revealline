import { boundedJSON, canonicalJSON, exactKeys, required } from '../../game/data-json.mjs';
import { validateCompletionReward, validateCompletionRewards } from '../../game/rewards/model.mjs';
import { validateFlightCourse, replayFlight } from './model.mjs';
import { flightRewardDefinitions } from './notebook.mjs';
const COPY = {
  en: {
    title: 'Flight course studio',
    note: 'Authoring preview never earns. Changes need a new course revision and matching demonstrations before edition admission.',
    course: 'Course',
    mode: 'Criteria for mode',
    revision: 'Revision',
    rewardRevision: 'Reward revision (change when rebinding the course)',
    titleField: 'Title',
    brief: 'Cue / objective',
    lesson: 'Discovery explanation',
    steps: 'Ordered criteria',
    type: 'Type',
    add: 'Add criterion',
    remove: 'Remove criterion',
    up: 'Move earlier',
    apply: 'Apply guided fields',
    preview: 'Preview without earning',
    json: 'Advanced course JSON',
    load: 'Apply JSON',
    export: 'Export course, rewards and demonstration',
    import: 'Import studio bundle',
    demo: 'Optional exact demonstration JSON',
    reward: 'Reward requires this distinct course in either allowed mode.',
    success: 'Validated. Studio preview cannot earn campaign rewards.',
    failure: 'Draft needs correction',
    min: 'Minimum volume',
    max: 'Maximum volume',
    centred: 'Require centred attitude controls',
  },
  uk: {
    title: 'Студія вправ польоту',
    note: 'Авторський перегляд не дає винагород. Зміни потребують нової ревізії вправи та відповідних демонстрацій перед допуском видання.',
    course: 'Вправа',
    mode: 'Критерії для режиму',
    revision: 'Ревізія',
    rewardRevision: 'Ревізія винагороди (змініть для нової прив’язки вправи)',
    titleField: 'Назва',
    brief: 'Підказка / мета',
    lesson: 'Пояснення відкриття',
    steps: 'Послідовні критерії',
    type: 'Тип',
    add: 'Додати критерій',
    remove: 'Видалити критерій',
    up: 'Перемістити раніше',
    apply: 'Застосувати поля',
    preview: 'Перегляд без винагород',
    json: 'Розширений JSON вправи',
    load: 'Застосувати JSON',
    export: 'Експорт вправи, винагород і демонстрації',
    import: 'Імпорт пакета студії',
    demo: 'Необов’язковий JSON точної демонстрації',
    reward: 'Винагорода потребує цієї окремої вправи в будь-якому дозволеному режимі.',
    success: 'Перевірено. Авторський перегляд не дає винагород кампанії.',
    failure: 'Чернетка потребує виправлень',
    min: 'Мінімум об’єму',
    max: 'Максимум об’єму',
    centred: 'Вимагати центрування керування нахилом',
  },
};
export function validateFlightStudioBundle(input) {
  const value = boundedJSON(input, {
    maxBytes: 2 * 1024 * 1024,
    maxNodes: 230000,
    maxArray: 36000,
    maxDepth: 16,
  });
  exactKeys(value, ['format', 'course', 'rewards', 'demonstration'], 'flight studio bundle');
  required(value.format === 'FlightStudioBundle.v1', 'Unknown flight studio bundle');
  const course = validateFlightCourse(value.course),
    rewards = validateCompletionRewards(value.rewards);
  const expected = flightRewardDefinitions([course])[0];
  required(
    rewards.length === 1 &&
      canonicalJSON(rewards[0].requirements) === canonicalJSON(expected.requirements),
    'Practice reward must retain its exact course requirements',
  );
  required(
    rewards[0].brandId === expected.brandId &&
      rewards[0].campaignId === expected.campaignId &&
      canonicalJSON(rewards[0].scope) === canonicalJSON(expected.scope),
    'Practice reward must retain its selected course owner and scope',
  );
  required(
    rewards[0].payloads.every((payload) => payload.type === 'knowledge') &&
      rewards[0].teaserImage === undefined &&
      rewards[0].audioGroups === undefined,
    'Flight Studio requires knowledge payloads; media and cosmetics need a selected asset adapter',
  );
  if (value.demonstration !== null) {
    required(
      value.demonstration.session === 'demonstration',
      'Only ineligible demonstrations belong in Studio',
    );
    required(
      replayFlight(course, value.demonstration).state.status === 'complete',
      'Demonstration must complete this exact course',
    );
  }
  return { format: value.format, course, rewards, demonstration: value.demonstration };
}
/** Rebinding preserves authored copy and payloads, with an explicit new promise revision. */
export function rebindFlightPracticeReward(input, course, revision) {
  const original = validateCompletionReward(input),
    expected = flightRewardDefinitions([course])[0],
    rebound = { ...structuredClone(original), revision, requirements: expected.requirements };
  required(
    canonicalJSON(original.requirements) === canonicalJSON(expected.requirements) ||
      revision !== original.revision,
    'Changed course binding needs a new reward revision',
  );
  return validateFlightStudioBundle({
    format: 'FlightStudioBundle.v1',
    course,
    rewards: [rebound],
    demonstration: null,
  }).rewards[0];
}

export function mountFlightStudio({ container, courses, locale = 'en', onPreview = () => {} }) {
  const doc = container.ownerDocument;
  locale = COPY[locale] ? locale : 'en';
  let copy = COPY[locale];
  const localized = new Map(),
    importedDrafts = new Map();
  let draft = structuredClone(courses[0]),
    selectedStep = 0,
    fields = [],
    disposed = false,
    rewardDraft = flightRewardDefinitions([draft])[0];
  const make = (tag, text, parent = container) => {
    const node = doc.createElement(tag);
    if (text !== undefined) {
      node.textContent = typeof text === 'function' ? text() : text;
      const key = Object.keys(copy).find((name) => copy[name] === text);
      if (typeof text === 'function') localized.set(node, text);
      else if (key && tag !== 'option') localized.set(node, () => copy[key]);
    }
    parent.append(node);
    return node;
  };
  const label = (text, parent = container) => make('label', text, parent);
  const button = (text, action, parent = container) => {
    const node = make('button', text, parent);
    node.type = 'button';
    node.onclick = () => {
      try {
        action();
      } catch (error) {
        status.textContent = `${copy.failure}: ${error.message}`;
      }
    };
    return node;
  };
  make('h2', copy.title);
  make('p', copy.note);
  const status = make('p');
  status.setAttribute('role', 'status');
  const selector = make('select', undefined, label(copy.course));
  for (const course of courses) {
    const option = make('option', course.locales[locale].title, selector);
    option.value = course.id;
  }
  selector.value = courses[0].id;
  const revision = make('input', undefined, label(copy.revision));
  revision.maxLength = 80;
  const rewardRevision = make('input', undefined, label(copy.rewardRevision));
  rewardRevision.maxLength = 128;
  const textFields = {};
  for (const lang of ['en', 'uk']) {
    const group = make('fieldset');
    make('legend', lang, group);
    textFields[lang] = {};
    for (const [key, title] of [
      ['title', 'titleField'],
      ['brief', 'brief'],
      ['lesson', 'lesson'],
    ]) {
      const node = make('textarea', undefined, label(copy[title], group));
      node.rows = key === 'title' ? 1 : 3;
      node.maxLength = 2048;
      textFields[lang][key] = node;
    }
  }
  const mode = make('select', undefined, label(copy.mode));
  for (const id of ['self-level', 'acro']) {
    const option = make('option', id, mode);
    option.value = id;
  }
  mode.value = 'self-level';
  const steps = make('select', undefined, label(copy.steps)),
    criteria = make('fieldset');
  function field(parent, text, path, value, type = 'number') {
    const input = make('input', undefined, label(text, parent));
    input.type = type;
    if (type === 'checkbox') input.checked = value;
    else input.value = value ?? '';
    if (type === 'number') input.step = '1';
    fields.push({ input, path, type });
  }
  function renderCriterion() {
    fields = [];
    for (const node of localized.keys()) if (criteria.contains(node)) localized.delete(node);
    criteria.replaceChildren();
    const step = draft.steps[mode.value][selectedStep];
    if (!step) return;
    make('legend', `${selectedStep + 1} · ${step.type}`, criteria);
    if (step.type === 'gate') {
      for (const key of ['axis', 'at', 'direction', 'minSide', 'maxSide', 'minY', 'maxY'])
        field(criteria, key, [key], step[key], key === 'axis' ? 'text' : 'number');
    } else {
      for (const side of ['min', 'max'])
        for (const axis of ['x', 'y', 'z'])
          field(criteria, () => `${copy[side]} ${axis} (mm)`, [side, axis], step[side][axis]);
      for (const key of ['ticks', 'maxSpeed', 'maxTilt', 'minTilt', 'heading'])
        field(criteria, key, [key], step[key]);
      field(criteria, copy.centred, ['centred'], step.centred, 'checkbox');
    }
  }
  function render() {
    revision.value = draft.revision;
    rewardRevision.value = rewardDraft.revision;
    for (const lang of ['en', 'uk'])
      for (const key of ['title', 'brief', 'lesson'])
        textFields[lang][key].value = draft.locales[lang][key];
    steps.replaceChildren();
    draft.steps[mode.value].forEach((step, i) => {
      const option = make('option', `${i + 1} · ${step.type}`, steps);
      option.value = String(i);
    });
    selectedStep = Math.min(selectedStep, draft.steps[mode.value].length - 1);
    steps.value = String(selectedStep);
    renderCriterion();
    advanced.value = JSON.stringify(draft, null, 2);
  }
  function apply() {
    const next = structuredClone(draft);
    next.revision = revision.value;
    for (const lang of ['en', 'uk'])
      for (const key of ['title', 'brief', 'lesson'])
        next.locales[lang][key] = textFields[lang][key].value;
    const criterion = next.steps[mode.value][selectedStep];
    for (const { input, path, type } of fields) {
      const owner = path.length === 2 ? criterion[path[0]] : criterion;
      owner[path.at(-1)] =
        type === 'checkbox'
          ? input.checked
          : type === 'number'
            ? input.value === ''
              ? null
              : Number(input.value)
            : input.value;
    }
    const original = courses.find((course) => course.id === next.id);
    if (original && JSON.stringify(next) !== JSON.stringify(original))
      required(
        next.revision !== original.revision,
        'Changed course needs a new immutable revision',
      );
    const validated = validateFlightCourse(next),
      reward = rebindFlightPracticeReward(rewardDraft, validated, rewardRevision.value);
    draft = validated;
    rewardDraft = reward;
    rememberDraft();
    status.textContent = copy.success;
    render();
  }
  selector.onchange = () => {
    const imported = importedDrafts.get(selector.value);
    draft = structuredClone(
      imported?.course ?? courses.find((course) => course.id === selector.value),
    );
    rewardDraft = imported?.reward ?? flightRewardDefinitions([draft])[0];
    demo.value = imported?.demonstration ?? '';
    selectedStep = 0;
    render();
  };
  mode.onchange = () => {
    selectedStep = 0;
    render();
  };
  steps.onchange = () => {
    selectedStep = Number(steps.value);
    renderCriterion();
  };
  button(copy.apply, apply);
  const type = make('select', undefined, label(copy.type));
  for (const kind of ['hold', 'land', 'gate']) {
    const option = make('option', kind, type);
    option.value = kind;
  }
  type.value = 'hold';
  button(copy.add, () => {
    const step =
      type.value === 'gate'
        ? {
            type: 'gate',
            axis: 'z',
            at: -5000,
            direction: -1,
            minSide: -1500,
            maxSide: 1500,
            minY: 700,
            maxY: 3500,
          }
        : {
            type: type.value,
            min: { x: -1000, y: 0, z: -1000 },
            max: { x: 1000, y: 2000, z: 1000 },
            ticks: 50,
            maxSpeed: 1000,
            maxTilt: 2000,
            minTilt: 0,
            centred: false,
            heading: null,
          };
    required(draft.steps[mode.value].length < 32, 'Criterion limit reached');
    draft.steps[mode.value].push(step);
    selectedStep = draft.steps[mode.value].length - 1;
    render();
  });
  button(copy.remove, () => {
    required(draft.steps[mode.value].length > 1, 'Keep at least one criterion');
    draft.steps[mode.value].splice(selectedStep, 1);
    render();
  });
  button(copy.up, () => {
    if (!selectedStep) return;
    const list = draft.steps[mode.value];
    [list[selectedStep - 1], list[selectedStep]] = [list[selectedStep], list[selectedStep - 1]];
    selectedStep--;
    render();
  });
  make('p', copy.reward);
  const advanced = make('textarea', undefined, label(copy.json));
  advanced.rows = 8;
  advanced.maxLength = 65536;
  button(copy.load, () => {
    const next = validateFlightCourse(advanced.value),
      original = courses.find((course) => course.id === next.id);
    if (original && JSON.stringify(next) !== JSON.stringify(original))
      required(
        next.revision !== original.revision,
        'Changed course needs a new immutable revision',
      );
    const reward = rebindFlightPracticeReward(rewardDraft, next, rewardRevision.value);
    draft = next;
    rewardDraft = reward;
    rememberDraft();
    render();
  });
  const demo = make('textarea', undefined, label(copy.demo));
  demo.rows = 3;
  demo.maxLength = 1024 * 1024;
  function rememberDraft() {
    if (importedDrafts.has(draft.id))
      importedDrafts.set(draft.id, {
        course: structuredClone(draft),
        reward: rewardDraft,
        demonstration: demo.value,
      });
  }
  const bundle = make('textarea');
  bundle.rows = 5;
  bundle.maxLength = 2 * 1024 * 1024;
  bundle.setAttribute('aria-label', 'Flight Studio bundle JSON');
  button(copy.export, () => {
    apply();
    bundle.value = JSON.stringify(
      validateFlightStudioBundle({
        format: 'FlightStudioBundle.v1',
        course: draft,
        rewards: [rewardDraft],
        demonstration: demo.value.trim() ? JSON.parse(demo.value) : null,
      }),
    );
  });
  button(copy.import, () => {
    const value = validateFlightStudioBundle(bundle.value);
    required(
      importedDrafts.has(value.course.id) || importedDrafts.size < 32,
      'Imported course draft limit reached; keep an export before opening a new Studio',
    );
    const original = courses.find((course) => course.id === value.course.id);
    if (original && canonicalJSON(value.course) !== canonicalJSON(original))
      required(
        value.course.revision !== original.revision,
        'Changed course needs a new immutable revision',
      );
    if (
      value.rewards[0].id === rewardDraft.id &&
      canonicalJSON(value.rewards[0]) !== canonicalJSON(rewardDraft)
    )
      required(
        value.rewards[0].revision !== rewardDraft.revision,
        'Changed reward needs a new immutable revision',
      );
    draft = value.course;
    rewardDraft = value.rewards[0];
    if (![...selector.options].some((option) => option.value === draft.id)) {
      const option = make('option', draft.locales[locale].title, selector);
      option.value = draft.id;
    }
    selector.value = draft.id;
    selectedStep = 0;
    demo.value = value.demonstration ? JSON.stringify(value.demonstration) : '';
    importedDrafts.set(draft.id, {
      course: structuredClone(draft),
      reward: rewardDraft,
      demonstration: demo.value,
    });
    render();
    status.textContent = copy.success;
  });
  button(copy.preview, () => {
    apply();
    onPreview(structuredClone(draft));
    status.textContent = copy.success;
  });
  render();
  return {
    snapshot: () => structuredClone(draft),
    reward: () => structuredClone(rewardDraft),
    setLocale(next) {
      if (disposed || !COPY[next] || next === locale) return;
      const previous = copy;
      locale = next;
      copy = COPY[next];
      for (const [node, resolve] of localized) {
        if (node.firstChild?.nodeType === 3) node.firstChild.nodeValue = resolve();
      }
      for (const option of selector.options) {
        const course =
          importedDrafts.get(option.value)?.course ??
          courses.find((item) => item.id === option.value) ??
          (draft.id === option.value ? draft : null);
        if (course) option.textContent = course.locales[locale].title;
      }
      if (status.textContent === previous.success) status.textContent = copy.success;
      else if (status.textContent.startsWith(previous.failure + ':'))
        status.textContent = copy.failure + status.textContent.slice(previous.failure.length);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const node of container.querySelectorAll('button')) node.onclick = null;
      selector.onchange = mode.onchange = steps.onchange = null;
      localized.clear();
      importedDrafts.clear();
      container.replaceChildren();
    },
  };
}
