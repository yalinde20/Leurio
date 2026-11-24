/*
 * Chargé avant chaque fichier de test (angular.json, `setupFiles`). Aucun test n'appelle un service réel : toute requête vers
 * une adresse http(s) externe (tuiles OpenStreetMap comprises) échoue bruyamment. Les adresses locales (assets) gardent leur
 * comportement d'origine. Un test qui veut observer les requêtes installe son propre double de `fetch`.
 */
const fetchOrigine = globalThis.fetch;

beforeEach(() => {
  vi.stubGlobal('fetch', (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof entree === 'string' ? entree : entree instanceof URL ? entree.href : entree.url;
    if (/^https?:\/\//i.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/i.test(url)) {
      throw new Error(`Appel réseau réel dans un test : ${url}`);
    }
    return fetchOrigine(entree, init);
  });
});
