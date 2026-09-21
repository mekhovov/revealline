"""Structural and technical revision checks; not a substitute for listening."""
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('retro_renderer',ROOT/'render_retro_v2.py')
r=importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)


class RetroRevisionTests(unittest.TestCase):
    def test_rejected_recording_and_its_sources_remain_exact(self):
        feedback=json.loads((ROOT/'idle-frequency-feedback.json').read_text())
        preserved=feedback['preserved']
        self.assertEqual(feedback['status'],'rejected-by-user')
        self.assertEqual(r.digest(ROOT/'compose.py'),preserved['composerSha256'])
        self.assertEqual(r.digest(ROOT/'render.py'),preserved['rendererSha256'])
        self.assertEqual(r.digest(ROOT/preserved['score']),preserved['scoreSha256'])
        for path,key in [('master','masterSha256'),('mp3','mp3Sha256')]:
            with self.subTest(recording=path):
                if not (ROOT/preserved[path]).exists():
                    self.skipTest('Unapproved local audio is intentionally excluded from the framework checkout.')
                self.assertEqual(r.digest(ROOT/preserved[path]),preserved[key])

    def test_new_score_immediate_rhythm_and_independent_melodic_material(self):
        score=json.loads((ROOT/'scores/idle-frequency-arcade-v2.json').read_text())
        old=json.loads((ROOT/'scores/idle-frequency.json').read_text())
        r.validate(score)
        self.assertTrue(138<=score['bpm']<=150)
        seconds=score['bars']*4*60/score['bpm']+score['tailSeconds']
        self.assertTrue(120<=seconds<=180)
        first=[e for e in score['events'] if e['beat']<4]
        self.assertTrue(all(any(e['instrument']==i and e['beat']==0 for e in first)
                            for i in ['kick','bass','lead']))
        self.assertGreater(len([e for e in first if e['instrument']=='bass']),4)
        self.assertGreater(len({e['pitch'] for e in first if e['instrument']=='bass'}),2)
        self.assertNotEqual([e['pitch'] for e in score['events'] if e['instrument']=='lead'][:12],
                            [e['pitch'] for e in old['events'] if e['instrument']=='keys'][:12])
        for section in score['sections']:
            for bar in range(section['startBar'],section['startBar']+section['bars']):
                self.assertTrue(any(e['instrument']=='kick' and e['beat']==bar*4 for e in score['events']))
        self.assertEqual(score['listeningReview'],'pending')
        self.assertEqual(score['status'],'candidate-unreviewed')

    def test_revised_voices_are_finite_zero_edged_and_deterministic(self):
        for inst in sorted(r.INSTRUMENTS):
            a=r.voice(inst,55,.25,144)
            b=r.voice(inst,55,.25,144)
            self.assertTrue(np.array_equal(a,b),inst)
            self.assertTrue(np.isfinite(a).all(),inst)
            self.assertEqual(float(a[0]),0,inst)
            self.assertEqual(float(a[-1]),0,inst)
            self.assertGreater(float(np.max(np.abs(a))),.01,inst)


if __name__=='__main__': unittest.main()
