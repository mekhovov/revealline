import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { mountFlightTuning } from '../../optional-practice/civilian-fpv/tuning-ui.mjs';
import {
  createTuningLibraryStore,
  TUNING_LIBRARY_KEY,
} from '../../optional-practice/civilian-fpv/tuning-library.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import { exportNativeRateProfile } from '../../optional-practice/civilian-fpv/betaflight-import.mjs';

const settle = () => new Promise((resolve) => setImmediate(resolve));
function fixture(t, { locale = 'en', getDiagnostics, locks, platformOptions } = {}) {
  let currentLocale = locale;
  const document = new Document(),
    window = new Events(),
    data = new Map(),
    frames = new Map();
  document.createElementNS = (_namespace, tag) => document.createElement(tag);
  let nextFrame = 0;
  Object.assign(window, {
    requestAnimationFrame(callback) {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
  });
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const store = createTuningLibraryStore({ storage, locks }),
    applied = [],
    tested = [],
    saved = [],
    closed = [];
  const ui = mountFlightTuning({
    document,
    window,
    store,
    locale: () => currentLocale,
    getDiagnostics,
    platformOptions,
    onApply: (config) => applied.push(config),
    onTest: (config) => tested.push(config),
    onSaved: (config) => saved.push(config),
    onClose: (context) => closed.push(context),
  });
  // The minimal DOM does not update a select when its first option's value is
  // assigned after insertion. Native HTML selects choose that first option.
  for (const select of ui.root.querySelectorAll('select'))
    if (select.selectedIndex < 0 && select.options.length) select.value = select.options[0].value;
  t.after(() => ui.dispose());
  ui.open();
  const find = (label, tag = 'input', scope = ui.root, type) => {
    const candidates = scope
      .querySelectorAll('label')
      .filter((node) => node._text === label)
      .flatMap((node) => node.querySelectorAll(tag))
      .filter((node) => !type || node.type === type);
    assert.ok(candidates[0], `Missing control: ${label} (${tag}/${type ?? ''})`);
    return candidates[0];
  };
  const click = async (label, scope = ui.root) => {
    const button = scope.querySelectorAll('button').find((node) => node.textContent === label);
    assert.ok(button, `Missing button: ${label}`);
    button.emit('click');
    await settle();
  };
  const edit = (label, value, { tag = 'input', event = 'input', scope = ui.root, type } = {}) => {
    const node = find(label, tag, scope, type);
    node.value = String(value);
    node.emit(event);
    return node;
  };
  const axis = (name) =>
    ui.root
      .querySelectorAll('fieldset')
      .find((node) => node.querySelector('legend')?.textContent === name);
  const draft = async () => {
    await click('Export SIM rates');
    return JSON.parse(find('Paste CLI or a SIM rate profile', 'textarea').value).profile;
  };
  const frame = (time) => {
    const callbacks = [...frames.values()];
    frames.clear();
    for (const callback of callbacks) callback(time);
  };
  return {
    document,
    window,
    storage,
    store,
    ui,
    applied,
    tested,
    saved,
    closed,
    find,
    click,
    edit,
    axis,
    draft,
    frame,
    frames,
    setLocale(value) {
      currentLocale = value;
      ui.refresh();
    },
  };
}

test('pointer opening restores focus to its trigger even when the browser did not focus it', async (t) => {
  const f = fixture(t);
  f.ui.close();
  const trigger = f.ui.button(f.document.body);
  f.document.body.focus();
  trigger.emit('click');
  await settle();
  assert.equal(f.ui.root.open, true);
  f.ui.close();
  assert.equal(f.document.activeElement, trigger);
});

test('native tuning downloads use JSON and inert CLI shares and retain text after cancellation', async (t) => {
  const exports = [];
  const f = fixture(t, {
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/optional-practice/civilian-fpv/' },
      loadBridge: async () => ({
        exportJSON(value) {
          exports.push(['json', value]);
          return { status: 'cancelled' };
        },
        exportText(value) {
          exports.push(['text', value]);
          return { status: 'shared' };
        },
      }),
    },
  });
  await f.click('New Actual profile');
  await f.click('Export SIM rates');
  const input = f.find('Paste CLI or a SIM rate profile', 'textarea');
  const original = input.value;
  await f.click('Download file');
  assert.equal(exports[0][0], 'json');
  assert.deepEqual(JSON.parse(exports[0][1].text), JSON.parse(original));
  assert.equal(input.value, original);
  assert.match(f.ui.root.textContent, /Sharing cancelled/);
  f.edit('Source / export firmware version', '2025.12.5', { tag: 'select', event: 'change' });
  await f.click('Export rate-only CLI');
  const cli = input.value;
  await f.click('Download file');
  assert.deepEqual(exports[1], ['text', { text: cli, name: 'fpv-tuning.txt' }]);
  assert.match(f.ui.root.textContent, /Shared with the selected app/);
});

test('a pending export cannot duplicate or report its late failure into a reopened editor', async (t) => {
  let failShare,
    exports = 0;
  const f = fixture(t, {
    platformOptions: {
      locationRef: { href: 'capacitor://localhost/' },
      loadBridge: async () => ({
        exportJSON() {
          exports++;
          return new Promise((_resolve, reject) => {
            failShare = reject;
          });
        },
      }),
    },
  });
  await f.click('Backup complete library');
  await f.click('Download file');
  await f.click('Download file');
  assert.equal(exports, 1);
  await f.click('Close');
  f.ui.open();
  failShare(new Error('Old share failed'));
  await settle();
  assert.doesNotMatch(f.ui.root.textContent, /Old share failed/);
});

test('algorithm drafts retain native values and linked roll/pitch edits keep yaw independent', async (t) => {
  const f = fixture(t);
  assert.equal(f.find('Rate algorithm', 'select').value, 'legacy');
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Center sensitivity (°/s)', 180, { scope: f.axis('Roll'), type: 'number' });
  const link = f.find('Link roll and pitch edits');
  link.checked = true;
  link.emit('change');
  f.edit('Maximum rate (°/s)', 940, { scope: f.axis('Roll'), type: 'number' });
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Pitch'), 'number').value, '940');
  let profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 18);
  assert.equal(profile.axes.roll.rate, 94);
  assert.equal(profile.axes.pitch.rate, 94);
  assert.equal(profile.axes.yaw.rate, 67);
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  f.edit('RC rate', 1.25, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Super rate', 0.73, { scope: f.axis('Roll'), type: 'number' });
  profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 125);
  assert.equal(profile.axes.roll.rate, 73);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  profile = await f.draft();
  assert.equal(profile.axes.roll.rcRate, 18);
  assert.equal(profile.axes.roll.rate, 94);
  f.edit('Rate algorithm', 'betaflight', { tag: 'select', event: 'change' });
  assert.equal((await f.draft()).axes.roll.rcRate, 125);
  assert.equal(f.store.snapshot().revision, 0, 'Draft editing must not save or apply settings.');
});

test('curve overlays, axis visibility and diagnostics show actual available measurements', async (t) => {
  const f = fixture(t, {
    getDiagnostics: () => ({
      raw: [0.2, -0.4],
      calibrated: { roll: 0.5, pitch: 0, yaw: -0.5 },
      achieved: { roll: 120, pitch: 0, yaw: -80 },
      sampleAgeMs: 12,
      cadenceHz: null,
    }),
  });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  const svg = f.ui.root.querySelector('svg');
  assert.equal(svg.querySelectorAll('path').length, 6);
  assert.equal(
    svg.querySelectorAll('path').filter((path) => path.getAttribute('stroke-dasharray')).length,
    3,
  );
  const yaw = f.find('Yaw');
  yaw.checked = false;
  yaw.emit('change');
  assert.equal(svg.querySelectorAll('path').length, 4);
  f.frame(250);
  const diagnostics = f.ui.root.querySelector('[aria-label="Input diagnostics"]').textContent;
  assert.match(diagnostics, /"roll":185/);
  assert.match(diagnostics, /"roll":120/);
  assert.match(diagnostics, /Browser sample age \(ms\): 12/);
  assert.match(diagnostics, /cadence \(Hz\): unavailable/);
  const motion = f.find('Animate rotation preview');
  motion.checked = true;
  f.frame(500);
  f.frame(525);
  assert.notEqual(f.ui.root.querySelector('.tuning-quad').style.transform, 'rotateZ(0deg)');
});

test('save for next flight never invokes restart; apply and restart is a distinct explicit action', async (t) => {
  const f = fixture(t),
    active = f.store.effective();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Save for next flight');
  assert.equal(f.applied.length, 0);
  assert.equal(f.saved.length, 1);
  assert.equal(f.ui.root.open, true);
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
  assert.equal(active.response.format, 'FlightResponseProfile.v1');
  f.edit('Maximum rate (°/s)', 1020, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].response.rates.axes.roll.rate, 102);
  assert.equal(f.ui.root.open, false);
});

test('unscored draft test returns to the same numeric and camera draft, then reverts without saving', async (t) => {
  const f = fixture(t),
    before = f.store.export();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 850, { scope: f.axis('Yaw'), type: 'number' });
  f.edit('Camera tilt (degrees)', 32);
  f.edit('Vertical FOV (degrees)', 103);
  await f.click('Test draft · unscored');
  assert.equal(f.ui.root.open, false);
  assert.equal(f.ui.returnButton.hidden, false);
  assert.equal(f.tested.length, 1);
  assert.equal(f.tested[0].response.rates.axes.yaw.rate, 85);
  assert.deepEqual(f.tested[0].camera, { tilt: 32, verticalFov: 103 });
  assert.notEqual(
    f.tested[0].simulationIdentity,
    f.store.effective().simulationIdentity,
    'A draft must not carry the saved configuration identity.',
  );
  assert.deepEqual(f.closed.at(-1), { testing: true });
  assert.equal(f.store.export(), before);
  f.ui.returnButton.emit('click');
  await settle();
  assert.equal(f.ui.root.open, true);
  assert.equal(f.find('Camera tilt (degrees)').value, '32');
  assert.equal((await f.draft()).axes.yaw.rate, 85);
  await f.click('Revert draft');
  assert.equal(f.find('Rate algorithm', 'select').value, 'legacy');
  assert.equal(f.find('Camera tilt (degrees)').value, '10');
  assert.equal(f.store.export(), before);
});

test('import preview creates a new profile only on save and assignment remains explicit', async (t) => {
  const f = fixture(t),
    before = f.store.export();
  const source = exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 99 } } }));
  f.edit('Paste CLI or a SIM rate profile', source, { tag: 'textarea' });
  await f.click('Preview import');
  assert.equal(f.store.export(), before);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  f.edit('Profile name', 'Imported race rates');
  await f.click('Save import as new profile');
  const library = f.store.snapshot(),
    imported = library.profiles.find((item) => item.name === 'Imported race rates');
  assert.ok(imported);
  assert.equal(library.defaultProfileId, 'legacy-feel');
  assert.equal(library.setups[0].profileId, null);
  assert.equal(f.store.effective().profileId, 'legacy-feel');
  f.edit('Rates used by this drone', imported.id, { tag: 'select', event: 'change' });
  await f.click('Save drone assignment & camera');
  assert.equal(f.store.effective().profileId, imported.id);
});

test('malformed import or changed input invalidates an earlier preview and cannot create a profile', async (t) => {
  const f = fixture(t),
    initialCount = f.store.snapshot().profiles.length;
  f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
    tag: 'textarea',
  });
  await f.click('Preview import');
  f.edit('Paste CLI or a SIM rate profile', 'set roll_rc_rate = NaN', { tag: 'textarea' });
  await f.click('Preview import');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /must be an integer/);
  await f.click('Save import as new profile');
  assert.equal(f.store.snapshot().profiles.length, initialCount);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview the import first/);
});

test('headerless CLI version selection and firmware-default baseline support deliberate imports', async (t) => {
  const f = fixture(t);
  f.edit('Operation', 'diff', { tag: 'select', event: 'change' });
  f.edit('Paste CLI or a SIM rate profile', 'rateprofile 1\nset yaw_srate = 74', {
    tag: 'textarea',
  });
  await f.click('Preview import');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /source firmware version/);
  f.edit('Source / export firmware version', '4.5.2', { tag: 'select', event: 'change' });
  await f.click('Preview import');
  let profile = await f.draft();
  assert.equal(profile.axes.yaw.rate, 74);
  assert.equal(profile.throttle.model, 'betaflight-4.5');
  f.edit('Operation', 'patch', { tag: 'select', event: 'change' });
  f.edit('Patch baseline', 'defaults', { tag: 'select', event: 'change' });
  f.edit('Source / export firmware version', '2026.6.2', { tag: 'select', event: 'change' });
  f.edit('Paste CLI or a SIM rate profile', 'set thr_hover = 35\nset p_roll = 80', {
    tag: 'textarea',
  });
  await f.click('Preview import');
  profile = await f.draft();
  assert.equal(profile.throttle.hover, 35);
  assert.equal(profile.axes.yaw.rate, 67);
  assert.match(f.ui.root.textContent, /No verified SIM adapter/);
});

test('shared profile users, name history and per-drone vertical camera values remain visible', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  f.edit('Profile name', 'My Actual');
  await f.click('Save for next flight');
  await f.click('Make player default');
  assert.match(f.ui.root.textContent, /Shared by: My drone · player default/);
  f.edit('Camera tilt (degrees)', 29);
  f.edit('Vertical FOV (degrees)', 105);
  await f.click('Save drone assignment & camera');
  await f.click('Duplicate drone setup');
  assert.equal(f.store.snapshot().setups.length, 2);
  assert.equal(f.store.effective().camera.verticalFov, 105);
  const portable = await f.draft();
  assert.equal(Object.hasOwn(portable, 'camera'), false);
  assert.equal(f.find('Saved revisions', 'select').querySelectorAll('option').length, 1);
  await f.click('Restore revision to draft');
  assert.equal(f.find('Profile name').value, 'New profile');
  assert.equal(
    f.store.snapshot().profiles.find((item) => item.id === f.find('Rate profile', 'select').value)
      .name,
    'My Actual',
  );
});

test('stale tab notification preserves the draft and a save cannot overwrite newer stored settings', async (t) => {
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  const other = createTuningLibraryStore({ storage: f.storage });
  await other.createProfile({ id: 'other-tab', name: 'Other tab' });
  f.window.emit('storage', { key: TUNING_LIBRARY_KEY });
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Another tab/);
  await f.click('Save for next flight');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Another tab/);
  assert.equal((await f.draft()).axes.roll.rate, 91);
  assert.equal(
    JSON.parse(f.storage.getItem(TUNING_LIBRARY_KEY)).profiles[0].response.format,
    'FlightResponseProfile.v1',
  );
  await f.click('Refresh library');
  assert.equal(f.store.snapshot().profiles.length, 2);
});

test('Ukrainian controls retain accessible dialog labels and dispose removes listeners and animation', async (t) => {
  const f = fixture(t, { locale: 'uk' });
  assert.equal(f.ui.root.getAttribute('aria-label'), 'Рейти й газ');
  assert.ok(f.find('Вертикальне поле зору (градуси)'));
  assert.ok(f.ui.root.querySelector('[role="status"]'));
  assert.equal(f.frames.size, 1);
  const parent = f.document.createElement('div');
  f.document.body.append(parent);
  f.ui.button(parent);
  f.ui.dispose();
  assert.equal(f.frames.size, 0);
  assert.equal(parent.querySelectorAll('button').length, 0);
  assert.equal(f.window.listeners.get('storage').size, 0);
  assert.equal(f.ui.root.isConnected, false);
});

test('Apply and restart explicitly assigns an otherwise unassigned new profile to the current drone', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const selected = f.find('Rate profile', 'select').value;
  assert.notEqual(selected, 'legacy-feel');
  assert.equal(f.store.effective().profileId, 'legacy-feel');
  await f.click('Apply & restart');
  assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0].profileId, selected);
  assert.equal(f.store.snapshot().setups[0].profileId, selected);
  assert.equal(f.store.snapshot().defaultProfileId, 'legacy-feel');
});

for (const uploadedRoot of ['firmware-presets', 'presets'])
  test(`local preset folder upload resolves official paths from ${uploadedRoot} and refreshes selected options`, async (t) => {
    const f = fixture(t);
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    const sources = {
      'presets/test/main.txt':
        '#$ INCLUDE: presets/test/base.txt\n#$ OPTION BEGIN (CHECKED): Fast yaw\nset yaw_srate = 90\n#$ OPTION END',
      'presets/test/base.txt': 'set yaw_srate = 80',
    };
    const file = f.find('Local preset folder');
    file.files = Object.entries(sources).map(([path, source]) => ({
      name: path.split('/').at(-1),
      size: source.length,
      webkitRelativePath: uploadedRoot === 'presets' ? path : `${uploadedRoot}/${path}`,
      text: async () => source,
    }));
    file.emit('change');
    await settle();
    assert.equal(f.find('Preset entry path within folder').value, 'presets/test/main.txt');
    await f.click('Resolve preset and review options');
    const option = f.find('Fast yaw');
    assert.equal(option.checked, true);
    await f.click('Preview import');
    assert.equal((await f.draft()).axes.yaw.rate, 90);
    option.checked = false;
    option.emit('change');
    await f.click('Resolve preset and review options');
    await f.click('Preview import');
    assert.equal((await f.draft()).axes.yaw.rate, 80);
    assert.equal(f.store.snapshot().revision, 0);
  });

test('ordinary tuning and camera saves preserve a drone’s existing Advanced aircraft and controller', async (t) => {
  const { validateAdvancedAircraft, createAdvancedAircraftTune } = await import(
    '../../optional-practice/civilian-fpv/advanced-simulation.mjs'
  );
  const f = fixture(t);
  const advanced = {
    aircraft: validateAdvancedAircraft('whoop'),
    controller: createAdvancedAircraftTune('whoop'),
  };
  const previousRevision = f.store.snapshot().revision;
  await f.store.saveSetup({ ...f.store.snapshot().setups[0], advanced });
  f.ui.acceptOwnSave(previousRevision);
  f.ui.close();
  f.ui.open();
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Camera tilt (degrees)', 37);
  await f.click('Save for next flight');
  assert.deepEqual(f.store.effective().advanced, advanced);
  assert.equal(f.store.effective().camera.tilt, 37);
  assert.equal(f.store.effective().response.rates.algorithm, 'actual');
  f.edit('Vertical FOV (degrees)', 111);
  await f.click('Save drone assignment & camera');
  assert.deepEqual(f.store.effective().advanced, advanced);
  assert.equal(f.store.effective().camera.verticalFov, 111);
});

test('a retained draft reopened after another tab edits the same profile cannot overwrite the newer revision', async (t) => {
  const { createTunedResponse } = await import(
    '../../optional-practice/civilian-fpv/flight-response.mjs'
  );
  const f = fixture(t);
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  f.edit('Maximum rate (°/s)', 990, { scope: f.axis('Roll'), type: 'number' });
  f.ui.close();
  const other = createTuningLibraryStore({ storage: f.storage });
  await other.saveProfile('legacy-feel', {
    name: 'Newer edit in another tab',
    response: createTunedResponse(createRateProfile({ axes: { roll: { rate: 51 } } })),
  });
  const newerSaved = f.storage.getItem(TUNING_LIBRARY_KEY);
  f.ui.open();
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /predates a library change/);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  await f.click('Save for next flight');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Settings changed/);
  assert.equal(f.storage.getItem(TUNING_LIBRARY_KEY), newerSaved);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  await f.click('Refresh library');
  assert.equal((await f.draft()).axes.roll.rate, 51);
  assert.equal(f.find('Profile name').value, 'Newer edit in another tab');
});

test('a save waiting for a browser lock keeps its click-time values and disables editing until completion', async (t) => {
  let release;
  const locks = {
    request(_key, work) {
      return new Promise((resolve) => {
        release = () => resolve(work());
      });
    },
  };
  const f = fixture(t, { locks });
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  const rate = f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
  await f.click('Save for next flight');
  assert.equal(typeof release, 'function');
  assert.equal(f.store.snapshot().revision, 0);
  for (const selector of ['input', 'select', 'textarea', 'button'])
    for (const control of f.ui.root.querySelectorAll(selector))
      assert.equal(control.disabled, true, `${selector} must not change a pending save`);
  // A synthetic event may still be dispatched to a disabled DOM node. The
  // library must also retain the snapshot captured before waiting for its lock.
  rate.value = '1020';
  rate.emit('input');
  release();
  await settle();
  assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
  assert.equal(f.saved.length, 1);
  assert.equal(f.find('Rate profile', 'select').disabled, false);
  assert.equal(f.find('Maximum rate (°/s)', 'input', f.axis('Roll'), 'number').disabled, false);
});

for (const failure of ['oversized', 'unreadable'])
  test(`an ${failure} upload invalidates an earlier successful import preview`, async (t) => {
    const f = fixture(t);
    f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
      tag: 'textarea',
    });
    await f.click('Preview import');
    const file = f.find('Upload text / JSON');
    file.files = [
      {
        size: failure === 'oversized' ? 512 * 1024 + 1 : 100,
        text: async () => {
          throw new Error('File cannot be read');
        },
      },
    ];
    file.emit('change');
    await settle();
    await f.click('Save import as new profile');
    assert.equal(f.store.snapshot().profiles.length, 1);
    assert.match(
      f.ui.root.querySelector('[role="status"]').textContent,
      /Preview the import first/,
    );
  });

test('an earlier upload completing after a newer selection cannot replace its text', async (t) => {
  const f = fixture(t),
    file = f.find('Upload text / JSON');
  let finishFirst;
  file.files = [
    {
      size: 100,
      text: () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    },
  ];
  file.emit('change');
  const latest = exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 91 } } }));
  file.files = [{ size: latest.length, text: async () => latest }];
  file.emit('change');
  await settle();
  finishFirst(exportNativeRateProfile(createRateProfile({ axes: { roll: { rate: 51 } } })));
  await settle();
  assert.equal(f.find('Paste CLI or a SIM rate profile', 'textarea').value, latest);
  await f.click('Preview import');
  assert.equal((await f.draft()).axes.roll.rate, 91);
});

test('an invalid preset folder selection clears an existing import preview immediately', async (t) => {
  const f = fixture(t);
  f.edit('Paste CLI or a SIM rate profile', exportNativeRateProfile(createRateProfile()), {
    tag: 'textarea',
  });
  await f.click('Preview import');
  const folder = f.find('Local preset folder');
  folder.files = [{ size: 512 * 1024 + 1, name: 'huge.txt', text: async () => '' }];
  folder.emit('change');
  await settle();
  await f.click('Save import as new profile');
  assert.equal(f.store.snapshot().profiles.length, 1);
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /Preview the import first/);
});

test('overlapping preset folder reads publish only the newest complete bundle', async (t) => {
  const f = fixture(t),
    folder = f.find('Local preset folder');
  f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
  let finishFirst;
  folder.files = [
    {
      size: 100,
      name: 'old.txt',
      text: () =>
        new Promise((resolve) => {
          finishFirst = resolve;
        }),
    },
  ];
  folder.emit('change');
  folder.files = [{ size: 100, name: 'new.txt', text: async () => 'set yaw_srate = 91' }];
  folder.emit('change');
  await settle();
  finishFirst('set yaw_srate = 51');
  await settle();
  assert.equal(f.find('Preset entry path within folder').value, 'new.txt');
  await f.click('Resolve preset and review options');
  await f.click('Preview import');
  assert.equal((await f.draft()).axes.yaw.rate, 91);
  f.edit('Preset entry path within folder', 'old.txt');
  await f.click('Resolve preset and review options');
  assert.match(f.ui.root.querySelector('[role="status"]').textContent, /missing|not found/i);
});

test('switching locale updates accessible controls without changing numeric, name, camera or assignment drafts', async (t) => {
  const f = fixture(t);
  await f.click('New Actual profile');
  const selected = f.find('Rate profile', 'select').value;
  f.edit('Maximum rate (°/s)', 990, { scope: f.axis('Roll'), type: 'number' });
  f.edit('Profile name', 'Мої рейти');
  f.edit('Drone name', 'Локальний дрон');
  f.edit('Camera tilt (degrees)', 60);
  f.edit('Vertical FOV (degrees)', 140);
  f.edit('Rates used by this drone', selected, { tag: 'select', event: 'change' });
  const saved = f.store.export();
  f.setLocale('uk');
  assert.equal(f.ui.root.getAttribute('aria-label'), 'Рейти й газ');
  assert.equal(f.ui.root.querySelector('h2').textContent, 'Рейти й газ');
  assert.equal(f.find('Назва профілю').value, 'Мої рейти');
  assert.equal(f.find('Назва дрона').value, 'Локальний дрон');
  assert.equal(f.find('Нахил камери (градуси)').value, '60');
  assert.equal(f.find('Вертикальне поле зору (градуси)').value, '140');
  assert.equal(f.find('Рейти для цього дрона', 'select').value, selected);
  assert.ok(
    f
      .axis('Крен')
      .querySelectorAll('input')
      .some((node) => node.type === 'number' && node.value === '990'),
  );
  assert.ok(
    f.ui.root
      .querySelectorAll('button')
      .some((node) => node.textContent === 'Зберегти для наступного польоту'),
  );
  assert.equal(f.store.export(), saved);
  f.setLocale('en');
  assert.equal(f.find('Profile name').value, 'Мої рейти');
  assert.equal(f.find('Drone name').value, 'Локальний дрон');
  assert.equal(f.find('Rates used by this drone', 'select').value, selected);
  assert.equal((await f.draft()).axes.roll.rate, 99);
  assert.equal(f.store.export(), saved);
});

for (const exit of ['cancel', 'close', 'close-and-reopen'])
  test(`${exit} while Apply waits for a browser lock never restarts a flight afterward`, async (t) => {
    let release;
    const f = fixture(t, {
      locks: {
        request: (_key, work) =>
          new Promise((resolve) => {
            release = () => resolve(work());
          }),
      },
    });
    f.edit('Rate algorithm', 'actual', { tag: 'select', event: 'change' });
    f.edit('Maximum rate (°/s)', 910, { scope: f.axis('Roll'), type: 'number' });
    await f.click('Apply & restart');
    assert.equal(typeof release, 'function');
    if (exit === 'cancel') f.ui.root.emit('cancel');
    else f.ui.close();
    if (exit === 'close-and-reopen') f.ui.open({ keepDraft: true });
    release();
    await settle();
    assert.equal(f.store.effective().response.rates.axes.roll.rate, 91);
    assert.equal(f.applied.length, 0);
    assert.equal(f.ui.root.open, false);
    if (exit === 'close-and-reopen') {
      f.ui.open({ keepDraft: true });
      assert.equal(f.ui.root.open, true);
      assert.equal(f.applied.length, 0);
    }
  });

test('closing a draft comparison retains the unscored return affordance until a normal flight starts', async (t) => {
  const f = fixture(t);
  await f.click('Test draft · unscored');
  assert.equal(f.ui.returnButton.hidden, false);
  assert.equal(f.ui.returnButton.getAttribute('data-mode-label'), 'Unscored draft practice');
  f.ui.returnButton.emit('click');
  await settle();
  assert.equal(f.ui.returnButton.hidden, true);
  await f.click('Close');
  assert.equal(f.ui.returnButton.hidden, false);
  f.ui.endDraftTest();
  assert.equal(f.ui.returnButton.hidden, true);
});
