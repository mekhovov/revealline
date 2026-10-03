import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  SNAKE_HUNT_COURSES,
  SNAKE_HUNT_PLAYLISTS,
} from '../optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';

const entry = 'optional-practice/civilian-fpv/snake-hunt-catalogue.mjs';
const sources = [
  entry,
  'optional-practice/civilian-fpv/expressive-hunt-courses.mjs',
  'game/data-json.mjs',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pins = sources.map((name) => ({
  path: name,
  sha256: hash(readFileSync(new URL(`../${name}`, import.meta.url))),
}));

/** The Company Snake hub only lists optional flight courses. Their simulation
 * geometry belongs to the independently installed FPV package. Project the
 * exact displayed names and launch identities, without copying flight rules.
 * Canonical source bytes and all inputs to this projection remain pinned; a
 * source edit after loading the build module fails instead of mixing editions. */
export function projectEditionFlightMenu(name, bytes) {
  if (name !== entry) return bytes;
  if (hash(bytes) !== pins[0].sha256)
    throw new Error('Company flight-menu projection differs from its source identity.');
  for (const pin of pins)
    if (hash(readFileSync(new URL(`../${pin.path}`, import.meta.url))) !== pin.sha256)
      throw new Error('Company flight-menu projection source changed during compilation.');
  const courses = SNAKE_HUNT_COURSES.map(({ id, locales }) => ({
    id,
    locales: Object.fromEntries(
      ['en', 'uk'].map((locale) => [locale, { title: locales[locale].title }]),
    ),
  }));
  const playlists = SNAKE_HUNT_PLAYLISTS.map(({ id, title, entries }) => ({
    id,
    title,
    entries: entries.map(({ levelId }) => ({ levelId })),
  }));
  return Buffer.from(
    `// Company optional flight menu; source identities: ${JSON.stringify(pins)}\n` +
      `export const SNAKE_HUNT_COURSES = Object.freeze(${JSON.stringify(courses)});\n` +
      `export const SNAKE_HUNT_PLAYLISTS = Object.freeze(${JSON.stringify(playlists)});\n`,
  );
}
