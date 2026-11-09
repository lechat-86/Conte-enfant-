# La Maison des Murmures — Partie 1 : L'héritage
Texte de la voix off (≈ 146 mots, ≈ 60 s de voix, calé sur la vidéo de 1 min 10).

## Texte à coller dans ElevenLabs (avec pauses)

```
Léa n'avait pas revu la maison de sa grand-mère depuis dix ans. Ce soir, le notaire lui avait enfin remis les clés.
<break time="1.0s" />
La maison se dressait dans le brouillard. Le vent faisait gémir les arbres morts. Toutes les fenêtres étaient noires… sauf une.
<break time="1.5s" />
Dans le couloir, une odeur de poussière… et autre chose. Quelque chose de sucré, comme une fleur qu'on aurait laissée pourrir.
<break time="0.8s" />
Au fond, la porte de la cave était entrouverte. Sa grand-mère la gardait verrouillée. Une lueur rouge filtrait dessous.
<break time="0.8s" />
Puis elle l'entendit. Un chuchotement… qui prononçait son prénom.
<break time="1.5s" />
Elle recula dans le salon. Au fond, un grand miroir ancien lui renvoyait son regard. Elle leva la main. Son reflet aussi.
<break time="1.0s" />
Elle baissa la main. Pas lui. Le reflet resta immobile… puis il sourit. D'un sourire beaucoup trop large.
<break time="1.5s" />
Ses yeux devinrent noirs. Il murmura : « Bienvenue à la maison, Léa. »
```

## Texte brut (sans balises de pause)

Léa n'avait pas revu la maison de sa grand-mère depuis dix ans. Ce soir, le notaire lui avait enfin remis les clés.

La maison se dressait dans le brouillard. Le vent faisait gémir les arbres morts. Toutes les fenêtres étaient noires… sauf une.

Dans le couloir, une odeur de poussière… et autre chose. Quelque chose de sucré, comme une fleur qu'on aurait laissée pourrir.

Au fond, la porte de la cave était entrouverte. Sa grand-mère la gardait verrouillée. Une lueur rouge filtrait dessous.

Puis elle l'entendit. Un chuchotement… qui prononçait son prénom.

Elle recula dans le salon. Au fond, un grand miroir ancien lui renvoyait son regard. Elle leva la main. Son reflet aussi.

Elle baissa la main. Pas lui. Le reflet resta immobile… puis il sourit. D'un sourire beaucoup trop large.

Ses yeux devinrent noirs. Il murmura : « Bienvenue à la maison, Léa. »

## Calage sur la vidéo (la voix démarre à 0:05)

| Temps vidéo | Ce qu'on voit | Phrase |
|---|---|---|
| 0:05 – 0:13 | La maison dans la nuit | « Léa n'avait pas revu… les clés. » |
| 0:13 – 0:22 | Approche, une fenêtre éclairée, une silhouette y apparaît à 0:19 | « La maison se dressait… sauf une. » |
| 0:22 – 0:30 | Le couloir | « Dans le couloir… pourrir. » |
| 0:30 – 0:37 | Une ombre au fond du couloir | « Au fond, la porte… dessous. » |
| 0:37 – 0:42 | L'ombre s'approche | « Puis elle l'entendit… prénom. » |
| 0:43 – 0:52 | Le miroir | « Elle recula… Son reflet aussi. » |
| 0:52 – 1:00 | Le reflet sourit | « Elle baissa la main… trop large. » |
| 1:00 – 1:06 | Yeux noirs, mains sur la vitre | « Ses yeux devinrent noirs… Léa. » |
| 1:06 – 1:10 | « À SUIVRE… » | (silence) |

## Réglages ElevenLabs conseillés
- Modèle : **Eleven Multilingual v2** (les balises `<break>` y fonctionnent).
- Voix : grave, posée, féminine ou masculine « narrateur / conteur ».
- Stability ≈ 40–50 %, Similarity ≈ 75 %, Style ≈ 20–30 %, vitesse 0.9–1.0.
- Le texte est écrit pour ≈ 2,5 mots/s ; si votre audio dure plus de 62 s, ralentissez moins ou supprimez une pause.

## Ajouter la voix à la vidéo
Deux fichiers sont fournis sans voix : `partie1_sans_soustitres.mp4` (à utiliser pour votre montage) et
`partie1_avec_soustitres.mp4`. Pour mixer automatiquement votre voix à 0:05 :

```
python3 horror/make_part1.py --voice ma_voix.mp3 --voice-delay 5
```
