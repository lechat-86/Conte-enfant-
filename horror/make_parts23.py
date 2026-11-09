#!/usr/bin/env python3
"""
PARTIE 2 (Le sous-sol) et PARTIE 3 (Elle + screamer). Réutilise make_video.py.

  python3 make_parts23.py --part 2
  python3 make_parts23.py --part 3 --voice voix3.mp3
  python3 make_parts23.py --part 2 --voice voix2.mp3 --starts 0,4.2,9.8,...   (débuts de phrases mesurés, en s dans l'audio)

Sans --starts, le calage est estimé à partir du texte ; avec --voice et sans --starts,
le calage est déduit des silences de l'audio (voir auto_starts).
"""
import math, os, re, subprocess, sys, wave
import numpy as np
import make_video as mv
from make_video import *   # noqa

DELAY = 4.0
RED = (150, 14, 14)

SEGS = {
    2: [
        "Léa n'aurait jamais dû descendre. Mais quelque chose l'appelait.",
        "Quarante marches de pierre humide. La lampe de son téléphone tremblait dans sa main.",
        "En bas, dans le noir, deux petites lueurs la regardaient. Puis quatre. Puis dix.",
        "Sur le mur, des photos de famille. Sur la première, une silhouette sombre, tout au fond du jardin.",
        "Sur la deuxième, prise vingt ans plus tard, la silhouette se tenait sur le seuil de la maison.",
        "Sur la troisième… elle était juste derrière Léa. Léa, telle qu'elle était ce soir.",
        "Sur une caisse, un journal. L'écriture de sa grand-mère. « Elle chante quand elle s'approche. Quand la berceuse s'arrête, elle est derrière toi. Ne te retourne jamais. »",
        "Soudain, une boîte à musique se mit à jouer, toute seule. Une berceuse lente et fausse. Puis les lumières moururent.",
        "Et quelque chose de très grand… respira dans le noir.",
    ],
    3: [
        "Léa remonta les marches en courant, le souffle coupé. La porte de la cave était verrouillée.",
        "Derrière elle, au bas de l'escalier, la berceuse venait de reprendre.",
        "Elle frappa. Elle hurla. Personne. Alors elle alluma la caméra de son téléphone, pour voir dans le noir.",
        "Sur l'écran, l'escalier était vide. Mais la berceuse, très douce, se rapprochait.",
        "Les marches se mirent à grincer. Une… puis une autre. Chacune plus près.",
        "Léa retint son souffle. Elle sentit un froid glacial sur sa nuque.",
        "« Léa… » murmura une voix juste derrière elle. Douce. Presque celle de sa grand-mère.",
        "Sur l'écran, juste au-dessus de son épaule, deux grandes mains pâles.",
        "Et la musique… s'arrêta.",
    ],
}

def seg_dur(s):
    return 0.355 * len(s.split()) + 0.40 * len(re.findall(r"[.!?…»]", s))

def estimate_starts(segs):
    t, out = 0.0, []
    for s in segs:
        out.append(t); t += seg_dur(s) + 0.5
    return out, t - 0.5

def auto_starts(voice, segs):
    """Déduit les débuts de segments depuis les silences de l'audio (>=0.55 s) en choisissant
    les n-1 plus longues pauses proches des estimations."""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", voice, "-af", "silencedetect=noise=-32dB:d=0.3", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    st = [float(x) for x in re.findall(r"silence_start: ([0-9.]+)", out)]
    en = [float(x) for x in re.findall(r"silence_end: ([0-9.]+)", out)]
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nv=1", voice],
                               capture_output=True, text=True).stdout)
    pauses = list(zip(st, en[:len(st)]))
    # fin de la parole = début du dernier silence s'il touche la fin du fichier
    speech_end = pauses[-1][0] if pauses and pauses[-1][1] >= dur - 0.4 else dur
    first = pauses[0][1] if pauses and pauses[0][0] < 0.05 else 0.0
    inner = [p for p in pauses if p[0] > first + 0.5 and p[1] < speech_end - 0.3]
    # nombre de phrases (fins de phrase) dans chaque segment -> index cumulatif de la pause attendue
    sent = [max(1, len(re.findall(r"[.!?…»]", s))) for s in segs]
    # on réconcilie en répartissant : la k-ième frontière de segment est la pause numéro (somme des phrases des k segments) - 1
    # parmi les pauses 'de phrase' ; les ellipses ajoutent des pauses : on se rabat sur les plus longues proches de l'estimation
    est, total = estimate_starts(segs)
    scale = (speech_end - first) / total
    starts = [first]
    for k in range(1, len(segs)):
        target = first + est[k] * scale
        cands = [p for p in inner if abs(p[1] - target) < 3.0]
        best = max(cands, key=lambda p: (p[1] - p[0]) - 0.15 * abs(p[1] - target)) if cands else None
        starts.append(best[1] if best else target)
    for k in range(1, len(starts)):      # monotone
        starts[k] = max(starts[k], starts[k - 1] + 1.0)
    return starts, speech_end

def setup(dur):
    mv.DUR = dur; mv.N = int(dur * SR); mv.TT = np.arange(mv.N) / SR

def captions_for(segs, starts, vend):
    out = []
    for i, s in enumerate(segs):
        a = starts[i] + DELAY
        b = (starts[i + 1] + DELAY - 0.15) if i + 1 < len(segs) else vend + DELAY + 0.4
        out.append((a, b, s))
    return out

# ---------------------------------------------------------------- scènes
def build_scenes(part, starts, vend):
    S = []
    def st(t, img, focus=(PW / 2, PH / 2), z0=1.0, z1=1.12):
        return dict(t=t, img=img, focus=focus, z0=z0, z1=z1)
    def sc(name, t0, t1, stages, **kw):
        d = dict(name=name, t0=t0, t1=t1, stages=stages, vig=0.8, grain=9, tint=None, fi=0.5, fo=0.4, dark=1.0, flick=True)
        d.update(kw); S.append(d)
    a = lambda i: starts[i] + DELAY
    vend_abs = vend + DELAY
    if part == 2:
        sc("title", 0, DELAY, [st(0, card_img([("PARTIE 2", 30, (140, 140, 140), False, True), ("LE SOUS-SOL", 84, RED, True, False),
                                                 ("LA MAISON DES MURMURES", 22, (120, 120, 120), False, True)]))], fi=1.0, fo=0.7)
        tp, tj, tb, tl = a(3), a(6), a(7), a(8)
        s2 = min(a(2) + 3.0, tp - 1.0); s3 = min(a(2) + 4.6, tp - 0.6)
        sc("stairs", DELAY, tp, [st(DELAY, scene_stairs(0), (560, 270), 1.0, 1.25),
                                 st(a(2), scene_stairs(1), (560, 270), 1.25, 1.4),
                                 st(s2, scene_stairs(4), (560, 270), 1.35, 1.6),
                                 st(s3, scene_stairs(16), (560, 270), 1.5, 1.8)], vig=0.9, grain=12, dark=1.9)
        ph = scene_photos()
        sc("photos", tp, tj, [st(tp, ph, (225, 330), 1.9, 2.2), st(a(4), ph, (560, 330), 1.9, 2.2),
                              st(a(5), ph, (895, 330), 1.9, 2.3)], vig=1.2, grain=11)
        sc("journal", tj, tb, [st(tj, scene_journal(), (560, 330), 1.0, 1.25)], vig=1.25)
        sc("lady", tb, vend_abs + 0.8, [st(tb, scene_musicbox(False), (560, 340), 1.0, 1.3),
                                         st(tl, scene_musicbox(True), (700, 300), 1.1, 1.35)], vig=1.25, fo=0.3)
        t_end = vend_abs + 0.8
        sc("end", t_end, t_end + 4.0, [st(t_end, card_img([("À SUIVRE…", 70, RED, True, False)]))], fi=0.4, fo=0.0, grain=6)
        return S, t_end + 4.0, None
    # partie 3
    sc("title", 0, DELAY, [st(0, card_img([("PARTIE 3", 30, (140, 140, 140), False, True), ("ELLE", 110, RED, True, False),
                                             ("LA MAISON DES MURMURES", 22, (120, 120, 120), False, True)]))], fi=1.0, fo=0.7)
    tb = vend_abs + 0.4          # coupure noire (la musique s'arrête)
    ts = tb + 1.7                # screamer
    sc("phone", DELAY, tb, [st(DELAY, scene_phone(0), (560, 330), 1.0, 1.1),
                            st(a(4), scene_phone(1), (560, 330), 1.1, 1.18),
                            st(a(5), scene_phone(2), (560, 330), 1.18, 1.25),
                            st(a(7), scene_phone(3), (560, 340), 1.1, 1.3)],
       tint="green", hud=True, vig=1.0, grain=26, fo=0.0, fi=0.3)
    sc("black", tb, ts, [st(tb, new())], fi=0, fo=0, grain=3, flick=False)
    sc("scream", ts, ts + 2.2, [st(ts, make_face())], fi=0, fo=0, grain=30, flick=False)
    te = ts + 2.2
    sc("end", te, te + 6.0, [st(te, new()),
                             st(te + 0.8, card_img([("Ne te retourne jamais.", 44, (170, 170, 170), False, False)])),
                             st(te + 3.4, card_img([("FIN", 90, RED, True, False)]))], fi=0.2, fo=0.5, grain=4)
    mv.SCREAM_T = ts
    return S, te + 6.0, dict(tb=tb, ts=ts)

# ---------------------------------------------------------------- son
def scream_sig():
    d = 2.2
    t = np.arange(int(d * SR)) / SR
    rs = np.random.default_rng(21)
    wob = boxlp(rs.standard_normal(len(t)), 900); wob = wob / (np.abs(wob).max() + 1e-9)
    f0 = 620 + 950 * (1 - np.exp(-t * 7)) + 140 * np.sin(2 * math.pi * 7.3 * t) + 220 * wob
    sig = np.zeros(len(t))
    for ratio, g in [(1.0, 1.0), (1.067, .8), (0.5, .6)]:
        ph = np.cumsum(2 * math.pi * f0 * ratio / SR)
        sig += g * sum(np.sin(k * ph + k) / k for k in range(1, 11))
    sig *= 0.65 + 0.35 * np.sin(2 * math.pi * 31 * t + wob * 4)
    nz = rs.standard_normal(len(t))
    sig += 2.2 * norm(boxlp(nz, 2) - boxlp(nz, 14)) * np.exp(-t * 2.0)
    sig = np.tanh(3.2 * sig / (np.std(sig) + 1e-9))
    sig *= np.minimum(1, t / 0.004) * np.exp(-np.maximum(t - 0.9, 0) * 1.8)
    boom = np.sin(2 * math.pi * (60 - 22 * (1 - np.exp(-t * 6))) * t) * np.exp(-t * 3.2)
    sig = np.tanh(1.8 * (sig * 0.8 + boom * 0.85))
    return sig / np.abs(sig).max()

def boom_sig(d=2.0, rnd=None):
    t = np.arange(int(d * SR)) / SR
    rnd = rnd or np.random.default_rng(1)
    b = np.sin(2 * math.pi * (48 - 14 * (1 - np.exp(-t * 4))) * t) * np.exp(-t * 2.4)
    return b + norm(boxlp(rnd.standard_normal(len(t)), 30)) * np.exp(-t * 6) * 0.4

def whisper(amb, a, b, g, nr):
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

def creak(amb, tc, nr, g=0.26):
    d = 0.9 + nr.random() * 0.5
    t = np.arange(int(d * SR)) / SR
    f = (170 + 230 * nr.random()) * (1 + 0.45 * np.sin(math.pi * t / d * (0.5 + nr.random())))
    ph = np.cumsum(2 * math.pi * f / SR)
    s = sum(np.sin(k * ph) / k for k in range(1, 8))
    s *= np.sin(math.pi * t / d) ** 1.5 * (0.6 + 0.4 * np.sin(2 * math.pi * 23 * t))
    amb.add(s, tc, g, nr.uniform(-.8, .8))

def heart(amb, t0, t1, bpm0, bpm1, g0, g1):
    tb = t0
    while tb < t1:
        bpm = np.interp(tb, [t0, t1], [bpm0, bpm1]); g = np.interp(tb, [t0, t1], [g0, g1])
        t = np.arange(int(.35 * SR)) / SR
        th = np.sin(2 * math.pi * 52 * t) * np.exp(-t * 22)
        amb.add(th, tb, g * 1.1); amb.add(th, tb + 60 / bpm * .28, g * .7)
        tb += 60 / bpm

MEL = ["E5", "D#5", "E5", "D#5", "E5", "B4", "D5", "C5", "A4", "C5", "E5", "A4", "B4", "E4", "G#4", "B4", "C5"]
NOTE = {"B4": 493.88, "C5": 523.25, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "A4": 440.0, "G#4": 415.3, "E4": 329.63}
def music_box(amb, t0, t1, beat, v0, v1, f0, f1):
    t_, i = t0, 0
    while t_ < t1:
        u = (t_ - t0) / max(t1 - t0, 1e-3)
        fl = 1 - (f0 + (f1 - f0) * u) * (1 + 0.5 * math.sin(i * 1.7))
        s = tone(NOTE[MEL[i % len(MEL)]] * fl, 1.6, (1.0, 0.0, 0.0, 0.35, 0.0, 0.15), decay=2.8)
        vol = v0 + (v1 - v0) * u
        amb.add(s, t_, vol, -0.3); amb.add(s, t_ + 0.23, vol * 0.4, 0.5)
        t_ += beat * (1.6 if MEL[i % len(MEL)] in ("A4", "C5") and i % 17 in (8, 16) else 1.0) * (1 + 0.5 * u * (i % 3))
        i += 1

def breath(d=3.0, seed=4):
    t = np.arange(int(d * SR)) / SR
    nz = np.random.default_rng(seed).standard_normal(len(t))
    band = norm(boxlp(nz, 12) - boxlp(nz, 160))
    env = np.sin(math.pi * t / d) ** 2 * (0.7 + 0.3 * np.sin(2 * math.pi * 0.9 * t))
    return band * env + 0.5 * np.sin(2 * math.pi * 70 * t) * env

def finish(amb, dur, extra=None):
    pk = max(np.abs(amb.L).max(), np.abs(amb.R).max())
    amb.L *= 0.5 / pk; amb.R *= 0.5 / pk
    L, R = amb.L, amb.R
    if extra is not None:
        L = L + extra; R = R + np.roll(extra, 18)
    pcm = (np.clip(np.stack([L, R], 1), -1, 1) * 32767).astype("<i2")
    path = os.path.join(mv.HERE, "audio_tmp23_%d.wav" % os.getpid())
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path

def build_audio(part, starts, vend, dur, info):
    TT, N = mv.TT, mv.N
    amb = Mix(); nr = np.random.default_rng(3 + part)
    a = lambda i: starts[i] + DELAY
    ve = vend + DELAY
    wl = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    wr = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    swell = (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * TT + 1) ** 2)
    drone = (0.5 * np.sin(2 * math.pi * 55 * TT) + 0.45 * np.sin(2 * math.pi * 55.8 * TT) +
             0.28 * np.sin(2 * math.pi * 82.4 * TT + 1.3 * np.sin(TT * .3)) + 0.12 * np.sin(2 * math.pi * 116.5 * TT))
    drone *= 0.6 + 0.4 * np.sin(2 * math.pi * 0.11 * TT)
    extra = None
    if part == 2:
        tp, tj, tb, tl = a(3), a(6), a(7), a(8)
        amb.add(drone * env_curve([(0, 0), (2, .5), (tp, .6), (tb, .85), (ve, 1.0), (ve + .8, .6), (dur, 0)]) * 0.9, 0)
        g = env_curve([(0, .05), (DELAY, .3), (tp, .12), (dur, .2)]) * swell
        amb.L += wl * g * 0.2; amb.R += wr * g * 0.2
        for tt in [0.2, DELAY, tp, ve + .8]:
            amb.add(boom_sig(2.0, nr), tt, 0.8)
        t_ = DELAY + 1.0                     # gouttes d'eau
        while t_ < ve:
            f = nr.uniform(1500, 2600)
            d = tone(f, 0.3, (1,), decay=22)
            amb.add(d, t_, 0.18, nr.uniform(-.8, .8)); amb.add(d, t_ + 0.19, 0.07, nr.uniform(-.8, .8))
            t_ += nr.uniform(1.4, 3.8)
        for tc in np.linspace(DELAY + 3, ve - 3, 8):
            creak(amb, float(tc), nr)
        heart(amb, a(2), ve, 55, 115, 0.0, 1.1)
        for (x, y, gg) in [(a(2), tp, .4), (tp, tj, .35), (tl - 1.0, ve, .55)]:
            whisper(amb, x, y, gg, nr)
        music_box(amb, tb, ve, 0.45, .22, .5, 0.01, 0.05)
        lo = tl - 1.6                         # lumières qui meurent
        t = np.arange(int(0.8 * SR)) / SR
        buzz = np.sign(np.sin(2 * math.pi * 100 * t)) * (0.5 + 0.5 * np.sin(2 * math.pi * 17 * t)) * np.linspace(1, 0.2, len(t))
        amb.add(buzz, lo - 0.8, 0.35)
        amb.add(boom_sig(1.0, nr), lo, 0.7)
        amb.add(breath(3.2), max(tl, ve - 1.8), 0.9)
        gate = np.interp(TT, [0, lo - .01, lo, lo + .45, lo + .5, dur], [1, 1, .15, .15, 1, 1])
        amb.L *= gate; amb.R *= gate
    else:
        tb, ts = info["tb"], info["ts"]
        amb.add(drone * env_curve([(0, 0), (2, .5), (DELAY, .5), (tb - .05, 1.0), (tb, 0), (ts + 2.4, 0), (ts + 3.2, .5), (dur, .25)]) * 0.9, 0)
        hi = np.sin(2 * math.pi * (1175 + 40 * np.sin(TT * .4)) * TT) + 0.6 * np.sin(2 * math.pi * 1244.5 * TT)
        amb.add(hi * env_curve([(0, 0), (a(3), 0), (tb - .05, .25), (tb, 0), (dur, 0)]) * 0.25, 0)
        g = env_curve([(0, .1), (DELAY, .5), (tb, .4), (dur, .1)]) * swell
        amb.L += wl * g * 0.25; amb.R += wr * g * 0.25
        for tt in [0.2, DELAY]:
            amb.add(boom_sig(2.0, nr), tt, 0.8)
        for k in range(3):                    # coups à la porte
            tt = a(2) + 0.2 + k * 0.45
            amb.add(norm(boxlp(nr.standard_normal(9000), 40)) * np.exp(-np.arange(9000) / 1500.0), tt, 1.2)
            amb.add(np.sin(2 * math.pi * 80 * np.arange(6000) / SR) * np.exp(-np.arange(6000) / 1200.0), tt, 0.9)
        amb.add(norm(nr.standard_normal(2000)) * np.exp(-np.arange(2000) / 150.0), a(0) + 3.2, 0.4)
        music_box(amb, a(1), tb - 0.05, 0.5, .15, .6, 0.01, 0.06)
        for tp_ in np.linspace(a(4) + 1.0, tb - 1.0, 9):
            t = np.arange(int(.35 * SR)) / SR
            step = norm(boxlp(nr.standard_normal(len(t)), 60)) * np.exp(-t * 18) * .8 + np.sin(2 * math.pi * 70 * t) * np.exp(-t * 20)
            amb.add(step, float(tp_), 1.2, nr.uniform(-.3, .3))
            creak(amb, float(tp_) - .15, nr, 0.15)
        heart(amb, DELAY, tb - .05, 70, 150, 0.1, 1.3)
        for (x, y, gg) in [(a(3), a(6), .4), (a(6), tb - .05, .8)]:
            whisper(amb, x, y, gg, nr)
        t = np.arange(int(3.0 * SR)) / SR
        rise = np.sin(2 * math.pi * np.cumsum(300 + 1700 * (t / 3.0) ** 2) / SR) * (t / 3.0) ** 2
        amb.add(rise, tb - 3.0, 0.3)
        gate = np.interp(TT, [0, tb - .06, tb, ts + 2.4, ts + 3.2, dur], [1, 1, 0, 0, 1, 1])
        amb.L *= gate; amb.R *= gate
        t = np.arange(int(.8 * SR)) / SR
        nz = np.random.default_rng(9).standard_normal(len(t))
        inh = norm(boxlp(nz, 3) - boxlp(nz, 25)) * (t / .8) ** 2 * (t < .75)
        amb.add(inh, ts - 0.8, 0.45)
        amb.add(tone(659.25 * .94, 3.0, (1, 0, 0, .3), decay=1.5), ts + 4.8, 0.25)
        extra = np.zeros(N); i0 = int(ts * SR); sg = scream_sig()
        extra[i0:i0 + len(sg)] = sg[:N - i0] * 0.97
        # le reste est normalisé à 0.5 plus bas ; le cri reste à ~0.97
    return finish(amb, dur, extra)

# ---------------------------------------------------------------- rendu
def render(out, wav, scenes, caps, dur, voice=None):
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
           "-r", str(FPS), "-i", "-", "-i", wav]
    if voice:
        d = int(DELAY * 1000)
        cmd += ["-i", voice, "-filter_complex",
                "[1:a]volume=0.55[a];[2:a]adelay=%d|%d[v];[a][v]amix=inputs=2:normalize=0:duration=longest[o]" % (d, d),
                "-map", "0:v", "-map", "[o]"]
    cmd += ["-t", "%.3f" % dur, "-c:v", "libx264", "-preset", "medium", "-crf", "30", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(int(dur * FPS)):
        pr.stdin.write(render_frame(fi, scenes, caps).tobytes())
    pr.stdin.close(); pr.wait()
    print("OK ->", out, flush=True)

def main():
    a = sys.argv
    part = int(a[a.index("--part") + 1])
    voice = a[a.index("--voice") + 1] if "--voice" in a else None
    segs = SEGS[part]
    if "--starts" in a:
        starts = [float(x) for x in a[a.index("--starts") + 1].split(",")]
        vend = float(a[a.index("--vend") + 1])
    elif voice:
        starts, vend = auto_starts(voice, segs)
    else:
        starts, tot = estimate_starts(segs); vend = tot
    print("débuts de segments (s, dans l'audio):", [round(x, 2) for x in starts], "fin parole:", round(vend, 2), flush=True)
    scenes, dur, info = build_scenes(part, starts, vend)
    setup(dur)
    wav = build_audio(part, starts, vend, dur, info)
    tag = "_voix" if voice else ""
    base = os.path.join(HERE, "partie%d" % part)
    render(base + "_sans_soustitres%s.mp4" % tag, wav, scenes, {}, dur, voice)
    import json
    with open(base + "_captions.json", "w", encoding="utf-8") as f:
        json.dump(captions_for(segs, starts, vend), f, ensure_ascii=False)
    caps = {(s, e, t): make_caption(t) for s, e, t in captions_for(segs, starts, vend)}
    render(base + "_avec_soustitres%s.mp4" % tag, wav, scenes, caps, dur, voice)
    os.remove(wav)

if __name__ == "__main__":
    main()
