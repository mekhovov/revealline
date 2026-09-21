"""Production checks do not substitute for listening or cultural review."""
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np

ROOT = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('local_renderer', ROOT/'render.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class ProductionTests(unittest.TestCase):
    def test_complete_balanced_scores(self):
        scores = [s for p in (ROOT/'scores').glob('*.json')
                  if (s := json.loads(p.read_text()))['version']=='gpt-authored-pilots.1']
        self.assertEqual(len(scores), 7)
        for genre in ['synth90s', 'metal', 'ukrainian']:
            group = [s for s in scores if s['genre']==genre and s['role']!='finale']
            self.assertEqual({s['role'] for s in group}, {'menu','gameplay'})
        for score in scores:
            r.validate(score)
            seconds = score['bars']*score['beatsPerBar']*60/score['bpm']+score['tailSeconds']
            low,high = (120,180) if score['role']=='menu' else (180,300)
            self.assertTrue(low<=seconds<=high)
            self.assertTrue(any('bridge' in s['name'] for s in score['sections']))
            self.assertTrue(any('return' in s['name'] for s in score['sections']))
            self.assertEqual(score['listeningReview'], 'pending')

    def test_all_voices_finite_and_zero_edged(self):
        for instrument in sorted(r.INSTRUMENTS):
            samples = r.voice(instrument,55,.3,101)
            self.assertTrue(np.isfinite(samples).all(),instrument)
            self.assertGreater(float(np.max(np.abs(samples))), .01,instrument)
            self.assertEqual(float(samples[0]),0,instrument)
            self.assertEqual(float(samples[-1]),0,instrument)

    def test_articulation_and_reproducibility(self):
        first = r.voice('guitar',38,.5,25,'mute')
        second = r.voice('guitar',38,.5,25,'mute')
        self.assertTrue(np.array_equal(first,second))
        open_string = r.voice('guitar',38,.5,25,'open')
        self.assertLess(np.mean(first[12000:]**2),np.mean(open_string[12000:]**2)*.3)

    def test_peak_estimate_handles_chunk_boundaries(self):
        samples = np.zeros((r.SR*2,2),np.float32)
        samples[r.SR-1]=.8
        peak = r.true_peak(samples)
        self.assertTrue(-2.1<peak<-1.8,peak)

    def test_pcm24_channel_interleave_and_sign(self):
        body = r.pcm24(np.array([[0,.5],[-.5,-1]],np.float32))
        self.assertEqual(body,bytes.fromhex('0000000000400000c0000080'))


if __name__=='__main__':
    unittest.main()
