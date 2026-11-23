// Édition de l'application : « complète » (poste de travail local) ou « démo publique » (hébergement statique).
// L'édition publique est activée UNIQUEMENT par l'attribut <html data-edition="public-demo"> écrit par le script de
// build (scripts/build-demo-public.mjs). Sans cet attribut (serveur local, tests unitaires), tout reste inchangé.
export const isPublicDemo = () => typeof document !== 'undefined' && document.documentElement?.dataset?.edition === 'public-demo';
