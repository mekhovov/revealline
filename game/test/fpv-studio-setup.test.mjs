import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import {
  flightRewardDefinitions,
  mountFlightNotebook,
} from '../../optional-practice/civilian-fpv/notebook.mjs';
import {
  mountFlightStudio,
  rebindFlightPracticeReward,
  validateFlightStudioBundle,
} from '../../optional-practice/civilian-fpv/studio.mjs';
import { mountRadioSetup } from '../../optional-practice/civilian-fpv/radio-setup.mjs';
import { createRadioRuntime } from '../../optional-practice/civilian-fpv/radio-runtime.mjs';
import {
  DEFAULT_RESPONSE,
  RADIO_FORMAT,
  radioDeviceIdentity,
} from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

function dom(t) {
  const document = new Document(),
    create = document.createElement.bind(document);
  // Model the label's native first text child without changing its nested control.
  document.createElement = (...args) => {
    const node = create(...args);
    Object.defineProperty(node, 'firstChild', {
      get: () =>
        node._text
          ? {
              nodeType: 3,
              get textContent() {
                return node._text;
              },
              set textContent(value) {
                node._text = value;
              },
              get nodeValue() {
                return node._text;
              },
              set nodeValue(value) {
                node._text = value;
              },
            }
          : (node.children[0] ?? null),
    });
    return node;
  };
  const container = document.createElement('section');
  document.body.append(container);
  const click = (text) => {
    const node = container.querySelectorAll('button').find((item) => item.textContent === text);
    assert.ok(node, text);
    node.emit('click');
  };
  const input = (text, type = 'input') => {
    const label = container.querySelectorAll('label').find((node) => node._text === text);
    assert.ok(label, text);
    return label.querySelector(type);
  };
  t.after(() => container.remove());
  return { document, container, click, input };
}
function bundle() {
  const course = structuredClone(FLIGHT_COURSES[0]),
    reward = structuredClone(flightRewardDefinitions([course])[0]);
  reward.revision = 'author-2';
  reward.locales.en.teaser = 'An authored promise';
  reward.locales.uk.teaser = 'Авторська обіцянка';
  reward.payloads[0].locales.en.paragraphs.push('A second authored observation.');
  return {
    format: 'FlightStudioBundle.v1',
    course,
    rewards: [reward],
    demonstration: FLIGHT_DEMONSTRATIONS[0],
  };
}

test('Flight Studio actual import/export preserves authored rewards and locale switches keep unapplied fields', (t) => {
  const f = dom(t),
    previews = [];
  const studio = mountFlightStudio({
    container: f.container,
    courses: FLIGHT_COURSES,
    onPreview: (course) => previews.push(course),
  });
  t.after(() => studio.dispose());
  const packet = bundle();
  const transfer = f.container
    .querySelectorAll('textarea')
    .find((node) => node.getAttribute('aria-label') === 'Flight Studio bundle JSON');
  transfer.value = JSON.stringify(packet);
  f.click('Import studio bundle');
  assert.deepEqual(studio.reward(), packet.rewards[0]);
  f.click('Export course, rewards and demonstration');
  assert.deepEqual(JSON.parse(transfer.value), packet);
  const title = f.container.querySelectorAll('fieldset')[0].querySelector('textarea');
  const typed = 'An unapplied authored title';
  title.value = typed;
  title.focus();
  const revision = f.input('Revision');
  revision.value = 'course-2';
  const rewardRevision = f.input('Reward revision (change when rebinding the course)');
  rewardRevision.value = 'author-3';
  studio.setLocale('uk');
  assert.equal(title.value, typed);
  assert.equal(revision.value, 'course-2');
  assert.equal(rewardRevision.value, 'author-3');
  assert.equal(f.document.activeElement, title);
  assert.deepEqual(studio.reward(), packet.rewards[0]);
  f.click('Перегляд без винагород');
  assert.equal(previews.length, 1);
  assert.equal(previews[0].locales.en.title, typed);
  assert.equal(studio.reward().revision, 'author-3');
  assert.deepEqual(studio.reward().payloads, packet.rewards[0].payloads);
  assert.notDeepEqual(studio.reward().requirements, packet.rewards[0].requirements);
  f.click('Експорт вправи, винагород і демонстрації');
  assert.match(
    f.container.querySelector('[role="status"]').textContent,
    /Exact flight/,
    'Old demonstration must not silently bind to the revised course.',
  );
});

test('practice studio rejects foreign ownership, unsupported dependencies and unchanged rebind revisions', () => {
  for (const change of [
    (reward) => {
      reward.brandId = 'other-brand';
    },
    (reward) => {
      reward.campaignId = 'other-campaign';
    },
    (reward) => {
      reward.scope = { kind: 'campaign', id: reward.campaignId };
    },
    (reward) => {
      reward.payloads = [
        {
          id: 'image',
          type: 'image',
          asset: { assetId: 'unknown-image', sha256: 'a'.repeat(64) },
          locales: {
            en: { title: 'Image', alt: 'Image' },
            uk: { title: 'Зображення', alt: 'Зображення' },
          },
        },
      ];
    },
  ]) {
    const value = bundle();
    change(value.rewards[0]);
    assert.throws(() => validateFlightStudioBundle(value));
  }
  const value = bundle(),
    revised = { ...value.course, revision: 'r2' };
  assert.throws(
    () => rebindFlightPracticeReward(value.rewards[0], revised, value.rewards[0].revision),
    /new reward revision/,
  );
  const result = rebindFlightPracticeReward(value.rewards[0], revised, 'author-3');
  assert.deepEqual(result.payloads, value.rewards[0].payloads);
  assert.equal(result.revision, 'author-3');
});

test('Radio setup import, explicit verification and save retain switch threshold and inversion', (t) => {
  const f = dom(t),
    win = new Events(),
    frames = new Map(),
    values = new Map();
  let next = 0,
    selected,
    saved,
    missing = false;
  const pad = {
    id: 'Test USB radio',
    index: 1,
    mapping: '',
    connected: true,
    axes: [0, 0, 0, -1],
    buttons: [{ value: 1 }, { value: 0 }],
  };
  Object.assign(win, {
    Event,
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
    requestAnimationFrame: (fn) => {
      frames.set(++next, fn);
      return next;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
  });
  const profile = {
    format: RADIO_FORMAT,
    id: 'usb-radio-v1',
    name: pad.id,
    device: radioDeviceIdentity(pad),
    stickMode: 2,
    throttleStyle: 'full-travel',
    verified: true,
    channels: Object.fromEntries(
      ['roll', 'pitch', 'yaw', 'throttle'].map((control, axis) => [
        control,
        {
          axis,
          min: -1,
          max: 1,
          center: control === 'throttle' ? null : 0,
          invert: false,
          deadZone: control === 'throttle' ? 0 : 0.02,
        },
      ]),
    ),
    switches: { arm: { button: 0, threshold: 0.75, invert: true }, pause: null, reset: null },
  };
  const runtime = createRadioRuntime({ getGamepads: () => (missing ? [] : [pad]) }),
    selectRadio = runtime.select,
    setRadioProfile = runtime.setProfile;
  runtime.select = (id) => {
    selected = id;
    return selectRadio(id);
  };
  runtime.setProfile = (p, options) => {
    saved = p;
    return setRadioProfile(p, options);
  };
  const setup = mountRadioSetup({ container: f.container, window: win, runtime });
  t.after(() => setup.dispose());
  const device = f.input('Your radio', 'select');
  device.value = '1';
  device.emit('change');
  assert.equal(selected, 1);
  setup.store.save({ ...setup.store.snapshot(), radio: profile, response: DEFAULT_RESPONSE });
  f.input('Profile JSON', 'textarea').value = setup.store.export();
  f.click('Import profiles');
  assert.equal(
    f.container
      .querySelectorAll('label')
      .filter((node) => node._text === 'Activation threshold')[0]
      .querySelector('input').value,
    '0.75',
  );
  f.click('I checked the animated sticks and their direction');
  f.click('Save verified profile');
  assert.deepEqual(saved.switches, profile.switches);
  missing = true;
  assert.doesNotThrow(() => device.emit('change'));
  assert.match(f.container.querySelector('.radio-feedback').textContent, /Choose a device/);
  f.click('Save verified profile');
  assert.match(f.container.querySelector('.radio-feedback').textContent, /incomplete/);
  missing = false;
  device.emit('change');
  f.click('Record full travel');
  f.click('I checked the animated sticks and their direction');
  assert.match(f.container.querySelector('.radio-feedback').textContent, /incomplete/);
});

test('Acro notebook review chooses only evidence satisfying its mode rule', async (t) => {
  const f = dom(t),
    db = managedIndexedDB(),
    win = { indexedDB: db.indexedDB },
    reviewed = [];
  const view = mountFlightNotebook({
    container: f.container,
    window: win,
    courses: [FLIGHT_COURSES[0]],
    onReview: (value) => reviewed.push(value),
  });
  t.after(() => view.dispose());
  await view.ready;
  await view.accept({ ...structuredClone(FLIGHT_DEMONSTRATIONS[1]), session: 'practice' });
  await view.accept({ ...structuredClone(FLIGHT_DEMONSTRATIONS[0]), session: 'practice' });
  const acro = f.container
    .querySelectorAll('article')
    .find((node) => node.querySelector('h3').textContent === 'Acro distinction');
  assert.ok(acro);
  acro
    .querySelectorAll('button')
    .find((node) => node.textContent === 'Review verified attempt')
    .emit('click');
  assert.equal(reviewed.at(-1).mode, 'acro');
});

test('a custom imported course remains selectable with its exact reward and demonstration slot', (t) => {
  const f = dom(t),
    studio = mountFlightStudio({ container: f.container, courses: FLIGHT_COURSES });
  t.after(() => studio.dispose());
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.id = 'custom-landing';
  course.revision = 'author-course-1';
  const reward = structuredClone(flightRewardDefinitions([course])[0]);
  reward.revision = 'author-reward-1';
  reward.payloads[0].locales.en.paragraphs.push('Preserve this authored explanation.');
  const packet = {
    format: 'FlightStudioBundle.v1',
    course,
    rewards: [reward],
    demonstration: null,
  };
  const transfer = f.container
    .querySelectorAll('textarea')
    .find((node) => node.getAttribute('aria-label') === 'Flight Studio bundle JSON');
  transfer.value = JSON.stringify(packet);
  f.click('Import studio bundle');
  const selector = f.input('Course', 'select');
  selector.value = 'flight-02';
  selector.emit('change');
  assert.equal(studio.snapshot().id, 'flight-02');
  selector.value = 'custom-landing';
  assert.doesNotThrow(() => selector.emit('change'));
  assert.deepEqual(studio.snapshot(), course);
  assert.deepEqual(studio.reward(), reward);
  f.click('Export course, rewards and demonstration');
  assert.deepEqual(JSON.parse(transfer.value), packet);
});

test('notebook import has a neutral localized Cancel action and disposal aborts a pending transfer', async (t) => {
  const f = dom(t),
    db = managedIndexedDB();
  const view = mountFlightNotebook({
    container: f.container,
    window: { indexedDB: db.indexedDB },
    courses: FLIGHT_COURSES,
  });
  t.after(() => view.dispose());
  await view.ready;
  const transfer = f.container.querySelector('textarea');
  const source = {
    format: 'FlightProofBackup.v1',
    packageId: 'civilian-fpv',
    attempts: [{ ...structuredClone(FLIGHT_DEMONSTRATIONS[0]), session: 'practice' }],
  };
  transfer.value = JSON.stringify(source);
  const button = (text) =>
    f.container.querySelectorAll('button').find((node) => node.textContent === text);
  const importing = button('Import and reverify proofs'),
    cancel = button('Cancel import');
  const before = view.snapshot(),
    writes = db.allPuts.length;
  const pending = importing.onclick();
  assert.equal(importing.disabled, true);
  assert.equal(cancel.hidden, false);
  cancel.focus();
  cancel.onclick();
  await pending;
  assert.equal(cancel.hidden, true);
  assert.equal(importing.disabled, false);
  assert.equal(f.document.activeElement, importing);
  assert.match(f.container.querySelector('[role="status"]').textContent, /^Import cancelled/);
  assert.equal(transfer.value, JSON.stringify(source));
  assert.deepEqual(view.snapshot().rewards, before.rewards);
  assert.equal(db.allPuts.length, writes);
  view.setLocale('uk');
  assert.match(f.container.querySelector('[role="status"]').textContent, /^Імпорт скасовано/);
  const second = importing.onclick();
  await view.dispose();
  await second;
  assert.equal(f.container.children.length, 0);
  assert.equal(db.allPuts.length, writes);
  await assert.rejects(view.accept(source.attempts[0]), { name: 'AbortError' });
  assert.equal(f.container.children.length, 0);
});
