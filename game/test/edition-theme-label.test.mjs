import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANY_BRANDS, createCompanyThemes } from '../company-campaigns/brands.mjs';
import { dataIdentity } from '../data-json.mjs';
import { editionThemeLabel } from '../ui/edition-theme-label.mjs';

const brand = COMPANY_BRANDS.find((item) => item.id === 'droneaid-nl');
const provider = {
  selection: { brand: { ...brand, name: 'DroneAid Netherlands' } },
  currentCatalog: { brands: [brand] },
};

test('current DroneAid branding labels all seven retained themes without changing their identity', () => {
  const themes = createCompanyThemes('droneaid-nl');
  const before = themes.map((theme) => dataIdentity(theme));
  assert.equal(themes.length, 7);
  for (const theme of themes) {
    Object.freeze(theme);
    assert.equal(
      editionThemeLabel(theme, theme.name, provider),
      theme.name.replace('DroneAid Netherlands', brand.name),
    );
    assert.ok(theme.name.startsWith('DroneAid Netherlands'));
  }
  assert.deepEqual(
    themes.map((theme) => dataIdentity(theme)),
    before,
  );
});

test('localized campaign suffixes survive the current metadata override', () => {
  const [base, workshop] = createCompanyThemes('droneaid-nl');
  assert.equal(editionThemeLabel(base, 'DroneAid Нідерланди', provider), 'DroneAid');
  assert.equal(
    editionThemeLabel(workshop, 'DroneAid Нідерланди · Майстерня FPV', provider),
    'DroneAid · Майстерня FPV',
  );
  const renamed = { ...provider, currentCatalog: { brands: [{ ...brand, name: 'New brand' }] } };
  assert.equal(editionThemeLabel(base, base.name, renamed), 'New brand');
});

test('generic, custom and other-brand theme labels retain their authored values', () => {
  const [base, workshop] = createCompanyThemes('droneaid-nl');
  assert.equal(editionThemeLabel(base, base.name), base.name);
  assert.equal(editionThemeLabel({ ...base, id: 'custom' }, base.name, provider), base.name);
  assert.equal(
    editionThemeLabel({ ...base, name: 'My workshop' }, 'Моя майстерня', provider),
    'Моя майстерня',
  );
  assert.equal(
    editionThemeLabel(workshop, 'A label without a brand separator', provider),
    'A label without a brand separator',
  );
  const [coupa] = createCompanyThemes('coupa');
  assert.equal(editionThemeLabel(coupa, coupa.name, provider), coupa.name);
});
