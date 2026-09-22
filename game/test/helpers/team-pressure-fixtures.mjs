import { readFile } from 'node:fs/promises';

const read = async (name) =>
  JSON.parse(await readFile(new URL(`../fixtures/team-${name}.json`, import.meta.url)));

/** References accepted input logs; does not rewrite prior failures or checkpoints. */
export async function teamPressureFixtures() {
  const templates = [];
  for (const name of ['opening', 'foundation', 'material', 'roamer']) {
    const data = await read(`${name}-routes`);
    for (const kind of name === 'foundation' ? ['clear', 'mastery'] : ['routes'])
      for (const row of data[kind])
        templates.push({ id: `${name}/${kind}/${row.missionId}/${row.difficulty}`, ...row });
  }
  const rows = (await read('pressure-assessment')).rows
    .filter((r) => r.selected)
    .map((r) => ({
      missionId: r.missionId,
      difficulty: r.difficulty,
      simulationIdentity: r.simulationIdentity,
      log: templates.find((t) => t.id === r.selected.templateId).log,
      delayTicks: r.selected.delayTicks,
      outcomes: r.selected.outcomes,
    }));
  for (const name of ['opening', 'foundation', 'material', 'roamer'])
    rows.push(
      ...(await read(`pressure-${name}-routes`)).rows.map((r) => ({ ...r, delayTicks: 0 })),
    );
  return rows;
}
