// Real pad commands own every application mutation. Profile parsing below only
// verifies the bytes saved by explicit lab actions; there is no lab export API.
import { restoreProfile, serializeProfile } from '../../../authoring/motion-lab/collection.mjs';
import { canonicalJSON } from '../../data-json.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const snapshot = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
async function textReceipt(value) {
  const bytes = new TextEncoder().encode(value);
  return {
    bytes: bytes.length,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}

export const motionCurrent = [
  'Current Motion Lab: cancel, configure, preview, save simulated collection and clear media',
  '/authoring/motion-lab/',
  async (p) => {
    const win = p.doc.defaultView,
      key = 'xonix.motion-lab.collection.v1';
    assert(
      win.location.port === '8988' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the isolated qualification origin on port 8988; the lab collection is restored during fixture cleanup.',
    );
    await p.wait(
      () =>
        !p.doc.querySelector('#motion-study').disabled &&
        p.doc.querySelector('#motion-load-status').dataset.state === 'ready',
      30000,
    );
    assert(
      p.doc.documentElement.lang.startsWith('en'),
      'This bounded Motion fixture currently qualifies English.',
    );
    const originalLocal = snapshot(win.localStorage),
      originalSession = snapshot(win.sessionStorage);
    const $ = (selector) => p.doc.querySelector(selector);
    const paused = () => $('#play-pause').textContent.trim() === 'Play';
    const pause = async () => {
      if (!paused()) await p.choose('#play-pause');
      assert(paused(), 'Study did not pause');
    };
    const saved = () => win.localStorage.getItem(key);
    try {
      await pause();
      await p.section('#motion-response-heading');
      const initialSpeed = $('#cruise-speed').value;
      await p.choose('#cruise-speed');
      await p.pulse('right');
      await p.pulse('back');
      assert($('#cruise-speed').value === initialSpeed, 'Canceled speed draft committed');
      await p.choose('#cruise-speed');
      await p.pulse('right');
      await p.pulse('confirm');
      assert(
        Number($('#cruise-speed').value) === Number(initialSpeed) + 0.5,
        'Speed draft did not commit one step',
      );
      await p.choose('#turn-policy');
      await p.pulse('down');
      await p.pulse('back');
      assert($('#turn-policy').value === 'immediate', 'Canceled policy changed movement');
      await p.select('#turn-policy', 'grid-center');
      assert(
        paused() && !$('#autoplay').checked,
        'Policy change did not reset into paused manual study',
      );
      assert(
        $('#turn-queue').textContent.includes('6.50, 6.50'),
        'Grid policy did not reset to its actual cell center',
      );
      await p.section('#motion-palette-heading');
      const initialTheme = $('#theme').value;
      await p.choose('#theme');
      await p.pulse('down');
      await p.pulse('back');
      assert(
        $('#theme').value === initialTheme && paused(),
        'Canceled palette changed study or resumed movement',
      );
      await p.select('#theme', 'retro-1994');
      assert($('#theme').value === 'retro-1994' && paused(), 'Palette edit changed paused intent');
      await p.select('#theme', initialTheme);
      p.record(
        'Sections reached Response and Palette; canceled speed/policy/palette drafts retained values, committed speed and grid policy preserved explicit paused intent',
        '#motion-event',
        { cruiseSpeed: Number($('#cruise-speed').value), turnPolicy: $('#turn-policy').value },
      );

      await p.choose('#background-file');
      await p.pulse('back');
      assert(
        $('#clear-background').disabled && !$('.authoring-source-dialog').open,
        'Canceled background chooser accepted media',
      );
      await p.choose('#background-file');
      await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      await p.wait(
        () => $('#background-status').dataset.state === 'ready' && !$('#clear-background').disabled,
      );
      const acceptedBackground = $('#background-status').textContent;
      assert(
        /640\s*×\s*360/.test(acceptedBackground),
        'Background preview did not decode the bundled picture',
      );
      await p.choose('#background-fit');
      await p.pulse('down');
      await p.pulse('back');
      assert($('#background-fit').value === 'contain', 'Canceled background fit committed');
      await p.select('#background-fit', 'cover');
      await p.choose('#background-file');
      await p.pulse('back');
      assert(
        $('#background-status').textContent === acceptedBackground &&
          !$('#clear-background').disabled,
        'Canceled replacement changed the accepted background',
      );
      await p.choose('#clear-background');
      assert(
        $('#clear-background').disabled && $('#background-status').dataset.state === 'cancelled',
        'Clear did not release the local background',
      );
      assert(
        p.doc.activeElement === $('#background-file'),
        'Clear did not restore focus to the usable background source control',
      );
      assert(paused(), 'Background editing resumed the study');
      p.record(
        'Background source and fit cancellation retained ownership; bundled PNG decoded, committed fit stayed local, canceled replacement retained the image, and Clear released it',
        '#background-status',
        { decodedPicture: [640, 360], export: 'No Motion Lab portable export exists.' },
      );

      await p.section('#motion-progression-heading');
      await p.choose('#reset-collection');
      const reset = restoreProfile(saved(), { mode: 'lab', profileId: 'local-design' });
      assert(
        !reset.warning && reset.profile.events.length === 0 && reset.profile.equipped.length === 0,
        'Explicit test collection Reset did not save an empty isolated lab profile',
      );
      await p.section('#motion-collection-heading');
      await p.select('#collection-context', 'fpv-first-flight');
      await p.select('#character', 'fpv-racer');
      assert(
        $('#equip-character').disabled && $('#unlock-conditions').textContent.trim(),
        'Locked cosmetic was equipable or had no visible condition',
      );
      const beforeReward = saved();
      await p.choose('#character');
      await p.pulse('down');
      await p.pulse('back');
      assert(
        $('#character').value === 'fpv-racer' && saved() === beforeReward,
        'Canceled character inspection altered the saved lab profile',
      );
      await p.section('#motion-progression-heading');
      await p.select('#reward-fixture', 'fpv-first-clear');
      await p.choose('#apply-fixture');
      await p.wait(() => saved() !== beforeReward);
      const afterReward = saved();
      await p.choose('#apply-fixture');
      assert(
        saved() === afterReward && /not applied/i.test($('#collection-message').textContent),
        'Repeated simulated reward wrote or duplicated a result',
      );
      await p.section('#motion-collection-heading');
      assert(
        $('#character').value === 'fpv-racer' && !$('#equip-character').disabled,
        'Recorded simulated result did not unlock the expected cosmetic',
      );
      await p.select('#equip-scope', 'context');
      await p.choose('#equip-character');
      const serialized = saved(),
        restored = restoreProfile(serialized, { mode: 'lab', profileId: 'local-design' });
      assert(
        !restored.warning && serializeProfile(restored.profile) === serialized,
        'Saved collection does not reopen through the production profile validator',
      );
      assert(
        restored.profile.events.length === 1 &&
          restored.profile.events.every((event) => event.simulated) &&
          restored.profile.equipped.some((entry) => entry.characterId === 'fpv-racer'),
        'Collection save changed result identity or omitted explicit equipment',
      );
      p.record(
        'Explicit lab reset exposed a locked cosmetic; canceled inspection made no save, one simulated reward unlocked it, duplicate reward was rejected, and Equip saved production-validated lab-only bytes',
        '#collection-message',
        {
          profile: {
            key,
            mode: restored.profile.mode,
            events: restored.profile.events.length,
            equipment: restored.profile.equipped,
            ...(await textReceipt(serialized)),
          },
          boundary:
            'Profile reopening here is the production validator over actual saved bytes; a native browser reload is a separate UI receipt.',
        },
      );

      await p.section('#motion-ability-heading');
      await p.select('#ability-class', 'light-bomber');
      await p.choose('#ability-reset');
      await p.choose('#ability-action');
      assert(
        paused() && /Paused/.test($('#ability-message').textContent),
        'Paused ability was not rejected',
      );
      await p.choose('#play-pause');
      await p.choose('#ability-action');
      assert(
        /Pick up/i.test($('#ability-message').textContent),
        'Empty charge ability was not rejected',
      );
      await p.choose('#ability-pickup');
      assert(
        /refilled/i.test($('#ability-message').textContent),
        'Supply pad did not refill the real toy ability',
      );
      await p.section('#motion-preview-heading');
      assert(p.doc.activeElement === $('#arena'), 'Preview section did not focus the arena');
      await p.pulse('confirm');
      assert(
        $('#arena').getAttribute('data-controller-editing') === 'true',
        'Arena did not take controller ownership',
      );
      await p.pulse('confirm');
      assert(
        /used|updated/i.test($('#ability-message').textContent),
        'Arena Confirm did not use the charged toy ability',
      );
      const beforeMovement = $('#turn-queue').textContent;
      await p.pulse('right');
      await p.wait(() => $('#turn-queue').textContent !== beforeMovement);
      await p.pulse('back');
      assert(
        paused() &&
          !$('#arena').hasAttribute('data-controller-editing') &&
          p.doc.activeElement === $('#arena'),
        'Arena Back did not pause and restore its entry',
      );
      await p.choose('[data-direction="up"]');
      assert(
        paused() && /Press Play/.test($('#motion-event').textContent),
        'Direction activation implicitly resumed a paused study',
      );
      await p.choose('#play-pause');
      for (const direction of ['up', 'left', 'down', 'right']) {
        await p.choose(`[data-direction="${direction}"]`);
        assert(
          $(`[data-direction="${direction}"]`).classList.contains('is-held'),
          `Controller Confirm did not select ${direction}`,
        );
      }
      for (const control of ['boost', 'slow']) {
        await p.choose(`#${control}`);
        assert(
          $(`#${control}`).getAttribute('aria-pressed') === 'true',
          `${control} did not engage`,
        );
        await p.pulse(control === 'boost' ? 'back' : 'confirm');
        assert(
          $(`#${control}`).getAttribute('aria-pressed') === 'false' &&
            !$(`#${control}`).hasAttribute('data-controller-editing'),
          `${control} did not release`,
        );
      }
      await pause();
      assert(saved() === serialized, 'Motion/ability editing changed the saved cosmetic profile');
      const previous = new Map(originalLocal);
      for (const [name, value] of snapshot(win.localStorage))
        if (name !== key && !name.startsWith(`${key}.recovery.`))
          assert(previous.get(name) === value, `Unrelated local storage changed: ${name}`);
      assert(same(snapshot(win.sessionStorage), originalSession), 'Session storage changed');
      p.record(
        'Paused/empty abilities rejected; pickup and explicit arena Confirm used the toy ability, movement changed the grid readout, Back paused, all direction buttons worked and boost/slow released',
        '#motion-event',
        {
          directionButtons: ['up', 'left', 'down', 'right'],
          held: { boost: false, slow: false },
          boundary:
            'No gameplay win, media export, iframe preview, OS file-picker or physical-controller qualification.',
        },
      );
    } finally {
      // Explicit fixture cleanup, never counted as application input. Only this
      // isolated lab save/recovery namespace was mutated by the real controls.
      const original = new Map(originalLocal);
      for (const [name] of snapshot(win.localStorage))
        if ((name === key || name.startsWith(`${key}.recovery.`)) && !original.has(name))
          win.localStorage.removeItem(name);
      for (const [name, value] of originalLocal)
        if (name === key || name.startsWith(`${key}.recovery.`))
          win.localStorage.setItem(name, value);
      assert(
        same(snapshot(win.localStorage), originalLocal),
        'Fixture did not preserve exact pre-run local storage',
      );
      assert(
        same(snapshot(win.sessionStorage), originalSession),
        'Fixture did not preserve exact pre-run session storage',
      );
    }
  },
];
