"""Short direction sketches remain separate from the full composition candidates."""
import importlib.util
import json
from pathlib import Path
import unittest
import numpy as np

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('direction_renderer',ROOT/'render_directions.py')
r=importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class DirectionTests(unittest.TestCase):
    def test_direction_scores_are_short_original_unapproved_sketches(self):
        scores=[json.loads(p.read_text()) for p in (ROOT/'sketch-scores').glob('*.json')]
        self.assertEqual(len(scores),2)
        self.assertEqual({s['bpm'] for s in scores},{128,140})
        for score in scores:
            r.validate(score)
            self.assertTrue(35<=score['bars']*4*60/score['bpm']+score['tailSeconds']<=45)
            self.assertEqual(score['compositionCountContribution'],0)
            self.assertEqual(score['publication'],'not-approved')
            self.assertEqual(score['status'],'sketch-unreviewed')
            self.assertTrue(any(e['instrument']=='kick' and e['beat']==0 for e in score['events']))
            self.assertTrue(any(e['instrument'].startswith('lead') and e['beat']==0 for e in score['events']))

    def test_new_palette_is_finite_deterministic_and_zero_edged(self):
        for inst in sorted(r.INSTRUMENTS):
            a=r.voice(inst,55,.3,303)
            self.assertTrue(np.isfinite(a).all(),inst)
            self.assertTrue(np.array_equal(a,r.voice(inst,55,.3,303)),inst)
            self.assertEqual(float(a[0]),0,inst)
            self.assertEqual(float(a[-1]),0,inst)
            self.assertGreater(float(np.max(np.abs(a))),.01,inst)

    def test_second_rejection_preserves_source_and_available_audio(self):
        data=json.loads((ROOT/'idle-frequency-arcade-v2-feedback.json').read_text())
        p=data['preserved']
        self.assertEqual(data['status'],'rejected-by-user')
        for filename,key in [('compose_retro_v2.py','composerSha256'),('render_retro_v2.py','rendererSha256'),(p['score'],'scoreSha256')]:
            self.assertEqual(r.digest(ROOT/filename),p[key])
        for key in ['master','mp3']:
            with self.subTest(recording=key):
                if not (ROOT/p[key]).exists():
                    self.skipTest('Unapproved audio is intentionally local and not part of the framework checkout.')
                self.assertEqual(r.digest(ROOT/p[key]),p[key+'Sha256'])


if __name__=='__main__': unittest.main()
