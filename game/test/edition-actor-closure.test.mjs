import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { ACTOR_VOICE_RECORDINGS } from '../audio/reactions/actors.mjs';
import { editionOfflineOptionalPath } from '../../scripts/edition-offline.mjs';
import {
  collectEditionEngineFiles,
  editionCodeDependencies,
} from '../../scripts/compile-edition.mjs';
import { projectEditionRuntimeImports } from '../../scripts/edition-runtime.mjs';
import { projectEditionFlightMenu } from '../../scripts/edition-flight-menu.mjs';
import {
  SNAKE_HUNT_COURSES,
  SNAKE_HUNT_PLAYLISTS,
} from '../../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const flightPath = 'optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';

test('Company actor captions and recordings library include exactly their pinned optional originals', async () => {
  const engine = await collectEditionEngineFiles({ root });
  assert.ok(engine.has('game/hunt/actor-reactions.mjs'));
  assert.ok(engine.has('game/journey/reaction-voice-library.mjs'));
  assert.ok(engine.has('game/editions/standalone/actor-recordings.mjs'));
  assert.ok(!engine.has('game/audio/reactions/actors.mjs'));
  const expected = ACTOR_VOICE_RECORDINGS.map((voice) => `game/audio/reactions/${voice.file}`);
  assert.equal(expected.length, 48);
  assert.deepEqual(
    [...engine.keys()].filter((name) => name.includes('/actors-v1/')).sort(),
    [...expected].sort(),
  );
  for (const voice of ACTOR_VOICE_RECORDINGS) {
    const name = `game/audio/reactions/${voice.file}`,
      bytes = engine.get(name);
    assert.equal(bytes.length, voice.bytes, name);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), voice.sha256, name);
    assert.equal(
      editionOfflineOptionalPath(name),
      true,
      'actor speech stays outside the core cache',
    );
  }
  assert.ok([...engine.keys()].some((name) => /^game\/audio\/reactions\/[^/]+\.m4a$/.test(name)));
  const adapter = await import('../editions/standalone/actor-recordings.mjs');
  // The source adapter stays empty; compilation injects canonical metadata.
  assert.deepEqual(adapter.ACTOR_VOICE_RECORDINGS, []);
  const library = 'game/journey/reaction-voice-library.mjs';
  assert.ok(
    editionCodeDependencies(
      library,
      projectEditionRuntimeImports(library, engine.get(library)),
    ).includes('game/editions/standalone/actor-recordings.mjs'),
  );
});

test('Company flight menu preserves every title and launch identity without flight simulation data', async () => {
  const bytes = await fs.readFile(new URL(`../../${flightPath}`, import.meta.url));
  const projected = projectEditionFlightMenu(flightPath, bytes);
  const menu = await import(`data:text/javascript;base64,${projected.toString('base64')}`);
  assert.deepEqual(
    menu.SNAKE_HUNT_COURSES,
    SNAKE_HUNT_COURSES.map(({ id, locales }) => ({
      id,
      locales: Object.fromEntries(
        ['en', 'uk'].map((locale) => [locale, { title: locales[locale].title }]),
      ),
    })),
  );
  assert.deepEqual(
    menu.SNAKE_HUNT_PLAYLISTS,
    SNAKE_HUNT_PLAYLISTS.map(({ id, title, entries }) => ({
      id,
      title,
      entries: entries.map(({ levelId }) => ({ levelId })),
    })),
  );
  assert.deepEqual(editionCodeDependencies(flightPath, projected), []);
  assert.throws(
    () =>
      projectEditionFlightMenu(
        flightPath,
        Buffer.concat([bytes, Buffer.from('\n// modified source')]),
      ),
    /source identity/,
  );
  const engine = await collectEditionEngineFiles({ root });
  assert.ok(!engine.has('optional-practice/civilian-fpv/expressive-hunt-courses.mjs'));
});
