#!/usr/bin/env python3
"""Assemble un spot 1080x1920 H.264 depuis des clips/images + voix + musique + SRT.
usage: assemble.py --out out.mp4 --voice voix.mp3 [--music m.mp3] [--srt s.srt] clip1 clip2 ...
Images : Ken Burns doux (zoom lent) ; vidéos : recadrées 9:16. Durée par plan : --dur (défaut 4s)."""
import argparse, subprocess, tempfile, os
a = argparse.ArgumentParser()
a.add_argument("--out", required=True); a.add_argument("--voice"); a.add_argument("--music")
a.add_argument("--srt"); a.add_argument("--dur", type=float, default=4.0)
a.add_argument("clips", nargs="+"); n = a.parse_args()
tmp = tempfile.mkdtemp(); parts = []
for i, c in enumerate(n.clips):
    c, _, d = c.partition("@"); dur = float(d) if d else n.dur
    o = f"{tmp}/p{i}.mp4"; vf = "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30,format=yuv420p"
    if c.lower().endswith((".jpg",".jpeg",".png",".webp")):
        fr = int(dur*30)
        vf = f"scale=2160:3840:force_original_aspect_ratio=increase,crop=2160:3840,zoompan=z='min(zoom+0.0008,1.12)':d={fr}:s=1080x1920:fps=30,format=yuv420p"
        cmd = ["ffmpeg","-y","-loglevel","error","-i",c,"-vf",vf,"-t",str(dur),"-c:v","libx264","-crf","17",o]
    else:
        cmd = ["ffmpeg","-y","-loglevel","error","-i",c,"-vf",vf,"-t",str(dur),"-an","-c:v","libx264","-crf","17",o]
    subprocess.run(cmd, check=True); parts.append(o)
lst = f"{tmp}/l.txt"; open(lst,"w").write("".join(f"file '{p}'\n" for p in parts))
cat = f"{tmp}/cat.mp4"
subprocess.run(["ffmpeg","-y","-loglevel","error","-f","concat","-safe","0","-i",lst,"-c","copy",cat],check=True)
cmd = ["ffmpeg","-y","-loglevel","error","-i",cat]; fa = []
if n.voice: cmd += ["-i", n.voice]
if n.music: cmd += ["-i", n.music]
vf = "null"
if n.srt: vf = f"subtitles={n.srt}:force_style='FontName=DejaVu Sans,Bold=1,FontSize=16,Alignment=2,MarginV=260,Outline=3,PrimaryColour=&HFFFFFF&'"
fc = f"[0:v]{vf}[v]"
if n.voice and n.music: fc += ";[2:a]volume=0.15[m];[1:a][m]amix=inputs=2:duration=first[a]"; am = "[a]"
elif n.voice: am = "1:a"
elif n.music: am = "1:a"
else: am = None
cmd += ["-filter_complex", fc, "-map","[v]"] + (["-map", am] if am else []) + ["-c:v","libx264","-crf","17","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-shortest","-movflags","+faststart",n.out]
subprocess.run(cmd, check=True); print("OK", n.out)
