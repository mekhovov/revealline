import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inspectPack, preparePack } from '../../../../optional-practice/civilian-fpv/world-content.mjs';

const [output] = process.argv.slice(2);
if (!output || !path.isAbsolute(output)) throw Error('Require an absolute new output pack path');
const project = JSON.parse(await fs.readFile(new URL('./diagnostic.project.json', import.meta.url)));
const bytes = new Uint8Array(await (await preparePack(project)).arrayBuffer());
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (
  bytes.length !== 2803 ||
  sha256 !== 'f50172e5d8e9e0666f6a07f91e5f3ede3c37490c570adbb845f265a21f963388'
)
  throw Error('Diagnostic source does not reproduce the qualified pack');
const inspected = await inspectPack(bytes);
if (inspected.project.courses.length !== 1) throw Error('Diagnostic pack course count');
await fs.writeFile(output, bytes, { flag: 'wx' });
console.log(JSON.stringify({ output, bytes: bytes.length, sha256, suppliedProofs: 0 }));
