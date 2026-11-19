#!/usr/bin/env python3
"""(Générique) Pub B 'Prêt en 2 minutes' — tableau de missions fratrie. Lancer: python3 build_ad.py <dossier_produit> <variante> <dossier_modele_piper> (lit config_<variante>.json)"""
import subprocess, sys, wave, pathlib, textwrap
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json
HERE = pathlib.Path(sys.argv[1]).resolve(); VAR=sys.argv[2]; MODEL = pathlib.Path(sys.argv[3]); CFG=json.load(open(HERE/f"config_{VAR}.json"))
W, H = 1080, 1920; CREAM=(251,240,220); RED=(224,80,47); DARK=(60,40,35)
F = lambda w,s: ImageFont.truetype(f"/usr/share/fonts/opentype/inter/Inter-{w}.otf", s)
src = Image.open(HERE/"photos_reference"/CFG["src"]).convert("RGB")
page=src.crop(tuple(CFG["page"])); title=src.crop(tuple(CFG["title"])); top=src.crop(tuple(CFG["top"]))
SC=CFG["scenes"]
def wrap(d,t,f,w):
    out=[]
    for para in t.split("\n"):
        cur=""
        for wd in para.split():
            if d.textlength((cur+" "+wd).strip(),font=f)<=w: cur=(cur+" "+wd).strip()
            else: out.append(cur); cur=wd
        out.append(cur)
    return out
def card(img,w):
    im=img.resize((w,int(img.height*w/img.width)),Image.LANCZOS)
    sh=Image.new("RGBA",(im.width+80,im.height+80),(0,0,0,0)); ImageDraw.Draw(sh).rounded_rectangle((40,50,im.width+40,im.height+50),28,fill=(0,0,0,70))
    sh=sh.filter(ImageFilter.GaussianBlur(18)); m=Image.new("L",im.size,0); ImageDraw.Draw(m).rounded_rectangle((0,0,*im.size),28,fill=255)
    return sh,im,m
def frame(kind,text,i):
    c=Image.new("RGB",(W,H),CREAM); d=ImageDraw.Draw(c)
    d.ellipse((600,-250,1300,450),fill=(246,226,190)); d.ellipse((-300,1500,400,2200),fill=(246,226,190))
    big = kind in("hook","pb","cta")
    f=F("ExtraBold",82 if kind!="cta" and big else (66 if kind=="cta" else 62)); ls=wrap(d,text,f,900)
    y=150 if kind!="cta" else 1000
    if kind in ("pb",): y=380
    for l in ls:
        tw=d.textlength(l,font=f); d.text(((W-tw)/2,y),l,font=f,fill=RED if kind in("hook","cta") else DARK); y+=int(f.size*1.25)
    if kind=="pb":
        sh,im,m=card(page,760); x=(W-im.width)//2; c.paste(sh,(x-40,1040),sh); c.paste(im,(x,1100),m)
    if kind in("hook","page","page2"):
        sh,im,m=card(top if kind=="page2" else page,900 if kind=="page2" else (700 if kind=="hook" else 760)); x=(W-im.width)//2; yy=max(y+60,560) if kind!="hook" else y+80
        c.paste(sh,(x-40,yy-40),sh); c.paste(im,(x,yy),m)
    if kind=="info":
        sh,im,m=card(title,940); x=(W-im.width)//2; yy=y+80; c.paste(sh,(x-40,yy-40),sh); c.paste(im,(x,yy),m)
    if kind=="cta":
        sh,im,m=card(src,960); x=(W-im.width)//2; c.paste(sh,(x-40,140),sh); c.paste(im,(x,180),m)
    p=HERE/f"scenes/{VAR}_s{i}.png"; c.save(p); return p
from piper import PiperVoice
v=PiperVoice.load(str(MODEL/"fr_FR-siwis-medium.onnx"))
srt=[]; t=0.0; clips=[]; wavs=[]
for i,(sub,voice,kind) in enumerate(SC):
    wp=HERE/f"voix/{VAR}_s{i}.wav"
    with wave.open(str(wp),"wb") as wf: v.synthesize_wav(voice,wf)
    with wave.open(str(wp)) as r: dur=r.getnframes()/r.getframerate()
    sd=max(dur+0.5,2.5); frame(kind,sub.replace("\n"," ") if kind!="cta" else CFG["cta"],i)
    clips.append(f"{HERE/f'scenes/{VAR}_s{i}.png'}@{sd:.2f}"); wavs.append((wp,sd))
    def ts(x): return f"{int(x//3600):02}:{int(x%3600//60):02}:{int(x%60):02},{int(x*1000)%1000:03}"
    srt.append(f"{i+1}\n{ts(t+0.1)} --> {ts(t+sd-0.1)}\n"+"\n".join(textwrap.wrap(sub.replace('\n',' '),26))+"\n"); t+=sd
(HERE/f"sous_titres/{VAR}.srt").write_text("\n".join(srt),encoding="utf-8")
# piste voix alignée
inp=[]; fc=""
for k,(wp,sd) in enumerate(wavs): inp+=["-i",str(wp)]; fc+=f"[{k}:a]apad=whole_dur={sd:.2f},aresample=44100[a{k}];"
fc+="".join(f"[a{k}]" for k in range(len(wavs)))+f"concat=n={len(wavs)}:v=0:a=1[o]"
subprocess.run(["ffmpeg","-y","-loglevel","error",*inp,"-filter_complex",fc,"-map","[o]",str(HERE/f"voix/{VAR}_voix.wav")],check=True)
print("total",round(t,1),"s"); open(HERE/f"montage/clips_{VAR}.txt","w").write(" ".join(clips))
