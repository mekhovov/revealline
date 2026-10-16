import test from 'node:test';
import assert from 'node:assert/strict';
import { recordingVerificationHref } from '../ui/recording-verification.mjs';

test('terminal recording navigation remains inside the active build without forwarding launch or credential hints', () => {
  for (const root of [
    'http://127.0.0.1:8790/',
    'https://example.test/releases/previous/site/',
    'revealline://app/',
    'capacitor://localhost/',
  ])
    for (const entry of ['game/couch/', 'game/couch/index.html', 'game/couch/relay-rescue.html']) {
      const source = `${root}${entry}?journey=pilot&room=private&credential=secret&return=https://other.test/#external`,
        target = new URL(recordingVerificationHref(source, 'uk'));
      assert.equal(target.href, `${root}game/playground/?lang=uk#recording-verification`);
      assert.deepEqual([...target.searchParams.keys()], ['lang']);
    }
  assert.equal(
    recordingVerificationHref('https://example.test/game/couch/', 'uk&credential=secret'),
    'https://example.test/game/playground/?lang=en#recording-verification',
  );
});
