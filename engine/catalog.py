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
