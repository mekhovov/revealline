import { createSimModeLinks } from '../../optional-practice/civilian-fpv/flight-fullscreen.mjs';
import { Document } from './helpers/couch-dom.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { parse } from 'acorn';
import {
  nativeArtReviewURL,
  snakeLaunchURL,
  overflightLaunchURL,
  fpvLaunchURL,
  fpvWorldLaunchURL,
  fpvReturnURL,
  fpvWorldReturnURL,
  appearanceLaunchURL,
} from '../fpv-entry.mjs';
import { prepareSnakeStudioPlay } from '../studio/snake-play-launch.mjs';
import { snakeStudioReturnHref } from '../ui/content-studio-navigation.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import {
  CLASSIC_PACKAGE_FORMAT,
  classicSnakePackageIdentity,
  classicSnakePackageEntries,
} from '../snake/classic-community.mjs';

const revisions = ['industrial-pilot-v1', 'industrial-overhead-v2', 'industrial-roster-v3'];
const roots = [
  'http://127.0.0.1:8779/',
  'https://example.test/revealline/',
  'https://example.test/editions/sample/releases/v2.3.4/site/',
  'capacitor://localhost/',
  'file:///app/site/',
];

test('an explicit art review crosses fixed native pages only inside the same build', () => {
  for (const root of roots)
    for (const revision of revisions) {
      const source = `${root}game/snake/play.html?level=one&seed=17&artReview=${revision}`;
      for (const path of [
        'game/',
        'game/index.html',
        'game/company.html',
        'game/couch/',
        'game/couch/index.html',
        'game/couch/relay-rescue.html',
        'game/snake/',
        'game/snake/index.html',
        'game/snake/play.html',
        'game/studio/snake.html',
        'game/studio/overflight.html',
        'game/studio/raid.html',
        'game/overflight/play.html',
        'game/overflight/raid.html',
        'game/playground/',
        'game/hunt/',
        'game/online/',
        'game/replay-theater/',
        'game/controller-lab/',
        'authoring/asset-studio/',
        'authoring/motion-lab/index.html',
        'authoring/enemy-catalog/',
        'authoring/industrial-art-review/',
        'optional-practice/civilian-fpv/index.html',
        'optional-practice/fpv-worlds/index.html',
      ]) {
        const target = new URL(nativeArtReviewURL(`${root}${path}?lang=uk#menu`, source));
        assert.equal(target.searchParams.get('artReview'), revision, path);
        assert.equal(target.searchParams.get('lang'), 'uk');
        assert.equal(target.searchParams.has('level'), false);
        assert.equal(target.searchParams.has('seed'), false);
        assert.equal(target.hash, '#menu');
      }
    }
});

test('review inheritance never broadens URL trust or crosses provider/edition/credential boundaries', () => {
  const source = 'https://example.test/project/game/snake/play.html?artReview=industrial-roster-v3';
  for (const target of [
    'https://other.test/project/game/',
    'http://example.test/project/game/',
    'https://example.test:8443/project/game/',
    'https://user@example.test/project/game/',
    'https://example.test/other/game/',
    'https://example.test/project/editions/private/game/',
    'https://example.test/project/community/level.html',
    'https://example.test/project/game/custom.html',
    'https://example.test/project/game/snake/unknown.html',
    'https://example.test/project/authoring/third-party/index.html',
    'javascript:alert(1)',
  ]) {
    assert.equal(nativeArtReviewURL(target, source), new URL(target).href);
  }
  for (const invalidSource of [
    'not a URL',
    'https://example.test/project/game/?artReview=unknown',
    'https://example.test/project/game/?artReview=industrial-roster-v3&artReview=industrial-roster-v3',
    'https://user@example.test/project/game/?artReview=industrial-roster-v3',
    'https://example.test/project/provider/?artReview=industrial-roster-v3',
  ]) {
    const target = 'https://example.test/project/game/snake/play.html?lang=uk';
    assert.equal(nativeArtReviewURL(target, invalidSource), target);
  }
  assert.equal(
    nativeArtReviewURL(
      'file://remote/app/site/game/',
      'file:///app/site/game/?artReview=industrial-roster-v3',
    ),
    'file://remote/app/site/game/',
  );
});

test('an explicit destination choice stays authoritative and normal launches stay unmodified', () => {
  assert.equal(nativeArtReviewURL('../', 'https://example.test/game/snake/'), '../');
  const source = 'https://example.test/game/?artReview=industrial-roster-v3';
  for (const suffix of ['', '?artReview=industrial-overhead-v2', '?artReview=bad&artReview=bad']) {
    const target = `https://example.test/game/snake/play.html${suffix}`;
    if (suffix) assert.equal(nativeArtReviewURL(target, source), target);
    assert.equal(nativeArtReviewURL(target, 'https://example.test/game/'), target);
  }
});

test('native launch/return functions preserve preview without replacing appearance or content ownership', () => {
  const pin = { familyId: 'vyshyvanka', revision: 'r1' };
  for (const root of roots) {
    const source = `${root}game/?edition=sample&journey=opening&artReview=industrial-roster-v3`;
    for (const target of [
      snakeLaunchURL(source, 'team', 'uk', pin),
      overflightLaunchURL(source, 'uk', pin),
      fpvLaunchURL(source, 'uk', pin),
      fpvWorldLaunchURL(source, 'uk', pin),
    ]) {
      const url = new URL(target);
      assert.equal(url.searchParams.get('artReview'), 'industrial-roster-v3');
      assert.equal(url.searchParams.get('appearanceFamily'), pin.familyId);
      assert.equal(url.searchParams.get('appearanceRevision'), pin.revision);
      assert.equal(url.searchParams.get('lang'), 'uk');
      assert.equal(url.searchParams.has('edition'), false);
      assert.equal(url.searchParams.has('journey'), false);
    }
    assert.equal(fpvReturnURL(fpvLaunchURL(source, 'uk', pin)), source);
    assert.equal(fpvWorldReturnURL(fpvWorldLaunchURL(source, 'uk', pin)), source);
  }
  // An optional package published separately is a different build root.
  const separate =
    'https://example.test/project/practice/fpv-worlds/releases/v1.2.3/site/optional-practice/fpv-worlds/index.html?artReview=industrial-roster-v3';
  assert.equal(fpvWorldReturnURL(separate), 'https://example.test/project/game/');
});

test('the actual Snake hub launch handler retains review and appearance before and after click', async () => {
  const source = await readFile(new URL('../snake/hub.mjs', import.meta.url), 'utf8');
  const declaration = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
    (node) =>
      node.type === 'VariableDeclaration' &&
      node.declarations.some((part) => part.id.name === 'launch'),
  );
  assert.ok(declaration);
  const href = 'https://example.test/project/game/snake/?artReview=industrial-roster-v3';
  const pin = { familyId: 'military-field', revision: 'r1' };
  const context = createContext({
    location: { href },
    URL,
    nativeArtReviewURL,
    appearanceLaunchURL,
    appearancePin: () => pin,
    node(tag, label) {
      assert.equal(tag, 'a');
      let target;
      const listeners = new Map();
      return {
        label,
        get href() {
          return target;
        },
        set href(value) {
          target = new URL(value, href).href;
        },
        addEventListener(kind, action) {
          listeners.set(kind, action);
        },
        click() {
          listeners.get('click')?.();
        },
      };
    },
  });
  new Script(
    `${source.slice(declaration.start, declaration.end)}\nglobalThis.launchLink = launch;`,
  ).runInContext(context);
  const link = context.launchLink(
    'Campaign',
    './play.html?mode=team&level=classic-living-cable-cutoff&lang=uk',
  );
  for (const click of [false, true]) {
    if (click) link.click();
    const url = new URL(link.href);
    assert.equal(url.searchParams.get('artReview'), 'industrial-roster-v3');
    assert.equal(url.searchParams.get('level'), 'classic-living-cable-cutoff');
    assert.equal(url.searchParams.get('mode'), 'team');
    assert.equal(url.searchParams.get('appearanceFamily'), 'military-field');
  }
});

test('Snake Studio play and fixed return retain review without changing the installed native package', async () => {
  const official = CLASSIC_SNAKE_LEVELS.find(
    (entry) => entry.level.version === 'classic-snake-level.v3',
  );
  const source = {
    format: CLASSIC_PACKAGE_FORMAT,
    title: { en: 'Review preview', uk: 'Перегляд' },
    entries: [
      structuredClone({
        title: official.title,
        description: official.description,
        level: official.level,
      }),
    ],
  };
  const before = structuredClone(source),
    baseURL = 'https://example.test/project/game/studio/snake.html?artReview=industrial-roster-v3';
  const identity = classicSnakePackageIdentity(source),
    entries = classicSnakePackageEntries(source);
  const href = await prepareSnakeStudioPlay({
    source,
    selectedIndex: 0,
    mode: 'team',
    locale: 'uk',
    baseURL,
    isCurrent: () => true,
    install: async (pack, options) => {
      assert.deepEqual(pack, before);
      assert.deepEqual(options, { owner: 'studio' });
      return { identity, entries };
    },
  });
  const target = new URL(href);
  assert.equal(target.searchParams.get('community'), identity);
  assert.equal(target.searchParams.get('level'), entries[0].id);
  assert.equal(target.searchParams.get('artReview'), 'industrial-roster-v3');
  assert.equal(
    snakeStudioReturnHref(href),
    'https://example.test/project/game/studio/snake.html?lang=uk&artReview=industrial-roster-v3',
  );
  assert.deepEqual(source, before);
});

test('Snake hub static Home, Studio and Rooms links carry only the explicit review pin', async () => {
  const html = await readFile(new URL('../snake/index.html', import.meta.url), 'utf8');
  const anchors = [...html.matchAll(/<a\s[^>]*data-native-review-link[^>]*>/g)];
  assert.equal(anchors.length, 3);
  for (const [tag] of anchors) {
    const path = /href="([^"]+)"/.exec(tag)[1];
    const target = new URL(
      nativeArtReviewURL(
        path,
        'https://example.test/game/snake/?artReview=industrial-roster-v3&seed=17',
      ),
    );
    assert.equal(target.searchParams.get('artReview'), 'industrial-roster-v3');
    assert.equal(target.searchParams.has('seed'), false);
  }
});

test('native SIM mode links retain the accepted return preview on display and activation', () => {
  for (const root of roots) {
    const doc = new Document();
    let locale = 'en';
    const returnURL = fpvWorldReturnURL(
      `${root}optional-practice/fpv-worlds/index.html?artReview=industrial-roster-v3`,
    );
    const nav = createSimModeLinks({ document: doc, gameReturn: returnURL, locale: () => locale });
    doc.body.append(nav);
    for (const link of nav.querySelectorAll('a')) {
      assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-roster-v3');
      locale = 'uk';
      link.click();
      assert.equal(new URL(link.href).searchParams.get('artReview'), 'industrial-roster-v3');
      assert.equal(new URL(link.href).searchParams.get('lang'), 'uk');
    }
    assert.equal(nav.querySelectorAll('a').length, 4);
  }
});
