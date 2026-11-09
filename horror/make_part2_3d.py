#!/usr/bin/env python3
"""
PARTIE 2 en vraie 3D (three.js + Chromium headless) : escalier, cave en briques, lampe torche, ombres,
photos accrochées, journal, boîte à musique, la Dame modélisée. Le calage suit l'audio ElevenLabs.

  python3 make_part2_3d.py                       # brouillon sans voix (durée estimée)
  python3 make_part2_3d.py --voice voix2.mp3     # calé sur votre voix
Options : --workers 3 (processus de rendu 3D)  --reuse (réutilise les images 3D déjà rendues)  --only clean|subs
"""
import json, os, subprocess, sys, time
import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ARGV = sys.argv[:]
sys.argv = sys.argv[:1]
import make_parts23 as m
import make_video as mv
from make_parts23 import DELAY, SEGS

FPS = 24
FW, FH = 1920, 1080

def flag(name, default=None):
    return ARGV[ARGV.index(name) + 1] if name in ARGV else default

def run_3d(f0, f1, anchors, workers, outdir):
    os.makedirs(outdir, exist_ok=True)
    env = dict(os.environ)
    env["NODE_PATH"] = "/tmp/t3d/node_modules:" + subprocess.run(["npm", "root", "-g"], capture_output=True, text=True).stdout.strip()
    procs = []
    for k in range(workers):
        cmd = ["node", os.path.join(HERE, "3d", "render_frames.js"), outdir, str(f0 + k), str(f1), str(workers),
               json.dumps(anchors), str(FW), str(FH), str(FPS)]
        procs.append(subprocess.Popen(cmd, env=env))
    t = time.time()
    while any(p.poll() is None for p in procs):
        n = len([x for x in os.listdir(outdir) if x.endswith(".jpg")])
        print("  rendu 3D : %d/%d images (%.0fs)" % (n, f1 - f0, time.time() - t), flush=True)
        time.sleep(30)
    if any(p.returncode for p in procs):
        raise SystemExit("rendu 3D en échec")

def card(lines):
    return mv.card_img(lines).resize((FW, FH), Image.LANCZOS)

def build_cards(part_title_lines, end_lines):
    return card(part_title_lines), card(end_lines)

def main():
    voice = flag("--voice")
    workers = int(flag("--workers", "3"))
    only = flag("--only", "both")
    segs = SEGS[2]
    if voice:
        starts, vend = m.auto_starts(voice, segs)
    else:
        starts, vend = m.estimate_starts(segs)
    a = lambda i: starts[i] + DELAY
    ve = vend + DELAY
    anchors = dict(t0=DELAY, a2=a(2), a3=a(3), a4=a(4), a5=a(5), a6=a(6), a7=a(7), a8=a(8), ve=ve)
    t3d_end = ve + 0.8
    dur = t3d_end + 4.0
    f0, f1 = int(DELAY * FPS), int(t3d_end * FPS)
    print("débuts de segments:", [round(x, 2) for x in starts], "fin parole:", round(vend, 2), "durée vidéo:", round(dur, 2), flush=True)
    framedir = os.path.join(HERE, "3d", "frames")
    if "--reuse" not in ARGV:
        if os.path.isdir(framedir):
            for f in os.listdir(framedir):
                os.remove(os.path.join(framedir, f))
        run_3d(f0, f1, anchors, workers, framedir)

    mv.set_resolution(FW, FH)
    m.setup(dur)
    wav = m.build_audio(2, starts, vend, dur, None)
    title_img, end_img = build_cards(
        [("PARTIE 2", 30, (140, 140, 140), False, True), ("LE SOUS-SOL", 84, m.RED, True, False),
         ("LA MAISON DES MURMURES", 22, (120, 120, 120), False, True)],
        [("À SUIVRE…", 70, m.RED, True, False)])
    caps_list = m.captions_for(segs, starts, vend)
    with open(os.path.join(HERE, "partie2_captions.json"), "w", encoding="utf-8") as f:
        json.dump(caps_list, f, ensure_ascii=False)
    caps = {(s, e, t): mv.make_caption(t) for s, e, t in caps_list}
    vig3d = mv.vignette(0.55)
    vigc = mv.vignette(0.8)
    tag = ("_voix" if voice else "")

    def frame(fi, with_subs):
        t = fi / FPS
        if DELAY <= t < t3d_end:
            fn = os.path.join(framedir, "f_%05d.jpg" % fi)
            arr = np.asarray(Image.open(fn).convert("RGB"), np.float32)
            # léger bloom sur les hautes lumières (yeux, flamme, lampe)
            hi = np.clip(arr - 150, 0, None)
            small = Image.fromarray(hi.clip(0, 255).astype(np.uint8)).resize((FW // 4, FH // 4), Image.BILINEAR).filter(ImageFilter.GaussianBlur(5))
            arr += 0.9 * np.asarray(small.resize((FW, FH), Image.BICUBIC), np.float32)
            arr = arr * vig3d + mv.NOISE[fi % 8][..., None] * 6.5
            # aberration chromatique très légère
            arr[..., 0] = np.roll(arr[..., 0], 1, axis=1); arr[..., 2] = np.roll(arr[..., 2], -1, axis=1)
            fade = min(1.0, (t - DELAY) / 0.9, (t3d_end - t) / 0.35)
        else:
            img = title_img if t < DELAY else end_img
            t0_, t1_ = (0.0, DELAY) if t < DELAY else (t3d_end, dur)
            z = 1.0 + 0.07 * (t - t0_) / (t1_ - t0_)
            bw, bh = FW / z, FH / z
            box = ((FW - bw) / 2, (FH - bh) / 2, (FW + bw) / 2, (FH + bh) / 2)
            arr = np.asarray(img.resize((FW, FH), Image.BICUBIC, box=box), np.float32)
            arr = arr * vigc * (1 + 0.04 * np.sin(t * 13)) + mv.NOISE[fi % 8][..., None] * 5
            fade = min(1.0, (t - t0_) / (1.0 if t < DELAY else 0.5), (t1_ - t) / (0.7 if t < DELAY else 1.0e9))
        if with_subs:
            for (c0, c1, text), (col, al) in caps.items():
                if c0 <= t < c1:
                    f_ = min(1, (t - c0) / 0.3, (c1 - t) / 0.3)
                    ch = col.shape[0]
                    arr[FH - ch:] = arr[FH - ch:] * (1 - al * f_) + col * (al * f_)
        return (arr * max(fade, 0.0)).clip(0, 255).astype(np.uint8)

    def encode(out, with_subs):
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (FW, FH),
               "-r", str(FPS), "-i", "-", "-i", wav]
        if voice:
            d = int(DELAY * 1000)
            cmd += ["-i", voice, "-filter_complex",
                    "[1:a]volume=0.55[a];[2:a]adelay=%d|%d[v];[a][v]amix=inputs=2:normalize=0:duration=longest[o]" % (d, d),
                    "-map", "0:v", "-map", "[o]"]
        cmd += ["-t", "%.3f" % dur, "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-maxrate", "6000k", "-bufsize", "12000k",
                "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]
        pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for fi in range(int(dur * FPS)):
            pr.stdin.write(frame(fi, with_subs).tobytes())
        pr.stdin.close(); pr.wait()
        print("OK ->", out, flush=True)

    base = os.path.join(HERE, "partie2_3d")
    if only in ("both", "clean"):
        encode(base + "_sans_soustitres%s.mp4" % tag, False)
    if only in ("both", "subs"):
        encode(base + "_avec_soustitres%s.mp4" % tag, True)
    os.remove(wav)

if __name__ == "__main__":
    main()
