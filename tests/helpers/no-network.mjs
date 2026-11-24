// Préchargé (--import) dans les processus enfants des tests : toute requête réseau échoue bruyamment.
globalThis.fetch = async (url) => {
  throw new Error(`REQUETE_REELLE_INTERDITE ${String(url)}`);
};
