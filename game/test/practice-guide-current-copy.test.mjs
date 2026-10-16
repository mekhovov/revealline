import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

const source = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const packages = ['civilian-flight', 'civilian-fpv', 'fpv-worlds'];
const plain = (value) => value.replace(/<[^>]*>|\*\*/g, '').replace(/\s+/g, ' ');

async function localizedGuides(locale) {
  const markdown = await source(`docs/flight-practice-player${locale === 'uk' ? '.uk' : ''}.md`);
  const html = await Promise.all(
    packages.map(async (id) => {
      const guide = await source(`optional-practice/${id}/guide.html`);
      const sections = [
        ...guide.matchAll(new RegExp(`<section lang="${locale}"[^>]*>([\\s\\S]*?)</section>`, 'g')),
      ];
      assert.ok(sections.length, `${id} has a ${locale} guide`);
      return sections.map((section) => section[1]).join(' ');
    }),
  );
  return [markdown, ...html].map(plain);
}

test('repository and shipped guides name the current rendered radio setup control in both locales', async () => {
  const academy = await source('optional-practice/civilian-fpv/app.mjs');
  const world = await source('optional-practice/civilian-fpv/world-app.mjs');
  // The shared shell overrides the old static HTML/setup-dialog label. Bind the
  // guide route to the rendered menu copy, without maintaining another binding table.
  const academyLabels = academy.match(/radioSetup: \['([^']+)', '([^']+)'\]/);
  assert.ok(academyLabels);
  const worldLabels = [...world.matchAll(/radioSetup: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(worldLabels, academyLabels.slice(1));
  for (const [index, locale] of ['en', 'uk'].entries()) {
    const prefix = locale === 'en' ? 'Settings → Controls → ' : 'Налаштування → Керування → ';
    for (const guide of await localizedGuides(locale)) {
      assert.ok(guide.includes(prefix + academyLabels[index + 1]));
      assert.doesNotMatch(guide, /Radio &(?:amp;)? response|Пульт і реакція/);
    }
  }
});

test('repository and shipped guides document the reachable maintained Detailed HUD in both locales', async () => {
  for (const locale of ['en', 'uk'])
    for (const guide of await localizedGuides(locale)) {
      assert(
        guide.includes(
          locale === 'en'
            ? 'Settings → Accessibility → Flight guidance'
            : 'Налаштування → Доступність → Підказки польоту',
        ),
      );
      assert(guide.includes(locale === 'en' ? 'Detailed' : 'Докладні'));
      assert(guide.includes(locale === 'en' ? 'Text size' : 'Розмір тексту'));
      assert(guide.includes(locale === 'en' ? 'HUD contrast' : 'Контраст приладів'));
    }
});

test('both guide formats distinguish incomplete verification from confirmed repair', async () => {
  const launcher = await source('optional-practice/launcher-template.mjs');
  const checks = [...launcher.matchAll(/check: '([^']+)'/g)].map((match) => match[1]);
  const statuses = [...launcher.matchAll(/unverified:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.equal(checks.length, 2);
  assert.equal(statuses.length, 2);
  for (const [index, locale] of ['en', 'uk'].entries()) {
    const headline = statuses[index].split('.')[0];
    for (const guide of await localizedGuides(locale)) {
      assert.ok(guide.includes(headline), `Missing ${locale} unfinished-check explanation`);
      assert.ok(guide.includes(checks[index]), `Missing ${locale} retry action`);
      assert.match(guide, locale === 'en' ? /keep the saved copy/ : /зберігайте копію/);
      assert.match(
        guide,
        locale === 'en'
          ? /only when the launcher reports Needs repair/
          : /лише за повідомленням Потрібне відновлення/,
      );
    }
  }
});

test('both guide formats explain deadline/cancel recovery without inventing a storage cause', async () => {
  for (const locale of ['en', 'uk'])
    for (const guide of await localizedGuides(locale)) {
      for (const text of locale === 'en'
        ? [
            'Download stalled / exceeded five minutes',
            'not that a previous copy was removed',
            'Permission errors do not necessarily mean storage is full',
          ]
        : [
            'Завантаження не просувалося / тривало понад п’ять хвилин',
            'а не видаляє попередню копію',
            'Помилка дозволу не обов’язково означає заповнене сховище',
          ])
        assert(guide.includes(text));
    }
});

test('World Studio launcher onboarding names the mounted Home actions in both locales', async () => {
  const app = parse(await source('optional-practice/civilian-fpv/world-app.mjs'), {
    ecmaVersion: 'latest',
    sourceType: 'module',
  });
  const field = (node, key) =>
    node?.type === 'ObjectExpression'
      ? node.properties.find(
          (item) =>
            item.type === 'Property' && !item.computed && (item.key.name ?? item.key.value) === key,
        )?.value
      : undefined;
  const shells = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee.type === 'Identifier' &&
      node.callee.name === 'mountSimPlayShell' &&
      field(node.arguments[0], 'idPrefix')?.value === 'worlds-shell'
    )
      shells.push(node.arguments[0]);
    for (const value of Object.values(node))
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
  }
  visit(app);
  assert.equal(shells.length, 1, 'Exactly one maintained Worlds Home must supply the labels');
  const labels = [
    field(field(shells[0], 'homeLabels'), 'missions'),
    field(field(shells[0], 'homeAction'), 'label'),
  ];
  const descriptor = JSON.parse(await source('optional-practice/fpv-worlds/package-info.json'));
  for (const locale of ['en', 'uk']) {
    const instruction = descriptor.copy[locale].firstFlight;
    for (const label of labels) {
      const literal = field(label, locale);
      assert.equal(literal?.type, 'Literal', 'Read the public label without executing app code');
      assert.equal(typeof literal.value, 'string');
      assert.ok(
        instruction.includes(literal.value),
        `Missing current ${locale} action: ${literal.value}`,
      );
    }
    assert.match(instruction, /\.rlpack/);
    assert.doesNotMatch(
      instruction,
      /Open Explore and|Відкрийте «Огляд»|through World packs|через «Пакети світів»/,
    );
    assert.match(
      instruction,
      locale === 'en'
        ? /not apps to the Flight practice directory/
        : /а не застосунки до каталогу льотної практики/,
    );
  }
});
