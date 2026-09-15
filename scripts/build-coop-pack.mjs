#!/usr/bin/env node
/** Build bounded co-op data. Existing files are never overwritten. */
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COOP_PACK_MAX_BYTES,
  COOP_PACK_VERSION,
  COOP_PACK_RECIPE_VERSION,
  COOP_RECIPE_VERSION,
  COOP_TEMPLATES,
  buildCoopLevel,
  buildCoopPack,
  createCoopLevelRecipe,
  validateCoopPack,
} from '../game/coop/recipes.mjs';
import { COOP_LEVEL_VERSION, COOP_RULESET } from '../game/coop/core.mjs';

const HELP = `Co-op level and pack builder

  node scripts/build-coop-pack.mjs --list-templates
  node scripts/build-coop-pack.mjs --template coverage --id orchard --name "Orchard" --out orchard.pack.json
  node scripts/build-coop-pack.mjs --template stronghold --kind level --out yard.level.json
  node scripts/build-coop-pack.mjs --source authoring/coop/starter-pack.recipe.json --out starter.pack.json
  node scripts/build-coop-pack.mjs --validate starter.pack.json

--kind pack|level defaults to pack. A single level recipe can be wrapped in a
one-level pack; a mixed pack recipe keeps each explicit template. --source and
--template are mutually exclusive. --revision is a positive integer (default 1).
Without --out, compiled JSON is written to stdout. --out must be a new file.
`;

async function readJSON(filename) {
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size === 0 || info.size > COOP_PACK_MAX_BYTES)
      throw new TypeError('Input must be a regular JSON file no larger than 1 MiB.');
    const buffer = Buffer.alloc(info.size + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length !== info.size) throw new TypeError('Input changed while being read.');
    return JSON.parse(buffer.subarray(0, length).toString('utf8'));
  } finally {
    await handle.close();
  }
}

function parse(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (['--help', '--list-templates'].includes(flag)) {
      if (options[flag]) throw new TypeError(`Repeated option: ${flag}`);
      options[flag] = true;
      continue;
    }
    if (
      ![
        '--source',
        '--template',
        '--id',
        '--name',
        '--revision',
        '--kind',
        '--out',
        '--validate',
      ].includes(flag)
    )
      throw new TypeError(`Unknown option: ${flag}`);
    if (Object.hasOwn(options, flag) || !argv[i + 1] || argv[i + 1].startsWith('--'))
      throw new TypeError(`Supply one value for ${flag}.`);
    options[flag] = argv[++i];
  }
  return options;
}

export async function buildCoopCommand(argv, { stdout = process.stdout } = {}) {
  const options = parse(argv);
  if (options['--help'] || options['--list-templates']) {
    if (Object.keys(options).length !== 1)
      throw new TypeError('Help or template listing must be used alone.');
    stdout.write(options['--help'] ? HELP : `${JSON.stringify(COOP_TEMPLATES, null, 2)}\n`);
    return null;
  }
  if (options['--validate']) {
    if (Object.keys(options).length !== 1) throw new TypeError('Validation must be used alone.');
    const value = await readJSON(options['--validate']);
    const validation =
      value?.version === COOP_LEVEL_VERSION
        ? validateCoopPack({
            version: COOP_PACK_VERSION,
            ruleset: COOP_RULESET,
            id: 'validation',
            revision: 1,
            name: 'Validation',
            levels: [value],
          })
        : validateCoopPack(value);
    if (!validation.valid) throw new TypeError(validation.errors.join('\n'));
    stdout.write(`${JSON.stringify(validation)}\n`);
    return validation;
  }
  if (!!options['--source'] === !!options['--template'])
    throw new TypeError('Choose exactly one --source recipe or --template.');
  const kind = options['--kind'] || 'pack';
  if (!['pack', 'level'].includes(kind)) throw new TypeError('--kind must be pack or level.');
  if (
    options['--source'] &&
    ['--id', '--name', '--revision'].some((flag) => options[flag] !== undefined)
  )
    throw new TypeError('Source recipes own their metadata; edit the recipe to revise it.');
  const metadata = Object.fromEntries(
    ['id', 'name', 'revision']
      .filter((key) => options[`--${key}`] !== undefined)
      .map((key) => [key, key === 'revision' ? Number(options[`--${key}`]) : options[`--${key}`]]),
  );
  const recipe = options['--source']
    ? await readJSON(options['--source'])
    : createCoopLevelRecipe(options['--template'], metadata);
  let value;
  if (recipe?.version === COOP_PACK_RECIPE_VERSION) {
    if (kind !== 'pack') throw new TypeError('A pack recipe must produce a pack.');
    value = buildCoopPack(recipe);
  } else if (recipe?.version === COOP_RECIPE_VERSION) {
    value =
      kind === 'level'
        ? buildCoopLevel(recipe)
        : buildCoopPack({
            version: COOP_PACK_RECIPE_VERSION,
            id: recipe.id,
            revision: recipe.revision,
            name: recipe.name,
            levels: [recipe],
          });
  } else throw new TypeError('Expected an explicit co-op level or pack recipe.');
  const text = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(text) > COOP_PACK_MAX_BYTES)
    throw new TypeError('Compiled JSON exceeds 1 MiB.');
  if (options['--out']) {
    const handle = await open(options['--out'], 'wx', 0o644);
    try {
      await handle.writeFile(text);
    } finally {
      await handle.close();
    }
  } else stdout.write(text);
  return value;
}

const direct = process.argv[1] && (await realpath(path.resolve(process.argv[1])).catch(() => null));
if (direct === fileURLToPath(import.meta.url))
  buildCoopCommand(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`Co-op build error: ${error.message}\n`);
    process.exitCode = 1;
  });
