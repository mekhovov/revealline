import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import {
  createClassicSnake,
  queueClassicSnakeTurn,
  stepClassicSnake,
  restoreClassicSnakeReplay,
} from '../snake/classic-core.mjs';

const entryFor = (id) => CLASSIC_SNAKE_LEVELS.find((entry) => entry.id === id);
const cellKey = ({ x, y }) => `${x},${y}`;
function permanentReach(level) {
  const blocked = new Set([
    ...level.walls.map(cellKey),
    ...level.shutters.flatMap((shutter) => shutter.cells.map(cellKey)),
  ]);
  const seen = new Set([cellKey(level.spawns[0])]),
    queue = [level.spawns[0]];
  for (let index = 0; index < queue.length; index++) {
    const at = queue[index];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next = { x: at.x + dx, y: at.y + dy },
        key = cellKey(next);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= level.width ||
        next.y >= level.height ||
        blocked.has(key) ||
        seen.has(key)
      )
        continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return { seen, openCells: level.width * level.height - blocked.size };
}

test('Three-way Escape and Final Airfield retain connected permanent approaches with every shutter closed', () => {
  for (const id of ['classic-pursuit-three-way-escape', 'classic-pursuit-final-airfield']) {
    const { level } = entryFor(id),
      { seen, openCells } = permanentReach(level);
    assert.equal(
      seen.size,
      openCells,
      `${id}: permanent terrain must not require waiting for a door`,
    );
    for (const spawn of level.spawns) assert.ok(seen.has(cellKey(spawn)));
    for (const offer of level.pickups) {
      assert.ok(offer.at < level.goal);
      for (const pad of offer.pads)
        assert.ok(seen.has(cellKey(pad)), 'supply detours remain outside closed gates');
    }
  }
});

test('the two long-route concerns are active interceptions rather than compulsory stationary waits', async (t) => {
  const { proofs } = JSON.parse(
    await readFile(
      new URL('./fixtures/classic-snake-variety-proofs.json', import.meta.url),
      'utf8',
    ),
  );
  for (const levelId of ['classic-pursuit-three-way-escape', 'classic-pursuit-final-airfield'])
    for (const mode of ['solo', 'team']) {
      const proof = proofs.find(
        (p) => p.levelId === levelId && p.mode === mode && p.pace === 'normal',
      );
      const level = prepareClassicSnakeLevel(entryFor(levelId), { pace: proof.pace });
      const run = createClassicSnake(level, { mode, seed: proof.replay.seed });
      let cursor = 0,
        gap = 0,
        movementInGap = 0,
        longest = { moves: 0, targetMoves: 0 };
      const captureCells = new Set();
      for (let tick = 0; tick < proof.replay.steps; tick++) {
        while (proof.replay.turns[cursor]?.tick === tick) {
          const turn = proof.replay.turns[cursor++];
          assert.ok(queueClassicSnakeTurn(run, turn.playerId, turn.direction));
        }
        const heads = run.snakes.map((snake) => cellKey(snake.body[0]));
        stepClassicSnake(run);
        assert.ok(
          run.snakes.some((snake, index) => cellKey(snake.body[0]) !== heads[index]),
          'accepted flight never holds the head while a gate timer runs',
        );
        const catches = run.events.filter((event) => event.type === 'target.caught');
        for (const event of catches) captureCells.add(cellKey(event.target));
        if (catches.length) {
          if (gap > longest.moves) longest = { moves: gap, targetMoves: movementInGap };
          gap = 0;
          movementInGap = 0;
        } else {
          gap++;
          movementInGap += run.events.filter((event) => event.type === 'target.moved').length;
        }
      }
      assert.equal(run.status, 'won');
      assert.equal(
        captureCells.size,
        level.goal,
        'these witnessed routes intercept different locations',
      );
      assert.ok(
        longest.targetMoves > 0,
        'the longest gap includes target movement rather than a required idle timer',
      );
      t.diagnostic(
        `${levelId}/${mode}: ${run.tick} moves, ${captureCells.size} capture cells, longest catch gap ${longest.moves} moves containing ${longest.targetMoves} target moves`,
      );
    }
});

test('the accepted Courier Overpass Solo routes can finish with no optional catches at every pace', async () => {
  const { proofs } = JSON.parse(
    await readFile(
      new URL(
        '../../docs/verification/snake-remaster/outlier-alternative-proofs.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  for (const pace of ['slow', 'normal', 'fast']) {
    const proof = proofs.find(
      (p) =>
        p.levelId === 'classic-expedition-courier-overpass' && p.mode === 'solo' && p.pace === pace,
    );
    const level = prepareClassicSnakeLevel(entryFor(proof.levelId), { pace });
    const run = restoreClassicSnakeReplay(proof.replay, { level });
    assert.equal(run.status, 'won');
    assert.equal(run.catches, level.goal);
    assert.equal(run.bonusCatches, 0);
  }
});
