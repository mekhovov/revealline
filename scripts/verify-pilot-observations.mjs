#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  verifyPilotObservations,
  MAX_PILOT_OBSERVATION_BYTES,
} from '../game/content-design/neutral-pilot-session.mjs';

export async function verifyPilotFile(file) {
  const handle = await fs.open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_PILOT_OBSERVATION_BYTES)
      throw new TypeError('Pilot observations exceed file limit or are not a regular file.');
    // A bounded read also covers a file growing after stat, without loading it all.
    const buffer = Buffer.alloc(MAX_PILOT_OBSERVATION_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(buffer, size, buffer.length - size, null);
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > MAX_PILOT_OBSERVATION_BYTES)
      throw new TypeError('Pilot observations exceed file limit.');
    return verifyPilotObservations(buffer.subarray(0, size).toString('utf8'));
  } finally {
    await handle.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) {
    console.error('Usage: node scripts/verify-pilot-observations.mjs observations.json');
    process.exitCode = 1;
  } else {
    verifyPilotFile(process.argv[2]).then(
      (result) => console.log(JSON.stringify(result, null, 2)),
      (error) => {
        console.error(error.message);
        process.exitCode = 1;
      },
    );
  }
}
