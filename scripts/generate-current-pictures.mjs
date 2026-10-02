import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { inventoryCurrentPictures } from './compile-presentation.mjs';

/** Compact only the private transport rows. The public ordered objects stay unchanged. */
export async function currentPictureModule(pictures) {
  const rows = pictures.map(
    ({
      id,
      label,
      dimensions: [width, height],
      owner: { baseCampaignKey, levelId, levelRevision, themeId },
    }) => [id, label, width, height, baseCampaignKey, levelId, levelRevision, themeId],
  );
  const target = new URL('../game/presentation/current-pictures.mjs', import.meta.url);
  return format(
    '// Generated from current base, active/archive, optional and external source catalogs.\n// Validate with inventoryCurrentPictures; no original bytes or gameplay data is embedded.\n' +
      '// prettier-ignore\nconst rows = ' +
      JSON.stringify(rows) +
      ';\nexport const CURRENT_PICTURES = Object.freeze(rows.map(([id, label, width, height, baseCampaignKey, levelId, levelRevision, themeId]) => ({id, label, dimensions: [width, height], owner: {baseCampaignKey, levelId, levelRevision, themeId}})));\n',
    { ...(await resolveConfig(fileURLToPath(target))), filepath: fileURLToPath(target) },
  );
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || !['--check', '--write'].includes(process.argv[2]))
    throw new Error('Use generate-current-pictures.mjs --check or --write.');
  const rows = await inventoryCurrentPictures(),
    output = await currentPictureModule(rows),
    target = new URL('../game/presentation/current-pictures.mjs', import.meta.url);
  if (process.argv[2] === '--write') await fs.writeFile(target, output);
  else if ((await fs.readFile(target, 'utf8')) !== output)
    throw new Error('Current picture owner module is stale.');
  console.log(
    rows.length +
      ' current picture owners ' +
      (process.argv[2] === '--check' ? 'verified' : 'written') +
      '.',
  );
}
