import { restoreClassicSnakeReplay } from '../../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  queueClassicSnakeMatchTurn,
  advanceClassicSnakeMatchTo,
  nextClassicSnakeMatchEventAt,
  exportClassicSnakeMatch,
} from '../../snake/classic-match.mjs';

/** A verified journal prefix, one accepted move before completion. No outcome,
 * score, position or timer is fabricated. The actual host plays the final move. */
export function prepareSnakeResultFixture(replay, { mode = replay.mode, pace = 'normal' } = {}) {
  if (restoreClassicSnakeReplay(replay).status !== 'won')
    throw new Error('A verified clear is required.');
  const match = createClassicSnakeMatch(replay.level, {
    mode,
    seed: replay.seed,
    ...(replay.hazardSeed === undefined ? {} : { hazardSeed: replay.hazardSeed }),
  });
  let cursor = 0;
  while (match.runs[0].tick < replay.steps - 1) {
    const tick = match.runs[0].tick;
    while (replay.turns[cursor]?.tick === tick) {
      const turn = replay.turns[cursor++];
      for (const player of mode === 'versus' ? [0, 1] : [turn.playerId])
        if (!queueClassicSnakeMatchTurn(match, player, turn.direction))
          throw new Error('Rejected journal turn.');
    }
    advanceClassicSnakeMatchTo(match, nextClassicSnakeMatchEventAt(match));
    if (match.status !== 'running') throw new Error('Fixture must stop before the outcome.');
  }
  // The host handles any final input after Continue; do not insert unaccepted
  // future turns into a serialized checkpoint.
  const finalTurns = replay.turns.slice(cursor).filter((turn) => turn.tick === replay.steps - 1);
  return {
    finalTurns,
    session: {
      format: 'revealline-classic-snake-session.v2',
      activity: 'campaign',
      levelId: replay.level.id,
      mode,
      pace,
      targetRules: 'authored',
      preset: 'classic',
      duel: 'score',
      seed: replay.seed,
      style: 'cable',
      match: exportClassicSnakeMatch(match),
    },
  };
}

async function mount() {
  const { document, location, localStorage, fetch } = globalThis;
  const form = document.getElementById('prepare');
  const status = document.getElementById('status');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      if (!['127.0.0.1', 'localhost'].includes(location.hostname))
        throw new Error('Use a dedicated localhost test origin.');
      const mode = document.getElementById('mode').value;
      const locale = document.getElementById('locale').value;
      const saveKey = 'revealline.classic-snake.round.v2';
      const marker = 'revealline.test.snake-result-fixture';
      if (
        !localStorage.getItem(marker) &&
        (localStorage.getItem(saveKey) || localStorage.getItem('revealline.classic-snake.round.v1'))
      )
        throw new Error(
          'Existing Snake profile detected. Use a fresh localhost port; this fixture will not overwrite it.',
        );
      const replay =
        mode === 'team'
          ? (await (await fetch('../fixtures/classic-snake-v4-proofs.json')).json()).proofs.find(
              (proof) =>
                proof.levelId === 'classic-field-quiet-channel' &&
                proof.mode === 'team' &&
                proof.pace === 'normal',
            ).replay
          : await (
              await fetch('../../../docs/verification/classic-snake/authored-open-loop.replay.json')
            ).json();
      const prepared = prepareSnakeResultFixture(replay, { mode });
      localStorage.setItem(
        marker,
        'This localhost origin is reserved for manual result verification.',
      );
      localStorage.setItem(saveKey, JSON.stringify(prepared.session));
      const link = document.getElementById('launch');
      const url = new URL('../../snake/play.html', location.href);
      url.search = new URLSearchParams({
        mode,
        lang: locale,
        seed: String(replay.seed),
        pace: 'normal',
        activity: 'campaign',
        targets: 'authored',
        preset: 'classic',
        duel: 'score',
        board: 'living-circuit',
        scene: 'orchard',
      });
      link.href = url.href;
      link.hidden = false;
      status.textContent = `Prepared move ${replay.steps - 1}/${replay.steps}. Open the real game, then Continue. ${prepared.finalTurns.length ? `Final steering: ${prepared.finalTurns.map((turn) => `Player ${turn.playerId + 1} ${turn.direction}`).join(', ')}.` : 'The final move needs no steering.'} This isolated test profile may earn test records.`;
    } catch (error) {
      status.textContent = error.message;
    }
  });
}
if (globalThis.document?.getElementById('snake-result-fixture')) void mount();
