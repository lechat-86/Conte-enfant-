"""Types de messages et métiers cibles."""
MESSAGE_TYPES = {
 "accueil":   dict(label="Message d'accueil (pré-décroché)", max_words=45,
   guide="Accueil bref et chaleureux : nom de l'entreprise, formule de politesse, invitation à patienter. Pas d'information superflue."),
 "horaires":  dict(label="Messagerie hors horaires / répondeur", max_words=70,
   guide="Dit que l'entreprise est fermée, rappelle les horaires fournis, invite à laisser nom, numéro et motif, promet de rappeler."),
 "attente":   dict(label="Message d'attente", max_words=90,
   guide="Remercie de patienter, présente en 2 ou 3 phrases les services fournis, rassure sur la prise en charge. Sans promesse non fournie."),
 "fermeture": dict(label="Fermeture exceptionnelle / congés", max_words=60,
   guide="Annonce une fermeture temporaire en reprenant exactement les dates ou informations fournies, indique comment laisser un message."),
}
VOICES = {"f": "voix féminine", "m": "voix masculine"}
PACK = ["accueil", "horaires", "attente"]
SINGLE_OPTIONS = [(f"{k}_{v}", f"{MESSAGE_TYPES[k]['label']} - {VOICES[v]}") for k in MESSAGE_TYPES for v in VOICES]

# Métiers (pages SEO) : exemples rédigés à la main, à adapter par le client.
METIERS = [
 dict(slug="artisan-plombier", nom="plombier / artisan du bâtiment",
  accueil="Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant, nous allons prendre votre appel.",
  horaires="Dupont Plomberie est actuellement fermée. Nos horaires sont du lundi au vendredi, de 8 heures à 18 heures. Laissez-nous votre nom, votre numéro et la nature de votre demande, nous vous rappelons dès que possible."),
 dict(slug="restaurant", nom="restaurant",
  accueil="Bonjour, vous êtes en ligne avec le restaurant Chez Marcel. Un instant, nous vous répondons dans quelques secondes.",
  horaires="Le restaurant Chez Marcel est ouvert du mardi au samedi, de midi à 14 heures et de 19 heures à 22 heures. Laissez-nous un message avec votre nom et votre numéro pour une réservation, nous vous rappelons."),
 dict(slug="coiffeur", nom="salon de coiffure",
  accueil="Bonjour, bienvenue au salon Atelier Léa. Merci de patienter, nous prenons votre appel dans un instant.",
  horaires="Le salon Atelier Léa est fermé pour le moment. Nous vous accueillons du mardi au samedi, de 9 heures à 18 heures. Laissez votre nom et votre numéro, nous vous rappellerons pour fixer un rendez-vous."),
 dict(slug="cabinet-medical", nom="cabinet paramédical / kinésithérapeute",
  accueil="Bonjour, vous êtes bien au cabinet de kinésithérapie Martin. Merci de patienter, nous allons répondre à votre appel.",
  horaires="Le cabinet est actuellement fermé. En cas d'urgence médicale, composez le 15. Sinon, laissez votre nom, votre numéro et la raison de votre appel, nous vous rappellerons."),
 dict(slug="agence-immobiliere", nom="agence immobilière",
  accueil="Bonjour, agence Horizon Immobilier. Merci de patienter, un conseiller va vous répondre.",
  horaires="L'agence Horizon Immobilier est fermée. Nous sommes ouverts du lundi au samedi, de 9 heures à 19 heures. Laissez-nous votre nom, votre numéro et votre projet, un conseiller vous rappelle."),
 dict(slug="garage-auto", nom="garage automobile",
  accueil="Bonjour, garage Durand Automobiles. Merci de patienter, nous prenons votre appel.",
  horaires="Le garage Durand Automobiles est fermé. Nous vous répondons du lundi au vendredi, de 8 heures à 18 heures. Laissez-nous votre nom, votre numéro et l'immatriculation du véhicule, nous vous rappelons."),
 dict(slug="cabinet-comptable", nom="cabinet comptable / conseil",
  accueil="Bonjour, cabinet Renaud Conseil. Merci de patienter quelques instants, un collaborateur va vous répondre.",
  horaires="Le cabinet Renaud Conseil est fermé. Nos horaires sont du lundi au vendredi, de 9 heures à 17 heures. Laissez votre nom, votre numéro et l'objet de votre appel, nous vous rappelons rapidement."),
 dict(slug="association", nom="association",
  accueil="Bonjour, vous êtes en relation avec l'association Les Amis du Quartier. Merci de patienter.",
  horaires="L'association Les Amis du Quartier est fermée. Laissez-nous un message avec votre nom et votre numéro, un bénévole vous rappellera dès que possible."),
 dict(slug="hotel-gite", nom="hôtel / gîte / chambre d'hôtes",
  accueil="Bonjour, bienvenue à la Maison des Pins. Merci de patienter un instant, nous vous répondons tout de suite.",
  horaires="La réception de la Maison des Pins est fermée. Laissez votre nom, votre numéro et vos dates de séjour, nous vous rappelons. Pour une réservation, rendez-vous sur notre site."),
 dict(slug="commerce", nom="commerce de proximité",
  accueil="Bonjour, vous êtes bien à la boutique Les Fleurs de Claire. Merci de patienter, nous vous répondons dans un instant.",
  horaires="La boutique Les Fleurs de Claire est fermée. Nous vous accueillons du mardi au samedi, de 9 heures à 19 heures. Laissez votre message, nous vous rappellerons."),
]

# Exemples audio du site (entreprise fictive, clairement indiquée comme exemple). Générés par tools/make_samples.py.
SAMPLES = [
 dict(key="accueil_f", titre="Message d'accueil", voix="f", entreprise="Garage Durand",
      texte="Bonjour, vous êtes bien au garage Durand Automobiles. Merci de patienter quelques instants, nous allons prendre votre appel."),
 dict(key="horaires_m", titre="Répondeur hors horaires", voix="m", entreprise="Cabinet Renaud",
      texte="Bonjour, vous êtes bien au cabinet Renaud Conseil. Nos bureaux sont fermés actuellement. Nous vous accueillons du lundi au vendredi, de 9 heures à 17 heures. Laissez-nous votre nom, votre numéro et l'objet de votre appel, nous vous rappelons rapidement."),
 dict(key="attente_f", titre="Message d'attente", voix="f", entreprise="Institut Clara",
      texte="Merci de patienter, votre appel est important pour nous. L'institut Clara vous accueille sur rendez-vous pour vos soins du visage et du corps. Une conseillère va vous répondre dans quelques instants."),
]

FAQ = [
 ("Comment ça marche ?", "Vous payez en ligne, vous indiquez le nom de votre entreprise, la voix souhaitée et les informations à citer (horaires, services, dates). Nous rédigeons le texte, l'enregistrons et vous envoyons les fichiers par e-mail, en principe en moins d'une heure."),
 ("Les voix sont-elles de vraies personnes ?", "Non : ce sont des voix de synthèse en français, très naturelles, créées par une technologie d'intelligence artificielle. Nous le disons ouvertement. Écoutez les exemples sur cette page pour juger par vous-même."),
 ("Mon téléphone acceptera-t-il les fichiers ?", "Vous recevez chaque message en MP3 et en WAV 8 kHz mono 16 bits, le format le plus souvent demandé par les standards téléphoniques. Chaque système a ses réglages : en cas de doute, écrivez-nous avec le nom de votre opérateur ou de votre standard, nous vous aidons."),
 ("Et si une erreur s'est glissée (horaire, nom) ?", "Relisez le texte fourni avec les fichiers. Une modification de texte est incluse : répondez simplement à l'e-mail. Si le résultat ne vous convient pas, nous vous remboursons."),
 ("Puis-je utiliser les fichiers longtemps ?", "Oui, sans limite de durée, sur vos lignes téléphoniques et votre site. La revente des fichiers est interdite."),
 ("Les prix incluent-ils la TVA ?", "Les prix sont affichés en euros. Selon notre statut, la TVA peut ne pas s'appliquer (art. 293 B du CGI) ; la mention figure sur votre facture."),
 ("Que faites-vous de mes données ?", "Uniquement ce qui sert à créer et livrer votre commande, avec des prestataires techniques identifiés. Détails dans la politique de confidentialité."),
]

GUIDES = [
 dict(slug="guide-message-accueil-telephonique", titre="Message d'accueil téléphonique professionnel : mode d'emploi",
  desc="Que dire dans un message d'accueil téléphonique, quelle durée, quelles erreurs éviter. Exemples prêts à adapter.",
  html="""<p>Le message d'accueil (ou <strong>pré-décroché</strong>) est la première chose qu'un appelant entend. Il rassure : l'appel a bien abouti, quelqu'un va répondre.</p>
<h2>La structure en 4 temps</h2><ol><li><strong>Bonjour</strong> : une formule de politesse, tout de suite.</li><li><strong>Le nom de l'entreprise</strong> : l'appelant vérifie qu'il a le bon numéro.</li><li><strong>Une invitation à patienter</strong> : « merci de patienter quelques instants ».</li><li><strong>Une seule information utile</strong>, si nécessaire (par exemple une urgence : le numéro à composer).</li></ol>
<h2>Durée et ton</h2><p>Visez 8 à 15 secondes, soit 20 à 40 mots. Phrases courtes, ton chaleureux, rythme posé. Évitez l'humour dans les métiers de santé et de droit.</p>
<h2>Les erreurs fréquentes</h2><ul><li>Un message trop long : les appelants s'impatientent.</li><li>Des horaires périmés après un changement ou des congés.</li><li>Un numéro de téléphone dicté à l'oral dans le message d'accueil : il est difficile à retenir.</li><li>Une qualité sonore médiocre (bruit de fond, voix étouffée).</li></ul>
<h2>Exemple à adapter</h2><blockquote>Bonjour, vous êtes bien chez Dupont Plomberie. Merci de patienter un instant, nous allons prendre votre appel.</blockquote>"""),
 dict(slug="guide-message-repondeur-hors-horaires", titre="Message de répondeur hors horaires : 5 exemples et conseils",
  desc="Comment écrire un message de répondeur quand vous êtes fermé : horaires, demande de rappel, urgences. Exemples.",
  html="""<p>Quand personne ne peut répondre, le répondeur doit faire trois choses : <strong>expliquer</strong> pourquoi, <strong>informer</strong> (horaires), <strong>inviter</strong> à laisser un message.</p>
<h2>Ce qu'il faut dire</h2><ul><li>Le nom de l'entreprise.</li><li>Que vous êtes actuellement indisponible ou fermé.</li><li>Vos horaires d'ouverture, une seule fois, clairement.</li><li>Quoi laisser : nom, numéro, motif.</li><li>Quand vous rappelez (seulement si vous pouvez le tenir).</li></ul>
<h2>Exemples</h2><blockquote>Le garage Durand est actuellement fermé. Nous sommes ouverts du lundi au vendredi, de 8 heures à 18 heures. Laissez-nous votre nom, votre numéro et l'immatriculation de votre véhicule, nous vous rappelons.</blockquote><blockquote>Bonjour, vous êtes bien au cabinet de kinésithérapie Martin. En cas d'urgence médicale, composez le 15. Sinon, laissez votre nom et votre numéro, nous vous rappellerons.</blockquote>
<h2>Pensez à le changer</h2><p>Un répondeur qui annonce des horaires faux fait perdre des clients. Prévoyez un message spécifique pour les congés et les fermetures exceptionnelles.</p>"""),
 dict(slug="guide-message-attente-telephonique", titre="Message d'attente téléphonique : durée, contenu, exemples",
  desc="Comment rédiger un message d'attente efficace : durée, contenu, ton. Exemples pour TPE et artisans.",
  html="""<p>Le message d'attente occupe l'appelant pendant qu'il patiente. Bien fait, il informe sans lasser.</p>
<h2>Contenu</h2><ul><li>Remercier de patienter.</li><li>Présenter en deux ou trois phrases vos principaux services.</li><li>Rassurer : un interlocuteur va répondre.</li></ul>
<h2>Durée</h2><p>Entre 20 et 40 secondes par message, répété avec une courte pause. Au-delà, changez de message : une boucle qui tourne mal agace.</p>
<h2>À éviter</h2><ul><li>Promettre un délai que vous ne pouvez pas tenir (« réponse dans 30 secondes »).</li><li>Les promotions éphémères qui deviennent fausses.</li><li>Les informations complexes (adresses, longs numéros).</li></ul>
<blockquote>Merci de patienter, votre appel est important pour nous. L'institut Clara vous accueille sur rendez-vous pour vos soins du visage et du corps. Une conseillère va vous répondre dans quelques instants.</blockquote>"""),
 dict(slug="guide-format-audio-standard-telephonique", titre="Quel format audio pour un standard téléphonique ? (WAV 8 kHz, MP3)",
  desc="WAV 8 kHz mono 16 bits, MP3 : quel fichier utiliser pour le message d'accueil de votre standard, box ou application.",
  html="""<p>Beaucoup de standards téléphoniques acceptent un WAV <strong>8 kHz, mono, 16 bits</strong> (qualité téléphonique). D'autres, notamment les services en ligne modernes, acceptent le MP3. Les exigences varient : consultez la documentation de votre système.</p>
<h2>Que choisir ?</h2><ul><li><strong>WAV 8 kHz mono 16 bits</strong> : le plus souvent demandé par les standards et les serveurs de téléphonie.</li><li><strong>MP3</strong> : pratique pour les applications, sites web et services cloud.</li></ul>
<h2>Conseils pratiques</h2><ul><li>Gardez toujours une copie de vos fichiers.</li><li>Testez l'appel depuis un autre téléphone après l'installation.</li><li>Si votre système refuse un fichier, indiquez-nous son nom : nous pouvons fournir un autre format.</li></ul>"""),
]
