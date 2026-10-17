import { pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { arch, platform } from 'node:os';
import { ADVANCED_BACKEND } from '../optional-practice/civilian-fpv/advanced-simulation.mjs';
import { runAdvancedTimingQualification } from '../game/test/helpers/fpv-advanced-qualification.mjs';

export async function benchmarkAdvanced() {
  return {
    format: 'AdvancedBenchmark.v2',
    backend: ADVANCED_BACKEND,
    runtime: process.version,
    platform: platform(),
    architecture: arch(),
    scenario:
      'Coupled controller, four motor states and Rapier body; separate 100 deg/s roll, pitch and yaw steps and 40 m/s thin-wall contact. Three warmed repetitions per axis and candidate against a 2 kHz reference, with 50 Hz observations.',
    ...(await runAdvancedTimingQualification()),
    limitations: [
      'This one local machine is not the qualification device matrix.',
      'The numerical reference is not a measured real aircraft.',
      'Capacity includes simulation/recording but excludes rendering and streaming.',
      'Contact equality checks obstruction without tunneling, not every mission geometry.',
      'Cross-runtime worker evidence is recorded separately in fpv-advanced-runtime-qualification.json.',
      'Custom controller settings, including disabled feedforward filtering, require separate qualification.',
    ],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = await benchmarkAdvanced();
  const output = `${JSON.stringify(report, null, 2)}\n`;
  const flag = process.argv.indexOf('--write');
  if (flag >= 0) {
    if (!process.argv[flag + 1]) throw new Error('--write requires a report path');
    await writeFile(process.argv[flag + 1], output);
  }
  process.stdout.write(output);
}
