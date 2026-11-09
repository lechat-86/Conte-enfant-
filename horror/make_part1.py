#!/usr/bin/env python3
"""
PARTIE 1 - L'HERITAGE (70 s). Réutilise les décors de make_video.py.

  python3 make_part1.py                       -> 2 vidéos (avec / sans sous-titres), sans voix
  python3 make_part1.py --voice voix.mp3      -> ajoute votre voix ElevenLabs (début à 5 s)
  python3 make_part1.py --voice voix.mp3 --voice-delay 4.5
Options : --only-clean  (ne génère que la version sans sous-titres)
"""
import math, os, subprocess, sys, wave
import numpy as np
import make_video as mv
from make_video import *   # noqa

PART_DUR = 70.0
mv.DUR = PART_DUR
mv.N = int(PART_DUR * SR)
mv.TT = np.arange(mv.N) / SR

# (début, fin, texte) -- c'est aussi le texte de la voix off
NARRATION = [
    (5.0, 13.0, "Léa n'avait pas revu la maison de sa grand-mère depuis dix ans. Ce soir, le notaire lui avait enfin remis les clés."),
    (13.5, 21.5, "La maison se dressait dans le brouillard. Le vent faisait gémir les arbres morts. Toutes les fenêtres étaient noires… sauf une."),
    (22.5, 30.0, "Dans le couloir, une odeur de poussière… et autre chose. Quelque chose de sucré, comme une fleur qu'on aurait laissée pourrir."),
    (30.5, 37.0, "Au fond, la porte de la cave était entrouverte. Sa grand-mère la gardait verrouillée. Une lueur rouge filtrait dessous."),
    (37.5, 42.5, "Puis elle l'entendit. Un chuchotement… qui prononçait son prénom."),
    (43.0, 51.5, "Elle recula dans le salon. Au fond, un grand miroir ancien lui renvoyait son regard. Elle leva la main. Son reflet aussi."),
    (52.0, 59.5, "Elle baissa la main. Pas lui. Le reflet resta immobile… puis il sourit. D'un sourire beaucoup trop large."),
    (60.5, 66.0, "Ses yeux devinrent noirs. Il murmura : « Bienvenue à la maison, Léa. »"),
]

def build_scenes_p1():
    S = []
    def st(t, img, focus=(PW / 2, PH / 2), z0=1.0, z1=1.12):
        return dict(t=t, img=img, focus=focus, z0=z0, z1=z1)
    def sc(name, t0, t1, stages, **kw):
        d = dict(name=name, t0=t0, t1=t1, stages=stages, vig=0.8, grain=9, tint=None, fi=0.5, fo=0.4, dark=1.0, flick=True)
        d.update(kw); S.append(d)
    red = (150, 14, 14)
    sc("title", 0, 5, [st(0, card_img([("LA MAISON", 92, red, True, False), ("DES MURMURES", 92, red, True, False),
                                        ("PARTIE 1  —  L'HÉRITAGE", 28, (150, 150, 150), False, True)]), z0=1.0, z1=1.08)],
       fi=1.2, fo=0.8)
    sc("house", 5, 22, [st(5, scene_house(0), (590, 420), 1.0, 1.25),
                        st(19.5, scene_house(1), (590, 400), 1.3, 1.45)], vig=0.9, grain=10)
    sc("hall", 22, 42, [st(22, scene_hall(None), (560, 300), 1.0, 1.15),
                        st(30.2, scene_hall(7.4), (560, 300), 1.15, 1.3),
                        st(37.0, scene_hall(4.2), (560, 300), 1.3, 1.5)], vig=1.0)
    sc("mirror", 42, 66, [st(42, scene_mirror(0), (560, 300), 1.0, 1.25),
                          st(52.0, scene_mirror(1), (560, 280), 1.25, 1.42),
                          st(60.0, scene_mirror(2), (560, 300), 1.2, 1.5)], vig=1.0, fo=0.3)
    sc("end", 66, 70, [st(66, card_img([("À SUIVRE…", 70, red, True, False)]))], fi=0.4, fo=0.0, grain=6)
    return S

def build_audio_p1():
    amb = Mix()
    nr = np.random.default_rng(3)
    TT, N = mv.TT, mv.N

    gdrone = env_curve([(0, 0), (2, .5), (42, .7), (66, .95), (68, .5), (70, 0)])
    drone = (0.5 * np.sin(2 * math.pi * 55 * TT) + 0.45 * np.sin(2 * math.pi * 55.8 * TT) +
             0.28 * np.sin(2 * math.pi * 82.4 * TT + 1.3 * np.sin(TT * .3)) + 0.12 * np.sin(2 * math.pi * 116.5 * TT))
    drone *= 0.6 + 0.4 * np.sin(2 * math.pi * 0.11 * TT)
    amb.add(drone * gdrone * 0.9, 0)

    gh = env_curve([(0, 0), (50, 0), (58, .06), (60, .12), (66, .2), (68, 0), (70, 0)])
    hi = np.sin(2 * math.pi * (1175 + 40 * np.sin(TT * .4)) * TT) + 0.6 * np.sin(2 * math.pi * 1244.5 * TT)
    amb.add(hi * gh * 0.25, 0)

    wl = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    wr = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    gw = env_curve([(0, .1), (6, .7), (22, .4), (42, .2), (70, .3)]) * (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * TT + 1) ** 2)
    amb.L += wl * gw * 0.25; amb.R += wr * gw * 0.25

    for tb, g in [(0.2, .9), (5.0, .5), (22.0, .8), (60.0, 1.4), (66.0, .9)]:
        t = np.arange(int(2.0 * SR)) / SR
        boom = np.sin(2 * math.pi * (48 - 14 * (1 - np.exp(-t * 4))) * t) * np.exp(-t * 2.4)
        boom += norm(boxlp(nr.standard_normal(len(t)), 30)) * np.exp(-t * 6) * 0.4
        amb.add(boom, tb, g * 0.9)

    for tc in [11.0, 16.0, 23.5, 27.0, 33.0, 39.5, 45.0, 49.0, 55.0, 62.0]:
        d = 0.9 + nr.random() * 0.5
        t = np.arange(int(d * SR)) / SR
        f = (170 + 230 * nr.random()) * (1 + 0.45 * np.sin(math.pi * t / d * (0.5 + nr.random())))
        ph = np.cumsum(2 * math.pi * f / SR)
        s = sum(np.sin(k * ph) / k for k in range(1, 8))
        s *= np.sin(math.pi * t / d) ** 1.5 * (0.6 + 0.4 * np.sin(2 * math.pi * 23 * t))
        amb.add(s, tc, 0.26, nr.uniform(-.8, .8))

    for (a, b, g) in [(14, 21, .25), (30, 42, .55), (50, 59, .5), (60.5, 66, .8)]:
        for ch in (0, 1):
            n = int((b - a) * SR)
            nz = nr.standard_normal(n)
            band = norm(boxlp(nz, 4) - boxlp(nz, 30))
            seg = np.zeros(n); i = 0
            while i < n:
                L_ = int(nr.uniform(0.08, 0.32) * SR)
                seg[i:i + L_] = nr.random() ** 1.5
                i += L_ + int(nr.uniform(0.0, .12) * SR)
            seg = boxlp(seg, 700)
            seg = np.concatenate([seg, np.zeros(n - len(seg))])
            amb.add(band * seg * np.sin(math.pi * np.arange(n) / n) ** 0.5, a, g, -0.9 if ch == 0 else 0.9)

    tb = 42.0
    while tb < 67:
        bpm = np.interp(tb, [42, 60, 67], [60, 95, 135])
        g = np.interp(tb, [42, 55, 67], [.0, .7, 1.2])
        t = np.arange(int(.35 * SR)) / SR
        th = np.sin(2 * math.pi * 52 * t) * np.exp(-t * 22)
        amb.add(th, tb, g * 1.1); amb.add(th, tb + 60 / bpm * .28, g * .7)
        tb += 60 / bpm

    # boîte à musique lointaine (annonce la berceuse)
    n_ = {"B4": 493.88, "C5": 523.25, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "A4": 440.0}
    mel = ["E5", "D#5", "E5", "D#5", "E5", "B4", "D5", "C5", "A4"]
    t_, i = 12.0, 0
    while t_ < 21.5:
        fl = 1 - 0.015 * (1 + math.sin(i * 1.7))
        amb.add(tone(n_[mel[i % 9]] * fl, 1.6, (1, 0, 0, .35, 0, .15), decay=2.8), t_, 0.07 + 0.0 * i, -0.3)
        t_ += 0.55 * (1.6 if mel[i % 9] == "A4" else 1.0); i += 1

    t = np.arange(int(2.6 * SR)) / SR
    rise = np.sin(2 * math.pi * np.cumsum(300 + 1700 * (t / 2.6) ** 2) / SR) * (t / 2.6) ** 2
    amb.add(rise, 57.4, 0.35)
    gate = np.interp(TT, [0, 59.55, 59.62, 59.95, 60.0, 70], [1, 1, 0, 0, 1, 1])  # micro-silence avant l'impact
    amb.L *= gate; amb.R *= gate
    amb.add(np.zeros(1), 0)
    t = np.arange(int(2.0 * SR)) / SR
    boom = np.sin(2 * math.pi * (48 - 14 * (1 - np.exp(-t * 4))) * t) * np.exp(-t * 2.4)
    amb.add(boom, 60.0, 1.3)

    pk = max(np.abs(amb.L).max(), np.abs(amb.R).max())
    amb.L *= 0.5 / pk; amb.R *= 0.5 / pk
    pcm = (np.clip(np.stack([amb.L, amb.R], 1), -1, 1) * 32767).astype("<i2")
    path = os.path.join(mv.HERE, "audio_p1_tmp.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path

def render(out, wav, scenes, caps, voice=None, delay=5.0):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
           "-r", str(FPS), "-i", "-", "-i", wav]
    if voice:
        d = int(delay * 1000)
        cmd += ["-i", voice, "-filter_complex",
                "[1:a]volume=0.55[a];[2:a]adelay=%d|%d[v];[a][v]amix=inputs=2:normalize=0:duration=longest[o]" % (d, d),
                "-map", "0:v", "-map", "[o]"]
    cmd += ["-t", str(PART_DUR), "-c:v", "libx264", "-preset", "medium", "-crf", "30", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    total = int(PART_DUR * FPS)
    for fi in range(total):
        pr.stdin.write(render_frame(fi, scenes, caps).tobytes())
    pr.stdin.close(); pr.wait()
    print("OK ->", out, flush=True)

def main():
    a = sys.argv
    voice = a[a.index("--voice") + 1] if "--voice" in a else None
    delay = float(a[a.index("--voice-delay") + 1]) if "--voice-delay" in a else 5.0
    scenes = build_scenes_p1()
    wav = build_audio_p1()
    tag = "_voix" if voice else ""
    render(os.path.join(HERE, "partie1_sans_soustitres%s.mp4" % tag), wav, scenes, {}, voice, delay)
    if "--only-clean" not in a:
        caps = {(s, e, t): make_caption(t) for s, e, t in NARRATION}
        render(os.path.join(HERE, "partie1_avec_soustitres%s.mp4" % tag), wav, scenes, caps, voice, delay)
    os.remove(wav)

if __name__ == "__main__":
    main()
