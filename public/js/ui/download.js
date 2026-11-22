// Téléchargement local d'un fichier (Blob) — aucune requête réseau.
// Retourne {ok:true} ou {ok:false, error} : l'appelant ne doit JAMAIS supposer que ça a marché.
// Limite honnête : le navigateur ne dit pas si l'utilisateur a réellement enregistré le fichier ;
// on sait seulement que le téléchargement a bien été déclenché sans erreur.
export function downloadFile(filename, content, mime) {
  try {
    const bom = mime.startsWith('text/csv') ? '﻿' : ''; // BOM UTF-8 : Excel affiche correctement les accents
    const blob = new Blob([bom, content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
