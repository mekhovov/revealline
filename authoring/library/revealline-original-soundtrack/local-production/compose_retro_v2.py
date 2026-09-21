"""A new energetic retro-menu composition, responding to the rejected slow pilot.

Every note is newly authored here. No reference audio/MIDI/transcription is used.
The original compose.py, its score and rejected recording remain immutable.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = 'gpt-authored-arcade-menu.2'

# F-sharp minor. Each independent eight-bar sentence contains a call, an answer,
# a varied second call, and a cadence. MIDI numbers are explicit score material.
A = [
    [(0,78,.30),(.5,78,.20),(.875,76,.30),(1.5,81,.40),(2.25,80,.35),(3,73,.28),(3.5,76,.30)],
    [(.25,78,.52),(1,73,.28),(1.5,76,.36),(2.25,80,.30),(2.75,78,.70)],
    [(0,78,.30),(.5,78,.20),(.875,76,.30),(1.5,81,.40),(2.25,85,.38),(3,83,.28),(3.5,81,.28)],
    [(0,80,.55),(.75,76,.28),(1.5,73,.55),(2.5,76,.28),(3,80,.63)],
    [(0,78,.30),(.5,78,.20),(.875,76,.30),(1.5,81,.40),(2.25,80,.35),(3,73,.28),(3.5,76,.30)],
    [(.25,81,.45),(1,80,.28),(1.5,78,.36),(2.25,76,.28),(2.75,73,.55),(3.5,76,.28)],
    [(0,80,.30),(.5,80,.20),(.875,78,.30),(1.5,76,.40),(2.25,73,.35),(3,71,.28),(3.5,73,.30)],
    [(0,74,.55),(.75,76,.30),(1.5,73,.40),(2.25,76,.25),(2.75,78,.80)],
]
B = [
    [(.25,85,.9),(1.5,83,.4),(2.25,81,.65),(3.25,80,.45)],
    [(0,80,.55),(.75,81,.28),(1.25,83,.50),(2,80,1.0),(3.5,76,.28)],
    [(0,78,.55),(1,81,.55),(2,85,.8),(3.25,83,.45)],
    [(0,81,.95),(1.5,80,.32),(2,78,.65),(3,76,.65)],
    [(.25,81,.9),(1.5,80,.4),(2.25,78,.65),(3.25,76,.45)],
    [(0,78,.55),(.75,80,.28),(1.25,81,.50),(2,85,.90),(3.5,81,.28)],
    [(0,83,.55),(1,80,.55),(2,76,.8),(3.25,73,.45)],
    [(0,74,.55),(.75,73,.28),(1.25,71,.4),(2,73,.45),(2.75,76,.3),(3.5,77,.25)],
]
C = [
    [(0,66,.25),(.75,69,.25),(1.5,73,.25),(2.25,71,.25),(3,68,.25),(3.5,69,.25)],
    [(0,64,.25),(.75,68,.25),(1.5,71,.25),(2.25,73,.25),(3,76,.25),(3.5,71,.25)],
    [(0,62,.25),(.75,66,.25),(1.5,69,.25),(2.25,73,.25),(3,71,.25),(3.5,69,.25)],
    [(0,61,.25),(.75,64,.25),(1.5,68,.25),(2.25,71,.25),(3,73,.25),(3.5,77,.25)],
]
# Root, four upper voices. Inversions keep the middle registers moving gently.
HARMONY_A = [
    (30,[57,61,64,68]), (28,[56,59,61,66]),
    (26,[54,57,61,64]), (25,[52,56,59,64]),
    (30,[57,61,64,68]), (33,[56,61,64,69]),
    (28,[54,59,64,68]), (23,[54,57,61,66]),
]
HARMONY_B = [
    (33,[56,61,64,69]), (28,[56,59,64,68]),
    (30,[57,61,64,68]), (26,[54,57,61,66]),
    (23,[54,57,61,66]), (26,[54,57,61,64]),
    (28,[56,59,64,66]), (25,[53,56,59,65]),
]


def build():
    events, roadmap = [], []
    bpm = 144
    # 92 bars, 2:35 including the natural tail. The break still carries hats,
    # kick and a new bass figure; there is no ambient/half-time interlude.
    sections = [
        ('cold open: beat and hook',4,'A','open'),
        ('A: call and response',16,'A','full'),
        ('A: bass and arp variation',8,'A','variation'),
        ('B: wide answering melody',16,'B','full'),
        ('four-bar groove break',4,'C','break'),
        ('A: developed return',16,'A','return'),
        ('lead and bass exchange',8,'C','exchange'),
        ('final A and B hook relay',16,'AB','final'),
        ('rhythmic sign-off',4,'A','outro'),
    ]
    def note(inst, beat, pitch, duration, gain, pan=0, articulation='normal', **extra):
        events.append(dict(instrument=inst,beat=round(beat,5),pitch=pitch,
                           durationBeats=duration,gain=round(gain,4),pan=pan,
                           articulation=articulation,**extra))
    cursor = 0
    for name,count,theme,texture in sections:
        roadmap.append(dict(name=name,startBar=cursor,bars=count,theme=theme,
                            texture=texture,startSeconds=round(cursor*4*60/bpm,3)))
        for local in range(count):
            bar, start = cursor+local, (cursor+local)*4
            active_theme = ('A' if local<8 else 'B') if theme=='AB' else theme
            chords = HARMONY_B if active_theme=='B' else HARMONY_A
            root,voicing = chords[local%8]
            next_root = chords[(local+1)%8][0]
            broken = texture=='break'
            exchange = texture=='exchange'
            final = texture=='final'
            ending = texture=='outro' and local==3
            if ending: root,voicing = HARMONY_A[0]
            root += 12
            next_root += 12
            # Punch on the first sample block: four-on-floor foundation with
            # phrase-specific pickups; no slow introduction or sparse opening.
            kick_beats = [0,1,2,3] if not ending else [0,1,2]
            if local%8==6 and not broken: kick_beats += [2.75]
            for at in kick_beats:
                note('kick',start+at,36,.28,.63 if at%1==0 else .36)
            for at in [1,3] if not ending else [1]:
                note('snare',start+at+.006,38,.3,.29)
                if not broken:
                    note('clap',start+at+.017,38,.21,.085,-.12)
            for step in range(8 if not ending else 6):
                at = step*.5
                note('hat',start+at,60,.11,.072 if step%2 else .043,.25)
            # Sixteenth-note ghost hats and occasional wood clicks make the
            # offbeat rhythm independent of the bass and arpeggio patterns.
            for at in ([.75,2.75,3.25] if local%2 else [1.75,2.25]):
                if not ending: note('hat',start+at,60,.075,.026,-.22)
            if local%4==2 and not broken:
                note('rim',start+2.75,60,.1,.09,-.40)
            if local%8==0 and not broken:
                note('crash',start,60,1.7,.09,-.35)
            # Bass is a scored line, with offbeat octave/fifth answers and
            # distinct cadences. Short articulations retain drum separation.
            bass_cells = [
                [(0,0,.20),(.5,12,.22),(.875,0,.19),(1.5,7,.29),(2.25,0,.22),(2.75,12,.24),(3.5,7,.20)],
                [(0,0,.28),(.75,7,.20),(1.25,12,.22),(1.75,0,.20),(2.5,7,.26),(3,0,.20),(3.5,12,.20)],
                [(0,0,.20),(.5,0,.20),(1.25,7,.21),(1.75,12,.20),(2.5,0,.25),(3.25,7,.20)],
                [(0,0,.28),(.75,12,.19),(1.5,7,.28),(2.25,0,.20),(2.75,7,.20),(3.25,12,.20)],
            ]
            bass_cell = bass_cells[(local+(1 if active_theme=='B' else 0))%4]
            if broken: bass_cell = [(0,0,.28),(.75,12,.27),(1.5,7,.3),(2.25,0,.3),(3,10,.24),(3.5,12,.21)]
            if ending: bass_cell = [(0,0,.2),(.5,12,.2),(1.5,7,.25),(2,0,1.8)]
            for at,interval,length in bass_cell:
                note('bass',start+at,root+interval,length,.265 if not broken else .31)
            if not ending:
                note('bass',start+3.75,next_root+(1 if next_root<root else -1),.18,.19)
            # Bright stereo ostinato. Every four bars the permutation changes;
            # a separate chord stab makes the rhythm audible below the lead.
            if not broken and not exchange:
                permutation = [0,2,1,3,2,0,3,1] if local%4<2 else [2,0,3,1,0,2,1,3]
                for step,index in enumerate(permutation):
                    if ending and step>3: continue
                    note('keys',start+.25+step*.5,voicing[index]+12,.28,
                         .060 if texture=='open' else .071, -.48 if step%2 else .48)
                for at in ([.5,2.25] if local%2==0 else [.75,2.5]):
                    if ending and at>2: continue
                    for j,pitch in enumerate(voicing[:3]):
                        note('keys',start+at+j*.006,pitch,.28,.063,(j-1)*.22)
            if exchange:
                for at,j in [(.5,0),(1.25,2),(2.5,1),(3.25,3)]:
                    note('keys',start+at,voicing[j]+12,.2,.1,.5 if j%2 else -.5)
            if local%2==0 and not broken and texture!='open':
                for j,pitch in enumerate(voicing):
                    note('pad',start+j*.016,pitch+12,7.5,.016,(j-1.5)*.34)
            # Lead carries complete, different eight-bar melodies. During the
            # groove break low FM fragments answer the bass, never replacing
            # it with sustained background ambience.
            line = (A if active_theme=='A' else B if active_theme=='B' else C)[local%(8 if active_theme!='C' else 4)]
            if ending:
                line = [(0,81,.25),(.5,80,.25),(1,76,.25),(1.5,73,.25),(2,78,1.6)]
            for n,(at,pitch,duration) in enumerate(line):
                if texture=='variation' and local%4==3 and n%2:
                    inst,pan,amp='keys',-.24,.19
                else:
                    inst,pan,amp='lead',.04,.20
                if broken: amp=.17
                if exchange and local%2: pitch+=12
                note(inst,start+at,pitch,duration,amp,pan)
                # Short, written dotted-eighth reply is quiet enough to leave
                # each new phrase clear; skip busy terminal fills.
                if n==0 and not broken and local%4==0:
                    note('keys',start+at+.75,pitch,.19,.047,-.42)
            if texture in {'return','final'} and local%4 in {1,3}:
                # Independent contrary-motion counterline, not octave doubling.
                for at,p in [(0,voicing[2]),(1.5,voicing[1]),(2.75,voicing[0]+12)]:
                    note('keys',start+at,p+12,.3,.075,-.34)
            # Tracker-style phrase punctuation: alternating retriggers, tuned
            # tom descent and a last-sixteenth pickup. Hats keep the pulse.
            if local%8==7 or (count==4 and local==3 and not ending):
                for i,at in enumerate([3,3.25,3.5,3.75]):
                    note('snare' if i<2 else 'tom',start+at,
                         38 if i<2 else 52-(i-2)*7,.16,.12+i*.024,.35-i*.22)
            elif local%4==3 and not ending:
                note('snare',start+2.75,38,.15,.07,-.18)
                note('snare',start+3.75,38,.14,.105,.18)
            if final and local in {3,11}:
                for i,p in enumerate([85,83,81,80]):
                    note('keys',start+3+i*.25,p,.15,.065,-.45+i*.30)
        cursor+=count
    events.sort(key=lambda e:(e['beat'],e['instrument'],e['pitch']))
    return dict(format='revealline-local-score.v1',version=VERSION,
        slug='idle-frequency-arcade-v2',title='Idle Frequency — Arcade Revision',
        genre='synth90s',role='menu',seed=9144,bpm=bpm,meter='4/4',beatsPerBar=4,
        bars=cursor,tailSeconds=2.0,sampleRate=48000,status='candidate-unreviewed',
        sections=roadmap,events=events,
        provenance='New original GPT-authored notes and arrangement; no imported melodies, MIDI or audio. Separate replacement after rejection of the slow pilot.',
        instrumentDisclosure='All voices synthesized locally: FM lead, FM bass, keys, pads and electronic percussion. No sampled performances or emulation-accuracy claim.',
        listeningReview='pending',culturalReview='not-applicable',
        revisionOf='original.idle-frequency',
        design=['Immediate kick, syncopated bass and hook from bar one',
                '144 BPM, new F-sharp-minor call-and-response material',
                'Distinct A/B sentences, four-bar groove break, developed returns',
                'Sixteenth-note tracker fills and rhythmic ending; no ambient intro'])


def main():
    path=ROOT/'scores'/'idle-frequency-arcade-v2.json'
    score=build()
    if path.exists() and json.loads(path.read_text())!=score:
        raise RuntimeError('Existing revision score differs; preserve it before changes.')
    path.write_text(json.dumps(score,ensure_ascii=False,indent=2)+'\n')
    print(f"{path}: {len(score['events'])} events, {score['bars']} bars, {score['bpm']} BPM")


if __name__=='__main__':
    main()
