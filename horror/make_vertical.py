#!/usr/bin/env python3
"""
Version verticale 9:16 (1080x1920) pour YouTube Shorts / TikTok / Reels.
Vidéo 16:9 au centre, fond flou assombri, titre en haut, gros sous-titres en bas.

  python3 make_vertical.py --part 1            # partie1_sans_soustitres_voix.mp4 -> partie1_short_vertical.mp4
  python3 make_vertical.py --part 2 --nom-sous-titres   (utilise partie2_captions.json écrit par make_parts23.py)
  python3 make_vertical.py --in video.mp4 --out sortie.mp4 --part 1
"""
import json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
TITLES = {1: "L'HÉRITAGE", 2: "LE SOUS-SOL", 3: "ELLE"}

def ts(t):
    cs = int(round(t * 100))
    return "%d:%02d:%02d.%02d" % (cs // 360000, cs // 6000 % 60, cs // 100 % 60, cs % 100)

def get_captions(part):
    if part == 1:
        sys.argv = sys.argv[:1]
        from make_part1 import NARRATION
        return list(NARRATION)
    with open(os.path.join(HERE, "partie%d_captions.json" % part), encoding="utf-8") as f:
        return [tuple(x) for x in json.load(f)]

def make_ass(caps, part, dur, path):
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Sub,DejaVu Serif,60,&H00E6EEF2,&H00FFFFFF,&H00000000,&H80000000,0,1,0,0,100,100,0,0,1,5,2,8,80,80,1290,1
Style: Title,DejaVu Serif,74,&H001010A0,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,8,60,60,300,1
Style: Part,DejaVu Sans,44,&H00B4B4B4,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,6,0,1,3,0,8,60,60,410,1
Style: Brand,DejaVu Sans,34,&H00808080,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,2,0,1,2,0,2,60,60,150,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""
    lines = [head]
    lines.append("Dialogue: 0,%s,%s,Title,,0,0,0,,LA MAISON DES MURMURES" % (ts(0), ts(dur)))
    lines.append("Dialogue: 0,%s,%s,Part,,0,0,0,,PARTIE %d/3  —  %s" % (ts(0), ts(dur), part, TITLES[part]))
    lines.append("Dialogue: 0,%s,%s,Brand,,0,0,0,,⚠ histoire d'horreur%s" % (ts(0), ts(dur), " — screamer à la fin" if part == 3 else ""))
    for a, b, text in caps:
        text = text.replace("\n", " ")
        lines.append("Dialogue: 1,%s,%s,Sub,,0,0,0,,{\\fad(250,250)}%s" % (ts(a), ts(b), text))
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

def main():
    a = sys.argv
    part = int(a[a.index("--part") + 1])
    src = a[a.index("--in") + 1] if "--in" in a else None
    if not src:
        for cand in ("partie%d_sans_soustitres_voix.mp4", "partie%d_sans_soustitres.mp4"):
            p = os.path.join(HERE, cand % part)
            if os.path.exists(p):
                src = p; break
    out = a[a.index("--out") + 1] if "--out" in a else os.path.join(HERE, "partie%d_short_vertical.mp4" % part)
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", src],
                               capture_output=True, text=True).stdout)
    caps = get_captions(part)
    ass = os.path.join(HERE, "tmp_vertical.ass")
    make_ass(caps, part, dur, ass)
    fg = ("[0:v]split=2[a][b];"
          "[a]scale=270:480:force_original_aspect_ratio=increase,crop=270:480,gblur=sigma=5,"
          "eq=brightness=-0.22:saturation=0.9,scale=1080:1920:flags=bicubic[bg];"
          "[b]scale=1080:-2:flags=lanczos[fg];"
          "[bg][fg]overlay=0:(H-h)/2-90[v0];"
          "[v0]ass=%s:fontsdir=/usr/share/fonts/truetype/dejavu[v]" % ass)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-filter_complex", fg, "-map", "[v]", "-map", "0:a?",
           "-c:v", "libx264", "-preset", "medium", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "24",
           "-c:a", "copy", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    os.remove(ass)
    print("OK ->", out)

if __name__ == "__main__":
    main()
