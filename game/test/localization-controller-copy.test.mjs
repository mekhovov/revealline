import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  resolveControllerBindings,
  controllerBindingLabels,
  controllerButtonLabel,
  controllerStickLabel,
  sampleControllerStick,
} from '../controller-bindings.mjs';
import { soloControllerFlightHint } from '../ui/controller-flight-copy.mjs';

test('localized controller names preserve physical bindings, glyph families and stick sampling', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const config = resolveControllerBindings();
  config.flight.stick = { enabled: true, xAxis: 2, yAxis: 3, invertX: true, invertY: true };
  for (const family of ['generic', 'xbox', 'playstation']) {
    config.glyphFamily = family;
    const before = JSON.stringify(config);
    setLocale('en', { persist: false });
    const physical = sampleControllerStick(config, 'flight', [0, 0, 0.2, -0.8]);
    assert.equal(
      controllerStickLabel(config, 'flight'),
      'Right stick (horizontal inverted, vertical inverted)',
    );
    setLocale('uk', { persist: false });
    assert.equal(
      controllerStickLabel(config, 'flight'),
      'Правий стік (горизонтальну й вертикальну осі інвертовано)',
    );
    assert.equal(controllerStickLabel(config, 'menu'), 'Лівий стік');
    const labels = controllerBindingLabels(config);
    assert.equal(labels.flight.ability, family === 'xbox' ? 'A' : controllerButtonLabel(0, family));
    assert.doesNotMatch(Object.values(labels.flight).join(' '), /South|D-pad|shoulder|stick|Menu/);
    assert.deepEqual(sampleControllerStick(config, 'flight', [0, 0, 0.2, -0.8]), physical);
    assert.equal(JSON.stringify(config), before);
  }
  config.flight.stick = { enabled: true, xAxis: 3, yAxis: 2, invertX: false, invertY: true };
  assert.equal(controllerStickLabel(config, 'flight'), 'Осі 3/2 (вертикальну вісь інвертовано)');
  config.flight.stick.invertX = true;
  config.flight.stick.invertY = false;
  assert.equal(controllerStickLabel(config, 'flight'), 'Осі 3/2 (горизонтальну вісь інвертовано)');
  config.flight.stick.enabled = false;
  assert.equal(controllerStickLabel(config, 'flight'), 'Лише кнопки');
  assert.equal(controllerButtonLabel(-1), 'Невідома кнопка');
});

test('flight help translates only the controls available in each actual action model', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  for (const language of ['en', 'uk']) {
    setLocale(language, { persist: false });
    const labels = controllerBindingLabels().flight;
    const arcade = soloControllerFlightHint({
      labels,
      actions: { manualAbility: false, manualPickup: false, manualBoost: false },
      manualSupply: false,
      craftSwitch: false,
    });
    assert.match(arcade, language === 'en' ? /: field guide\./ : /: польовий довідник\./);
    assert.match(arcade, language === 'en' ? /: missions\./ : /: місії\./);
    assert.doesNotMatch(
      arcade,
      /: ability|: supply|: boost|: hangar|: здібність|: припаси|: прискорення|: ангар/,
    );
    const options = {
      labels,
      actions: { manualAbility: true, manualPickup: true, manualBoost: true },
      manualSupply: false,
      craftSwitch: false,
    };
    const unavailable = soloControllerFlightHint(options);
    assert.doesNotMatch(unavailable, /: supply|: припаси|: hangar|: ангар/);
    const tactical = soloControllerFlightHint({
      ...options,
      manualSupply: true,
      craftSwitch: true,
    });
    assert.match(tactical, language === 'en' ? /: supply\./ : /: припаси\./);
    assert.match(tactical, language === 'en' ? /: hangar\./ : /: ангар\./);
    assert.match(tactical, language === 'en' ? /: boost\./ : /: прискорення\./);
    assert.doesNotMatch(tactical, /: field guide|: польовий довідник/);
    if (language === 'uk') assert.doesNotMatch(tactical, /Stick|pause|steer|Lift|undefined/);
  }
});
