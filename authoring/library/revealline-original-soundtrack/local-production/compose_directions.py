"""Two original short style auditions, not full compositions or approved tracks."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
VERSION='gpt-authored-direction-sketches.1'


def build(direction):
    a=direction=='a'
    bpm,bars=(128,20) if a else (140,24)
    events=[]
    def n(inst,beat,pitch,duration,gain,pan=0,cents=0):
        events.append(dict(instrument=inst,beat=round(beat,5),pitch=pitch,durationBeats=duration,
                           gain=gain,pan=pan,articulation='normal',cents=cents))
    # New low-register hooks, scored over two-bar harmonic units. They deliberately
    # leave space for the bass/drum interplay instead of filling every eighth note.
    hook_a=[
        [(0,67,.45),(.75,63,.32),(1.5,60,.70),(2.75,63,.30),(3.5,65,.30)],
        [(.25,67,.65),(1.5,70,.38),(2.25,67,.70),(3.5,63,.30)],
        [(0,68,.5),(.75,67,.30),(1.5,63,.55),(2.5,60,.30),(3.25,63,.45)],
        [(.25,65,.42),(1,67,.42),(2,62,.7),(3,65,.30),(3.5,67,.3)],
    ]
    answer_a=[
        [(0,72,.8),(1.25,70,.35),(2,67,.55),(3,63,.65)],
        [(0,67,.38),(.75,70,.38),(1.5,72,.75),(3,74,.6)],
        [(.25,75,.70),(1.25,72,.35),(2,70,.7),(3.25,68,.5)],
        [(0,67,.75),(1.25,65,.35),(2,62,.5),(3,60,.8)],
    ]
    hook_b=[
        [(0,69,.25),(.5,69,.18),(1.25,72,.25),(2,67,.32),(2.75,64,.45),(3.5,67,.2)],
        [(0,69,.55),(1,76,.25),(1.75,74,.2),(2.5,72,.32),(3.25,71,.3)],
        [(0,72,.25),(.5,72,.18),(1.25,76,.25),(2,74,.32),(2.75,72,.45),(3.5,69,.2)],
        [(.25,71,.38),(1,67,.25),(1.75,64,.3),(2.5,68,.25),(3.25,71,.3)],
    ]
    answer_b=[
        [(0,76,.60),(1,72,.25),(1.75,69,.35),(2.75,67,.6)],
        [(.25,69,.35),(1,72,.35),(2,74,.65),(3.25,76,.35)],
        [(0,77,.35),(.75,76,.35),(1.5,72,.60),(2.75,69,.3),(3.5,72,.25)],
        [(0,71,.35),(.75,68,.35),(1.5,64,.65),(2.75,67,.3),(3.5,68,.25)],
    ]
    harmonies=([(36,[60,63,67]),(44,[60,63,68]),(39,[58,63,67]),(46,[62,65,70])]
               if a else [(33,[57,60,64]),(41,[57,60,65]),(43,[55,59,62]),(40,[56,59,64])])
    for bar in range(bars):
        start=bar*4
        root,chord=harmonies[(bar//2)%4]
        answer=8<=bar<16
        breakdown=16<=bar<18 if a else 16<=bar<20
        final=bar>=18 if a else bar>=20
        # A: retro-electronic drive; B: syncopated authored breakbeats.
        kicks=([0,1,2,3] if bar%2==0 else [0,.75,2,2.75,3.5]) if a else (
            [0,.75,1.5,2.5,3.25] if bar%2==0 else [0,1.75,2.25,3.5])
        for beat in kicks: n('kick',start+beat,36,.3,.87 if beat%1==0 else .74)
        for beat in [1,3]: n('snare',start+beat+.004,38,.30,.72 if a else .76)
        if not a:
            for beat in [.875,2.75,3.75]: n('snare',start+beat,38,.12,.14 if beat!=2.75 else .23,-.12)
        for i in range(16):
            if a and i%2==1 and i%4!=3: continue
            n('hat',start+i*.25,60,.09,(.091 if i%4==2 else .042 if i%2==0 else .026),.28)
        for beat in [.5,2.5] if bar%2 else [1.5,3.5]:
            n('openhat',start+beat,60,.3,.06,-.21)
        if bar%4==0: n('crash',start,60,1.5,.11,-.36)
        if bar%4==3:
            for i,p in enumerate([55,52,48,43]):
                n('tom' if i>1 else 'snare',start+3+i*.25,p,.18,.20+i*.026,.45-i*.3)
        # More midrange in the bass, plus an independently controlled sub lane.
        cells_a=[[(0,0,.25),(.5,0,.22),(.875,12,.18),(1.5,7,.22),(1.875,0,.20),
                  (2.5,0,.22),(2.875,12,.18),(3.5,10,.22),(3.875,7,.10)],
                 [(0,0,.33),(.75,7,.18),(1.25,12,.18),(1.75,10,.18),(2.25,0,.33),
                  (3,7,.22),(3.5,12,.22)]]
        cells_b=[[(0,0,.3),(.75,0,.23),(1.5,12,.23),(2.25,7,.23),(2.75,0,.25),(3.5,10,.24)],
                 [(0,0,.4),(1.25,7,.2),(1.75,12,.22),(2.5,0,.25),(3.25,7,.2),(3.75,10,.12)]]
        for beat,interval,duration in (cells_a if a else cells_b)[bar%2]:
            n('bassA' if a else 'bassB',start+beat,root+interval,duration,.29)
            n('sub',start+beat,root-12,duration,.11)
        # Short chords supply body in the middle range. Stereo arp is a reply,
        # not a continuously dominant bed competing with the riff.
        if not breakdown:
            for beat in ([.5,2.5] if bar%2==0 else [.75,2.25]):
                for j,p in enumerate(chord): n('stab',start+beat+j*.006,p,.38,.063,(j-1)*.4)
            if bar%2:
                for i,p in enumerate([chord[0]+12,chord[2]+12,chord[1]+12,chord[2]]):
                    n('arp',start+2.5+i*.25,p,.17,.057,-.55+i*.32)
        line=(answer_a if answer else hook_a) if a else (answer_b if answer else hook_b)
        if not breakdown or bar%2==1:
            for beat,pitch,duration in line[bar%4]:
                if breakdown and beat<2: continue
                n('leadA' if a else 'leadB',start+beat,pitch,duration,.18 if a else .17,.06)
                if a and final:
                    n('leadA',start+beat+.012,pitch-12,duration,.075,-.3,cents=-4)
        if final and bar%2:
            n('stab',start+3.5,chord[0]+12,.20,.085,-.38)
    events.sort(key=lambda e:(e['beat'],e['instrument'],e['pitch']))
    sections=([('drive and riff',8),('melodic answer',8),('rhythm spotlight',2),('riff return',2)] if a
              else [('breakbeat hook',8),('FM answering hook',8),('drum and bass break',4),('developed return',4)])
    at=0; roadmap=[]
    for name,count in sections:
        roadmap.append(dict(name=name,startBar=at,bars=count,startSeconds=round(at*4*60/bpm,3)))
        at+=count
    return dict(format='revealline-local-score.v1',version=VERSION,
        slug='direction-a-retro-drive' if a else 'direction-b-tracker-breaks',
        title='Direction A — Retro Drive' if a else 'Direction B — Tracker Breaks',
        genre='synth90s',role='direction-sketch',seed=12803 if a else 14003,bpm=bpm,
        meter='4/4',beatsPerBar=4,bars=bars,tailSeconds=1.2,sampleRate=48000,
        status='sketch-unreviewed',sections=roadmap,events=events,
        provenance='Original GPT-authored short style sketch. No existing melody, audio, MIDI, model or sample import.',
        instrumentDisclosure='New locally synthesized saw/pulse bass, controlled sub, subtractive riff or FM brass, chord stabs and electronic drums. No recorded guitar or commercial sample use.',
        listeningReview='pending',culturalReview='not-applicable',publication='not-approved',
        compositionCountContribution=0)


if __name__=='__main__':
    (ROOT/'sketch-scores').mkdir(exist_ok=True)
    for direction in ['a','b']:
        score=build(direction)
        path=ROOT/'sketch-scores'/(score['slug']+'.json')
        if path.exists() and json.loads(path.read_text())!=score: raise RuntimeError('Preserve existing score revision first.')
        path.write_text(json.dumps(score,ensure_ascii=False,indent=2)+'\n')
        print(score['slug'],len(score['events']),'events',round(score['bars']*4*60/score['bpm']+1.2,3),'seconds')
