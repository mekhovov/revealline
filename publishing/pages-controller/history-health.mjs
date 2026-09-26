#!/usr/bin/env node
// Read-only authority audit, deliberately outside the release critical path.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, readOrdinary, validateAdmissions } from './assemble.mjs';
import { parseJSON } from './metadata.mjs';
import { verifyArchiveAuthorities } from './archive-authority.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const { metadata } = await loadCatalog(directory);
const configuration = parseJSON(await readOrdinary(directory, 'publication.json'));
const { admissions } = await validateAdmissions({ directory, configuration, metadata });
const authority = await verifyArchiveAuthorities({ admissions, token: process.env.GH_TOKEN });
console.log(
  JSON.stringify({ scope: 'all-local-history', archives: admissions.length, ...authority }),
);
