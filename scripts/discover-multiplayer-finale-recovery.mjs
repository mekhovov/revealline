import { readFile, writeFile } from 'node:fs/promises';
import { finaleCases, playFinale } from '../game/test/helpers/multiplayer-finale-qualification.mjs';

// Bounded mistake probes for four fast finale routes. The only interventions
// are held directions and neutral commands; no enemies, reserves, lives, cells,
// positions or outcomes are assigned. A failed search remains failed evidence.
const [output = '.cache/finale-recovery.json'] = process.argv.slice(2);
const strategies = JSON.parse(
  await readFile(
    new URL('../game/test/fixtures/multiplayer-expansion/finale-strategies.json', import.meta.url),
  ),
);
const selected = new Set([
  'team-highland-reunion',
  'team-expedition-homecoming',
  'versus-archive-decider',
  'versus-highland-finish',
]);
const receipt = { kind: 'bounded-finale-mistake-probes-not-human-review', rows: [], probes: [] };
for (const mode of ['team', 'versus'])
  for (const row of await finaleCases(mode)) {
    if (!selected.has(row.missionId)) continue;
    const proof = strategies.rows.find((r) => r.missionId === row.missionId);
    const fast =
      proof.observations.primaryTicks < proof.observations.alternativeTicks
        ? proof.primary
        : proof.alternative;
    const events = (result) =>
      result.hazards.filter((e) =>
        ['player.downed', 'player.failed', 'player.revived'].includes(e.type),
      );
    const probes = [];
    let accepted;
    for (const pauseTicks of [240, 480, 960]) {
      for (let index = 0; index < Math.min(fast.length, 10); index++) {
        const segment = fast[index];
        if (segment.ticks < 60) continue;
        const at = Math.floor(segment.ticks / 2);
        const neutral =
          mode === 'team'
            ? { a: null, b: null, ticks: pauseTicks }
            : { direction: null, ticks: pauseTicks };
        const altered = [
          ...fast.slice(0, index),
          { ...segment, ticks: at },
          neutral,
          { ...segment, ticks: segment.ticks - at },
          ...fast.slice(index + 1),
          ...fast,
          ...fast,
        ];
        const result = playFinale(row, altered);
        const risk = events(result);
        probes.push({
          index,
          pauseTicks,
          status: result.run.status,
          tick: result.run.tick,
          closed: result.closed,
          risk,
        });
        if (result.won && risk.some((e) => ['player.downed', 'player.failed'].includes(e.type))) {
          accepted = {
            mode,
            missionId: row.missionId,
            difficulty: 'standard',
            authoredIdentity: row.authoredIdentity,
            tunedIdentity: row.tunedIdentity,
            options: row.options,
            change: { index, insertedNeutralTicks: pauseTicks },
            segments: result.segments,
            observations: { tick: result.run.tick, closed: result.closed, risk },
          };
          break;
        }
      }
      if (accepted) break;
    }
    if (accepted) receipt.rows.push(accepted);
    receipt.probes.push({ missionId: row.missionId, attempts: probes });
    await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
    console.log(
      `${row.missionId}: ${accepted ? 'command-earned failure followed by same-attempt win' : 'no recovery witness found'}; ${probes.length} probes`,
    );
  }
