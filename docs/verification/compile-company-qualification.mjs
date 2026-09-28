#!/usr/bin/env node
/** Compile complete reviewer evidence into the existing edition promotion schema.
 * This maintenance tool never allocates, uploads, releases or selects anything. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { editionHash } from '../../publishing/edition-zip.mjs';
import { compileCompanyQualificationReview } from './company-qualification-model.mjs';

const options = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const option = process.argv[index],
    value = process.argv[index + 1];
  if (!['--bundle', '--qualification', '--review'].includes(option) || !value || options[option])
    throw new Error(
      'Usage: compile-company-qualification.mjs --bundle DIR --qualification FILE --review FILE',
    );
  options[option] = value;
}
if (!options['--bundle'] || !options['--qualification'] || !options['--review'])
  throw new Error(
    'Usage: compile-company-qualification.mjs --bundle DIR --qualification FILE --review FILE',
  );

const directory = path.resolve(options['--bundle']),
  envelopeBytes = await fs.readFile(path.join(directory, 'editions.json')),
  envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(envelopeBytes)),
  qualificationBytes = await fs.readFile(path.resolve(options['--qualification']));
if (qualificationBytes.length === 0 || qualificationBytes.length > 8_000_000)
  throw new Error('Qualification evidence is empty or exceeds its bounded public size.');
const qualification = JSON.parse(
    new TextDecoder('utf-8', { fatal: true }).decode(qualificationBytes),
  ),
  evidenceName = `review-company-qualification-${envelope.version}.json`,
  evidencePath = path.join(directory, evidenceName),
  reviewPath = path.resolve(options['--review']),
  evidence = {
    path: evidenceName,
    bytes: qualificationBytes.length,
    sha256: editionHash(qualificationBytes),
    publication: 'public',
    approved: true,
  },
  review = compileCompanyQualificationReview(envelope, qualification, {
    envelopeSha256: editionHash(envelopeBytes),
    evidence,
  }),
  reviewBytes = Buffer.from(`${JSON.stringify(review, null, 2)}\n`);
if (evidencePath === reviewPath)
  throw new Error('Qualification evidence and promotion review need distinct output paths.');

async function assertAbsent(file) {
  try {
    await fs.lstat(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Refusing to replace existing promotion output: ${file}`);
}

await assertAbsent(evidencePath);
await assertAbsent(reviewPath);
await fs.writeFile(evidencePath, qualificationBytes, { flag: 'wx' });
try {
  await fs.writeFile(reviewPath, reviewBytes, { flag: 'wx' });
} catch (error) {
  await fs.rm(evidencePath, { force: true });
  throw error;
}
console.log(
  'Compiled complete qualification into hash-bound promotion evidence. No release or selector was changed.',
);
