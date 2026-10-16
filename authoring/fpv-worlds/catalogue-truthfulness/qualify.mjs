// Manual source/data qualification, intentionally outside the unit-test suite.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import {
  WORLD_CATALOGUE,
  BEGINNER_CATALOGUE,
  ACTIVITY_NAMES,
} from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { validateWorldCourse } from '../../../optional-practice/civilian-fpv/world-model.mjs';
import {
  inspectPack,
  preparePack,
} from '../../../optional-practice/civilian-fpv/world-content.mjs';

const [reservoirPath, festivalPath, inventoryPath, output] = process.argv.slice(2);
if (![reservoirPath, festivalPath, inventoryPath, output].every((p) => p && path.isAbsolute(p)))
  throw Error('Use ABS_RESERVOIR_PACK ABS_FESTIVAL_PACK ABS_BASELINE_INVENTORY ABS_NEW_RECEIPT');
const hostPath = 'optional-practice/civilian-fpv/world-app.mjs',
  source = await fs.readFile(hostPath, 'utf8'),
  tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }),
  nodes = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type) nodes.push(node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
}
walk(tree);
const named = (type, name) => {
    const found = nodes.filter((n) => n.type === type && n.id?.name === name);
    if (found.length !== 1) throw Error('Expected one source node: ' + name);
    return found[0];
  },
  text = (node) => source.slice(node.start, node.end),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  checks = [],
  imported = [];
function check(name, passed) {
  checks.push({ name, passed: !!passed });
  if (!passed) throw Error(name);
}
const copyUK = Object.fromEntries(
    named('VariableDeclarator', 'COPY_UK')
      .init.properties.filter((p) => p.value.type === 'Literal')
      .map((p) => [p.key.name, p.value.value]),
  ),
  functions = ['catalogueActivity', 'catalogueDetails', 'customEntry'].map((name) =>
    text(named('FunctionDeclaration', name)),
  ),
  filter = named('VariableDeclarator', 'filtered').init.arguments[0],
  factory = vm.runInNewContext(
    `(function (mode, locale, ACTIVITY_NAMES, COPY_UK) {
      const $ = () => ({value: mode}),
        txt = ${text(named('VariableDeclarator', 'txt').init)},
        localized = ${text(named('VariableDeclarator', 'localized').init)},
        projectOwnsCourse = () => false;
      ${functions.join('\n')}
      return { catalogueActivity, catalogueDetails, customEntry,
        filter(activity, difficulty, entry) {
          const theme = 'all', progress = 'all', search = '', complete = new Set(),
            keyOf = (e) => e.id, label = () => '', FLIGHT_WORLDS = [];
          return (${text(filter)})(entry);
        }
      };
    })`,
  );
for (const [name, packPath, expectedSHA] of [
  ['reservoir', reservoirPath, '50ffbb0e5da7dec94862a8f2ca85cfeb60542d3fe9f86bd3c4e288dfa0a2e554'],
  ['festival', festivalPath, '87baca276e174f31ba19c02f4f2359c97affa07eefd4a5f4912b4d8664450f51'],
]) {
  const bytes = await fs.readFile(packPath),
    pack = await inspectPack(bytes);
  check(name + ' exact qualified immutable pack', hash(bytes) === expectedSHA);
  check(
    name + ' canonical roundtrip leaves pack identity exact',
    bytes.equals(
      Buffer.from(await (await preparePack(pack.project, { assets: pack.assets })).arrayBuffer()),
    ),
  );
  for (const mode of ['self-level', 'acro']) {
    const host = factory(mode, 'en', ACTIVITY_NAMES, copyUK);
    for (const course of pack.project.courses) {
      const entry = host.customEntry(validateWorldCourse(course)),
        before = JSON.stringify(course),
        expected =
          course.id === 'festival-grounds-06'
            ? 'follow'
            : course.id === 'festival-grounds-07'
              ? 'observe'
              : null;
      check(
        name + ' selected-mode activity ' + course.id + '/' + mode,
        host.catalogueActivity(entry) === expected,
      );
      check(
        name + ' no invented duration/difficulty ' + course.id + '/' + mode,
        !('difficulty' in entry) && !('duration' in entry),
      );
      check(
        name + ' All filter retains ' + course.id + '/' + mode,
        host.filter('all', 'all', entry),
      );
      for (const difficulty of ['beginner', 'intermediate', 'advanced'])
        check(
          name + ' unknown is not rated ' + course.id + '/' + mode + '/' + difficulty,
          !host.filter('all', difficulty, entry),
        );
      check(
        name + ' presentation leaves validated course untouched ' + course.id + '/' + mode,
        JSON.stringify(course) === before,
      );
      imported.push({
        course: course.id,
        mode,
        activity: expected,
        label: host.catalogueDetails(entry),
      });
    }
  }
  if (name === 'festival') {
    const follow = pack.project.courses.find((c) => c.id === 'festival-grounds-06'),
      gate = pack.project.courses.find((c) => c.id === 'festival-grounds-02').steps.acro[0],
      tracking = follow.steps.acro.find((s) => s.type === 'actor-track-v1'),
      cases = [
        ['follow-with-holds-and-land', null, 'follow'],
        [
          'observe-other-mode',
          (c) => {
            c.steps.acro.find((s) => s.type === 'actor-track-v1').minTargetTravel = 0;
          },
          'observe',
        ],
        [
          'mixed-tracking',
          (c) => {
            c.steps.acro.push({ ...tracking, minTargetTravel: 0 });
          },
          null,
        ],
        [
          'gate-ambiguity',
          (c) => {
            c.steps.acro.push(structuredClone(gate));
          },
          null,
        ],
        [
          'survival-ambiguity',
          (c) => {
            c.steps.acro.push({ type: 'survive', ticks: 10 });
          },
          null,
        ],
        [
          'combat-ambiguity',
          (c) => {
            c.actors.find((a) => a.id === tracking.actorId).role = 'hostile';
            c.steps.acro.push({ type: 'eliminate', targets: [tracking.actorId] });
          },
          null,
        ],
      ];
    for (const [name, change, expected] of cases) {
      const course = structuredClone(follow);
      change?.(course);
      const valid = validateWorldCourse(course);
      for (const locale of ['en', 'uk']) {
        const host = factory('acro', locale, ACTIVITY_NAMES, copyUK),
          entry = host.customEntry(valid);
        check(
          name + '/' + locale + ' validated mode classification',
          host.catalogueActivity(entry) === expected,
        );
        check(
          name + '/' + locale + ' filter uses matching classification',
          host.filter(expected ?? 'all', 'all', entry),
        );
        check(
          name + '/' + locale + ' incompatible tracking filter excludes',
          !host.filter(expected === 'follow' ? 'observe' : 'follow', 'all', entry),
        );
        check(
          name + '/' + locale + ' neutral text has no fabricated metadata',
          host.catalogueDetails(entry) ===
            (expected
              ? ACTIVITY_NAMES[expected][locale]
              : locale === 'uk'
                ? 'Авторське завдання'
                : 'Authored challenge'),
        );
      }
      if (name === 'observe-other-mode') {
        const host = factory('self-level', 'en', ACTIVITY_NAMES, copyUK);
        check(
          'Mode selection preserves divergent follow semantics',
          host.catalogueActivity(host.customEntry(valid)) === 'follow',
        );
      }
    }
  }
}
const builtins = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE];
for (const mode of ['self-level', 'acro'])
  for (const locale of ['en', 'uk']) {
    const host = factory(mode, locale, ACTIVITY_NAMES, copyUK);
    check(
      'All built-in metadata exact ' + mode + '/' + locale,
      builtins.every((entry) => {
        const expected = `${ACTIVITY_NAMES[entry.activity][locale]} · ${locale === 'uk' && copyUK[entry.difficulty] ? copyUK[entry.difficulty] : entry.difficulty} · ${entry.duration ?? 3} ${locale === 'uk' ? 'хв' : 'min'}`;
        return (
          host.catalogueActivity(entry) === entry.activity &&
          host.catalogueDetails(entry) === expected &&
          host.filter(entry.activity, entry.difficulty, entry)
        );
      }),
    );
  }
const hunt = builtins.find((e) => e.activity === 'hunt' && !e.legacy),
  host = factory('acro', 'en', ACTIVITY_NAMES, copyUK);
check(
  'Imported validated hunt remains neutral',
  host.catalogueActivity(host.customEntry(validateWorldCourse(hunt.course))) === null,
);
const inventory = JSON.parse(await fs.readFile(inventoryPath, 'utf8')),
  differences = [];
let total = 0;
for (const file of inventory.inputs) {
  const bytes = await fs.readFile(file.path);
  total += bytes.length;
  if (hash(bytes) !== file.sha256)
    differences.push({
      path: file.path,
      beforeBytes: file.bytes,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
}
check(
  'Exactly one of 95 admitted inputs changes',
  inventory.inputs.length === 95 && differences.length === 1 && differences[0].path === hostPath,
);
check('Unchanged source ceiling', total <= 16777216);
const receipt = {
  format: 'FPVImportedCatalogueManual.v1',
  sourceSHA256: hash(source),
  checks,
  imported,
  builtinCount: builtins.length,
  inputs: { count: inventory.inputs.length, bytes: total, reserve: 16777216 - total, differences },
  limitations: [
    'Extracted actual host functions and filter predicate; this is source/data qualification, not native browser interaction or replay execution. Pack/proof bytes and runtime schemas are unchanged.',
  ],
};
await fs.writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    checks: checks.length,
    passed: checks.every((c) => c.passed),
    inputs: receipt.inputs,
  }),
);
