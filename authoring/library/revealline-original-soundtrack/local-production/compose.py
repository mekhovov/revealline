"""Author the complete, original pilot scores. No samples, MIDI imports or network.

The written note/rhythm material and arrangement below are the score authority;
JSON exports make every performance event inspectable independently of the DSP.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VERSION = "gpt-authored-pilots.1"


def build(slug, title, genre, bpm, sections, chords, themes, seed, menu=False):
    events = []
    bars = sum(s[1] for s in sections)
    beat_seconds = 60 / bpm
    def note(inst, beat, pitch, length, gain, pan=0, articulation="normal", **extra):
        events.append(dict(instrument=inst, beat=round(beat, 5), pitch=pitch,
                           durationBeats=length, gain=round(gain, 4), pan=pan,
                           articulation=articulation, **extra))
    cursor = 0
    roadmap = []
    metal = genre == "metal"
    ua = genre == "ukrainian"
    for si, (name, count, theme, density) in enumerate(sections):
        roadmap.append(dict(name=name, startBar=cursor, bars=count, theme=theme,
                            texture=density, startSeconds=round(cursor * 4 * beat_seconds, 3)))
        for local in range(count):
            bar = cursor + local
            start = bar * 4
            chord = chords[(local + (4 if theme == "B" else 0)) % len(chords)]
            root, third, fifth, color = chord
            sparse = density < .5
            ending = name == "outro"
            developed = "return" in name or "peak" in name
            # Distinct inner voicings and restrained harmonic motion; pads leave bass space.
            if local % 2 == 0:
                for j, p in enumerate([root + 24, third + 12, fifth + 12, color + 12]):
                    note("pad", start + j * .022, p, 7.7,
                         (.027 if metal else .042) * density, (j - 1.5) * .24)
            if menu:
                order = [0, 2, 1, 3, 2, 1, 3, 2] if ua else [0, 2, 3, 1, 2, 0, 3, 2]
                voicing = [root + 12, third + 12, fifth + 12, color + 12]
                inst = "pluck" if ua else "clean" if metal else "keys"
                for step, index in enumerate(order):
                    if sparse and step not in [0, 3, 6]:
                        continue
                    note(inst, start + step * .5 + (0.018 if step % 2 else 0),
                         voicing[index], 1.35, .13 * density * (1 if step % 2 == 0 else .78),
                         -.32 if step % 2 == 0 else .28)
                note("bass", start, root - (12 if root > 40 else 0), 3.65, .19 * density)
                if not sparse and local % 2 == 0:
                    note("tom", start, 45, .6, .14 if metal else .085)
                if not sparse and not metal:
                    note("rim", start + 2, 60, .2, .052)
                    for t in [.5, 1.5, 2.5, 3.5]:
                        note("hat", start + t, 60, .1, .025, .35)
            elif metal:
                # Written syncopated riff cells: accents, muted repeated notes and open answers.
                riffs = {
                    "A": [(0,0,.32),(0.5,0,.22),(.875,0,.2),(1.25,3,.42),(2,2,.22),(2.5,0,.25),(3,7,.65)],
                    "B": [(0,0,.62),(.75,7,.25),(1.25,10,.5),(2,8,.55),(2.75,7,.4),(3.5,5,.3)],
                    "C": [(0,0,.7),(1.5,0,.45),(2.25,1,.3),(3,0,.65)],
                }
                if sparse:
                    for t, p in enumerate([root + 12, fifth + 12, color + 12, third + 12]):
                        note("clean", start + t, p, 1.8, .18, -.35 + .22 * t)
                    note("bass", start, root - 12, 3.8, .2)
                else:
                    for i, (at, interval, length) in enumerate(riffs[theme]):
                        # Last bar answers downward instead of cloning the opening cell.
                        p = root + interval + (-2 if local % 8 == 7 and i >= 4 else 0)
                        articulation = "mute" if length < .5 else "open"
                        for side in [-1, 1]:
                            note("guitar", start + at + (.018 if side == 1 else 0), p,
                                 length, .155 * density, side * .82, articulation,
                                 cents=side * 3.3)
                            if articulation == "open":
                                note("guitar", start + at + .009, p + 7, length,
                                     .077 * density, side * .72, articulation, cents=side * 2)
                        note("bass", start + at, p - 12, length + .04, .2 * density)
                        note("kick", start + at, 36, .3, .5 * density)
                    for at in ([2] if theme == "C" else [1, 3]):
                        note("snare", start + at + .01, 38, .4, .36 * density)
                    for n in range(8):
                        note("hat" if n % 4 else "ride", start + n / 2, 60, .4,
                             .065 * density * (1 if n % 2 == 0 else .65), .4)
            else:
                # FM/tracker and spring-inspired electronica use independent bass/lead rhythms.
                bass_steps = [0, .75, 1.5, 2, 2.75, 3.5] if ua else [0, .5, 1, 1.75, 2.5, 3, 3.5]
                for i, at in enumerate(bass_steps if not sparse else [0, 2]):
                    note("bass", start + at, root - 12 + (12 if i in [2,5] else 0),
                         .33 if not sparse else 1.4, .23 * density)
                if not sparse:
                    for at in [0, 1, 2, 3]:
                        note("kick", start + at, 36, .28, .42 * density)
                    for at in [1, 3]:
                        note("snare" if not ua else "clap", start + at + .012, 38, .26, .20 * density)
                    for n in range(8):
                        note("hat", start + n / 2 + .25, 60, .11,
                             .06 * density * (1 if n % 2 == 0 else .6), .25)
                    if ua:
                        for n in [0,.75,1.5,2.5,3.25]:
                            note("hand", start + n + .04, 62, .16, .11, -.25)
                arp = [root + 24, fifth + 12, third + 24, color + 12]
                for n in range(8):
                    if sparse and n % 3:
                        continue
                    note("pluck" if ua else "keys", start + n * .5,
                         arp[(n + local % 2) % 4], .65, .065 * density, -.42 if n % 2 else .42)
            # Melody is an eight-bar sentence with deliberate rests, B contrast and varied cadence.
            phrase_bar = local % 8
            if not ending and (name != "intro" or local >= 2):
                line = themes[theme][phrase_bar % len(themes[theme])]
                for ni, (at, pitch, duration) in enumerate(line):
                    inst = "wind" if ua else "clean" if menu and metal else "keys" if menu else "lead"
                    gain = (.16 if menu else .15 if metal else .18) * min(1, density + .2)
                    shift = 12 if developed and phrase_bar in [4, 5] else 0
                    if ua and not menu and ni == 0 and phrase_bar in [1, 3, 6]:
                        note("wind", start + at, pitch + shift - 2, .10, gain * .6, -.08)
                        at += .10
                        duration -= .10
                    note(inst, start + at, pitch + shift, duration, gain, -.08 if ua else .08)
                if developed and phrase_bar % 2 == 1:
                    for at, pitch, duration in line[-2:]:
                        note("pluck" if ua else "keys", start + at + .16, pitch - 12,
                             max(.15, duration * .7), .075, -.45)
            # Phrases have punctuation and evolving fills, not constant maximal percussion.
            if not menu and not sparse and local % 8 == 7:
                for n, p in enumerate([55, 52, 48, 43]):
                    note("tom", start + 3 + n * .25, p, .3, .19 + n * .025, .4 - n * .25)
            if not menu and not sparse and local % 8 == 0:
                note("crash", start, 60, 2.5, .15, -.25)
        cursor += count
    # Settled tonic: release into a natural reverb tail rather than chopping a loop.
    root = chords[0][0]
    for n in [root + 12, root + 19, root + 24]:
        note("pluck" if ua else "clean" if metal else "keys", bars * 4 - 3, n, 2.7, .11, 0)
    events.sort(key=lambda e: (e['beat'], e['instrument'], e['pitch']))
    return dict(format="revealline-local-score.v1", version=VERSION, slug=slug, title=title,
                genre=genre, role="menu" if menu else "gameplay", seed=seed, bpm=bpm,
                meter="4/4", beatsPerBar=4, bars=bars, tailSeconds=2.0, sampleRate=48000,
                status="candidate-unreviewed", sections=roadmap, events=events,
                provenance="Original GPT-authored notes and arrangement; deterministic sample-free local DSP.",
                instrumentDisclosure="All voices synthesized. No recorded guitar, drums, bandura, sopilka or folk performance.",
                listeningReview="pending", culturalReview="pending" if ua else "not-applicable")


def main():
    # Absolute pitches are MIDI numbers; each tuple is beat offset, pitch, held beats.
    scores = []
    scores.append(build("idle-frequency", "Idle Frequency", "synth90s", 88,
        [("intro",4,"A",.45),("A",12,"A",.8),("B",12,"B",.88),("pedal bridge",8,"C",.36),
         ("A return",16,"A",.85),("outro",4,"C",.38)],
        [(38,54,57,64),(38,54,57,61),(35,50,54,57),(35,50,54,61),
         (31,47,50,57),(31,47,50,54),(33,49,52,59),(33,49,52,61)],
        {"A":[[(0,74,.7),(1,78,.5),(2,81,.8),(3,76,.8)],[(.5,76,2.2),(3,73,.5)],
              [(0,74,1),(1.5,78,.5),(2.5,76,1)],[(0,73,.7),(1,69,1),(3,71,.75)]],
         "B":[[(0,81,1.3),(1.5,83,.4),(2.5,78,1)],[(0,76,.8),(1.5,78,1),(3,74,.6)],
              [(.5,73,.5),(1.5,76,.5),(2.5,81,1)],[(0,78,1),(1.5,76,.5),(2.5,73,1)]],
         "C":[[(.5,62,1.5),(2.5,66,1)],[],[(0,69,2),(2.5,64,1)],[(1,61,2)]]},
        9101, True))
    scores.append(build("glass-highway", "Glass Highway", "synth90s",132,
        [("intro",4,"A",.55),("A",24,"A",.9),("B",24,"B",1),("A development",16,"A",.86),
         ("half-time bridge",12,"C",.4),("B return",16,"B",1),("A peak return",12,"A",1),("outro",4,"C",.5)],
        [(40,55,59,66),(40,55,59,62),(43,59,62,69),(43,59,62,66),
         (45,61,64,71),(45,61,64,67),(38,54,57,64),(38,54,57,61)],
        {"A":[[(0,76,.4),(.75,79,.35),(1.5,83,.4),(2.5,81,.8),(3.5,78,.35)],
              [(0,76,1.1),(1.5,74,.4),(2.25,78,.6),(3,79,.6)],
              [(0,83,.5),(1,86,.5),(2,85,.5),(3,81,.7)],[(.5,79,.4),(1.25,78,.4),(2,76,1.6)]],
         "B":[[(0,88,.7),(1,86,.4),(1.75,83,.7),(3,81,.7)],
              [(0,85,1.1),(1.5,83,.4),(2.25,81,.5),(3,78,.6)],
              [(.25,79,.4),(1,83,.5),(2,86,.4),(2.75,88,.9)],[(0,85,.7),(1,81,.4),(2,78,1.6)]],
         "C":[[(0,64,1.4),(2,67,1.4)],[(0,71,1),(2.5,66,1)],[],[(1,69,1.5),(3,66,.6)]]},9102))
    scores.append(build("embers-at-rest", "Embers at Rest", "metal",76,
        [("intro",4,"C",.4),("A",12,"A",.75),("B",12,"B",.8),("quiet bridge",8,"C",.33),
         ("A return",8,"A",.85),("outro",4,"C",.4)],
        [(38,53,57,64),(38,53,57,60),(34,50,53,60),(34,50,53,57),
         (41,57,60,67),(41,57,60,64),(36,52,55,62),(33,49,52,58)],
        {"A":[[(0,62,1.1),(1.5,69,.7),(3,72,.7)],[(.5,76,1.3),(2.5,77,1)],
              [(0,74,1.2),(2,69,1.6)],[(.5,65,.8),(2,64,1.5)]],
         "B":[[(0,77,1),(1.5,76,.7),(3,72,.7)],[(0,70,1.7),(2.5,69,1)],
              [(0,72,.7),(1,74,.7),(2.5,77,1)],[(0,76,1),(2,73,1.6)]],
         "C":[[(0,62,2),(2.5,64,1)],[],[(1,65,1),(2.5,69,1)],[(0,64,2.8)]]},9103,True))
    scores.append(build("furnace-heart", "Furnace Heart", "metal",150,
        [("intro",4,"A",.7),("A",24,"A",1),("B",24,"B",.96),("A development",24,"A",1),
         ("clean bridge",8,"C",.38),("breakdown",12,"C",1),("B return",16,"B",1),
         ("A peak return",12,"A",1),("outro",4,"C",.6)],
        [(38,53,57,60),(38,53,57,64),(38,53,57,60),(38,53,57,64),
         (34,50,53,60),(34,50,53,57),(36,52,55,62),(33,49,52,58)],
        {"A":[[(0,74,.5),(.75,74,.35),(1.5,77,.6),(2.5,76,.45),(3.25,81,.5)],
              [(0,79,1.2),(1.5,77,.5),(2.5,76,1)],[],[(0,72,.5),(1,69,.7),(2.5,74,1)]],
         "B":[[(0,77,1.2),(1.5,81,.5),(2.5,84,1)],[(0,82,.7),(1,81,.5),(2,79,1.6)],
              [(0,76,.5),(.75,77,.5),(1.5,79,.5),(2.5,81,1)],[(0,80,.7),(1,77,.5),(2,73,1.5)]],
         "C":[[(0,62,1.5),(2,65,1)],[],[(0,64,1),(2,61,1.5)],[]]},9104))
    scores.append(build("first-light", "First Light / Перше світло", "ukrainian",82,
        [("intro",4,"C",.4),("A",12,"A",.72),("B",12,"B",.82),("drone bridge",8,"C",.36),
         ("A return",12,"A",.86),("outro",4,"C",.35)],
        [(38,54,57,64),(38,54,57,61),(43,59,62,66),(43,59,62,69),
         (35,50,54,61),(35,50,54,57),(38,55,57,64),(38,54,57,62)],
        {"A":[[(.5,74,.6),(1.5,78,.5),(2.5,81,1)],[(0,76,1.6),(2.5,79,1)],
              [(.5,78,.6),(1.5,76,.5),(2.5,74,1)],[(0,73,.5),(1,76,.7),(2.5,74,1)]],
         "B":[[(0,81,1),(1.5,83,.5),(2.5,81,1)],[(.5,78,.7),(2,76,1.4)],
              [(0,79,.5),(1,81,.6),(2,78,1.3)],[(0,76,1),(1.5,73,.7),(3,74,.6)]],
         "C":[[(1,66,1),(2.5,69,1)],[],[(0,67,1),(2,66,1.5)],[(1,64,2)]]},9105,True))
    scores.append(build("spring-circuit", "Spring Circuit / Весняне коло", "ukrainian",138,
        [("intro",4,"A",.5),("call A",24,"A",.9),("answer B",24,"B",1),
         ("A development",16,"A",.95),("open-air bridge",12,"C",.38),
         ("B return",20,"B",1),("A peak return",16,"A",1),("outro",4,"C",.4)],
        [(45,60,64,71),(45,60,64,67),(43,59,62,69),(43,59,62,66),
         (38,54,57,64),(38,54,57,61),(45,60,64,71),(40,55,59,66)],
        {"A":[[(0,81,.4),(.5,84,.4),(1,86,.65),(2,88,.4),(2.75,86,.4),(3.5,83,.35)],
              [(0,81,.75),(1,83,.35),(1.5,84,.7),(2.75,81,.85)],
              [(0,83,.4),(.75,86,.5),(1.5,88,.65),(2.5,86,1)],
              [(0,84,.5),(1,83,.5),(2,81,1.6)]],
         "B":[[(0,88,.7),(1,90,.4),(1.75,91,.7),(2.75,88,.85)],
              [(0,86,.7),(1,84,.4),(1.75,83,.7),(3,86,.6)],
              [(0,88,.35),(.5,86,.35),(1,84,.65),(2,83,.4),(2.75,84,.8)],
              [(0,86,.6),(1,83,.6),(2,81,1.6)]],
         "C":[[(.5,69,1),(2,72,1.4)],[(1,74,1),(2.5,71,1)],[],[(0,72,.8),(1.5,71,.8),(3,69,.6)]]},9106))
    steel = build("steel-kolomyika", "Steel Kolomyika / Сталева коломийка", "metal",168,
        [("intro",4,"A",.65),("dance call A",24,"A",1),("riff answer B",24,"B",1),
         ("A development",24,"A",.95),("open-string bridge",8,"C",.4),
         ("half-time breakdown",16,"C",.95),("B return",16,"B",1),
         ("A peak return",16,"A",1),("outro",4,"C",.55)],
        [(40,55,59,66),(40,55,59,62),(45,61,64,71),(45,61,64,67),
         (43,59,62,69),(43,59,62,66),(38,54,57,64),(40,55,59,66)],
        {"A":[[(0,76,.35),(.5,81,.4),(1,79,.35),(1.5,83,.4),(2,86,.6),(3,78,.7)],
              [(0,79,.35),(.5,81,.35),(1,83,.6),(2,81,.35),(2.5,78,.4),(3,76,.7)],
              [(0,83,.4),(.5,86,.4),(1,85,.65),(2,83,.35),(2.5,81,.4),(3,79,.7)],
              [(0,78,.4),(.5,79,.4),(1,81,.65),(2,78,.5),(3,76,.8)]],
         "B":[[(0,88,.6),(1,86,.4),(1.5,83,.35),(2,81,.65),(3,83,.7)],
              [(0,85,.4),(.5,83,.4),(1,81,.65),(2,78,.6),(3,79,.7)],
              [(0,83,.35),(.5,86,.35),(1,88,.65),(2,90,.35),(2.5,88,.35),(3,86,.75)],
              [(0,85,.6),(1,81,.6),(2,78,.6),(3,76,.8)]],
         "C":[[(0,64,.7),(1,69,.7),(2,67,.7),(3,71,.7)],
              [(0,74,1),(2,66,1.4)],[],[(0,67,.8),(1.5,66,.8),(3,64,.7)]]},9107)
    # The arrangement above is written in paired duple bars. Preserve all event
    # times while declaring its actual 2/4 bar count; no asymmetrical-meter claim.
    steel.update(genre="ukrainian", genres=["ukrainian", "metal"], role="finale",
                 meter="2/4", beatsPerBar=2, bars=steel["bars"]*2, culturalReview="pending")
    for section in steel["sections"]:
        section["startBar"] *= 2
        section["bars"] *= 2
    for event in steel["events"]:
        if event["instrument"] == "lead":
            event["instrument"] = "wind"
        elif event["instrument"] == "keys":
            event["instrument"] = "pluck"
    scores.append(steel)
    for score in scores:
        path = ROOT / "scores" / (score["slug"] + ".json")
        path.write_text(json.dumps(score, ensure_ascii=False, indent=2) + "\n")
        print(score["slug"], len(score["events"]), round(score["bars"] * score["beatsPerBar"] * 60 / score["bpm"] + 2, 2))


if __name__ == "__main__":
    main()
