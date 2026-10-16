// Content qualification: ordinary commands only, then an independent deterministic replay.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectPack } from '../../../optional-practice/civilian-fpv/world-content.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldStateIdentity,
  WORLD_FLIGHT_MODEL,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import {
  exportProofParts,
  worldRecordIdentity,
  importProofPart,
} from '../../../optional-practice/civilian-fpv/world-records.mjs';
import { DEFAULT_RESPONSE } from '../../../optional-practice/civilian-fpv/radio-profile.mjs';
import { schoolAuthoringPilot } from '../../../scripts/qualify-fpv-acro-school.mjs';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'distribution/r1');
await initWorldRuntime();
const receipt = [];
for (const id of (await fs.readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('cc0-'))
  .map((entry) => entry.name)
  .filter((id) => !process.argv[2] || id === process.argv[2])) {
  const directory = path.join(root, id),
    pack = await inspectPack(await fs.readFile(path.join(directory, id + '.r1.rlpack'))),
    records = [];
  for (const course of pack.project.courses)
    for (const mode of ['self-level', 'acro']) {
      const flight = createWorldFlight({ course, mode, response: DEFAULT_RESPONSE }),
        recorder = createWorldRecorder(flight, { session: 'demonstration' }),
        memory = {};
      flight.arm();
      let state = flight.snapshot();
      while (state.status === 'active' && state.ticks < 15000) {
        state = flight.step(schoolAuthoringPilot(state, course, memory, mode));
        recorder.record();
      }
      if (state.status !== 'complete' || state.contacts !== 0 || state.health !== state.maxHealth)
        throw Error(
          JSON.stringify({
            id,
            mode,
            status: state.status,
            step: state.step,
            contacts: state.contacts,
            position: state.position,
            target: state.target,
          }),
        );
      const proof = recorder.export(),
        replay = await replayWorldFlight(course, proof, { yieldControl: async () => {} });
      if (
        replay.state.status !== 'complete' ||
        worldStateIdentity(replay.state) !== proof.finalStateIdentity
      )
        throw Error(id + ' replay differs');
      records.push({
        id: worldRecordIdentity({ course, proof }),
        course,
        proof,
        packIdentity: 'fpv-pack:' + pack.sha256,
        status: 'verified',
        diagnostic: 'complete',
        savedAt: 0,
        pinned: false,
      });
      const row = {
        id,
        mode,
        packSha256: pack.sha256,
        ticks: state.ticks,
        contacts: state.contacts,
        health: state.health,
        finalStateIdentity: proof.finalStateIdentity,
      };
      receipt.push(row);
      console.log(JSON.stringify(row));
      flight.dispose();
    }
  const parts = await exportProofParts(records);
  if (parts.length !== 1) throw Error('Proof archive unexpectedly split');
  const text = JSON.stringify(parts[0]);
  await importProofPart(text);
  await fs.writeFile(path.join(directory, id + '.r1.proofs.json'), text + '\n');
}
await fs.writeFile(
  path.join(root, process.argv[2] ? process.argv[2] + '.flights.json' : 'flights.json'),
  JSON.stringify(
    {
      format: 'FPVFreeWorldFlights.v1',
      verifiedAt: new Date().toISOString(),
      runtime: WORLD_FLIGHT_MODEL,
      checks: receipt,
      limitations: [
        'Content commands/replay verification; browser installation and visual inspection are separate.',
        'No physical-device performance or human acceptance claim.',
      ],
    },
    null,
    2,
  ) + '\n',
);
