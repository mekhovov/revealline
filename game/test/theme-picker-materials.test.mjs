import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import { memoryStorage } from './helpers/solo-dom.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { BUILTIN_THEME_FAMILIES } from '../presentation/theme-system.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { duplicateStudioSnapshot } from '../presentation/studio-session.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { attachThemeFamilyControls } from '../ui/theme-family-controls.mjs';

async function fixture(t, options = {}) {
  const document = new Document(),
    window = new Events(),
    storage = memoryStorage(),
    display = createDisplayPreferences({ window, getStorage: () => storage }),
    host = installThemeHost({
      document,
      window,
      getStorage: () => storage,
      displayPreferences: display,
      prepareStyles: () => Promise.resolve(),
      ...options,
    });
  await host.ready;
  const controls = attachThemeFamilyControls({ document, root: document.body, host });
  t.after(() => {
    controls.dispose();
    host.dispose();
    display.dispose();
  });
  const card = (id) => document.getElementById(`theme-card-${id}`),
    preview = (id) => card(id)?.querySelector('[data-theme-card-preview]');
  return { document, storage, display, host, controls, card, preview };
}

test('theme picker shows each runtime material without nested interactive controls or preference writes', async (t) => {
  const { document, host, storage, card, preview } = await fixture(t);
  const choices = host.availableThemeChoices();
  assert.equal(choices.length, BUILTIN_THEME_FAMILIES.length + 1);
  assert.equal(document.querySelectorAll('[data-theme-card-preview]').length, choices.length);
  assert.deepEqual(storage.writes, [], 'Viewing available finishes is not an appearance change.');
  for (const choice of choices) {
    const scope = preview(choice.id);
    assert.ok(scope, `${choice.id} has its own material specimen`);
    assert.equal(scope.dataset.themeFamily, choice.family.id);
    assert.equal(scope.dataset.interfaceTheme, choice.interfaceTheme.id);
    assert.equal(scope.style.getPropertyValue('--iw-panel'), choice.interfaceTheme.tokens.panel);
    assert.equal(scope.getAttribute('aria-hidden'), 'true');
    assert.equal(
      scope.querySelectorAll('button, input, select, textarea, a, [tabindex], [contenteditable]')
        .length,
      0,
      'The whole card is one keyboard/controller target; sample controls are decorative.',
    );
    assert.ok(scope.querySelector('[data-ui-action]'), 'Sample keys use runtime component roles.');
    assert.equal(card(choice.id).tagName, 'BUTTON');
  }
  const selected = card('dnipro-porcelain'),
    specimen = preview('dnipro-porcelain');
  selected.focus();
  selected.click();
  await host.ready;
  assert.equal(host.snapshot().familyId, 'dnipro-porcelain');
  assert.equal(selected.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, selected);
  assert.equal(preview('dnipro-porcelain'), specimen, 'Applying a theme preserves its DOM node.');
  assert.equal(preview('industrial-workshop').dataset.themeFamily, 'industrial-workshop');
  assert.notEqual(
    preview('industrial-workshop').style.getPropertyValue('--iw-panel'),
    specimen.style.getPropertyValue('--iw-panel'),
    'Other cards retain their own material after the outer game appearance changes.',
  );
});

test('Follow and curated card previews retain the accepted interface basis independently of the art family', async (t) => {
  const candidate = createThemeCandidate(
    duplicateStudioSnapshot(createDefaultThemeBundle(), {
      id: 'polar-preview',
      name: 'Community Polar',
    }),
    { familyId: 'tryzub', interfaceId: 'polar-relay' },
  );
  const { document, host, card, preview } = await fixture(t, {
    appearanceThemes: [candidate],
    appearanceDefault: { familyId: candidate.family.id, revision: candidate.family.revision },
  });
  for (const id of ['follow-game', candidate.family.id]) {
    assert.deepEqual(
      host.availableThemeChoices().find((choice) => choice.id === id).basis,
      candidate.basis,
    );
    assert.equal(preview(id).dataset.themeFinish, 'polar-relay');
    assert.equal(preview(id).dataset.themeMaterial, 'steel');
    assert.equal(
      preview(id).style.getPropertyValue('--iw-panel'),
      candidate.interfaceTheme.tokens.panel,
    );
  }
  card(candidate.family.id).click();
  await host.ready;
  assert.equal(preview(candidate.family.id).dataset.themeFinish, host.snapshot().materialVariant);
  assert.equal(
    preview(candidate.family.id).style.getPropertyValue('--iw-panel'),
    host.snapshot().tokens.panel,
  );
  const follow = card('follow-game'),
    followPreview = preview('follow-game');
  follow.focus();
  await host.setDefault({ familyId: 'moonlit-grove', revision: 'r1' });
  assert.equal(
    host.snapshot().familyId,
    candidate.family.id,
    'A context change keeps personal choice.',
  );
  assert.equal(preview('follow-game'), followPreview);
  assert.equal(followPreview.dataset.themeFinish, 'moonlit-grove');
  assert.equal(document.activeElement, follow);
  follow.click();
  await host.ready;
  assert.equal(host.snapshot().familyId, 'moonlit-grove');
  assert.equal(host.preferences.snapshot().familyId, 'follow-game');
});

test('material previews honor immediate accessibility changes without replacing focus or selection', async (t) => {
  const { document, display, host, card } = await fixture(t);
  const focused = card('vyshyvanka');
  focused.focus();
  display.set({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  await host.ready;
  host.set({ highContrast: true, ornaments: 'off', opaqueHud: true });
  await host.ready;
  for (const scope of document.querySelectorAll('[data-theme-card-preview]')) {
    assert.equal(scope.dataset.themeContrast, 'high');
    assert.equal(scope.dataset.themeTexture, 'off');
    assert.equal(scope.dataset.themeMotion, 'reduced');
    assert.equal(scope.dataset.themeTextSize, 'large');
    assert.equal(scope.dataset.themeHud, 'opaque');
    assert.match(scope.style.getPropertyValue('--iw-font-ui'), /Exo 2/);
    assert.equal(scope.style.getPropertyValue('--iw-text'), '#ffffff');
  }
  assert.equal(document.activeElement, focused);
  assert.equal(card('follow-game').getAttribute('aria-pressed'), 'true');
  host.set({ highContrast: false });
  await host.ready;
  for (const scope of document.querySelectorAll('[data-theme-card-preview]')) {
    assert.equal(scope.dataset.themeContrast, 'normal');
    assert.equal(
      scope.dataset.themeTexture,
      'off',
      'Restoring contrast does not restore decoration.',
    );
  }
  assert.equal(document.activeElement, focused);
});

test('disposing a picker releases scoped presentation and detaches selection handlers', async (t) => {
  const { document, host, controls, card, preview } = await fixture(t);
  const removedCard = card('vyshyvanka'),
    scope = preview('vyshyvanka'),
    prior = host.preferences.snapshot();
  controls.dispose();
  assert.equal(document.querySelector('[data-theme-controls]'), null);
  assert.equal(scope.dataset.themeFamily, undefined);
  assert.equal(scope.style.getPropertyValue('--iw-panel'), '');
  removedCard.click();
  assert.equal(host.preferences.snapshot(), prior);
  await host.setDefault({ familyId: 'dos', revision: 'r1' });
  assert.equal(
    scope.dataset.themeFamily,
    undefined,
    'Detached scopes are not repainted by host updates.',
  );
});
