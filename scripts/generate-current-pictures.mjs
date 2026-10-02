import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { inventoryCurrentPictures } from './compile-presentation.mjs';

/** Private dictionaries reduce repeated metadata; public owners retain exact values/order.
 * Labels split at their first existing separator without normalizing any characters.
 * Each public dimensions array is copied, preserving independent mutable child arrays. */
export async function currentPictureModule(pictures) {
  const campaigns = [],
    themes = [],
    dimensions = [],
    labelPrefixes = [];
  const index = (values, value) => {
    const existing = values.indexOf(value);
    if (existing >= 0) return existing;
    values.push(value);
    return values.length - 1;
  };
  const rows = pictures.map(
    ({
      id,
      label,
      dimensions: [width, height],
      owner: { baseCampaignKey, levelId, levelRevision, themeId },
    }) => {
      const separator = label.indexOf(' · '),
        prefix = separator < 0 ? '' : label.slice(0, separator + 3),
        suffix = label.slice(prefix.length);
      let dimension = dimensions.findIndex(([w, h]) => w === width && h === height);
      if (dimension < 0) {
        dimension = dimensions.length;
        dimensions.push([width, height]);
      }
      return [
        id,
        index(labelPrefixes, prefix),
        suffix,
        dimension,
        index(campaigns, baseCampaignKey),
        levelId,
        levelRevision,
        index(themes, themeId),
      ];
    },
  );
  const target = new URL('../game/presentation/current-pictures.mjs', import.meta.url);
  return format(
    '// Generated from current base, active/archive, optional and external source catalogs.\n// Validate with inventoryCurrentPictures; no original bytes or gameplay data is embedded.\n' +
      Object.entries({ campaigns, themes, dimensions, labelPrefixes })
        .map(
          ([name, values]) =>
            '// prettier-ignore\nconst ' + name + ' = ' + JSON.stringify(values) + ';\n',
        )
        .join('') +
      '// prettier-ignore\nconst rows = ' +
      JSON.stringify(rows) +
      ';\nexport const CURRENT_PICTURES = Object.freeze(rows.map(([id, labelPrefix, labelSuffix, dimension, campaign, levelId, levelRevision, theme]) => ({id, label: labelPrefixes[labelPrefix] + labelSuffix, dimensions: [...dimensions[dimension]], owner: {baseCampaignKey: campaigns[campaign], levelId, levelRevision, themeId: themes[theme]}})));\n',
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
