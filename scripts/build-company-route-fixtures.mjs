import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { COMPANY_MISSIONS } from '../game/company-campaigns/catalog.mjs';

const rows = [];
for (const mission of COMPANY_MISSIONS)
  for (const difficulty of ['gentle', 'standard', 'expert'])
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const args = [
        'scripts/qualify-company-route.mjs',
        mission.id,
        difficulty,
        turnPolicy,
        '--no-wait',
        '--max-ms=20000',
      ];
      let row = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
      if (row.status !== 'won') {
        args.splice(args.indexOf('--no-wait'), 1);
        row = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
      }
      if (row.status !== 'won')
        throw new Error(`No proven route: ${mission.id}/${difficulty}/${turnPolicy}`);
      rows.push(row);
      console.log(
        `${rows.length}/198 ${mission.id} ${difficulty} ${turnPolicy}: ${row.ticks} ticks`,
      );
      writeFileSync(
        'game/test/fixtures/company-campaign-routes.json',
        `${JSON.stringify(
          {
            format: 'revealline-company-route-evidence.v1',
            evidence:
              'Offline omniscient feasibility search. Not human pacing, accessibility, or enjoyment evidence.',
            seed: 1,
            rows,
          },
          null,
          2,
        )}\n`,
      );
    }
